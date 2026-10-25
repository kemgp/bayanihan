import { useEffect, useState, type FormEvent } from 'react';
import type { Payment, PaymentConfig, Profile, Split } from '../features/payments/api';
import { formatXlm, previewAmount } from '../features/payments/amount';

export const shortAddress = (value: string) => `${value.slice(0, 7)}…${value.slice(-6)}`;
export function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Arrow() { return <span aria-hidden="true">↗</span>; }
export function Messages({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <div className="message error" role="alert"><strong>Something needs attention</strong><p>{error}</p></div>}{notice && <p className="message information" role="status">{notice}</p>}</>;
}
export function ConnectionStatus({ config }: { config: PaymentConfig | null }) {
  return <div className="connection-status" role="status"><span className={`readiness-dot ${config?.ready ? 'ready' : ''}`} />{!config ? 'Checking payment connection…' : config.ready ? 'Paiflow connected · Stellar Testnet' : 'Payment connection unavailable'}</div>;
}
export function Recipients({ split }: { split: Split }) {
  return <details className="recipient-details"><summary>View payment recipients</summary><dl><dt>Worker wallet · 85%</dt><dd>{split.worker}</dd><dt>BAYANIHAN wallet · 15%</dt><dd>{split.platform}</dd><dt>Paiflow splitter</dt><dd>{split.splitter}</dd></dl><p>Addresses come from the configured Testnet deployment. The server checks actual transfers before issuing a receipt.</p></details>;
}

export function LoginScreen({ symbol, configured, busy, error, onLogin }: {
  symbol: string; configured: boolean; busy: string; error: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onLogin(email, password);
    setPassword('');
  }
  return <main className="login-layout" id="main-content">
    <section className="login-story">
      <p className="eyebrow"><span className="mini-line" /> LOCAL SKILLS. SHARED PROGRESS.</p>
      <h1 id="screen-title" tabIndex={-1}>A helping hand.<br /><span>A fair share.</span></h1>
      <p className="lead">Support the people who get the job done. Pay local talent with a clear breakdown and a receipt you can verify.</p>
      <div className="community-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-symbol"><img src={symbol} alt="" /></div><span className="art-caption">Built on bayanihan.</span><span className="art-badge badge-worker">85% to the worker</span><span className="art-badge badge-platform">15% to BAYANIHAN</span></div>
      <p className="demo-caption">Testnet presentation · Service and physical completion are simulated.</p>
    </section>
    <section className="login-card surface" aria-labelledby="login-title">
      <span className="section-label">01 / SIGN IN</span>
      <h2 id="login-title">Welcome back.</h2>
      <p className="card-description">Sign in to your BAYANIHAN demo account to continue to payment.</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!busy} />
        <label htmlFor="password">Password</label><div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required disabled={!!busy} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={!!busy}>{showPassword ? 'Hide' : 'Show'}</button></div>
        <Messages error={error} />
        {!configured && <p className="message error" role="alert">Sign-in is not configured. Add the public Supabase settings to the web environment.</p>}
        <button className="primary-button" disabled={!!busy || !configured} aria-busy={!!busy}>{busy || 'Sign in to continue'}<Arrow /></button>
      </form>
      <div className="login-help"><span className="small-lock" aria-hidden="true">◇</span><p>Use your pre-created demo account. Your session is restored automatically when you return.</p></div>
      <div className="wallet-requirement"><strong>A wallet comes next.</strong><p>After sign-in, connect Freighter on Stellar Testnet. Your private key stays in your wallet.</p><a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Get Freighter <Arrow /></a></div>
    </section>
  </main>;
}

