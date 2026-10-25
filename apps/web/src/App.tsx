import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import wordmark from '../../../assets/branding/Bayanihan Logo.png';
import symbol from '../../../assets/branding/4.svg';
import { ApiError, apiFetch } from './lib/api';
import { supabase } from './lib/supabase';
import { paymentRequest, type Payment, type PaymentConfig, type Profile } from './features/payments/api';
import { connectWallet, signPayment } from './features/payments/wallet';

const short = (address: string) => `${address.slice(0, 7)}…${address.slice(-6)}`;
function Check() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wallet, setWallet] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  const token = session?.access_token;
  const currentActor = useRef(session?.user.id);
  currentActor.current = session?.user.id;
  function acceptPayment(next: Payment | null) { if (currentActor.current === session?.user.id) setPayment(next); }

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<PaymentConfig>('/api/payments/config', { signal: controller.signal }).then(setConfig).catch(() => {
      if (!controller.signal.aborted) setConfig({ ready: false, network: 'testnet', message: 'API unavailable. Start the Express server and reload.' });
    });
    if (!supabase) { setRestoring(false); return () => controller.abort(); }
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) { setSession(nextSession); setRestoring(false); }
    });
    supabase.auth.getSession().then(({ data: current }) => {
      if (alive) { setSession(current.session); setRestoring(false); }
    }).catch(() => { if (alive) setRestoring(false); });
    return () => { alive = false; controller.abort(); data.subscription.unsubscribe(); };
  }, []);

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
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not restore checkout.');
        if (e instanceof ApiError && e.status === 401) await supabase?.auth.signOut({ scope: 'local' });
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (!token || payment?.status !== 'pending') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let remaining = 6;
    const check = async () => {
      if (stopped) return;
      try {
        const result = await paymentRequest(token, `/${payment.id}/check`, {});
        if (!stopped) {
          setPayment(result.payment);
          if (result.payment?.status !== 'pending') return;
        }
      } catch { /* Keep manual status recovery available after the bounded polling window. */ }
      if (!stopped && --remaining > 0) timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 5000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [token, payment?.id, payment?.status]);

  async function run(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    const at = generation.current;
    try { await action(); }
    catch (e) {
      if (generation.current === at) {
        setError(e instanceof Error ? e.message : 'The request could not be completed. Check the saved payment before trying again.');
        if (token && profile?.role === 'customer') {
          try { const result = await paymentRequest(token); if (generation.current === at) { acceptPayment(result.payment); setLoaded(true); } } catch { /* retain saved view */ }
        }
      }
      if (e instanceof ApiError && e.status === 401) await supabase?.auth.signOut({ scope: 'local' });
    } finally { lock.current = false; setBusy(''); }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await run('Signing in…', async () => {
      if (!supabase) throw new Error('Configure the browser Supabase settings first.');
      const result = await supabase.auth.signInWithPassword({ email, password });
      setPassword('');
      if (result.error) throw new Error('Sign-in failed. Check the demo account email and password.');
    });
  }
  const split = payment?.split ?? config?.split;
  const paid = payment?.status === 'paid';
  const pending = payment?.status === 'pending';
  const terminal = payment && ['paid', 'failed', 'expired'].includes(payment.status);
  const prepared = payment?.status === 'prepared';
  const steps = [wallet || payment ? 'done' : 'current', paid ? 'done' : payment ? 'current' : '', paid ? 'done' : pending ? 'current' : ''];
  const canPay = loaded && profile?.role === 'customer' && config?.ready;

  return <div className="app-shell">
    <header className="header">
      <a href="/" aria-label="BAYANIHAN payment demo"><img className="wordmark" src={wordmark} alt="BAYANIHAN" /></a>
      <div className="header-right"><span className="testnet"><span />Stellar Testnet</span>{session && <button className="text-button" disabled={!!busy} onClick={() => run('Signing out…', async () => { const result = await supabase!.auth.signOut({ scope: 'local' }); if (result.error) throw new Error('Could not sign out. Try again.'); })}>Sign out</button>}</div>
    </header>
    <main className="payment-layout">
      <section className="story">
        <p className="eyebrow"><span className="mini-line" /> THE BAYANIHAN PAYMENT DEMO</p>
        <h1>One helping hand.<br /><span>A fair share for all.</span></h1>
        <p className="story-description">Pay for local skills with a clear split. One wallet signature sends the worker their share and supports the community.</p>
        <div className="split-visual">
          <div className="share-worker"><span>To your worker</span><strong>85<span>%</span></strong><small>0.85 XLM</small></div>
          <div className="share-platform"><img src={symbol} alt="" /><span>To BAYANIHAN</span><strong>15<span>%</span></strong><small>0.15 XLM</small></div>
        </div>
        <div className="integration-line"><span>CONNECTED THROUGH</span><strong>Freighter <span>×</span> Paiflow</strong></div>
        <p className="demo-note">Presentation checkout · 1 test XLM<br />The service and physical completion are simulated. Wallet signing and payment use Stellar Testnet.</p>
      </section>
      <section className="checkout" aria-label="Payment checkout">
        <div className="card-topline"><span>PAYMENT CHECKOUT</span><span className="demo-label">TEST ASSETS ONLY</span></div>
        <div className="service-heading"><div className="service-icon"><img src={symbol} alt="" /></div><div><h2>Furniture assembly</h2><p>Labor only · Demo service</p></div></div>
        <div className="total"><span>Total payment</span><strong>1.00 <small>XLM</small></strong></div>
        <div className="breakdown">
          <div><span><i className="dot worker-dot" />Worker receives <small>85%</small></span><strong>0.85 XLM</strong></div>
          <div><span><i className="dot platform-dot" />BAYANIHAN <small>15%</small></span><strong>0.15 XLM</strong></div>
          <div className="split-bar"><span /><span /></div><p>Network fees are additional and shown in Freighter.</p>
        </div>
        <ol className="steps">{['Connect wallet', 'Sign payment', 'Verify split'].map((step, i) => <li className={steps[i]} key={step}><span>{steps[i] === 'done' ? <Check /> : i + 1}</span>{step}</li>)}</ol>
        <div className="checkout-action">
          {restoring ? <p className="muted" role="status">Restoring your session…</p> : !session ? <form onSubmit={login} className="login-form">
            <h3>Sign in to the demo</h3><p>Use your pre-created customer account to save the payment and receipt.</p>
            <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} disabled={!!busy} />
            <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!!busy} />
            <button className="primary-button" disabled={!!busy || !supabase}>{busy || 'Sign in to continue'}<span aria-hidden="true">↗</span></button>
            {!supabase && <p className="error">Supabase browser configuration is missing.</p>}
          </form> : !profile ? <p className="muted">{error ? 'Account could not be loaded.' : 'Loading your account…'}</p> : profile.role !== 'customer' ? <div className="state-panel"><h3>Customer checkout</h3><p>Signed in as {profile.display_name}, a worker. Sign out and use the customer account to demonstrate payment.</p></div> : <>
            <div className="account-line"><span>Customer</span><strong>{profile.display_name}</strong></div>
            {!loaded && <button className="secondary-button" disabled={!!busy} onClick={() => run('Loading…', async () => { const result = await paymentRequest(token!); acceptPayment(result.payment); setLoaded(true); })}>{busy || 'Load saved checkout'}</button>}
            {paid ? <div className="receipt-panel" role="status"><div className="success-icon"><Check /></div><h3>Payment verified</h3><p>The original transaction and both payouts are confirmed on Stellar Testnet.</p><div><span>Worker received</span><strong>0.85 XLM</strong></div><div><span>BAYANIHAN received</span><strong>0.15 XLM</strong></div><small>Ledger {payment.receipt?.ledger.toLocaleString()} · {payment.receipt && new Date(payment.receipt.verifiedAt).toLocaleString()}</small></div> : pending ? <div className="state-panel pending-panel" role="status"><span className="pulse" /><h3>Checking your payment</h3><p>The original transaction is saved. Settlement or payout evidence is still pending. Check its status before starting another payment.</p></div> : payment?.status === 'preparing' ? <div className="state-panel"><h3>Preparing your payment</h3><p>Another request reserved this checkout. Check the saved attempt in a moment.</p></div> : terminal ? <div className="state-panel"><h3>{payment.status === 'expired' ? 'Payment expired' : 'Payment did not complete'}</h3><p>{payment.status === 'expired' ? 'The server confirmed the signing window has closed and found no included transaction in the covered chain history.' : 'The transaction failed on-chain, or preparation ended before an envelope was made available.'} You can start a new demo.</p></div> : <>
              <button className={wallet ? 'wallet-connected' : 'secondary-button wallet-button'} disabled={!!busy || !loaded} onClick={() => run('Connecting Freighter…', async () => { setWallet(await connectWallet()); })}><span>{wallet ? '● Freighter connected' : 'Connect Freighter'}</span>{wallet ? <code>{short(wallet)}</code> : <span aria-hidden="true">↗</span>}</button>
              {payment && <p className="wallet-hint">Prepared for <code title={payment.payer}>{short(payment.payer)}</code>{wallet && wallet !== payment.payer && ' · Select this account in Freighter.'}{payment.expiresAt && <> · Sign before {new Date(payment.expiresAt).toLocaleTimeString()}. If it expires, check payment status.</>}</p>}
              {prepared ? <button className="primary-button" disabled={!!busy || !wallet || wallet !== payment.payer || !canPay} onClick={() => run('Approve in Freighter…', async () => {
                if (!payment.xdr) throw new Error('Reload the saved payment before signing.');
                const signedXdr = await signPayment(payment.xdr, payment.payer);
                setBusy('Submitting through Paiflow…');
                const result = await paymentRequest(token!, `/${payment.id}/submit`, { signedXdr }); acceptPayment(result.payment);
              })}>{busy || 'Sign & pay 1 XLM'}<span aria-hidden="true">↗</span></button> : <button className="primary-button" disabled={!!busy || !wallet || !canPay} onClick={() => run('Preparing with Paiflow…', async () => {
                const result = await paymentRequest(token!, '/prepare', { payer: wallet }); acceptPayment(result.payment);
              })}>{busy || 'Prepare payment'}<span aria-hidden="true">→</span></button>}
              <p className="wallet-hint">Your wallet asks for approval before signing. BAYANIHAN never receives your private key.</p>
            </>}
            {payment && !terminal && <button className="secondary-button" disabled={!!busy} onClick={() => run('Checking original transaction…', async () => {
              const result = await paymentRequest(token!, `/${payment.id}/check`, {}); acceptPayment(result.payment);
              if (result.payment?.status === 'pending') setNotice('The payment is still unresolved. Keep this original attempt; no replacement charge was created.');
            })}>{busy || 'Check payment status'}</button>}
            {pending && <button className="text-button retry-button" disabled={!!busy} onClick={() => run('Retrying saved transaction…', async () => { const result = await paymentRequest(token!, `/${payment.id}/retry`, {}); acceptPayment(result.payment); setNotice('Retried the exact saved envelope. No new payment was prepared.'); })}>Retry the saved transaction</button>}
            {payment?.hash && <a className="explorer-link" href={`https://stellar.expert/explorer/testnet/tx/${payment.hash}`} target="_blank" rel="noreferrer">{paid ? 'View verified transaction' : 'View original transaction'} <span aria-hidden="true">↗</span><code>{short(payment.hash)}</code></a>}
            {terminal && <button className="secondary-button" disabled={!!busy} onClick={() => run('Opening new demo…', async () => { await paymentRequest(token!, `/${payment.id}/new`, {}); setPayment(null); setWallet(''); })}>{busy || 'Start another test payment'}</button>}
          </>}
          {error && <p className="message error" role="alert">{error}</p>}
          {notice && <p className="message information" role="status">{notice}</p>}
          {config && !config.ready && <p className="message information" role="status">{config.message}</p>}
        </div>
        {split && <details className="recipients"><summary>Payment recipients & verification</summary><dl><dt>Worker · 85%</dt><dd>{split.worker}</dd><dt>BAYANIHAN · 15%</dt><dd>{split.platform}</dd><dt>Paiflow splitter contract</dt><dd>{split.splitter}</dd></dl><p>Recipients come from the configured deployment’s live Testnet contract. The receipt checks actual native-XLM transfers.</p></details>}
        <div className="card-footer"><span className={`readiness-dot ${config?.ready ? 'ready' : ''}`} /><span>{config === null ? 'Checking Paiflow connection…' : config.ready ? 'Paiflow connected · Native XLM · 85/15 split' : 'Paiflow connection needs attention'}</span></div>
      </section>
    </main>
    <footer className="page-footer"><span>Built on community. Powered by Stellar.</span><a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Get Freighter ↗</a></footer>
  </div>;
}
