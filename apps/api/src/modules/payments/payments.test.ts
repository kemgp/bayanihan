import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Account, Address, Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';
import { parsePaymentAmount, type PaymentAmounts } from './amount.js';
import { previewAmount, formatXlm } from '../../../../web/src/features/payments/amount.js';
import { createPaymentService } from './service.js';
import { transactionHash, validatePreparation, validateSigned } from './gateway.js';
import { matchingPayouts, publicPayment, type ChainResult, type Payment, type PaymentGateway, type PaymentStore, type Split } from './model.js';

const payer = Keypair.random();
const anotherPayer = Keypair.random();
const split: Split = {
  worker: Keypair.random().publicKey(), platform: Keypair.random().publicKey(),
  trigger: Address.contract(new Uint8Array(32).fill(1)).toString(),
  splitter: Address.contract(new Uint8Array(32).fill(2)).toString(), token: Asset.native().contractId(Networks.TESTNET),
};
const deployment = randomUUID();
const envelope = (amount = '10000000', key = payer, network = Networks.TESTNET) => new TransactionBuilder(new Account(key.publicKey(), '10'), { fee: '100', networkPassphrase: network })
  .addOperation(new Contract(split.trigger).call('deposit', new Address(key.publicKey()).toScVal(), nativeToScVal(BigInt(amount), { type: 'i128' })))
  .setTimeout(180).build();

class MemoryStore implements PaymentStore {
  rows: Payment[] = [];
  async current(customerId: string) { return structuredClone(this.rows.find(p => p.customer_id === customerId && p.active) ?? null); }
  async get(id: string, customerId: string) { return structuredClone(this.rows.find(p => p.id === id && p.customer_id === customerId) ?? null); }
  async reserve(customerId: string, address: string, deploymentId: string, expected: Split, amounts: PaymentAmounts) {
    const found = this.rows.find(p => p.customer_id === customerId && p.active);
    if (found) return { payment: structuredClone(found), created: false };
    const now = new Date().toISOString();
    const row: Payment = { id: randomUUID(), customer_id: customerId, payer_address: address, deployment_id: deploymentId,
      ...amounts, status: 'preparing', active: true, split: expected, unsigned_xdr: null, signed_xdr: null, transaction_hash: null,
      preparation_request_id: null, expires_at: null, receipt: null, created_at: now, updated_at: now };
    this.rows.push(row);
    return { payment: structuredClone(row), created: true };
  }
  async update(payment: Payment, patch: Partial<Payment>) {
    const row = this.rows.find(p => p.id === payment.id && p.customer_id === payment.customer_id && p.status === payment.status && p.active === payment.active);
    if (!row) return null;
    Object.assign(row, structuredClone(patch));
    return structuredClone(row);
  }
}
function fixture() {
  const store = new MemoryStore();
  let tx = envelope();
  let preparations = 0, submissions = 0;
  let result: ChainResult = { status: 'unknown' };
  let loseResponse = false;
  const sent: string[] = [];
  const gateway: PaymentGateway = {
    configuration: async () => split,
    prepare: async (_payer, _split, amountStroops) => { preparations++; tx = envelope(amountStroops); return { xdr: tx.toXdr(), hash: transactionHash(tx.toXdr()), expiresAt: new Date(Number(tx.timeBounds!.maxTime) * 1000).toISOString(), requestId: null, fee: tx.fee }; },
    validateSigned,
    submit: async payment => {
      submissions++;
      assert.equal(store.rows[0]?.status, 'pending');
      assert.equal(store.rows[0]?.signed_xdr, payment.signed_xdr, 'envelope must already be persisted before network submit');
      sent.push(payment.signed_xdr!);
      if (loseResponse) throw new Error('timeout');
    },
    inspect: async () => result,
  };
  const service = createPaymentService(store, gateway, deployment);
  const sign = () => { tx.sign(payer); return tx.toXdr(); };
  return { store, service, sign, sent, setResult: (r: ChainResult) => { result = r; }, loseResponse: () => { loseResponse = true; }, counts: () => ({ preparations, submissions }) };
}
const transfers = (amountXlm = '1') => { const a = parsePaymentAmount(amountXlm); return [
  { contract: split.token, from: payer.publicKey(), to: split.trigger, amount: a.amount_stroops },
  { contract: split.token, from: split.trigger, to: split.splitter, amount: a.amount_stroops },
  { contract: split.token, from: split.splitter, to: split.worker, amount: a.worker_amount_stroops },
  { contract: split.token, from: split.splitter, to: split.platform, amount: a.platform_amount_stroops },
]; };

