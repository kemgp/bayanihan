import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckoutScreen, LoginScreen, ReceiptScreen, hasVerifiedReceipt, type CheckoutProps } from './PaymentScreens';
import type { Payment, Profile, Split } from '../features/payments/api';

const noop = async () => {};
const profile: Profile = { id: 'customer-id', display_name: 'Demo Customer', role: 'customer' };
const split: Split = { worker: `G${'W'.repeat(55)}`, platform: `G${'P'.repeat(55)}`, splitter: `C${'S'.repeat(55)}`, trigger: `C${'T'.repeat(55)}`, token: `C${'X'.repeat(55)}` };
const hash = 'a'.repeat(64);
const base: CheckoutProps = { symbol: '/symbol.svg', profile, config: { ready: true, network: 'testnet', split }, payment: null, amount: '2.5', wallet: '', busy: '', error: '', notice: '', onAmount: () => {}, onConnect: noop, onPrepare: noop, onSign: noop, onCheck: noop, onRetry: noop, onNew: noop, onConnection: noop };
function payment(overrides: Partial<Payment> = {}): Payment {
  return { id: 'payment-reference', payer: `G${'C'.repeat(55)}`, status: 'prepared', hash: null, expiresAt: new Date(Date.now() + 120_000).toISOString(), createdAt: '2026-10-25T04:00:00Z', xdr: 'private-unsigned-envelope', receipt: null, total: '25000000', workerAmount: '21250000', platformAmount: '3750000', split, ...overrides };
}
function paid(overrides: Partial<Payment> = {}) { return payment({ status: 'paid', hash, xdr: null, receipt: { hash, ledger: 123456, verifiedAt: '2026-10-25T04:05:00Z' }, ...overrides }); }
const renderCheckout = (overrides: Partial<CheckoutProps> = {}) => renderToStaticMarkup(<CheckoutScreen {...base} {...overrides} />);
const renderReceipt = (value: Payment) => renderToStaticMarkup(<ReceiptScreen payment={value} profile={profile} busy="" error="" onNew={noop} />);
function button(html: string, text: string) {
  const found = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(match => match[0].includes(text));
  assert.ok(found, `Expected button: ${text}`);
  return found[0];
}

test('sign-in is a dedicated account form with accessible password controls and no role picker', () => {
  const html = renderToStaticMarkup(<LoginScreen symbol="/symbol.svg" configured busy="" error="" onLogin={noop} />);
  assert.match(html, /autoComplete="username"/);
  assert.match(html, /autoComplete="current-password"/);
  assert.match(html, /aria-label="Show password"/);
  assert.doesNotMatch(html, /<select|payment-amount|Sign &amp; pay/);
  assert.match(html, /physical completion are simulated/);
});
test('unconfigured authentication and sign-in errors remain actionable', () => {
  const html = renderToStaticMarkup(<LoginScreen symbol="/symbol.svg" configured={false} busy="" error="Account unavailable" onLogin={noop} />);
  assert.match(button(html, 'Sign in to continue'), /disabled=""/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Account unavailable/);
});
test('checkout previews the selected amount and exact 85/15 split before connecting', () => {
  const html = renderCheckout();
  assert.match(html, /value="2.5"/);
  assert.match(html, /2.125 XLM/);
  assert.match(html, /0.375 XLM/);
  assert.match(button(html, 'Prepare payment'), /disabled=""/);
  assert.doesNotMatch(button(html, 'Connect Freighter'), /disabled/);
});
test('invalid and deployment-below-minimum amounts disable preparation', () => {
  for (const amount of ['1e3', '-1', '0', '1.12345678', '10001']) {
    const html = renderCheckout({ amount, wallet: payment().payer });
    assert.match(html, /aria-invalid="true"/);
    assert.match(button(html, 'Prepare payment'), /disabled=""/);
  }
  const html = renderCheckout({ amount: '2.5', wallet: payment().payer, config: { ready: true, network: 'testnet', split: { ...split, minimumAmount: '30000000' } } });
  assert.match(button(html, 'Prepare payment'), /disabled=""/);
});
test('prepared payment locks its saved amount and requires the original wallet to sign', () => {
  const saved = payment();
  const html = renderCheckout({ payment: saved, amount: '999', wallet: saved.payer });
  const amountInput = html.match(/<input id="payment-amount"[^>]+>/)?.[0] ?? '';
  assert.match(amountInput, /value="2.50"/);
  assert.match(amountInput, /disabled=""/);
  assert.doesNotMatch(button(html, 'Sign &amp; pay 2.50 XLM'), /disabled/);
  assert.doesNotMatch(html, /private-unsigned-envelope|999 XLM/);
  assert.match(button(renderCheckout({ payment: saved, wallet: split.worker }), 'Sign &amp; pay'), /disabled=""/);
});
test('expired local signing countdown cannot authorize a replacement payment', () => {
  const saved = payment({ expiresAt: '2026-01-01T00:00:00Z' });
  const html = renderCheckout({ payment: saved, wallet: saved.payer });
  assert.match(button(html, 'Sign &amp; pay'), /disabled=""/);
  assert.match(html, /Check payment status/);
  assert.doesNotMatch(html, /Start another test payment|Payment verified/);
});
test('pending recovery exposes original status and identical retry without prepare or success', () => {
  const html = renderCheckout({ payment: payment({ status: 'pending', hash, xdr: null }) });
  assert.match(html, /Payment is being verified/);
  assert.match(html, /Retry the saved transaction/);
  assert.match(html, /Check payment status/);
  assert.doesNotMatch(html, /Sign &amp; pay|Prepare payment|Start another test payment|Payment verified/);
});
test('terminal server outcome permits an explicit new attempt, unavailable connection permits retry', () => {
  const html = renderCheckout({ payment: payment({ status: 'expired', xdr: null }), config: { ready: false, network: 'testnet', message: 'Try again shortly' } });
  assert.match(html, /server confirmed expiry/);
  assert.match(html, /Start another test payment/);
  assert.match(html, /Check connection again/);
});
test('receipt gating rejects pending, missing, mismatched, malformed and inconsistent evidence', () => {
  for (const value of [null, payment(), paid({ status: 'pending' }), paid({ receipt: null }), paid({ hash: 'b'.repeat(64) }), paid({ receipt: { hash, ledger: 0, verifiedAt: '2026-10-25T04:05:00Z' } }), paid({ receipt: { hash, ledger: 123, verifiedAt: 'invalid' } }), paid({ workerAmount: '21250001', platformAmount: '3749999' }), paid({ total: 'malformed' })]) {
    assert.equal(hasVerifiedReceipt(value), false);
  }
  assert.equal(hasVerifiedReceipt(paid()), true);
  assert.doesNotMatch(renderReceipt(payment()), /Payment verified|Total paid/);
});
test('verified receipt includes saved totals, full addresses, original explorer link and recovery action', () => {
  const html = renderReceipt(paid());
  for (const text of ['Payment verified', '2.5', '2.125', '0.375', '123,456', 'PHT', split.worker, split.platform, hash, 'Print receipt', 'Copy transaction ID', 'Start another test payment']) assert.ok(html.includes(text), text);
  assert.match(html, new RegExp(`https://stellar.expert/explorer/testnet/tx/${hash}`));
  assert.doesNotMatch(html, /private-unsigned-envelope|signedXdr/);
});
