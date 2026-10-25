import { useEffect, useState } from 'react';
import wordmark from '../../../assets/branding/Bayanihan Logo.png';
import symbol from '../../../assets/branding/4.svg';
import { apiFetch } from './lib/api';

export function App() {
  const [apiStatus, setApiStatus] = useState('Checking connection…');

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ status: string }>('/api/health', { signal: controller.signal })
      .then(() => setApiStatus('API connected'))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('API unavailable. Start the Express server.');
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="header">
        <img className="wordmark" src={wordmark} alt="BAYANIHAN" />
        <span className="environment">Stellar Testnet</span>
      </header>
      <main>
        <img className="symbol" src={symbol} alt="" aria-hidden="true" />
        <p className="eyebrow">Local skills. Community support.</p>
        <h1>A helping hand,<br />closer to home.</h1>
        <p className="intro">Book a local skilled worker, confirm the work, and pay with a clear breakdown.</p>
        <p className="notice">Project foundation is ready. Booking and checkout are coming next.</p>
        <div className="details">
          <p><strong>85%</strong> to the worker</p>
          <p><strong>15%</strong> to BAYANIHAN</p>
        </div>
        <p className="status" role="status">{apiStatus}</p>
      </main>
      <footer>Development scaffold · Test assets only</footer>
    </>
  );
}
