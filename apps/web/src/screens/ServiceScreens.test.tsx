import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Payment } from '../features/payments/api';
import { categories, filterServices } from '../features/services/catalog';
import { BrowseServicesScreen, ServiceDetailsScreen } from './ServiceScreens';
import { parseRoute, resolveScreen, type Route } from './navigation';

const noop = () => {};
const hash = 'a'.repeat(64);
const payment: Payment = { id: 'saved-payment', status: 'pending', payer: 'original-payer', split: { worker: 'original-worker', platform: 'original-platform', splitter: 'original-splitter', trigger: 'original-trigger', token: 'native-token' }, hash, expiresAt: null, createdAt: '2026-10-25T04:00:00Z', xdr: null, receipt: null, total: '25000000', workerAmount: '21250000', platformAmount: '3750000' };
function screen(route: Route, overrides: Partial<Parameters<typeof resolveScreen>[0]> = {}) {
  return resolveScreen({ route, restoring: false, authenticated: true, accountReady: true, role: 'customer', payment: null, ...overrides });
}

test('catalog exposes exactly the six requested categories with only assembly available', () => {
  assert.deepEqual(categories.map(value => value.name), ['Assembly', 'Carpentry', 'Plumbing', 'Electrical', 'Cleaning', 'Painting']);
  assert.equal(filterServices('all', '').length, 1);
  assert.equal(filterServices('assembly', '').length, 1);
  for (const category of categories.slice(1)) assert.deepEqual(filterServices(category.id, ''), []);
});
test('search combines with categories, normalizes text and returns honest empty results', () => {
  assert.equal(filterServices('all', '  FURNITURE  ').length, 1);
  assert.equal(filterServices('assembly', 'flat-pack').length, 1);
  assert.equal(filterServices('cleaning', 'furniture').length, 0);
  assert.equal(filterServices('all', 'unavailable service').length, 0);
});
test('browse renders the six selectable categories and one clearly labeled service', () => {
  const html = renderToStaticMarkup(<BrowseServicesScreen onDetails={noop} onResume={noop} busy={false} />);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 6);
  assert.equal((html.match(/Coming soon/g) ?? []).length, 5);
  assert.match(html, /Search services/);
  assert.match(html, /View service/);
  assert.doesNotMatch(html, /Book now|Resume saved payment|5\.0|Verified worker/);
});
test('details disclose demo worker, proposed scope, fees and no actual booking', () => {
  const html = renderToStaticMarkup(<ServiceDetailsScreen onBrowse={noop} onCheckout={noop} onResume={noop} busy={false} />);
  for (const value of ['What’s included', 'What’s outside the scope', 'DEMO WORKER PROFILE', 'have not been verified', 'Try payment demo', 'does not create a booking', '85%', '15%', 'Network fees are additional']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /type="datetime|Book now|verified identity/i);
});
test('saved-payment notices offer resume without clearing or preparing another attempt', () => {
  const html = renderToStaticMarkup(<ServiceDetailsScreen onBrowse={noop} onCheckout={noop} onResume={noop} busy={false} resumeLabel="Resume saved payment" />);
  assert.match(html, /Your payment is saved/);
  assert.match(html, /Resume saved payment/);
  assert.doesNotMatch(html, /Try payment demo|Start another test payment/);
});
test('public browse/details work while authentication restores or the account API is unavailable', () => {
  for (const route of ['browse', 'details'] as const) {
    assert.equal(screen(route, { restoring: true, authenticated: false, accountReady: false }), route);
    assert.equal(screen(route, { accountReady: false }), route);
  }
  assert.equal(screen('auto', { authenticated: false, accountReady: false }), 'login');
  assert.equal(screen('auto'), 'browse');
});
test('payment deep link requires a verified customer account and resumes after sign-in', () => {
  assert.equal(screen('payment', { authenticated: false, accountReady: false }), 'login');
  assert.equal(screen('payment', { restoring: true }), 'loading');
  assert.equal(screen('payment', { accountReady: false }), 'account');
  assert.equal(screen('payment', { role: 'worker' }), 'worker');
  assert.equal(screen('payment'), 'checkout');
});
test('saved pending and paid attempts restore on entry and remain resumable after browsing', () => {
  assert.equal(screen('auto', { payment }), 'checkout');
  assert.equal(screen('browse', { payment }), 'browse');
  assert.equal(screen('details', { payment }), 'details');
  assert.equal(screen('payment', { payment }), 'checkout');
  const paid: Payment = { ...payment, status: 'paid', receipt: { hash, ledger: 123, verifiedAt: '2026-10-25T04:05:00Z' } };
  assert.equal(screen('auto', { payment: paid }), 'receipt');
  assert.equal(screen('payment', { payment: paid }), 'receipt');
  assert.equal(screen('payment', { payment: { ...paid, receipt: null } }), 'checkout');
});
test('navigation resolves supported deep links and rejects arbitrary service identifiers', () => {
  assert.equal(parseRoute(''), 'auto');
  assert.equal(parseRoute('#services'), 'browse');
  assert.equal(parseRoute('#services/furniture-assembly'), 'details');
  assert.equal(parseRoute('#payment'), 'payment');
  assert.equal(parseRoute('#login'), 'login');
  assert.equal(parseRoute('#services/nonexistent'), 'browse');
});
