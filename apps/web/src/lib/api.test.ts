import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { ApiError, apiFetch } from './api';

afterEach(() => mock.restoreAll());

function stalled(signal: AbortSignal) {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(Response.json({ ready: true })), 500);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

test('a hanging payment mutation times out without automatically replaying it', async () => {
  const fetch = mock.method(globalThis, 'fetch', (_url: RequestInfo | URL, options?: RequestInit) => stalled(options!.signal!));
  await assert.rejects(apiFetch('/api/payments/demo/submit', { method: 'POST' }, 5), (error: unknown) => error instanceof ApiError && error.code === 'REQUEST_TIMEOUT');
  assert.equal(fetch.mock.callCount(), 1);
});

test('the deadline also covers a stalled response body', async () => {
  mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, options?: RequestInit) => new Response(new ReadableStream({
    start(controller) {
      const timer = setTimeout(() => { controller.enqueue(new TextEncoder().encode('{}')); controller.close(); }, 500);
      options!.signal!.addEventListener('abort', () => { clearTimeout(timer); controller.error(options!.signal!.reason); }, { once: true });
    },
  })));
  await assert.rejects(apiFetch('/api/me', undefined, 5), (error: unknown) => error instanceof ApiError && error.code === 'REQUEST_TIMEOUT');
});

test('effect cleanup remains cancellation rather than a connection failure', async () => {
  mock.method(globalThis, 'fetch', (_url: RequestInfo | URL, options?: RequestInit) => stalled(options!.signal!));
  const controller = new AbortController();
  const request = apiFetch('/api/me', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('an HTML hosting fallback reports a wrong API response', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('<html>Frontend</html>'));
  await assert.rejects(apiFetch('/api/me'), (error: unknown) => error instanceof ApiError && error.code === 'INVALID_API_RESPONSE');
});

test('an expired session preserves the API status for sign-out handling', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ error: { code: 'UNAUTHORIZED', message: 'Session expired.' } }, { status: 401 }));
  await assert.rejects(apiFetch('/api/me'), (error: unknown) => error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHORIZED');
});

test('network and CORS failures give a recoverable API connection message', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(apiFetch('/api/me'), (error: unknown) => error instanceof ApiError && error.code === 'API_UNREACHABLE');
});

test('successful JSON responses still load', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ ready: true }));
  assert.deepEqual(await apiFetch('/api/payments/config'), { ready: true });
});
