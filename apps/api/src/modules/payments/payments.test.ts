import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Account, Address, Asset, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';
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
  async reserve(customerId: string, address: string, deploymentId: string, expected: Split) {
    const found = this.rows.find(p => p.customer_id === customerId && p.active);
    if (found) return { payment: structuredClone(found), created: false };
    const now = new Date().toISOString();
    const row: Payment = { id: randomUUID(), customer_id: customerId, payer_address: address, deployment_id: deploymentId,
      status: 'preparing', active: true, split: expected, unsigned_xdr: null, signed_xdr: null, transaction_hash: null,
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
  const tx = envelope();
  let preparations = 0, submissions = 0;
  let result: ChainResult = { status: 'unknown' };
  let loseResponse = false;
  const sent: string[] = [];
  const gateway: PaymentGateway = {
    configuration: async () => split,
    prepare: async () => { preparations++; return { xdr: tx.toXdr(), hash: transactionHash(tx.toXdr()), expiresAt: new Date(Number(tx.timeBounds!.maxTime) * 1000).toISOString(), requestId: null, fee: tx.fee }; },
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
const transfers = () => [
  { contract: split.token, from: payer.publicKey(), to: split.trigger, amount: '10000000' },
  { contract: split.token, from: split.trigger, to: split.splitter, amount: '10000000' },
  { contract: split.token, from: split.splitter, to: split.worker, amount: '8500000' },
  { contract: split.token, from: split.splitter, to: split.platform, amount: '1500000' },
];

test('concurrent preparation reserves one attempt and prepares only once', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => f.service.prepare('customer', payer.publicKey())));
  assert.equal(new Set(results.map(p => p.id)).size, 1);
  assert.equal(f.store.rows.length, 1);
  assert.equal(f.counts().preparations, 1);
});

test('concurrent submit saves the original first and sends it only once', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey()); const signed = f.sign();
  await Promise.all(Array.from({ length: 12 }, () => f.service.submit('customer', p.id, signed)));
  assert.equal(f.counts().submissions, 1);
  assert.equal((await f.service.current('customer'))?.status, 'pending');
});

test('lost response remains pending, blocks replacement, and retries identical envelope', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey()); f.loseResponse();
  const pending = await f.service.submit('customer', p.id, f.sign());
  assert.equal(pending.status, 'pending');
  await assert.rejects(f.service.newDemo('customer', p.id), /Resolve the original/);
  const again = await f.service.prepare('customer', anotherPayer.publicKey());
  assert.equal(again.id, p.id);
  await f.service.retryOriginal('customer', p.id);
  assert.equal(f.counts().preparations, 1);
  assert.equal(f.sent[0], f.sent[1]);
  const dto = JSON.stringify(publicPayment(pending));
  assert.equal(dto.includes('signed_xdr'), false);
  assert.equal(dto.includes(f.sent[0]!), false);
});

test('another customer cannot read, check, or submit the attempt', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
  await assert.rejects(f.service.check('intruder', p.id), /not found/);
  await assert.rejects(f.service.submit('intruder', p.id, f.sign()), /not found/);
  assert.equal(await f.service.current('intruder'), null);
  assert.equal(f.counts().submissions, 0);
});

test('changed amount, signer, network and unsigned envelopes fail before submission', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
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
  assert.doesNotThrow(() => validatePreparation(envelope().toXdr(), payer.publicKey(), split));
  assert.throws(() => validatePreparation(envelope('9999999').toXdr(), payer.publicKey(), split));
  assert.throws(() => validatePreparation(envelope().toXdr(), anotherPayer.publicKey(), split));
  assert.throws(() => validatePreparation(envelope().toXdr(), payer.publicKey(), { ...split, trigger: split.splitter }));
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(anotherPayer.publicKey(), '100', envelope(), Networks.TESTNET);
  assert.throws(() => validatePreparation(feeBump.toXdr(), payer.publicKey(), split), /Fee-bump/);
});

