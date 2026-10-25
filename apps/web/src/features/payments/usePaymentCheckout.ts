import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ApiError, apiFetch } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { paymentRequest, type Payment, type PaymentConfig, type Profile } from './api';
import { connectWallet, signPayment } from './wallet';
import { formatXlm } from './amount';

export function usePaymentCheckout() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const generation = useRef(0);
  const actor = useRef<string | undefined>(undefined);
  actor.current = session?.user.id;
  const token = session?.access_token;

  const refreshConfiguration = useCallback(async () => {
    try { setConfig(await apiFetch<PaymentConfig>('/api/payments/config')); }
    catch { setConfig({ ready: false, network: 'testnet', message: 'Payment connection is unavailable. Try checking again in a moment.' }); }
  }, []);

  useEffect(() => {
    let alive = true;
    void refreshConfiguration();
    if (!supabase) { setRestoring(false); return () => { alive = false; }; }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) { setSession(next); setRestoring(false); }
    });
    supabase.auth.getSession().then(({ data: current }) => {
      if (alive) { setSession(current.session); setRestoring(false); }
    }).catch(() => { if (alive) setRestoring(false); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [refreshConfiguration]);

  useEffect(() => {
    let alive = true;
    generation.current++;
    setProfile(null); setPayment(null); setLoaded(false); setWallet(''); setError(''); setNotice('');
    if (!token) return () => { alive = false; };
    (async () => {
      try {
        const me = await apiFetch<{ profile: Profile }>('/api/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!alive) return;
        setProfile(me.profile);
        if (me.profile.role === 'customer') {
          const current = await paymentRequest(token);
          if (alive) { setPayment(current.payment); setLoaded(true); }
        } else { setLoaded(true); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load your account. Please try again.');
        if (alive && e instanceof ApiError && e.status === 401) await supabase?.auth.signOut({ scope: 'local' });
      }
    })();
    return () => { alive = false; };
  }, [token, reload]);

  useEffect(() => {
    if (!token || payment?.status !== 'pending') return;
    let stopped = false;
    let remaining = 6;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const result = await paymentRequest(token, `/${payment.id}/check`, {});
        if (stopped) return;
        setPayment(result.payment);
        if (result.payment?.status !== 'pending') return;
      } catch { /* Manual recovery remains available; polling never replaces a payment. */ }
      if (!stopped && --remaining > 0) timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [token, payment?.id, payment?.status]);

  async function run(label: string, action: (save: (next: Payment | null) => void, current: () => boolean) => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    const at = generation.current;
    const owner = actor.current;
    const current = () => generation.current === at && actor.current === owner;
    const save = (next: Payment | null) => { if (current()) setPayment(next); };
    try { await action(save, current); }
    catch (e) {
      if (current()) {
        setError(e instanceof Error ? e.message : 'The request did not finish. Check your saved payment before trying again.');
        if (token && profile?.role === 'customer') {
          try { const result = await paymentRequest(token); if (current()) { save(result.payment); setLoaded(true); } } catch { /* preserve recovery record */ }
        }
        if (e instanceof ApiError && e.status === 401) await supabase?.auth.signOut({ scope: 'local' });
      }
    } finally { lock.current = false; setBusy(''); }
  }

  return {
    session, restoring, profile, config, payment, loaded, wallet, amount, setAmount, busy, error, notice,
    authConfigured: !!supabase,
    retryAccount: () => { if (!lock.current) setReload(value => value + 1); },
    refreshConfiguration: () => run('Checking connection…', async () => { await refreshConfiguration(); }),
    login: (email: string, password: string) => run('Signing in…', async () => {
      if (!supabase) throw new Error('Sign-in is not configured. Check the browser Supabase settings.');
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw new Error('Unable to sign in. Check your demo email and password and try again.');
    }),
    signOut: () => run('Signing out…', async () => {
      const result = await supabase!.auth.signOut({ scope: 'local' });
      if (result.error) throw new Error('Could not sign out. Please try again.');
      setAmount('1');
    }),
    connect: () => run('Connecting Freighter…', async (_save, current) => {
      const address = await connectWallet();
      if (current()) setWallet(address);
    }),
    prepare: () => run('Preparing payment…', async save => {
      if (!token) return;
      save((await paymentRequest(token, '/prepare', { payer: wallet, amountXlm: amount.trim() })).payment);
    }),
    sign: () => run('Approve in Freighter…', async (save, current) => {
      if (!token || !payment?.xdr) throw new Error('Reload your saved payment before signing.');
      const signedXdr = await signPayment(payment.xdr, payment.payer);
      if (!current()) return;
      setBusy('Submitting through Paiflow…');
      save((await paymentRequest(token, `/${payment.id}/submit`, { signedXdr })).payment);
    }),
    check: () => run('Checking payment…', async (save, current) => {
      if (!token || !payment) return;
      const result = await paymentRequest(token, `/${payment.id}/check`, {});
      save(result.payment);
      if (current() && result.payment && !['paid', 'failed', 'expired'].includes(result.payment.status)) setNotice('Still awaiting confirmation. Your original payment is saved; no replacement charge was created.');
    }),
    retryOriginal: () => run('Retrying saved transaction…', async (save, current) => {
      if (!token || !payment) return;
      save((await paymentRequest(token, `/${payment.id}/retry`, {})).payment);
      if (current()) setNotice('Retried the exact saved transaction. No new payment was prepared.');
    }),
    newPayment: () => run('Opening new payment…', async (save, current) => {
      if (!token || !payment) return;
      await paymentRequest(token, `/${payment.id}/new`, {});
      if (current()) { setAmount(formatXlm(payment.total)); setWallet(''); save(null); }
    }),
  };
}
