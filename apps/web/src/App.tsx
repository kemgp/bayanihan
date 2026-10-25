import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import symbol from '../../../assets/branding/4.svg';
import { ApiError, apiFetch } from './lib/api';
import { supabase } from './lib/supabase';
import { paymentRequest, type Payment, type PaymentConfig, type Profile } from './features/payments/api';
import { connectWallet, signPayment } from './features/payments/wallet';
import { previewAmount, formatXlm } from './features/payments/amount';
import { createBooking, listBookings, listServices, updateBookingStatus, type ApiService, type Booking } from './features/marketplace/api';

const short = (address: string) => `${address.slice(0, 7)}…${address.slice(-6)}`;
function Check() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

type Service = { id: string; title: string; description: string; icon: string };
const services: Service[] = [
  { id: 'plumbing', title: 'Plumbing', description: 'Leaks, pipes, drains and fixtures.', icon: 'plumbing' },
  { id: 'electrician', title: 'Electrician', description: 'Electrical repairs, lights and wiring.', icon: 'electrician' },
  { id: 'carpenter', title: 'Carpenter', description: 'Furniture assembly and wood repairs.', icon: 'carpenter' },
  { id: 'appliances', title: 'Appliances Repair', description: 'Appliance repairs and installation.', icon: 'appliances' },
  { id: 'cleaner', title: 'Cleaner', description: 'Deep cleaning and maintenance.', icon: 'cleaner' },
  { id: 'painter', title: 'Painter', description: 'Interior and exterior painting.', icon: 'painter' },
  { id: 'gardener', title: 'Gardener', description: 'Lawn care and landscaping.', icon: 'gardener' },
  { id: 'hvac', title: 'Hvac repair', description: 'Repair and maintenance.', icon: 'hvac' },
];

gsap.registerPlugin(ScrollTrigger);

function ServiceIcon({ name }: { name: string }) {
  const assetName = name === 'appliances' ? 'appliances-repair' : name;
  return <img className="service-icon-art" src={`/figma/service-${assetName}.svg`} alt="" />;
}

