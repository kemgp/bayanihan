import { Paiflow } from '@paiflow/sdk';
import { Address, Asset, Contract, FeeBumpTransaction, Keypair, Networks, StrKey, TransactionBuilder, rpc, scValToNative, type Transaction } from '@stellar/stellar-sdk';
import type { Config } from '../../config/env.js';
import { PaymentError, type Payment, type PaymentGateway, type Split, type Transfer } from './model.js';
import { MAX_STROOPS } from './amount.js';

const problem = () => new PaymentError(503, 'DEPLOYMENT_NOT_READY', 'The Testnet deployment must be an active native-XLM deposit flow with one 85/15 splitter.');
export function transaction(xdr: string): Transaction {
  const tx = TransactionBuilder.fromXdr(xdr, Networks.TESTNET);
  if (tx instanceof FeeBumpTransaction) throw new Error('Fee-bump envelopes are not supported.');
  return tx;
}
export function transactionHash(xdr: string) { return Buffer.from(transaction(xdr).hash()).toString('hex'); }

export function validatePreparation(xdr: string, payer: string, split: Split, amountStroops: string) {
  const tx = transaction(xdr);
  const op = tx.operations[0];
  if (tx.source !== payer || tx.operations.length !== 1 || op?.type !== 'invokeHostFunction' || (op.source && op.source !== payer)
    || op.func.type !== 'hostFunctionTypeInvokeContract') throw new Error('Unexpected payment operation.');
  const call = op.func.invokeContract;
  if (Address.fromScAddress(call.contractAddress).toString() !== split.trigger || call.functionName.toString() !== 'deposit'
    || call.args.length !== 2 || scValToNative(call.args[0]!) !== payer || scValToNative(call.args[1]!) !== BigInt(amountStroops)) throw new Error('Payment inputs do not match.');
  if (!tx.timeBounds || BigInt(tx.timeBounds.maxTime) === 0n) throw new Error('Payment must expire.');
  return tx;
}

export function validateSigned(payment: Payment, signedXdr: string) {
  try {
    const tx = validatePreparation(signedXdr, payment.payer_address, payment.split, payment.amount_stroops);
    if (!payment.unsigned_xdr || transactionHash(signedXdr) !== payment.transaction_hash || transactionHash(payment.unsigned_xdr) !== payment.transaction_hash) throw new Error();
    const key = Keypair.fromPublicKey(payment.payer_address);
    if (!tx.signatures.some(signature => key.verify(tx.hash(), signature.signature.value))) throw new Error();
  } catch {
    throw new PaymentError(400, 'INVALID_SIGNATURE', 'The signed transaction must match the saved Testnet payment and customer wallet.');
  }
}

