export const MIN_STROOPS = 100n;
export const MAX_STROOPS = 100000000000n;
export type PaymentAmounts = { amount_stroops: string; worker_amount_stroops: string; platform_amount_stroops: string };
export function parsePaymentAmount(value: unknown): PaymentAmounts {
  if (typeof value !== 'string' || value.length > 30 || !/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value.trim())) throw new Error('Enter an XLM amount between 0.00001 and 10,000 with at most 7 decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const total = BigInt(whole!) * 10000000n + BigInt(fraction.padEnd(7, '0'));
  if (total < MIN_STROOPS || total > MAX_STROOPS) throw new Error('Enter an XLM amount between 0.00001 and 10,000 with at most 7 decimal places.');
  const worker = total * 85n / 100n;
  return { amount_stroops: total.toString(), worker_amount_stroops: worker.toString(), platform_amount_stroops: (total - worker).toString() };
}
