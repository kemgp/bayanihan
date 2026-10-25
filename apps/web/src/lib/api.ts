const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (import.meta.env.PROD && !baseUrl) {
    throw new ApiError(0, 'API_BASE_URL_MISSING', 'The deployed API URL is missing. Set VITE_API_BASE_URL to the Render service origin and redeploy the frontend.');
  }
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
