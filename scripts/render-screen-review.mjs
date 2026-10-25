// Isolated visual fixtures. This does not authenticate, sign or call payment APIs.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { CheckoutScreen, ReceiptScreen, LoginScreen } from '../apps/web/src/screens/PaymentScreens.tsx';

const directory = '/private/tmp/bayanihan-screen-review';
await mkdir(`${directory}/assets`, { recursive: true });
const assets = await readdir('apps/web/dist/assets');
const css = assets.find(name => name.endsWith('.css'));
if (!css) throw new Error('Build the application before rendering screen reviews.');
await copyFile(`apps/web/dist/assets/${css}`, `${directory}/assets/${css}`);
await copyFile('assets/branding/Bayanihan Logo.png', `${directory}/assets/wordmark.png`);
await copyFile('assets/branding/4.svg', `${directory}/assets/symbol.svg`);
const noop = async () => {};
const profile = { id: 'sample-customer', display_name: 'Demo Customer', role: 'customer' };
const split = { worker: `G${'W'.repeat(55)}`, platform: `G${'P'.repeat(55)}`, splitter: `C${'S'.repeat(55)}`, trigger: `C${'T'.repeat(55)}`, token: `C${'X'.repeat(55)}` };
const hash = 'a'.repeat(64);
const receipt = { id: 'sample-payment-reference', status: 'paid', payer: `G${'C'.repeat(55)}`, split, hash, expiresAt: null, createdAt: '2026-10-25T04:00:00Z', xdr: null, receipt: { hash, ledger: 123456, verifiedAt: '2026-10-25T04:05:00Z' }, total: '25000000', workerAmount: '21250000', platformAmount: '3750000' };
const checkout = { symbol: '/assets/symbol.svg', profile, config: { ready: true, network: 'testnet', split }, payment: null, amount: '2.5', wallet: '', busy: '', error: '', notice: '', onAmount: () => {}, onConnect: noop, onPrepare: noop, onSign: noop, onCheck: noop, onRetry: noop, onNew: noop, onConnection: noop };
const screens = {
  login: React.createElement(LoginScreen, { symbol: '/assets/symbol.svg', configured: true, busy: '', error: '', onLogin: noop }),
  checkout: React.createElement(CheckoutScreen, checkout),
  pending: React.createElement(CheckoutScreen, { ...checkout, payment: { ...receipt, status: 'pending', receipt: null } }),
  receipt: React.createElement(ReceiptScreen, { payment: receipt, profile, busy: '', error: '', onNew: noop }),
};
for (const [name, screen] of Object.entries(screens)) {
  const step = name === 'login' ? 0 : name === 'receipt' ? 2 : 1;
  const header = `<header class="header"><a class="brand-link" href="/login.html"><img class="wordmark" src="/assets/wordmark.png" alt="BAYANIHAN"></a><nav aria-label="Payment progress"><ol class="journey-steps">${['Sign in','Payment','Receipt'].map((value,i)=>`<li class="${i===step?'current':''}"><span>0${i+1}</span>${value}</li>`).join('')}</ol></nav><div class="header-right"><span class="testnet"><span></span>Stellar Testnet</span>${step?'<button class="text-button" disabled>Sign out</button>':''}</div></header>`;
  const body = renderToStaticMarkup(screen).replace(/<button /g, '<button disabled ').replace(/href="https:[^"]+"/g, 'href="#sample-data"');
  await writeFile(`${directory}/${name}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BAYANIHAN · ${name} screen review</title><link rel="stylesheet" href="/assets/${css}"><style>.sample-banner{padding:9px;text-align:center;background:#fff4cf;color:#694b0d;font:11px sans-serif;border-bottom:1px solid #e9d48b}.sample-banner a{margin:0 5px}</style></head><body><aside class="sample-banner" id="sample-data">DESIGN REVIEW · SAMPLE DATA · NO PAYMENT MADE · ${Object.keys(screens).map(value=>`<a href="/${value}.html">${value}</a>`).join('')}</aside><div class="app-shell">${header}${body}<footer class="page-footer"><span>Built on community. Powered by Stellar.</span><span>Freighter × Paiflow</span><span>Sample data · No payment made</span></footer></div></body></html>`);

}
console.log(`Isolated screen reviews written to ${directory}. Sample data only.`);
