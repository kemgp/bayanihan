import { StrKey } from '@stellar/stellar-sdk';
import { PaymentError, matchingPayouts, type Payment, type PaymentGateway, type PaymentStore } from './model.js';
import { parsePaymentAmount } from './amount.js';

export function createPaymentService(store: PaymentStore, gateway: PaymentGateway, deploymentId: string) {
  const get = async (id: string, customerId: string) => {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new PaymentError(400, 'INVALID_PAYMENT', 'Invalid payment ID.');
    const payment = await store.get(id, customerId);
    if (!payment) throw new PaymentError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
    return payment;
  };
  const refresh = async (payment: Payment) => (await store.get(payment.id, payment.customer_id))!;
  const reconcile = async (payment: Payment) => {
    // A crashed preparation never exposed an envelope: a late preparer loses its CAS and cannot return it.
    if (payment.status === 'preparing' && Date.now() - Date.parse(payment.created_at) > 120000) {
      await store.update(payment, { status: 'failed' });
      return refresh(payment);
    }
    if (!payment.transaction_hash || ['paid', 'failed', 'expired'].includes(payment.status)) return payment;
    let result;
    try { result = await gateway.inspect(payment); }
    catch { return payment; } // An outage never proves failure or permits another charge.
    if (result.status === 'success' && result.hash === payment.transaction_hash && matchingPayouts(payment, result.transfers)) {
      await store.update(payment, { status: 'paid', receipt: { hash: result.hash, ledger: result.ledger, verifiedAt: new Date().toISOString(), transfers: result.transfers } });
    } else if (result.status === 'failed' || result.status === 'expired') {
      await store.update(payment, { status: result.status });
    } else if (result.status === 'success' && payment.status === 'prepared') {
      await store.update(payment, { status: 'pending' });
    }
    return refresh(payment);
  };
  return {
    configuration: () => gateway.configuration(),
    current: (customerId: string) => store.current(customerId),
    async prepare(customerId: string, payer: string, amountXlm: unknown) {
      if (typeof payer !== 'string' || !StrKey.isValidEd25519PublicKey(payer)) throw new PaymentError(400, 'INVALID_WALLET', 'Connect a valid Freighter account.');
      let amounts;
      try { amounts = parsePaymentAmount(amountXlm); }
      catch (error) { throw new PaymentError(400, 'INVALID_AMOUNT', (error as Error).message); }
      const existing = await store.current(customerId);
      const original = (payment: Payment) => {
        if (payment.amount_stroops !== amounts.amount_stroops || payment.payer_address !== payer) throw new PaymentError(409, 'PAYMENT_ALREADY_EXISTS', 'The saved payment has a different amount or wallet. Resolve it before starting another payment.');
        return payment;
      };
      if (existing) return original(existing);
      const split = await gateway.configuration();
      if (BigInt(amounts.amount_stroops) < BigInt(split.minimumAmount ?? '0')) throw new PaymentError(400, 'INVALID_AMOUNT', 'The selected amount is below the Paiflow deployment minimum.');
      if ([split.worker, split.platform].includes(payer)) throw new PaymentError(400, 'PAYER_IS_RECIPIENT', 'Use a customer wallet distinct from the worker and platform wallets.');
      const reserved = await store.reserve(customerId, payer, deploymentId, split, amounts);
      if (!reserved.created) return original(reserved.payment);
      const payment = reserved.payment;
      let prepared;
      try { prepared = await gateway.prepare(payer, split, payment.amount_stroops); }
      catch {
        // No envelope has been returned to any browser, so this preparation can safely be released.
        await store.update(payment, { status: 'failed', active: false });
        throw new PaymentError(502, 'PREPARATION_FAILED', 'Could not prepare payment. Check the funded Testnet wallet and Paiflow deployment, then try again.');
      }
      const saved = await store.update(payment, { status: 'prepared', unsigned_xdr: prepared.xdr, transaction_hash: prepared.hash, expires_at: prepared.expiresAt, preparation_request_id: prepared.requestId });
      if (!saved) throw new PaymentError(409, 'PAYMENT_CHANGED', 'Payment changed. Reload the saved attempt.');
      return saved;
    },
    async submit(customerId: string, id: string, signedXdr: string) {
      let payment = await get(id, customerId);
      if (payment.status !== 'prepared') return reconcile(payment);
      if (!payment.active) throw new PaymentError(409, 'PAYMENT_CLOSED', 'This demo payment is closed.');
      if (typeof signedXdr !== 'string' || signedXdr.length > 200000) throw new PaymentError(400, 'INVALID_SIGNATURE', 'A valid signed transaction is required.');
      gateway.validateSigned(payment, signedXdr);
      // Atomic prepared -> pending claim. Save the exact envelope BEFORE the external submit.
      const claimed = await store.update(payment, { status: 'pending', signed_xdr: signedXdr });
      if (!claimed) return reconcile(await refresh(payment));
      payment = claimed;
      try { await gateway.submit(payment); } catch { /* acknowledgement may have been lost */ }
      return reconcile(payment);
    },
    async check(customerId: string, id: string) { return reconcile(await get(id, customerId)); },
    async retryOriginal(customerId: string, id: string) {
      let payment = await reconcile(await get(id, customerId));
      if (payment.status !== 'pending' || !payment.signed_xdr) return payment;
      // Explicit recovery only. An identical envelope cannot execute twice on Stellar.
      try { await gateway.submit(payment); } catch { /* keep original pending */ }
      payment = await reconcile(payment);
      return payment;
    },
    async newDemo(customerId: string, id: string) {
      const payment = await reconcile(await get(id, customerId));
      if (!['paid', 'failed', 'expired'].includes(payment.status)) throw new PaymentError(409, 'PAYMENT_UNRESOLVED', 'Resolve the original payment before starting another demo.');
      await store.update(payment, { active: false });
    },
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
