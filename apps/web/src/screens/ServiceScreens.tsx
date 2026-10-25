import { useState } from 'react';
import { assemblyService, categories, filterServices, type CategoryFilter, type CategoryId } from '../features/services/catalog';
import { CheckIcon } from './PaymentScreens';

export function CategoryIcon({ category }: { category: CategoryId }) {
  const paths: Record<CategoryId, React.ReactNode> = {
    assembly: <><path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10M8 5l8 4" /></>,
    carpentry: <><path d="m4 20 8-8m-2-6 8 8 3-3-8-8-3 3ZM7 15l2 2M4 5l3-2 3 5-3 2-3-5Z" /><path d="m7 10 4 5" /></>,
    plumbing: <><path d="M4 4v8a5 5 0 0 0 5 5h2v4h6v-8H9a1 1 0 0 1-1-1V4H4Zm-1 0h6m1 17h8" /><path d="M18 3s-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z" /></>,
    electrical: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    cleaning: <><path d="m15 3-5 9m-4 0 7 4-4 6-8-5 5-5ZM5 16l-2 3m5-1-2 3M18 11v6m-3-3h6M19 3v4m-2-2h4" /></>,
    painting: <><path d="M4 3h14v6H4zM18 5h3v7H11v4m-2 0h4v6H9zM7 3v6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[category]}</svg>;
}
export function FurnitureArt({ compact = false }: { compact?: boolean }) {
  return <svg className={`furniture-art ${compact ? 'compact' : ''}`} viewBox="0 0 520 300" fill="none" aria-hidden="true">
    <circle cx="275" cy="143" r="118" fill="#E0EDFF" /><circle cx="404" cy="57" r="9" fill="#C3DCFB" /><circle cx="93" cy="181" r="5" fill="#9EC5F6" />
    <path d="M60 254h405" stroke="#ABC7E9" strokeWidth="2" strokeLinecap="round" />
    <path d="M147 142h239v15H147z" fill="#197BEA" stroke="#1663C7" strokeWidth="2" /><path d="M161 158v96m209-96v96" stroke="#285783" strokeWidth="11" />
    <path d="M186 159h162v53H186z" fill="#B2D1F8" stroke="#578CCB" strokeWidth="2" /><path d="M267 160v51m-23-27h9m29 0h9" stroke="#3E73AF" strokeWidth="2" strokeLinecap="round" />
    <path d="m204 141-5-46h90l-5 46" fill="#F6FAFF" stroke="#588DCB" strokeWidth="2" /><path d="M244 142v-12" stroke="#588DCB" strokeWidth="2" />
    <path d="M311 141v-34l20-22m-13-7 26 14-10 17-26-14 10-17Z" fill="#71A8EC" stroke="#2A69B5" strokeWidth="2" /><path d="M300 141h27" stroke="#2A69B5" strokeWidth="3" strokeLinecap="round" />
    <path d="M88 224h39l-5 29H93l-5-29Z" fill="#9BBAAC" /><path d="M107 223v-38m0 24c-22-3-21-22-21-22 21 1 21 22 21 22Zm1-11c18-4 18-21 18-21-18 3-18 21-18 21Z" fill="#83A796" stroke="#628B77" strokeWidth="2" />
    <path d="M400 220h44v9h-44zM407 229v25m30-25v25" stroke="#477FBF" strokeWidth="5" /><path d="m420 124 5-8m-1 12 9-1" stroke="#5A97E3" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

type ResumeProps = { resumeLabel?: string; onResume: () => void; busy: boolean };
function SavedPaymentNotice({ resumeLabel, onResume, busy }: ResumeProps) {
  if (!resumeLabel) return null;
  return <aside className="saved-payment-notice"><div><strong>Your payment is saved.</strong><p>Return to the same attempt and its saved amount whenever you’re ready.</p></div><button className="secondary-button" disabled={busy} onClick={onResume}>{resumeLabel} <span aria-hidden="true">↗</span></button></aside>;
}
export function BrowseServicesScreen({ onDetails, onResume, resumeLabel, busy }: ResumeProps & { onDetails: () => void }) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const services = filterServices(category, query);
  const selected = categories.find(item => item.id === category);
  function reset() { setCategory('all'); setQuery(''); }
  return <main className="services-layout" id="main-content">
    <SavedPaymentNotice resumeLabel={resumeLabel} onResume={onResume} busy={busy} />
    <section className="browse-hero"><div><p className="eyebrow"><span className="mini-line" /> LOCAL SKILLS. SHARED PROGRESS.</p><h1 id="screen-title" tabIndex={-1}>A little help.<br /><span>A better everyday.</span></h1><p className="lead">Find the right helping hand for your space. Explore local services, starting with our furniture assembly demo.</p><div className="browse-hero-note"><span className="note-check"><CheckIcon /></span>Clear service scope <span className="note-divider">·</span> Transparent 85/15 split</div></div><div className="browse-illustration"><FurnitureArt /><span className="illustration-caption">Made for the work that makes a home.</span></div></section>
    <section className="categories-section" aria-labelledby="categories-title"><div className="section-heading"><div><p className="section-label">FIND YOUR HELPING HAND</p><h2 id="categories-title">What can we help with?</h2></div><button className="text-button" onClick={reset}>View all services <span aria-hidden="true">↗</span></button></div>
      <div className="category-grid">{categories.map(item => <button key={item.id} className={`category-card ${category === item.id ? 'selected' : ''}`} aria-pressed={category === item.id} aria-controls="service-results" onClick={() => setCategory(item.id)}><span className="category-icon"><CategoryIcon category={item.id} /></span><strong>{item.name}</strong><span className="category-description">{item.description}</span><span className={`category-availability ${item.id === 'assembly' ? 'available' : ''}`}>{item.id === 'assembly' ? 'Demo available' : 'Coming soon'}</span></button>)}</div>
    </section>
    <section className="results-section" id="service-results" aria-labelledby="results-title"><div className="section-heading results-heading"><div><p className="section-label">EXPLORE SERVICES</p><h2 id="results-title">{selected ? `${selected.name} services` : 'A good place to start.'}</h2><p className="results-count" role="status">{services.length === 1 ? '1 demo service' : 'No services to show'}{query.trim() ? ` for “${query.trim()}”` : ''}</p></div><div className="service-search"><label htmlFor="service-search">Search services</label><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input id="service-search" type="search" placeholder="Try furniture assembly" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /></div></div></div>
      {services.length ? <div className="service-results-grid">{services.map(service => <article className="service-listing surface" key={service.id}><div className="listing-art"><FurnitureArt compact /><span className="listing-badge">ASSEMBLY</span></div><div className="listing-body"><span className="section-label">DEMO SERVICE · LABOR ONLY</span><h3>{service.title}</h3><p>Get your flat-pack furniture ready for everyday life, with a clear scope and a transparent payment.</p><div className="listing-tags">{service.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="listing-bottom"><div><span>TESTNET DEMO</span><strong>Choose your XLM amount</strong></div><button className="primary-button" disabled={busy} onClick={onDetails}>View service <span aria-hidden="true">↗</span></button></div></div></article>)}<aside className="more-services-card"><span className="more-services-icon"><CategoryIcon category="carpentry" /></span><span className="section-label">MORE HELP IS ON THE WAY</span><h3>A growing circle of skills.</h3><p>Carpentry, plumbing, electrical, cleaning and painting are planned categories. Explore them above to see what’s coming.</p><p className="catalog-disclosure">This presentation includes one demo service. Additional services and worker availability are not live.</p></aside></div>
        : <div className="empty-services surface"><span className="category-icon"><CategoryIcon category={selected?.id ?? 'assembly'} /></span><h3>{selected && selected.id !== 'assembly' ? `${selected.name} is coming soon.` : 'No matching services yet.'}</h3><p>{selected && selected.id !== 'assembly' ? 'This category is part of the BAYANIHAN vision. Furniture assembly is the available presentation demo.' : 'Try “furniture”, “assembly” or clear the filters to see the demo service.'}</p><button className="secondary-button" onClick={reset}>Explore the assembly demo <span aria-hidden="true">↗</span></button></div>}
    </section><p className="catalog-footnote">Presentation catalog · Demo profiles and simulated physical completion · Payments use Stellar Testnet.</p>
  </main>;
}

export function ServiceDetailsScreen({ onBrowse, onCheckout, onResume, resumeLabel, busy }: ResumeProps & { onBrowse: () => void; onCheckout: () => void }) {
  const service = assemblyService;
  return <main className="service-detail-layout" id="main-content"><nav className="breadcrumbs" aria-label="Breadcrumb"><button onClick={onBrowse}>Services</button><span aria-hidden="true">/</span><button onClick={onBrowse}>Assembly</button><span aria-hidden="true">/</span><span aria-current="page">Furniture assembly</span></nav>
    <SavedPaymentNotice resumeLabel={resumeLabel} onResume={onResume} busy={busy} />
    <div className="service-detail-grid"><section className="service-detail-content"><div className="detail-art"><FurnitureArt /><span className="listing-badge">ASSEMBLY · DEMO SERVICE</span></div><p className="eyebrow">A HELPING HAND FOR YOUR HOME</p><h1 id="screen-title" tabIndex={-1}>Furniture <span>assembly.</span></h1><p className="detail-description">{service.description}</p><div className="detail-tags"><span>Labor only</span><span>Duration varies by item</span><span>Testnet presentation</span></div>
      <section className="scope-section" aria-labelledby="scope-title"><h2 id="scope-title">The right help, clearly defined.</h2><p>A proposed service scope for this demonstration.</p><div className="scope-grid"><div><h3>What’s included</h3><ul>{service.includes.map(item => <li key={item}><CheckIcon /><span>{item}</span></li>)}</ul></div><div><h3>What’s outside the scope</h3><ul>{service.excludes.map(item => <li key={item}><span className="scope-minus" aria-hidden="true">−</span><span>{item}</span></li>)}</ul></div></div></section>
      <section className="demo-worker surface" aria-labelledby="worker-title"><div className="worker-avatar" aria-hidden="true">BA</div><div><span className="section-label">DEMO WORKER PROFILE</span><h2 id="worker-title">Assembly demo worker</h2><p>Furniture assembly · Demonstration profile</p><p className="worker-disclosure">A presentation example. Identity, location and availability have not been verified. Payment recipients are checked against the configured Paiflow deployment at checkout.</p></div></section>
    </section><aside className="service-summary surface" aria-labelledby="summary-title"><span className="section-label">TRANSPARENT FROM THE START</span><h2 id="summary-title">Good work.<br />A fair share.</h2><p>Explore the service, then try the integrated payment experience.</p><div className="service-price"><span>Testnet payment amount</span><strong>You choose. <small>XLM</small></strong><p>0.00001–10,000 XLM · Up to 7 decimal places</p></div><div className="detail-split"><div><span><i className="dot worker-dot" />Worker</span><strong>85%</strong></div><div><span><i className="dot platform-dot" />BAYANIHAN</span><strong>15%</strong></div><div className="split-bar"><span /><span /></div></div><p className="summary-fee-note">The split comes from your selected amount. Network fees are additional and shown in Freighter.</p><button className="primary-button" disabled={busy} onClick={onCheckout}>{resumeLabel || 'Try payment demo'} <span aria-hidden="true">↗</span></button><p className="summary-demo-note">Test assets only. This demonstration simulates the service and physical completion; it does not create a booking.</p><div className="summary-payment-path"><span>PAYMENT POWERED BY</span><strong>Freighter <b>×</b> Paiflow</strong><p>Your wallet signs. The server verifies the original transaction and both payouts.</p></div><button className="text-button" onClick={onBrowse}>← Back to services</button></aside></div>
  </main>;
}