export function App() {
  const [view, setView] = useState<'services' | 'checkout'>('services');
  const [selectedService, setSelectedService] = useState('carpenter');
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiServices, setApiServices] = useState<ApiService[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingServiceState, setBookingServiceState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bookingServiceError, setBookingServiceError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const servicesRef = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const token = session?.access_token;
  const currentActor = useRef(session?.user.id);
  currentActor.current = session?.user.id;
  function acceptPayment(next: Payment | null) { if (currentActor.current === session?.user.id) setPayment(next); }

  useEffect(() => {
    if (view !== 'services' || !servicesRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const context = gsap.context(() => {
      gsap.fromTo('.hero-copy > *', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .72, stagger: .1, ease: 'power3.out' });
      gsap.fromTo('.hero-photo', { scale: .92 }, { scale: 1, duration: 1.25, ease: 'power2.out' });
      gsap.fromTo('.service-card', { y: 30, opacity: 0 }, {
        y: 0, opacity: 1, duration: .55, stagger: .065, ease: 'power2.out',
        scrollTrigger: { trigger: '.service-grid', start: 'top 88%', once: true },
      });
      gsap.fromTo('.service-photo', { scale: .8, opacity: .65 }, {
        scale: 1, opacity: 1, duration: .85, ease: 'power2.out',
        scrollTrigger: { trigger: '.service-detail', start: 'top 75%', once: true },
      });
      gsap.fromTo('.process-card', { y: 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: .65, stagger: .16, ease: 'power2.out',
        scrollTrigger: { trigger: '.process-section', start: 'top 76%', once: true },
      });
    }, servicesRef);
    return () => context.revert();
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    listServices().then(result => {
      if (!controller.signal.aborted) { setApiServices(result.services); setBookingServiceState('ready'); }
    }).catch(e => {
      if (!controller.signal.aborted) {
        setBookingServiceState('error');
        setBookingServiceError(e instanceof ApiError && e.status === 501
          ? 'The deployed backend does not have the marketplace routes yet. Deploy the current API build before accepting bookings.'
          : e instanceof Error ? e.message : 'The service API is unavailable. Check the deployed API URL and try again.');
      }
    });
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
    if (!token || !profile) { setBookings([]); return; }
    let alive = true;
    listBookings(token).then(result => {
      if (alive) { setBookings(result.bookings); setBookingError(''); }
    }).catch(e => {
      if (alive) setBookingError(e instanceof Error ? e.message : 'Could not load your bookings.');
    });
    return () => { alive = false; };
  }, [token, profile?.id]);

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

  async function run(label: string, action: () => Promise<void>, recoverPayment = true) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    const at = generation.current;
    try { await action(); }
    catch (e) {
      if (generation.current === at) {
        setError(e instanceof Error ? e.message : 'The request could not be completed. Check the saved payment before trying again.');
        if (!recoverPayment) setBookingError(e instanceof Error ? e.message : 'The booking request could not be completed.');
        if (recoverPayment && token && profile?.role === 'customer') {
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
      setView('services');
    });
  }
  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedApiService?.id || !selectedSlot) return;
    await run('Sending booking request…', async () => {
      await createBooking(token, {
        serviceId: selectedApiService.id!,
        scheduledAt: selectedSlot,
        taskDescription: taskDescription.trim(),
        serviceAddress: serviceAddress.trim(),
      });
      const refreshed = await listBookings(token);
      setBookings(refreshed.bookings);
      setTaskDescription(''); setServiceAddress(''); setSelectedSlot('');
      setBookingError('');
      setNotice('Your booking request was saved. Payment is handled separately after completion.');
    }, false);
  }
  async function changeBookingStatus(booking: Booking, status: Booking['job_status']) {
    if (!token) return;
    await run('Updating booking…', async () => {
      await updateBookingStatus(token, booking.id, status);
      const refreshed = await listBookings(token);
      setBookings(refreshed.bookings);
      setBookingError('');
    }, false);
  }
  const split = payment?.split ?? config?.split;
  const amounts = payment ?? previewAmount(amount);
  const totalLabel = amounts ? formatXlm(amounts.total) : '—';
  const workerLabel = amounts ? formatXlm(amounts.workerAmount) : '—';
  const platformLabel = amounts ? formatXlm(amounts.platformAmount) : '—';
  const validAmount = !!amounts && BigInt(amounts.total) >= BigInt(split?.minimumAmount ?? '0');
  const paid = payment?.status === 'paid';
  const pending = payment?.status === 'pending';
  const terminal = payment && ['paid', 'failed', 'expired'].includes(payment.status);
  const prepared = payment?.status === 'prepared';
  const steps = [wallet || payment ? 'done' : 'current', paid ? 'done' : payment ? 'current' : '', paid ? 'done' : pending ? 'current' : ''];
  const canPay = loaded && profile?.role === 'customer' && config?.ready && validAmount;
  const selectedServiceData = services.find(service => service.id === selectedService)!;
  const selectedApiService = apiServices.find(service => service.key === selectedService);
  const availableSlots = selectedApiService?.availableSlots ?? [];
  const isPilot = selectedService === 'carpenter';

  return <div className="app-shell">
    {view === 'services' && <div className="testnet-notice">Hackathon demo on Stellar Testnet. Test XLM has no real-money value.</div>}
    <header className={`header ${view === 'services' ? 'services-header' : ''}`}>
      <button className="brand-home" onClick={() => setView('services')} aria-label="BAYANIHAN services"><img className="brand-mark" src="/figma/brand-logo.svg" alt="" /><span className="brand-wordmark">bayanihan</span></button>
      {view === 'services' ? <><nav className="home-nav" aria-label="Main navigation"><button className="nav-current" onClick={() => document.getElementById('service-catalogue')?.scrollIntoView({ behavior: 'smooth' })}>Find a service</button><button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>{session && profile && <button onClick={() => document.getElementById('my-bookings')?.scrollIntoView({ behavior: 'smooth' })}>My bookings</button>}<button onClick={() => setView('checkout')}>Payment demo</button></nav><div className="header-right"><span className="testnet"><span />Stellar Testnet</span>{session ? <button className="nav-sign-in" disabled={!!busy} onClick={() => run('Signing out…', async () => { const result = await supabase!.auth.signOut({ scope: 'local' }); if (result.error) throw new Error('Could not sign out. Try again.'); })}>Sign out</button> : <button className="nav-sign-in" onClick={() => setView('checkout')}>Sign in</button>}</div></> : <div className="header-right"><button className="text-button" onClick={() => setView('services')}>All services</button><span className="testnet"><span />Stellar Testnet</span>{session && <button className="text-button" disabled={!!busy} onClick={() => run('Signing out…', async () => { const result = await supabase!.auth.signOut({ scope: 'local' }); if (result.error) throw new Error('Could not sign out. Try again.'); })}>Sign out</button>}</div>}
    </header>
    {view === 'services' ? <main className="services-page" ref={servicesRef}>
      <section className="services-hero">
        <img className="hero-photo" src="/figma/home-living-room.jpeg" alt="" />
        <div className="hero-wash" />
        <div className="hero-copy">
          <p className="services-kicker">Good help, right here in Jaro.</p>
          <h1>Skilled help.<br />Closer to home.</h1>
          <p>Find skilled local help across eight handyman services in Jaro.<br />Choose your service. Agree the scope. Book a Bayani.</p>
          <div className="hero-actions"><button className="hero-cta" onClick={() => document.getElementById('service-catalogue')?.scrollIntoView({ behavior: 'smooth' })}>Book a Bayani <span aria-hidden="true"><img src="/figma/arrow-northeast.svg" alt="" /></span></button><button className="hero-secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button></div>
        </div>
        <div className="hero-caption"><span>Less on your to-do list. More room for your day.</span><span>Illustrative home photograph · Demo service</span></div>
      </section>
      <section className="catalogue-section" id="service-catalogue">
        <div className="catalogue-heading"><h2>Every home has a to-do list.</h2><p>Choose from all eight handyman services. Select a category to describe your task, agree the scope and request an appointment.</p></div>
        <div className="service-grid" aria-label="Choose a handyman service">
          {services.map(service => <button key={service.id} type="button" className={`service-card ${service.id === 'carpenter' ? 'pilot' : ''} ${selectedService === service.id ? 'selected' : ''}`} aria-pressed={selectedService === service.id} onMouseEnter={event => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.to(event.currentTarget, { y: -4, duration: .18, ease: 'power2.out' }); }} onMouseLeave={event => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.to(event.currentTarget, { y: 0, duration: .18, ease: 'power2.out' }); }} onClick={() => setSelectedService(service.id)}>
            <ServiceIcon name={service.icon}/><strong>{service.title}</strong><span className="service-description">{service.description}</span><span className="service-status">{service.id === 'carpenter' ? 'Furniture assembly · Current pilot' : 'Planned service'}</span>
          </button>)}
        </div>
      </section>
      <section className="service-detail" aria-live="polite">
        <div className="detail-pilot">
          <img className="service-photo" src="/figma/home-living-room.jpeg" alt="A bright living room with assembled furniture" />
          <div className="detail-title"><h2>{isPilot ? 'Furniture assembly' : selectedServiceData.title}</h2><strong>{isPilot ? selectedApiService?.amountStroops ? `${formatXlm(selectedApiService.amountStroops)} XLM` : 'Pilot unavailable' : 'Planned'}</strong></div>
          <p>{isPilot ? selectedApiService?.scope ?? 'One flat-pack item. Two hours of local, skilled help.' : selectedServiceData.description}</p>
          <small>{isPilot ? 'Example Carpenter task · Fixed Testnet demo price' : 'This service is planned for a future Bayanihan release.'}</small>
          <button className="detail-action" disabled={!isPilot} onClick={() => setView('checkout')}>{isPilot ? 'Open payment demo' : 'Planned service'}<span aria-hidden="true"><img src="/figma/arrow-northeast.svg" alt="" /></span></button>
        </div>
        <div className="detail-included"><img src="/figma/house-outline.svg" alt="" /><h3>{isPilot ? <>The everyday<br />essentials.</> : <>Service<br />details.</>}</h3>
          {isPilot ? <ul><li><img src="/figma/checkmark.svg" alt="" />Assemble supplied parts</li><li><img src="/figma/checkmark.svg" alt="" />Follow product instructions</li><li><img src="/figma/checkmark.svg" alt="" />Check and tighten fittings</li><li><img src="/figma/checkmark.svg" alt="" />Tidy the work area</li></ul> : <p>Explore another category by selecting a service above. Carpenter furniture assembly is the current payment pilot.</p>}
          <p className="detail-note">{isPilot ? 'Labor only. Have the parts and instructions ready. Materials, repairs and specialist tasks are excluded.' : 'Availability, worker profiles and booking are not enabled for this service yet.'}</p>
        </div>
        <div className="detail-worker"><div className="worker-avatar">AR</div><h3>{isPilot ? 'Meet Ana.' : 'Local skilled help.'}</h3><p>{isPilot ? 'A sample Bayani profile for exploring the booking journey.' : 'Bayanihan is designed to connect customers with independent workers.'}</p><hr /><h4>{isPilot ? 'A simpler first booking.' : 'A local service catalogue.'}</h4><p>{isPilot ? 'Choose a time. Ana accepts the request. You review the completed work before paying.' : 'The remaining service categories are planned for future releases.'}</p><small>{isPilot ? 'Sample profile for the hackathon' : 'Planned service'}</small>
        </div>
      </section>
      <section className="booking-hub" id="my-bookings">
        <div className="booking-hub-heading"><div><p className="services-kicker">THE CARPENTER PILOT</p><h2>Request a visit.<br />Know what happens next.</h2></div><p>Booking requests are saved by the BAYANIHAN API. A payment is not created until service completion, and this pilot's payment demo is currently separate from bookings.</p></div>
        {bookingServiceState === 'loading' ? <p className="booking-feedback" role="status">Connecting to the service API…</p> : bookingServiceState === 'error' ? <div className="booking-feedback error" role="alert">{bookingServiceError}</div> : !selectedApiService?.available || !selectedApiService.id ? <div className="booking-feedback">Carpenter booking is not open yet. The live API has no active pilot service record.</div> : <div className="booking-hub-grid">
          <div className="booking-request-card"><h3>Book furniture assembly</h3><p>{selectedApiService.workerName ? `Request ${selectedApiService.workerName} in ${selectedApiService.serviceArea ?? 'the Jaro service area'}.` : 'Request the Carpenter pilot in Jaro.'} The server confirms the final scope and price.</p>
            {!session || !profile ? <button className="booking-submit" onClick={() => setView('checkout')}>Sign in to book <span aria-hidden="true">↗</span></button> : profile.role !== 'customer' ? <p className="booking-feedback">Sign in with a customer account to request this service.</p> : <form className="booking-form" onSubmit={submitBooking}>
              <label htmlFor="booking-slot">Appointment time</label><select id="booking-slot" required value={selectedSlot} onChange={event => setSelectedSlot(event.target.value)} disabled={!!busy || availableSlots.length === 0}><option value="">Choose an available slot</option>{availableSlots.map(slot => <option value={slot} key={slot}>{new Date(slot).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</option>)}</select>
              <label htmlFor="booking-task">What needs assembling?</label><textarea id="booking-task" required maxLength={2000} value={taskDescription} onChange={event => setTaskDescription(event.target.value)} placeholder="For example, one flat-pack wardrobe" disabled={!!busy} />
              <label htmlFor="booking-address">Service address in Jaro</label><input id="booking-address" required maxLength={500} value={serviceAddress} onChange={event => setServiceAddress(event.target.value)} placeholder="Street and barangay" disabled={!!busy} />
              <button className="booking-submit" type="submit" disabled={!!busy || !selectedSlot || availableSlots.length === 0}>{busy || 'Request booking'}<span aria-hidden="true">↗</span></button>
              {availableSlots.length === 0 && <p className="booking-feedback">No appointment times are currently available. Check back later.</p>}
            </form>}
          </div>
          <div className="booking-list-card"><div className="booking-list-heading"><h3>{profile?.role === 'worker' ? 'Assigned jobs' : 'Your booking requests'}</h3>{profile && <span>{profile.role === 'worker' ? 'WORKER VIEW' : 'CUSTOMER VIEW'}</span>}</div>
            {!session || !profile ? <p>Sign in to view booking progress.</p> : bookingError ? <p className="booking-feedback error" role="alert">{bookingError}</p> : bookings.length === 0 ? <p>No bookings yet. Your requests and job updates will appear here.</p> : <div className="booking-list">{bookings.map(booking => <article className="booking-row" key={booking.id}>
              <div><strong>Furniture assembly</strong><span>{new Date(booking.scheduled_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</span><span>{booking.job_status.replace('_', ' ')} · {booking.payment_status}</span></div>
              {profile.role === 'worker' && booking.job_status === 'requested' && <button disabled={!!busy} onClick={() => changeBookingStatus(booking, 'accepted')}>Accept</button>}
              {profile.role === 'worker' && booking.job_status === 'accepted' && <button disabled={!!busy} onClick={() => changeBookingStatus(booking, 'work_done')}>Mark work done</button>}
              {profile.role === 'customer' && booking.job_status === 'work_done' && <button disabled={!!busy} onClick={() => changeBookingStatus(booking, 'completed')}>Confirm completion</button>}
            </article>)}</div>}
          </div>
        </div>}
        {bookingError && session && <p className="booking-feedback error" role="alert">{bookingError}</p>}
        {notice && view === 'services' && <p className="booking-feedback success" role="status">{notice}</p>}
      </section>
      <section className="process-section" id="how-it-works">
        <div className="process-heading"><h2>Good help should feel simple.</h2><p>From the first request to the final receipt, know what happens next.</p></div>
        <div className="process-cards">
          <article className="process-card"><img className="process-icon" src="/figma/process-calendar.svg" alt="" /><h3>Choose your service</h3><p>Pick the time, add your address, and send a request. No payment is needed to book.</p></article>
          <article className="process-card"><img className="process-icon" src="/figma/process-home.svg" alt="" /><h3>Meet your partner</h3><p>Ana accepts your booking and marks the service complete after the work.</p></article>
          <article className="process-card"><img className="process-icon" src="/figma/process-shield.svg" alt="" /><h3>Pay with proof</h3><p>Review the work, approve the payment, and see both payouts confirmed.</p></article>
        </div>
      </section>
      <section className="closing-cta"><h2>Good help. A stronger community.</h2><div><p>Eight services. Local skilled help. One clear booking journey.</p><button onClick={() => { setSelectedService('carpenter'); setView('checkout'); }}>Open payment demo <span aria-hidden="true"><img src="/figma/arrow-northeast.svg" alt="" /></span></button></div></section>
    </main> : <main className="payment-layout">
      <section className="story">
        <p className="eyebrow"><span className="mini-line" /> THE BAYANIHAN PAYMENT DEMO</p>
        <h1>One helping hand.<br /><span>A fair share for all.</span></h1>
        <p className="story-description">Pay for local skills with a clear split. One wallet signature sends the worker their share and supports the community.</p>
        <div className="split-visual">
          <div className="share-worker"><span>To your worker</span><strong>85<span>%</span></strong><small>{workerLabel} XLM</small></div>
          <div className="share-platform"><img src={symbol} alt="" /><span>To BAYANIHAN</span><strong>15<span>%</span></strong><small>{platformLabel} XLM</small></div>
        </div>
        <div className="integration-line"><span>CONNECTED THROUGH</span><strong>Freighter <span>×</span> Paiflow</strong></div>
        <p className="demo-note">Presentation checkout · Test XLM only<br />The service and physical completion are simulated. Wallet signing and payment use Stellar Testnet.</p>
      </section>
      <section className="checkout" aria-label="Payment checkout">
        <div className="card-topline"><span>PAYMENT CHECKOUT</span><span className="demo-label">TEST ASSETS ONLY</span></div>
        <div className="service-heading"><div className="service-icon"><img src={symbol} alt="" /></div><div><h2>Furniture assembly</h2><p>Labor only · Demo service</p></div></div>
        <div className="amount-editor">
          <label htmlFor="payment-amount">Payment amount (XLM)</label>
          <div className="amount-input"><input id="payment-amount" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
            value={payment ? formatXlm(payment.total) : amount} onChange={event => setAmount(event.target.value)}
            disabled={!!busy || !!payment || (!!session && !loaded) || profile?.role === 'worker'}
            aria-invalid={!validAmount} aria-describedby="amount-help" /><span>XLM</span></div>
          <p id="amount-help">{payment ? 'Amount saved with this payment. Resolve it before starting a different amount.' : !validAmount && amount ? 'Enter 0.00001–10,000 XLM, up to 7 decimal places, and meet the deployment minimum.' : 'Enter 0.00001–10,000 XLM. Up to 7 decimal places.'}</p>
        </div>
        <div className="total"><span>Total payment</span><strong>{totalLabel} <small>XLM</small></strong></div>
        <div className="breakdown">
          <div><span><i className="dot worker-dot" />Worker receives <small>85%</small></span><strong>{workerLabel} XLM</strong></div>
          <div><span><i className="dot platform-dot" />BAYANIHAN <small>15%</small></span><strong>{platformLabel} XLM</strong></div>
          <div className="split-bar"><span /><span /></div><p>Network fees are additional and shown in Freighter. Worker share rounds down; BAYANIHAN receives the remainder.</p>
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
            {paid ? <div className="receipt-panel" role="status"><div className="success-icon"><Check /></div><h3>Payment verified</h3><p>The original transaction and both payouts are confirmed on Stellar Testnet.</p><div><span>Worker received</span><strong>{workerLabel} XLM</strong></div><div><span>BAYANIHAN received</span><strong>{platformLabel} XLM</strong></div><small>Ledger {payment.receipt?.ledger.toLocaleString()} · {payment.receipt && new Date(payment.receipt.verifiedAt).toLocaleString()}</small></div> : pending ? <div className="state-panel pending-panel" role="status"><span className="pulse" /><h3>Checking your payment</h3><p>The original transaction is saved. Settlement or payout evidence is still pending. Check its status before starting another payment.</p></div> : payment?.status === 'preparing' ? <div className="state-panel"><h3>Preparing your payment</h3><p>Another request reserved this checkout. Check the saved attempt in a moment.</p></div> : terminal ? <div className="state-panel"><h3>{payment.status === 'expired' ? 'Payment expired' : 'Payment did not complete'}</h3><p>{payment.status === 'expired' ? 'The server confirmed the signing window has closed and found no included transaction in the covered chain history.' : 'The transaction failed on-chain, or preparation ended before an envelope was made available.'} You can start a new demo.</p></div> : <>
              <button className={wallet ? 'wallet-connected' : 'secondary-button wallet-button'} disabled={!!busy || !loaded} onClick={() => run('Connecting Freighter…', async () => { setWallet(await connectWallet()); })}><span>{wallet ? '● Freighter connected' : 'Connect Freighter'}</span>{wallet ? <code>{short(wallet)}</code> : <span aria-hidden="true">↗</span>}</button>
              {payment && <p className="wallet-hint">Prepared for <code title={payment.payer}>{short(payment.payer)}</code>{wallet && wallet !== payment.payer && ' · Select this account in Freighter.'}{payment.expiresAt && <> · Sign before {new Date(payment.expiresAt).toLocaleTimeString()}. If it expires, check payment status.</>}</p>}
              {prepared ? <button className="primary-button" disabled={!!busy || !wallet || wallet !== payment.payer || !canPay} onClick={() => run('Approve in Freighter…', async () => {
                if (!payment.xdr) throw new Error('Reload the saved payment before signing.');
                const signedXdr = await signPayment(payment.xdr, payment.payer);
                setBusy('Submitting through Paiflow…');
                const result = await paymentRequest(token!, `/${payment.id}/submit`, { signedXdr }); acceptPayment(result.payment);
              })}>{busy || `Sign & pay ${totalLabel} XLM`}<span aria-hidden="true">↗</span></button> : <button className="primary-button" disabled={!!busy || !wallet || !canPay} onClick={() => run('Preparing with Paiflow…', async () => {
                const result = await paymentRequest(token!, '/prepare', { payer: wallet, amountXlm: amount.trim() }); acceptPayment(result.payment);
              })}>{busy || 'Prepare payment'}<span aria-hidden="true">→</span></button>}
              <p className="wallet-hint">Your wallet asks for approval before signing. BAYANIHAN never receives your private key.</p>
            </>}
            {payment && !terminal && <button className="secondary-button" disabled={!!busy} onClick={() => run('Checking original transaction…', async () => {
              const result = await paymentRequest(token!, `/${payment.id}/check`, {}); acceptPayment(result.payment);
              if (result.payment?.status === 'pending') setNotice('The payment is still unresolved. Keep this original attempt; no replacement charge was created.');
            })}>{busy || 'Check payment status'}</button>}
            {pending && <button className="text-button retry-button" disabled={!!busy} onClick={() => run('Retrying saved transaction…', async () => { const result = await paymentRequest(token!, `/${payment.id}/retry`, {}); acceptPayment(result.payment); setNotice('Retried the exact saved envelope. No new payment was prepared.'); })}>Retry the saved transaction</button>}
            {payment?.hash && <a className="explorer-link" href={`https://stellar.expert/explorer/testnet/tx/${payment.hash}`} target="_blank" rel="noreferrer">{paid ? 'View verified transaction' : 'View original transaction'} <span aria-hidden="true">↗</span><code>{short(payment.hash)}</code></a>}
            {terminal && <button className="secondary-button" disabled={!!busy} onClick={() => run('Opening new demo…', async () => { await paymentRequest(token!, `/${payment.id}/new`, {}); setAmount(formatXlm(payment.total)); setPayment(null); setWallet(''); })}>{busy || 'Start another test payment'}</button>}
          </>}
          {error && <p className="message error" role="alert">{error}</p>}
          {notice && <p className="message information" role="status">{notice}</p>}
          {config && !config.ready && <p className="message information" role="status">{config.message}</p>}
        </div>
        {split && <details className="recipients"><summary>Payment recipients & verification</summary><dl><dt>Worker · 85%</dt><dd>{split.worker}</dd><dt>BAYANIHAN · 15%</dt><dd>{split.platform}</dd><dt>Paiflow splitter contract</dt><dd>{split.splitter}</dd></dl><p>Recipients come from the configured deployment’s live Testnet contract. The receipt checks actual native-XLM transfers.</p></details>}
        <div className="card-footer"><span className={`readiness-dot ${config?.ready ? 'ready' : ''}`} /><span>{config === null ? 'Checking Paiflow connection…' : config.ready ? 'Paiflow connected · Native XLM · 85/15 split' : 'Paiflow connection needs attention'}</span></div>
      </section>
    </main>}
    {view === 'services' ? <footer className="page-footer services-footer"><div className="footer-brand"><img className="brand-mark" src="/figma/brand-logo.svg" alt="" /><span className="brand-wordmark">bayanihan</span></div><span>Built with Paiflow on Stellar Testnet</span><small>Hackathon prototype · 2026</small></footer> : <footer className="page-footer"><span>Built on community. Powered by Stellar.</span><a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Get Freighter ↗</a></footer>}
  </div>;
}
