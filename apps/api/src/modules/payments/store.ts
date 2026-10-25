import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, type Payment, type PaymentStore, type Split } from './model.js';

export function createPaymentStore(db: SupabaseClient): PaymentStore {
  const failure = () => new PaymentError(503, 'PAYMENT_STORAGE_UNAVAILABLE', 'Payment storage is unavailable. Apply the payment-demo migration and check the server configuration.');
  return {
    async current(customerId) {
      const { data, error } = await db.from('demo_payments').select('*').eq('customer_id', customerId).eq('active', true).maybeSingle();
      if (error) throw failure();
      return data as Payment | null;
    },
    async get(id, customerId) {
      const { data, error } = await db.from('demo_payments').select('*').eq('id', id).eq('customer_id', customerId).maybeSingle();
      if (error) throw failure();
      return data as Payment | null;
    },
    async reserve(customerId: string, payer: string, deploymentId: string, split: Split) {
      const { data, error } = await db.from('demo_payments').insert({ customer_id: customerId, payer_address: payer, deployment_id: deploymentId, split }).select('*').single();
      if (!error) return { payment: data as Payment, created: true };
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
      return data as Payment | null;
    },
  };
}
