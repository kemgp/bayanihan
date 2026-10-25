export const TOTAL = '10000000';
export const WORKER = '8500000';
export const PLATFORM = '1500000';
export type Split = { worker: string; platform: string; splitter: string; trigger: string; token: string };
export type PaymentStatus = 'preparing' | 'prepared' | 'pending' | 'paid' | 'failed' | 'expired';
export type Transfer = { contract: string; from: string; to: string; amount: string };
export type Receipt = { hash: string; ledger: number; verifiedAt: string; transfers: Transfer[] };
export type Payment = {
  id: string; customer_id: string; payer_address: string; deployment_id: string;
  status: PaymentStatus; active: boolean; split: Split;
  unsigned_xdr: string | null; signed_xdr: string | null; transaction_hash: string | null;
  preparation_request_id: string | null; expires_at: string | null; receipt: Receipt | null;
  created_at: string; updated_at: string;
};
export type Prepared = { xdr: string; hash: string; expiresAt: string; requestId: string | null; fee: string };
export type ChainResult =
  | { status: 'unknown' }
  | { status: 'expired' | 'failed' }
  | { status: 'success'; hash: string; ledger: number; transfers: Transfer[] };
export interface PaymentGateway {
  configuration(): Promise<Split>;
  prepare(payer: string, split: Split): Promise<Prepared>;
  validateSigned(payment: Payment, signedXdr: string): void;
  submit(payment: Payment): Promise<void>;
  inspect(payment: Payment): Promise<ChainResult>;
}
export interface PaymentStore {
  current(customerId: string): Promise<Payment | null>;
  get(id: string, customerId: string): Promise<Payment | null>;
  reserve(customerId: string, payer: string, deploymentId: string, split: Split): Promise<{ payment: Payment; created: boolean }>;
  update(payment: Payment, patch: Partial<Payment>): Promise<Payment | null>;
}
export class PaymentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function publicPayment(payment: Payment | null) {
  if (!payment) return null;
  return {
    id: payment.id, status: payment.status, payer: payment.payer_address, split: payment.split,
    hash: payment.transaction_hash, expiresAt: payment.expires_at, createdAt: payment.created_at,
    // A saved signed envelope is never returned to the browser or logged.
    xdr: payment.status === 'prepared' ? payment.unsigned_xdr : null,
    receipt: payment.receipt, total: TOTAL, workerAmount: WORKER, platformAmount: PLATFORM,
  };
}
export function matchingPayouts(payment: Payment, transfers: Transfer[]) {
  const { token, trigger, splitter, worker, platform } = payment.split;
  const tokenTransfers = transfers.filter(t => t.contract === token);
  const exact = (from: string, to: string, amount: string) => tokenTransfers.filter(t => t.from === from && t.to === to).reduce((sum, t) => sum + BigInt(t.amount), 0n) === BigInt(amount);
  // Verify the entire native-XLM path and net recipient credits, not a percentage event.
  return exact(payment.payer_address, trigger, TOTAL) && exact(trigger, splitter, TOTAL)
    && exact(splitter, worker, WORKER) && exact(splitter, platform, PLATFORM)
    && tokenTransfers.filter(t => t.from === payment.payer_address).reduce((n,t) => n + BigInt(t.amount), 0n) === BigInt(TOTAL)
    && tokenTransfers.filter(t => t.to === worker).reduce((n,t) => n + BigInt(t.amount), 0n) === BigInt(WORKER)
    && tokenTransfers.filter(t => t.to === platform).reduce((n,t) => n + BigInt(t.amount), 0n) === BigInt(PLATFORM)
    && [worker, platform].every(address => !tokenTransfers.some(t => t.from === address));
}
