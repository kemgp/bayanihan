import type { Payment, Profile } from '../features/payments/api';
import { hasVerifiedReceipt } from './PaymentScreens';

export type Route = 'auto' | 'browse' | 'details' | 'payment' | 'login';
export type Screen = 'browse' | 'details' | 'checkout' | 'receipt' | 'login' | 'loading' | 'account' | 'worker';
export const routeHash = { browse: '#services', details: '#services/furniture-assembly', payment: '#payment', login: '#login', auto: '' } as const;
export function parseRoute(hash: string): Route {
  if (!hash || hash === '#') return 'auto';
  const entry = Object.entries(routeHash).find(([, value]) => value === hash);
  return entry ? entry[0] as Route : 'browse';
}
export function resolveScreen(input: { route: Route; restoring: boolean; authenticated: boolean; accountReady: boolean; role?: Profile['role']; payment: Payment | null }): Screen {
  if (input.route === 'browse' || input.route === 'details') return input.route;
  if (input.restoring) return 'loading';
  if (!input.authenticated) return 'login';
  if (!input.accountReady) return 'account';
  if (input.role !== 'customer') return 'worker';
  if (input.payment) return hasVerifiedReceipt(input.payment) ? 'receipt' : 'checkout';
  return input.route === 'payment' ? 'checkout' : 'browse';
}