export type CheckoutProps = {
  symbol: string; profile: Profile; config: PaymentConfig | null; payment: Payment | null;
  amount: string; wallet: string; busy: string; error: string; notice: string;
  onAmount: (value: string) => void; onConnect: () => Promise<void>; onPrepare: () => Promise<void>;
  onSign: () => Promise<void>; onCheck: () => Promise<void>; onRetry: () => Promise<void>;
  onNew: () => Promise<void>; onConnection: () => Promise<void>;
};
export function CheckoutScreen(props: CheckoutProps) {
  const { symbol, profile, config, payment, amount, wallet, busy, error, notice } = props;
  const values = payment ?? previewAmount(amount);
  const total = values ? formatXlm(values.total) : '—';
  const worker = values ? formatXlm(values.workerAmount) : '—';
  const platform = values ? formatXlm(values.platformAmount) : '—';
  const split = payment?.split ?? config?.split;
  const valid = !!values && BigInt(values.total) >= BigInt(split?.minimumAmount ?? '0');
  const prepared = payment?.status === 'prepared';
  const pending = payment?.status === 'pending';
  const preparing = payment?.status === 'preparing';
  const terminal = payment?.status === 'failed' || payment?.status === 'expired';
  const unverified = payment?.status === 'paid';
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!prepared) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prepared, payment?.id]);
  const remaining = payment?.expiresAt ? Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - now) / 1000)) : 0;
  const expired = prepared && remaining === 0;
  const walletMatches = !payment || wallet === payment.payer;
  const locked = !!busy || !!payment;
  const disabled = !!busy || !config?.ready || !valid || !wallet || !walletMatches || expired;
  const stage = pending || preparing || unverified ? 2 : wallet || prepared ? 1 : 0;

  return <main className="checkout-layout" id="main-content">
    <section className="payment-context">
      <p className="eyebrow"><span className="mini-line" /> 02 / PAYMENT</p>
      <h1 id="screen-title" tabIndex={-1}>Good work.<br /><span>Fairly paid.</span></h1>
      <p className="lead">One payment. A transparent split. Review the amount, approve in your wallet, and let Paiflow distribute the shares.</p>
      <div className="service-card surface"><div className="service-icon"><img src={symbol} alt="" /></div><div><span className="section-label">DEMO SERVICE</span><h2>Furniture assembly</h2><p>Labor only · Physical completion simulated</p></div></div>
      <div className="split-visual"><div className="share-worker"><span>Worker receives</span><strong>85<span>%</span></strong><small>{worker} XLM</small></div><div className="share-platform"><span>BAYANIHAN receives</span><strong>15<span>%</span></strong><small>{platform} XLM</small></div></div>
      <div className="how-payment-works"><h3>From your wallet to a verified receipt.</h3><p><span>01</span> Freighter signs with your approval.</p><p><span>02</span> Paiflow runs the configured split.</p><p><span>03</span> BAYANIHAN verifies both transfers.</p></div>
      <p className="demo-caption">Stellar Testnet · Test XLM only. Network fees are additional.</p>
    </section>
    <section className="payment-card surface" aria-labelledby="payment-title">
      <div className="card-topline"><span className="section-label">YOUR PAYMENT</span><span className="demo-label">TEST ASSETS ONLY</span></div>
      <h2 id="payment-title">Review & pay</h2><p className="card-description">Signed in as <strong>{profile.display_name}</strong></p>
      <ol className="payment-steps">{['Connect', 'Approve', 'Confirm'].map((label, i) => <li className={stage === i ? 'current' : stage > i ? 'done' : ''} key={label} aria-current={stage === i ? 'step' : undefined}><span>{stage > i ? <CheckIcon /> : i + 1}</span>{label}</li>)}</ol>
      <div className="amount-editor"><label htmlFor="payment-amount">Payment amount (XLM)</label><div className="amount-input"><input id="payment-amount" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={payment ? total : amount} onChange={e => props.onAmount(e.target.value)} disabled={locked} aria-invalid={!valid} aria-describedby="amount-help" /><span>XLM</span></div><p id="amount-help">{payment ? 'Saved with this payment. The amount stays fixed during recovery.' : !valid && amount ? 'Enter 0.00001–10,000 XLM with up to 7 decimals. Meet the deployment minimum.' : '0.00001–10,000 XLM · Up to 7 decimal places'}</p></div>
      <div className="payment-breakdown"><div><span><i className="dot worker-dot" />Worker · 85%</span><strong>{worker} XLM</strong></div><div><span><i className="dot platform-dot" />BAYANIHAN · 15%</span><strong>{platform} XLM</strong></div><div className="split-bar"><span /><span /></div><div className="payment-total"><span>Total payment</span><strong>{total} <small>XLM</small></strong></div><p>Plus network fees, shown in Freighter. Worker share rounds down; BAYANIHAN receives the remainder.</p></div>
      <div className="payment-actions">
        {pending || preparing || unverified ? <div className="state-panel pending-panel" role="status"><span className="pulse" /><h3>{preparing ? 'Preparing your payment' : unverified ? 'Receipt needs verification' : 'Payment is being verified'}</h3><p>{preparing ? 'This checkout is already reserved. Check its saved status in a moment.' : unverified ? 'A verified receipt could not be displayed. Check the saved payment before taking another action.' : 'We are checking the original transaction and both transfers. You can safely leave and return to this saved payment.'}</p></div> : terminal ? <div className="state-panel" role="status"><h3>{payment.status === 'expired' ? 'The signing window closed' : 'Payment did not complete'}</h3><p>{payment.status === 'expired' ? 'The server confirmed expiry using covered chain history. You can start a new test payment.' : 'Preparation ended before signing, or the transaction failed on-chain. You can start a new test payment.'}</p></div> : <>
          <button className={wallet ? 'wallet-connected' : 'secondary-button wallet-button'} disabled={!!busy} onClick={() => void props.onConnect()}><span>{wallet ? '● Freighter connected' : 'Connect Freighter'}</span>{wallet ? <code title={wallet}>{shortAddress(wallet)}</code> : <Arrow />}</button>
          {payment && <p className="wallet-hint">Prepared for <code title={payment.payer}>{shortAddress(payment.payer)}</code>{!walletMatches && wallet && ' · Select this account in Freighter.'}</p>}
          {expired ? <div className="message information" role="status"><strong>Signing window ended.</strong><p>Check the original payment status to confirm its outcome before starting again.</p></div> : prepared ? <p className="signing-window" role="timer">Ready to sign · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining</p> : null}
          <button className="primary-button" disabled={disabled} aria-busy={!!busy} onClick={() => void (prepared ? props.onSign() : props.onPrepare())}>{busy || (prepared ? `Sign & pay ${total} XLM` : 'Prepare payment')}<Arrow /></button>
          <p className="wallet-hint">Review the transaction in Freighter before approving. Your private key stays in your wallet.</p>
        </>}
        {payment && !terminal && <button className={pending || preparing || expired || unverified ? 'primary-button' : 'secondary-button'} disabled={!!busy} onClick={() => void props.onCheck()}>{busy && (pending || preparing || expired || unverified) ? busy : 'Check payment status'}<span aria-hidden="true">↻</span></button>}
        {pending && <button className="text-button retry-button" disabled={!!busy} onClick={() => void props.onRetry()}>Retry the saved transaction</button>}
        {terminal && <button className="primary-button" disabled={!!busy} onClick={() => void props.onNew()}>{busy || 'Start another test payment'}<Arrow /></button>}
        <Messages error={error} notice={notice} />
        {config && !config.ready && <div className="message information" role="status"><p>{config.message || 'Payment connection is unavailable.'}</p><button className="text-button" disabled={!!busy} onClick={() => void props.onConnection()}>Check connection again ↻</button></div>}
        {payment?.hash && <a className="explorer-link" href={`https://stellar.expert/explorer/testnet/tx/${payment.hash}`} target="_blank" rel="noreferrer">View original transaction <Arrow /><code>{shortAddress(payment.hash)}</code></a>}
      </div>
      {split && <Recipients split={split} />}
      <ConnectionStatus config={config} />
    </section>
  </main>;
}

