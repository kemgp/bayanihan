import { apiFetch } from '../../lib/api';
export type Split = { worker: string; platform: string; splitter: string; trigger: string; token: string };
export type Payment = {
  id: string; status: 'preparing' | 'prepared' | 'pending' | 'paid' | 'failed' | 'expired';
  payer: string; split: Split; hash: string | null; expiresAt: string | null; createdAt: string;
  xdr: string | null; receipt: { hash: string; ledger: number; verifiedAt: string } | null;
};
export type PaymentConfig = { ready: boolean; network: 'testnet'; split?: Split; message?: string };
export type Profile = { id: string; display_name: string; role: 'customer' | 'worker' };
export function paymentRequest(token: string, path = '', body?: unknown) {
  return apiFetch<{ payment: Payment | null }>(`/api/payments/demo${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
