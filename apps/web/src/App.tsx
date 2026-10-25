import { useEffect, useState } from 'react';
import wordmark from '../../../assets/branding/Bayanihan Logo.png';
import symbol from '../../../assets/branding/4.svg';
import { usePaymentCheckout } from './features/payments/usePaymentCheckout';
import { CheckoutScreen, LoginScreen, Messages, ReceiptScreen, hasVerifiedReceipt } from './screens/PaymentScreens';
import { BrowseServicesScreen, ServiceDetailsScreen } from './screens/ServiceScreens';
import { parseRoute, resolveScreen, routeHash, type Route } from './screens/navigation';

export function App() {
  const checkout = usePaymentCheckout();
  const { session, restoring, profile, loaded, payment, config, busy, error } = checkout;
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const accountReady = !!session && profile?.id === session.user.id && loaded;
  const view = resolveScreen({ route, restoring, authenticated: !!session, accountReady, role: profile?.role, payment });
  const step = view === 'receipt' ? 3 : view === 'checkout' ? 2 : view === 'browse' || view === 'details' ? 1 : 0;
  const resumeLabel = accountReady && profile?.role === 'customer' && payment ? hasVerifiedReceipt(payment) ? 'View saved receipt' : 'Resume saved payment' : undefined;

  useEffect(() => {
    const changed = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    const names = { login: 'Sign in', browse: 'Browse services', details: 'Furniture assembly', checkout: 'Checkout', receipt: 'Payment receipt', loading: 'Loading', account: 'Your account', worker: 'Customer checkout' };
    document.title = `${names[view]} | BAYANIHAN`;
    document.getElementById('screen-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);
  function navigate(next: Route) {
    if (busy) return;
    window.location.hash = routeHash[next];
  }
  function startAnotherPayment() {
    navigate('payment');
    return checkout.newPayment();
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('screen-title')?.focus(); }}>Skip to content</a>
    <header className="header">
      <a className="brand-link" href="#services" aria-label="BAYANIHAN services" onClick={event => { if (busy) event.preventDefault(); }}><img className="wordmark" src={wordmark} alt="BAYANIHAN" /></a>
      <nav aria-label="Presentation progress"><ol className="journey-steps">{['Sign in', 'Services', 'Payment', 'Receipt'].map((name, i) => <li key={name} className={step === i ? 'current' : step > i && (i !== 0 || !!session) ? 'done' : ''} aria-current={step === i ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{i === 1 || i === 2 ? <a href={i === 1 ? '#services' : '#payment'} aria-disabled={!!busy} onClick={event => { if (busy) event.preventDefault(); }}>{name}</a> : name}</li>)}</ol></nav>
      <div className="header-right"><span className="testnet"><span />Stellar Testnet</span>{session ? <button className="text-button" disabled={!!busy} onClick={() => void checkout.signOut()}>Sign out</button> : view === 'browse' || view === 'details' ? <button className="text-button" disabled={!!busy} onClick={() => navigate('login')}>Sign in</button> : null}</div>
    </header>
    {view === 'browse' ? <BrowseServicesScreen onDetails={() => navigate('details')} onResume={() => navigate('payment')} resumeLabel={resumeLabel} busy={!!busy} />
      : view === 'details' ? <ServiceDetailsScreen onBrowse={() => navigate('browse')} onCheckout={() => navigate('payment')} onResume={() => navigate('payment')} resumeLabel={resumeLabel} busy={!!busy} />
      : view === 'login' ? <LoginScreen symbol={symbol} configured={checkout.authConfigured} busy={busy} error={error} onLogin={checkout.login} />
      : view === 'checkout' && profile ? <><div className="checkout-breadcrumb"><button className="text-button" disabled={!!busy} onClick={() => navigate('details')}>← Furniture assembly details</button></div><CheckoutScreen symbol={symbol} profile={profile} config={config} payment={payment} amount={checkout.amount} wallet={checkout.wallet} busy={busy} error={error} notice={checkout.notice} onAmount={checkout.setAmount} onConnect={checkout.connect} onPrepare={checkout.prepare} onSign={checkout.sign} onCheck={checkout.check} onRetry={checkout.retryOriginal} onNew={startAnotherPayment} onConnection={checkout.refreshConfiguration} /></>
      : view === 'receipt' && profile && payment ? <ReceiptScreen profile={profile} payment={payment} busy={busy} error={error} onNew={startAnotherPayment} />
      : <main className="account-state surface" id="main-content"><span className="section-label">YOUR ACCOUNT</span><h1 id="screen-title" tabIndex={-1}>{view === 'worker' ? 'Customer checkout' : error ? 'Let’s reconnect.' : 'A moment, please.'}</h1>
        <p role="status">{view === 'worker' ? `You’re signed in as ${profile?.display_name}, a worker. Use the customer demo account to present the payment flow.` : error ? 'Your account or saved checkout could not be loaded. Retry to recover the original payment.' : restoring ? 'Restoring your secure session…' : 'Loading your account and any saved payment…'}</p>
        <Messages error={error} />
        {view === 'account' && error && <button className="primary-button" disabled={!!busy} onClick={checkout.retryAccount}>Retry account connection <span aria-hidden="true">↻</span></button>}
        {view === 'worker' && <button className="primary-button" disabled={!!busy} onClick={() => void checkout.signOut()}>{busy || 'Sign out to switch accounts'}</button>}
      </main>}
    <footer className="page-footer"><span>Built on community. Powered by Stellar.</span><span>Freighter <b>×</b> Paiflow</span><span>Testnet demo · Test assets only</span></footer>
  </div>;
}
