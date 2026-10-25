const baseUrl = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function apiFetch<T>(path: string, options?: RequestInit, timeoutMs = 90_000): Promise<T> {
  if (import.meta.env?.PROD && !baseUrl) {
    throw new ApiError(0, 'API_BASE_URL_MISSING', 'The deployed API URL is missing. Set VITE_API_BASE_URL to the Render service origin and redeploy the frontend.');
  }
  // Allow a sleeping API to wake, but never leave checkout waiting indefinitely.
  // A timed-out mutation is unresolved: callers recover the saved attempt, never replay it here.
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal });
    const body = await response.json().catch(() => null);
    if (signal.aborted) throw signal.reason;
    if (!response.ok) {
      throw new ApiError(response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? `API request failed (${response.status})`);
    }
    if (body === null || typeof body !== 'object') {
      throw new ApiError(response.status, 'INVALID_API_RESPONSE', 'The API returned an unexpected response. Check the deployed API URL and service status.');
    }
    return body as T;
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    if (timeout.aborted) throw new ApiError(0, 'REQUEST_TIMEOUT', 'The API took too long to respond. It may be starting up. Try again; check any saved payment before paying again.');
    if (error instanceof TypeError) throw new ApiError(0, 'API_UNREACHABLE', 'Could not reach the API. Check your connection, the deployed API URL and allowed website origin.');
    throw error;
  }
}
