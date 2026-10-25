import { useEffect } from 'react';
import wordmark from '../../../assets/branding/Bayanihan Logo.png';
import symbol from '../../../assets/branding/4.svg';
import { usePaymentCheckout } from './features/payments/usePaymentCheckout';
import { CheckoutScreen, LoginScreen, Messages, ReceiptScreen, hasVerifiedReceipt } from './screens/PaymentScreens';

export function App() {
  const checkout = usePaymentCheckout();
  const { session, restoring, profile, loaded, payment, config, busy, error } = checkout;
  const accountReady = !!session && profile?.id === session.user.id && loaded;
  const view = restoring ? 'loading' : !session ? 'login' : !accountReady ? 'account' : profile?.role !== 'customer' ? 'worker' : hasVerifiedReceipt(payment) ? 'receipt' : 'checkout';
  const step = view === 'receipt' ? 2 : session ? 1 : 0;

  useEffect(() => {
    const names: Record<string, string> = { login: 'Sign in', checkout: 'Checkout', receipt: 'Payment receipt', loading: 'Loading', account: 'Your account', worker: 'Customer checkout' };
    document.title = `${names[view]} | BAYANIHAN`;
    document.getElementById('screen-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="header">
      <a className="brand-link" href="/" aria-label="BAYANIHAN home"><img className="wordmark" src={wordmark} alt="BAYANIHAN" /></a>
      <nav aria-label="Payment progress"><ol className="journey-steps">{['Sign in', 'Payment', 'Receipt'].map((name, i) => <li key={name} className={step === i ? 'current' : step > i ? 'done' : ''} aria-current={step === i ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{name}</li>)}</ol></nav>
      <div className="header-right"><span className="testnet"><span />Stellar Testnet</span>{session && <button className="text-button" disabled={!!busy} onClick={() => void checkout.signOut()}>Sign out</button>}</div>
    </header>
    {view === 'login' ? <LoginScreen symbol={symbol} configured={checkout.authConfigured} busy={busy} error={error} onLogin={checkout.login} />
      : view === 'checkout' && profile ? <CheckoutScreen symbol={symbol} profile={profile} config={config} payment={payment} amount={checkout.amount} wallet={checkout.wallet} busy={busy} error={error} notice={checkout.notice} onAmount={checkout.setAmount} onConnect={checkout.connect} onPrepare={checkout.prepare} onSign={checkout.sign} onCheck={checkout.check} onRetry={checkout.retryOriginal} onNew={checkout.newPayment} onConnection={checkout.refreshConfiguration} />
      : view === 'receipt' && profile && payment ? <ReceiptScreen profile={profile} payment={payment} busy={busy} error={error} onNew={checkout.newPayment} />
      : <main className="account-state surface" id="main-content"><span className="section-label">YOUR ACCOUNT</span><h1 id="screen-title" tabIndex={-1}>{view === 'worker' ? 'Customer checkout' : error ? 'Let’s reconnect.' : 'A moment, please.'}</h1>
        <p role="status">{view === 'worker' ? `You’re signed in as ${profile?.display_name}, a worker. Use the customer demo account to present the payment flow.` : error ? 'Your account or saved checkout could not be loaded. Retry to recover the original payment.' : restoring ? 'Restoring your secure session…' : 'Loading your account and any saved payment…'}</p>
        <Messages error={error} />
        {view === 'account' && error && <button className="primary-button" disabled={!!busy} onClick={checkout.retryAccount}>Retry account connection <span aria-hidden="true">↻</span></button>}
        {view === 'worker' && <button className="primary-button" disabled={!!busy} onClick={() => void checkout.signOut()}>{busy || 'Sign out to switch accounts'}</button>}
      </main>}
    <footer className="page-footer"><span>Built on community. Powered by Stellar.</span><span>Freighter <b>×</b> Paiflow</span><span>Testnet demo · Test assets only</span></footer>
  </div>;
}