test('concurrent preparation reserves one attempt and prepares only once', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => f.service.prepare('customer', payer.publicKey(), '1')));
  assert.equal(new Set(results.map(p => p.id)).size, 1);
  assert.equal(f.store.rows.length, 1);
  assert.equal(f.counts().preparations, 1);
});

test('concurrent submit saves the original first and sends it only once', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1'); const signed = f.sign();
  await Promise.all(Array.from({ length: 12 }, () => f.service.submit('customer', p.id, signed)));
  assert.equal(f.counts().submissions, 1);
  assert.equal((await f.service.current('customer'))?.status, 'pending');
});

test('lost response remains pending, blocks replacement, and retries identical envelope', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1'); f.loseResponse();
  const pending = await f.service.submit('customer', p.id, f.sign());
  assert.equal(pending.status, 'pending');
  await assert.rejects(f.service.newDemo('customer', p.id), /Resolve the original/);
  await assert.rejects(f.service.prepare('customer', anotherPayer.publicKey(), '1'), /different amount or wallet/);
  const again = await f.service.prepare('customer', payer.publicKey(), '1');
  assert.equal(again.id, p.id);
  await f.service.retryOriginal('customer', p.id);
  assert.equal(f.counts().preparations, 1);
  assert.equal(f.sent[0], f.sent[1]);
  const dto = JSON.stringify(publicPayment(pending));
  assert.equal(dto.includes('signed_xdr'), false);
  assert.equal(dto.includes(f.sent[0]!), false);
});

test('another customer cannot read, check, or submit the attempt', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
  await assert.rejects(f.service.check('intruder', p.id), /not found/);
  await assert.rejects(f.service.submit('intruder', p.id, f.sign()), /not found/);
  assert.equal(await f.service.current('intruder'), null);
  assert.equal(f.counts().submissions, 0);
});

test('changed amount, signer, network and unsigned envelopes fail before submission', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
  const altered = envelope('20000000'); altered.sign(payer);
  const wrongSigner = envelope(); wrongSigner.sign(anotherPayer);
  const mainnet = envelope('10000000', payer, Networks.PUBLIC); mainnet.sign(payer);
  for (const xdr of [altered.toXdr(), wrongSigner.toXdr(), mainnet.toXdr(), envelope().toXdr(), 'malformed']) {
    await assert.rejects(f.service.submit('customer', p.id, xdr), /must match/);
  }
  assert.equal(f.counts().submissions, 0);
  assert.equal((await f.service.current('customer'))?.status, 'prepared');
});

test('preparation validates exact deposit payer, amount and configured trigger', () => {
  assert.doesNotThrow(() => validatePreparation(envelope().toXdr(), payer.publicKey(), split, '10000000'));
  assert.throws(() => validatePreparation(envelope('9999999').toXdr(), payer.publicKey(), split, '10000000'));
  assert.throws(() => validatePreparation(envelope().toXdr(), anotherPayer.publicKey(), split, '10000000'));
  assert.throws(() => validatePreparation(envelope().toXdr(), payer.publicKey(), { ...split, trigger: split.splitter }, '10000000'));
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(anotherPayer.publicKey(), '100', envelope(), Networks.TESTNET);
  assert.throws(() => validatePreparation(feeBump.toXdr(), payer.publicKey(), split, '10000000'), /Fee-bump/);
});

test('successful original transaction needs both exact native-XLM transfers', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
  await f.service.submit('customer', p.id, f.sign());
  for (const bad of [[], transfers().slice(0, 3), transfers().map(t => t.to === split.worker ? { ...t, amount: '8499999' } : t), transfers().map(t => ({ ...t, contract: split.trigger }))]) {
    f.setResult({ status: 'success', hash: p.transaction_hash!, ledger: 42, transfers: bad });
    assert.equal((await f.service.check('customer', p.id)).status, 'pending');
  }
  f.setResult({ status: 'success', hash: p.transaction_hash!, ledger: 42, transfers: transfers() });
  const paid = await f.service.check('customer', p.id);
  assert.equal(paid.status, 'paid'); assert.equal(paid.receipt?.ledger, 42);
  assert.deepEqual((await f.service.current('customer'))?.receipt, paid.receipt);
  await f.service.newDemo('customer', p.id);
  assert.equal(await f.service.current('customer'), null);
  assert.equal(f.store.rows[0]?.receipt?.ledger, 42, 'receipt remains stored after starting another demo');
});

