import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, type Payment, type PaymentStore, type Split } from './model.js';
import type { PaymentAmounts } from './amount.js';

// Amounts are bounded below JS's safe integer limit in SQL and serialized as strings at the API boundary.
function paymentRow(data: Record<string, unknown> | null): Payment | null {
  if (!data) return null;
  return { ...data, amount_stroops: String(data.amount_stroops), worker_amount_stroops: String(data.worker_amount_stroops), platform_amount_stroops: String(data.platform_amount_stroops) } as Payment;
}

export function createPaymentStore(db: SupabaseClient): PaymentStore {
  const failure = () => new PaymentError(503, 'PAYMENT_STORAGE_UNAVAILABLE', 'Payment storage is unavailable. Apply the payment-demo migration and check the server configuration.');
  return {
    async current(customerId) {
      const { data, error } = await db.from('demo_payments').select('*').eq('customer_id', customerId).eq('active', true).maybeSingle();
      if (error) throw failure();
      return paymentRow(data);
    },
    async get(id, customerId) {
      const { data, error } = await db.from('demo_payments').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
      if (error) throw failure();
      return paymentRow(data);
    },
    async reserve(customerId: string, payer: string, deploymentId: string, split: Split, amounts: PaymentAmounts) {
      const { data, error } = await db.from('demo_payments').insert({ customer_id: customerId, payer_address: payer, deployment_id: deploymentId, split, ...amounts }).select('*').single();
      if (!error) return { payment: paymentRow(data)!, created: true };
      if (error.code === '23514') throw new PaymentError(503, 'AMOUNT_MIGRATION_REQUIRED', 'Apply migration 20261025000400_variable_demo_amounts.sql in Supabase before using editable payment amounts.');
      if (error.code === '23505') {
        const existing = await this.current(customerId);
        if (existing) return { payment: existing, created: false };
      }
      throw failure();
    },
    async update(payment, patch) {
      const { data, error } = await db.from('demo_payments').update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', payment.id).eq('customer_id', payment.customer_id).eq('status', payment.status).eq('active', payment.active).select('*').maybeSingle();
      if (error) throw failure();
      return paymentRow(data);
    },
  };
}