export function hasVerifiedReceipt(payment: Payment | null): payment is Payment & { receipt: NonNullable<Payment['receipt']> } {
  if (!payment || payment.status !== 'paid' || !payment.receipt || !payment.hash || !/^[a-f0-9]{64}$/i.test(payment.hash)
    || payment.receipt.hash !== payment.hash || !Number.isSafeInteger(payment.receipt.ledger) || payment.receipt.ledger <= 0 || !Number.isFinite(Date.parse(payment.receipt.verifiedAt))) return false;
  try {
    const total = BigInt(payment.total), worker = BigInt(payment.workerAmount), platform = BigInt(payment.platformAmount);
    return total > 0n && worker === total * 85n / 100n && worker + platform === total;
  } catch { return false; }
}
export function ReceiptScreen({ payment, profile, busy, error, onNew }: {
  payment: Payment; profile: Profile; busy: string; error: string; onNew: () => Promise<void>;
}) {
  const [copyState, setCopyState] = useState('');
  if (!hasVerifiedReceipt(payment)) return <main className="account-state surface" id="main-content"><h1 id="screen-title" tabIndex={-1}>Receipt unavailable</h1><p>The original transaction and payout evidence must be verified first.</p></main>;
  const verifiedAt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(payment.receipt.verifiedAt));
  async function copyHash() {
    try { await navigator.clipboard.writeText(payment.hash!); setCopyState('Transaction ID copied.'); }
    catch { setCopyState('Copy is unavailable. Select the transaction ID below to copy it.'); }
  }
  return <main className="receipt-layout" id="main-content">
    <div className="receipt-heading"><p className="eyebrow">03 / YOUR RECEIPT</p><div className="success-icon"><CheckIcon /></div><h1 id="screen-title" tabIndex={-1}>A fair share. <span>Delivered.</span></h1><p>The original transaction and both payouts are verified on Stellar Testnet.</p></div>
    <section className="receipt-card surface" aria-labelledby="receipt-title">
      <div className="receipt-card-header"><div><span className="section-label">BAYANIHAN PAYMENT RECEIPT</span><h2 id="receipt-title">Furniture assembly</h2><p>Demo service · Labor only</p></div><span className="verified-badge"><CheckIcon /> Payment verified</span></div>
      <div className="receipt-total"><span>Total paid</span><strong>{formatXlm(payment.total)} <small>XLM</small></strong><p>Network fees are additional to this amount.</p></div>
      <div className="receipt-payouts"><div><span className="payout-icon"><CheckIcon /></span><div><span>WORKER RECEIVED · 85%</span><strong>{formatXlm(payment.workerAmount)} <small>XLM</small></strong></div></div><div><span className="payout-icon"><CheckIcon /></span><div><span>BAYANIHAN RECEIVED · 15%</span><strong>{formatXlm(payment.platformAmount)} <small>XLM</small></strong></div></div></div>
      <dl className="receipt-facts"><div><dt>Customer</dt><dd>{profile.display_name}</dd></div><div><dt>Network</dt><dd>Stellar Testnet · XLM</dd></div><div><dt>Verified on</dt><dd>{verifiedAt} PHT</dd></div><div><dt>Ledger</dt><dd>{payment.receipt.ledger.toLocaleString('en-US')}</dd></div><div className="wide"><dt>Payment reference</dt><dd><code>{payment.id}</code></dd></div><div className="wide"><dt>Transaction ID</dt><dd><code className="transaction-id">{payment.hash}</code><button className="text-button" onClick={() => void copyHash()}>Copy transaction ID</button><span className="copy-status" role="status">{copyState}</span></dd></div><div className="wide"><dt>Paid from</dt><dd><code>{payment.payer}</code></dd></div><div className="wide"><dt>Worker wallet</dt><dd><code>{payment.split.worker}</code></dd></div><div className="wide"><dt>BAYANIHAN wallet</dt><dd><code>{payment.split.platform}</code></dd></div></dl>
      <div className="receipt-actions"><a className="primary-button" href={`https://stellar.expert/explorer/testnet/tx/${payment.hash}`} target="_blank" rel="noreferrer">View on Stellar Explorer <Arrow /></a><button className="secondary-button" onClick={() => window.print()}>Print receipt</button><button className="text-button" disabled={!!busy} onClick={() => void onNew()}>{busy || 'Start another test payment'} →</button><Messages error={error} /></div>
      <p className="receipt-note">This receipt is saved to your account and remains available after refresh. Test assets only; the service and physical completion are simulated.</p>
    </section>
    <p className="receipt-thanks">Good work deserves a fair share. Thank you for supporting local skills.</p>
  </main>;
}