test('unrelated transaction hash cannot settle the payment', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
  await f.service.submit('customer', p.id, f.sign());
  f.setResult({ status: 'success', hash: 'a'.repeat(64), ledger: 42, transfers: transfers() });
  assert.equal((await f.service.check('customer', p.id)).status, 'pending');
});

test('recipient extra credits or debits are rejected and receipt is server-only', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
  assert.equal(matchingPayouts(p, transfers()), true);
  assert.equal(matchingPayouts(p, [...transfers(), { contract: split.token, from: split.worker, to: split.platform, amount: '1' }]), false);
  assert.equal(matchingPayouts(p, [...transfers(), { contract: split.token, from: split.trigger, to: split.worker, amount: '1' }]), false);
});

test('chain failure or covered expiry releases a payment only after reconciliation', async () => {
  for (const status of ['failed', 'expired'] as const) {
    const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '1');
    f.setResult({ status });
    assert.equal((await f.service.check('customer', p.id)).status, status);
    await f.service.newDemo('customer', p.id);
    assert.equal(await f.service.current('customer'), null);
  }
});

test('recipient wallet cannot be used as the payer', async () => {
  const f = fixture();
  await assert.rejects(f.service.prepare('customer', split.worker, '1'), /distinct/);
  await assert.rejects(f.service.prepare('customer', 'invalid', '1'), /valid Freighter/);
  assert.equal(f.counts().preparations, 0);
});

test('crashed unexposed preparation can be safely resolved after its grace period', async () => {
  const f = fixture(); const r = await f.store.reserve('customer', payer.publicKey(), deployment, split, parsePaymentAmount('1'));
  f.store.rows[0]!.created_at = new Date(Date.now() - 180000).toISOString();
  assert.equal((await f.service.check('customer', r.payment.id)).status, 'failed');
  await f.service.newDemo('customer', r.payment.id);
});