test('successful original transaction needs both exact native-XLM transfers', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
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
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
  await f.service.submit('customer', p.id, f.sign());
  f.setResult({ status: 'success', hash: 'a'.repeat(64), ledger: 42, transfers: transfers() });
  assert.equal((await f.service.check('customer', p.id)).status, 'pending');
});

test('recipient extra credits or debits are rejected and receipt is server-only', async () => {
  const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
  assert.equal(matchingPayouts(p, transfers()), true);
  assert.equal(matchingPayouts(p, [...transfers(), { contract: split.token, from: split.worker, to: split.platform, amount: '1' }]), false);
  assert.equal(matchingPayouts(p, [...transfers(), { contract: split.token, from: split.trigger, to: split.worker, amount: '1' }]), false);
});

test('chain failure or covered expiry releases a payment only after reconciliation', async () => {
  for (const status of ['failed', 'expired'] as const) {
    const f = fixture(); const p = await f.service.prepare('customer', payer.publicKey());
    f.setResult({ status });
    assert.equal((await f.service.check('customer', p.id)).status, status);
    await f.service.newDemo('customer', p.id);
    assert.equal(await f.service.current('customer'), null);
  }
});

test('recipient wallet cannot be used as the payer', async () => {
  const f = fixture();
  await assert.rejects(f.service.prepare('customer', split.worker), /distinct/);
  await assert.rejects(f.service.prepare('customer', 'invalid'), /valid Freighter/);
  assert.equal(f.counts().preparations, 0);
});

test('crashed unexposed preparation can be safely resolved after its grace period', async () => {
  const f = fixture(); const r = await f.store.reserve('customer', payer.publicKey(), deployment, split);
  f.store.rows[0]!.created_at = new Date(Date.now() - 180000).toISOString();
  assert.equal((await f.service.check('customer', r.payment.id)).status, 'failed');
  await f.service.newDemo('customer', r.payment.id);
});

test('HTTP checkout rejects anonymous/worker access and client-selected price or hash', async () => {
  const { default: express } = await import('express');
  const { default: request } = await import('supertest');
  const { createPaymentRouter } = await import('./routes.js');
  const { readEnv } = await import('../../config/env.js');
  const { PaymentError } = await import('./model.js');
  const f = fixture();
  const db = {
    auth: { getUser: async (token: string) => ({ data: { user: token === 'bad' ? null : { id: token } }, error: null }) },
    from: () => ({ select: () => ({ eq: (_field: string, id: string) => ({ maybeSingle: async () => ({ data: { id, role: id === 'worker' ? 'worker' : 'customer', display_name: 'Demo account' }, error: null }) }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
  const app = express(); app.use(express.json()); app.use('/api', createPaymentRouter(readEnv({}), db, f.service));
  app.use(((error, _req, res, _next) => { res.status(error instanceof PaymentError ? error.status : 500).json({ error: { code: error.code, message: error.message } }); }) as import('express').ErrorRequestHandler);
  await request(app).get('/api/payments/demo').expect(401);
  await request(app).get('/api/payments/demo').set('Authorization', 'Bearer bad').expect(401);
  await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer worker').send({ payer: payer.publicKey() }).expect(403);
  await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').send({ payer: payer.publicKey(), amount: '1' }).expect(400);
  const response = await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').send({ payer: payer.publicKey() }).expect(200);
  assert.equal(response.body.payment.total, '10000000');
  await request(app).post(`/api/payments/demo/${response.body.payment.id}/check`).set('Authorization', 'Bearer intruder').send({}).expect(404);
  await request(app).post(`/api/payments/demo/${response.body.payment.id}/submit`).set('Authorization', 'Bearer customer').send({ signedXdr: f.sign(), hash: 'a'.repeat(64) }).expect(400);
  await request(app).post('/api/payments/demo/prepare').set('Authorization', 'Bearer customer').set('Origin', 'https://untrusted.example').send({ payer: payer.publicKey() }).expect(403);
  assert.equal(f.counts().submissions, 0);
  assert.equal(JSON.stringify(response.body).includes('signed_xdr'), false);
});
