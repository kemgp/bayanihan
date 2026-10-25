export function previewAmount(value: string) {
  if (value.length > 30 || !/^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const total = BigInt(whole!) * 10000000n + BigInt(fraction.padEnd(7, '0'));
  if (total < 100n || total > 100000000000n) return null;
  const worker = total * 85n / 100n;
  return { total: total.toString(), workerAmount: worker.toString(), platformAmount: (total - worker).toString() };
}
export function formatXlm(stroops: string) {
  const value = BigInt(stroops);
  const fraction = (value % 10000000n).toString().padStart(7, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${value / 10000000n}.${fraction}`;
}