test('HTTP checkout enforces authentication, origins and server-calculated splits', async () => {
  const { default: express } = await import('express');
  const { default: request } = await import('supertest');
  const { default: cors } = await import('cors');
  const { createPaymentRouter } = await import('./routes.js');
  const { readEnv } = await import('../../config/env.js');
  const { PaymentError } = await import('./model.js');
  const f = fixture();
  const db = {
    auth: { getUser: async (token: string) => ({ data: { user: token === 'bad' ? null : { id: token } }, error: null }) },
    from: () => ({ select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: async () => ({ data: { id, role: id === 'worker' ? 'worker' : 'customer', display_name: 'Demo account' }, error: null }) }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
  const config = readEnv({ WEB_ORIGIN: 'http://127.0.0.1:5174,http://localhost:5174' });
  const app = express(); app.use(cors({ origin: config.webOrigins })); app.use(express.json()); app.use('/api', createPaymentRouter(config, db, f.service));
  app.use(((error, _req, res, _next) => { res.status(error instanceof PaymentError ? error.status : 500).json({ error: { code: error.code, message: error.message } }); }) as import('express').ErrorRequestHandler);
  await request(app).get('/api/payments/demo').expect(401);
  await request(app).get('/api/payments/demo').set('Authorization', 'Bearer bad').expect(401);
  await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer worker').send({ payer: payer.publicKey(), amountXlm: '1' }).expect(403);
  await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').send({ payer: payer.publicKey(), amountXlm: '1', amount: '1' }).expect(400);
  const missing = await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').send({ payer: payer.publicKey() }).expect(400);
  assert.equal(missing.body.error.code, 'INVALID_AMOUNT');
  const response = await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').send({ payer: payer.publicKey(), amountXlm: '2.5' }).expect(200);
  assert.equal(response.body.payment.total, '25000000');
  assert.equal(response.body.payment.workerAmount, '21250000');
  assert.equal(response.body.payment.platformAmount, '3750000');
  await request(app).post(`/api/payments/demo/${response.body.payment.id}/check`).set('Authorization', 'Bearer intruder').send({}).expect(404);
  await request(app).post(`/api/payments/demo/${response.body.payment.id}/submit`).set('Authorization', 'Bearer customer').send({ signedXdr: f.sign(), hash: 'a'.repeat(64) }).expect(400);
  for (const origin of config.webOrigins) {
    const allowed = await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').set('Origin', origin).send({ payer: payer.publicKey(), amountXlm: '2.5' }).expect(200);
    assert.equal(allowed.headers['access-control-allow-origin'], origin);
    assert.equal(allowed.body.payment.id, response.body.payment.id);
  }
  for (const origin of ['https://untrusted.example', 'http://localhost.evil.test:5174', 'http://localhost:51740', 'null']) {
    const rejected = await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').set('Origin', origin).send({ payer: payer.publicKey(), amountXlm: '1' }).expect(403);
    assert.equal(rejected.body.error.code, 'ORIGIN_REJECTED');
    assert.equal(rejected.headers['access-control-allow-origin'], undefined);
  }
  assert.equal(f.counts().preparations, 1);
  assert.equal(f.counts().submissions, 0);
  assert.equal(JSON.stringify(response.body).includes('signed_xdr'), false);
});

test('decimal XLM conversion and split use exact integer stroops', () => {
  assert.deepEqual(parsePaymentAmount('12.3456789'), { amount_stroops: '123456789', worker_amount_stroops: '104938270', platform_amount_stroops: '18518519' });
  for (const input of ['0.00001', '0.01', '1', '2.50', '12.3456789', '10000']) {
    const a = parsePaymentAmount(input);
    assert.equal(BigInt(a.worker_amount_stroops) + BigInt(a.platform_amount_stroops), BigInt(a.amount_stroops));
    assert.deepEqual(previewAmount(input), { total: a.amount_stroops, workerAmount: a.worker_amount_stroops, platformAmount: a.platform_amount_stroops });
  }
  assert.equal(formatXlm('123456789'), '12.3456789');
  assert.equal(formatXlm('25000000'), '2.50');
  assert.equal(formatXlm('100'), '0.00001');
});

test('invalid, excessive, exponential and overprecise amounts are rejected before preparation', async () => {
  const f = fixture();
  for (const value of ['', '0', '-1', '0.0000001', '0.0000099', '10000.0000001', '10001', '1e2', 'NaN', 'Infinity', '1,000', '1.00000001', '01', '1.', '1'.repeat(40), 1, null, undefined, {}]) {
    assert.throws(() => parsePaymentAmount(value), /Enter an XLM amount/);
    if (typeof value === 'string') assert.equal(previewAmount(value), null);
    await assert.rejects(f.service.prepare('customer', payer.publicKey(), value), /Enter an XLM amount/);
  }
  assert.equal(f.store.rows.length, 0);
  assert.equal(f.counts().preparations, 0);
});

test('custom amount persists through signing, exact payout verification and reload', async () => {
  const f = fixture(); const amount = '12.3456789';
  const p = await f.service.prepare('customer', payer.publicKey(), amount);
  assert.equal(p.amount_stroops, '123456789');
  await f.service.submit('customer', p.id, f.sign());
  f.setResult({ status: 'success', hash: p.transaction_hash!, ledger: 42, transfers: transfers('1') });
  assert.equal((await f.service.check('customer', p.id)).status, 'pending');
  f.setResult({ status: 'success', hash: p.transaction_hash!, ledger: 43, transfers: transfers(amount) });
  assert.equal((await f.service.check('customer', p.id)).status, 'paid');
  const restored = publicPayment(await f.service.current('customer'))!;
  assert.equal(restored.total, '123456789');
  assert.equal(restored.workerAmount, '104938270');
  assert.equal(restored.platformAmount, '18518519');
});

test('a saved original cannot be changed by another amount request', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey(), '2.5');
  const same = await f.service.prepare('customer', payer.publicKey(), '2.5000000');
  assert.equal(same.id, p.id);
  await assert.rejects(f.service.prepare('customer', payer.publicKey(), '3'), /different amount or wallet/);
  assert.equal(f.counts().preparations, 1);
  assert.equal(f.store.rows[0]?.amount_stroops, '25000000');
  const altered = envelope('30000000'); altered.sign(payer);
  await assert.rejects(f.service.submit('customer', p.id, altered.toXdr()), /must match/);
  assert.equal(f.counts().submissions, 0);
});

test('concurrent requests for different amounts cannot prepare two charges', async () => {
  const f = fixture();
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => f.service.prepare('customer', payer.publicKey(), i % 2 ? '3' : '2')));
  assert.equal(f.store.rows.length, 1);
  assert.equal(f.counts().preparations, 1);
  assert.ok(results.some(result => result.status === 'rejected'));
  for (const result of results) if (result.status === 'fulfilled') assert.equal(result.value.amount_stroops, f.store.rows[0]?.amount_stroops);
});