export function createPaymentGateway(config: Config): PaymentGateway {
  const chain = new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
  const client = () => {
    const url = new URL(config.paiflowBaseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || !/^(pfk|pfd)_[a-f0-9]{64}$/.test(config.paiflowApiToken) || !/^[a-f0-9-]{36}$/i.test(config.paiflowDeploymentId)) throw problem();
    return new Paiflow({ baseUrl: url.origin, token: config.paiflowApiToken, timeoutMs: 20000 });
  };
  let cache: { split: Split; until: number } | undefined;
  return {
    async configuration() {
      if (cache && cache.until > Date.now()) return cache.split;
      try {
        const deployment = client().deployment(config.paiflowDeploymentId);
        const [capabilities, balances] = await Promise.all([deployment.capabilities.get(), deployment.balances.get()]);
        const caps = capabilities.data;
        if (caps.deploymentId !== config.paiflowDeploymentId || caps.network !== 'testnet' || caps.triggerType !== 'deposit'
          || caps.inputAsset?.kind !== 'native' || caps.operations.execute.status !== 'supported' || caps.operations.transactions.status !== 'supported'
          || balances.data.network !== 'testnet' || balances.data.deploymentId !== config.paiflowDeploymentId) throw problem();
        const nodes = balances.data.nodes;
        if (nodes.length !== 1 || nodes[0]?.templateKind !== 'SPLITTER' || nodes[0].stale || nodes[0].error) throw problem();
        const splitter = nodes[0].contractAddress;
        const entries = await chain.getLedgerEntries(new Contract(splitter).getFootprint());
        const data = entries.entries[0]?.val;
        if (data?.type !== 'contractData' || data.contractData.val.type !== 'scvContractInstance') throw problem();
        const state = Object.fromEntries((data.contractData.val.instance.storage ?? []).map(entry => [String(scValToNative(entry.key)), scValToNative(entry.val)])) as Record<string, unknown>;
        const recipients = state.Recipients as Array<{ address: string; bps: number; amount: bigint; is_cash_out: boolean }> | undefined;
        const token = Asset.native().contractId(Networks.TESTNET);
        if (!recipients || recipients.length !== 2 || state.Asset !== token || state.Paused !== false || state.TotalFixedAmount !== 0n
          || typeof state.MinAmount !== 'bigint' || state.MinAmount < 0n || state.MinAmount > MAX_STROOPS || !Array.isArray(state.NextSteps) || state.NextSteps.length) throw problem();
        const worker = recipients.find(r => r.bps === 8500);
        const platform = recipients.find(r => r.bps === 1500);
        if (!worker || !platform || recipients[0] !== worker || recipients[1] !== platform || worker.address === platform.address || recipients.some(r => r.amount !== 0n || r.is_cash_out || !StrKey.isValidEd25519PublicKey(r.address))
          || typeof state.ParentNode !== 'string' || !StrKey.isValidContract(state.ParentNode)) throw problem();
        const split = { worker: worker.address, platform: platform.address, splitter, trigger: state.ParentNode, token, minimumAmount: state.MinAmount.toString() };
        cache = { split, until: Date.now() + 15000 };
        return split;
      } catch { throw problem(); }
    },
    async prepare(payer, split, amountStroops) {
      const response = await client().deployment(config.paiflowDeploymentId).execute.prepare({ amount: amountStroops, from: payer });
      if (response.data.network !== 'testnet' || response.data.networkPassphrase !== Networks.TESTNET) throw problem();
      const tx = validatePreparation(response.data.xdr, payer, split, amountStroops);
      const expiry = Number(tx.timeBounds!.maxTime) * 1000;
      if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry !== Date.parse(response.data.expiresAt)) throw problem();
      return { xdr: response.data.xdr, hash: transactionHash(response.data.xdr), expiresAt: response.data.expiresAt, requestId: response.metadata.historyRequestId ?? null, fee: tx.fee };
    },
    validateSigned,
    async submit(payment) {
      const response = await client().deployment(payment.deployment_id).execute.submit({ signedXdr: payment.signed_xdr! }, { wait: false });
      if (response.data.txHash !== payment.transaction_hash) throw new Error('Submission hash mismatch.');
      // Submission status alone never marks a payment paid/failed.
    },
    async inspect(payment) {
      if (!payment.transaction_hash) return { status: 'unknown' };
      const result = await chain.getTransaction(payment.transaction_hash);
      if (result.txHash !== payment.transaction_hash) return { status: 'unknown' };
      if (result.status === 'NOT_FOUND') {
        // Release only when chain time passed the envelope bound AND RPC history covers its entire lifetime.
        const created = Date.parse(payment.created_at) / 1000;
        if (payment.expires_at && result.latestLedgerCloseTime > Date.parse(payment.expires_at) / 1000
          && result.oldestLedgerCloseTime <= created) return { status: 'expired' };
        return { status: 'unknown' };
      }
      if (result.status === 'FAILED') return { status: 'failed' };
      if (result.status !== 'SUCCESS' || result.feeBump) return { status: 'unknown' };
      const onChain = TransactionBuilder.fromXdr(result.envelopeXdr, Networks.TESTNET);
      if (onChain instanceof FeeBumpTransaction || Buffer.from(onChain.hash()).toString('hex') !== payment.transaction_hash || onChain.source !== payment.payer_address) return { status: 'unknown' };
      const transfers: Transfer[] = [];
      for (const event of result.events.contractEventsXdr.flat()) {
        if (!event.contractId || event.type.name !== 'contract') continue;
        const body = event.body.v0;
        const topics = body.topics.map(value => scValToNative(value));
        if (topics[0] !== 'transfer' || typeof topics[1] !== 'string' || typeof topics[2] !== 'string') continue;
        const amount = scValToNative(body.data);
        if (typeof amount !== 'bigint' || amount < 0n) continue;
        transfers.push({ contract: StrKey.encodeContract(event.contractId.value), from: topics[1], to: topics[2], amount: amount.toString() });
      }
      return { status: 'success', hash: payment.transaction_hash, ledger: result.ledger, transfers };
    },
  };
}
