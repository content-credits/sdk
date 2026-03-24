import { tokenStorage } from '../auth/storage.js';
import type { EventEmitter } from '../core/events.js';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

/** Simple hash for deduplication key */
function requestKey(method: string, url: string, body?: string): string {
  return `${method}:${url}:${body ?? ''}`;
}

const inFlight = new Map<string, Promise<unknown>>();

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status >= 500 || status === 429;
}

export function createApiClient(baseUrl: string, emitter: EventEmitter) {
  async function request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    attempt = 0
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const serialisedBody = body ? JSON.stringify(body) : undefined;
    const key = requestKey(method, url, serialisedBody);

    // Deduplicate concurrent identical requests
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = tokenStorage.get();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const promise = fetch(url, {
      method,
      headers,
      body: serialisedBody,
      signal: controller.signal,
      credentials: 'omit', // SDK uses explicit Bearer header, not cookies
    })
      .then(async response => {
        clearTimeout(timeoutId);

        if (response.status === 401) {
          tokenStorage.clear();
          emitter.emit('auth:logout', {});
          throw new ApiError(401, 'Unauthorized — session expired');
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw new ApiError(response.status, 'Invalid JSON response from server');
        }

        if (!response.ok) {
          const msg = (data as { message?: string })?.message ?? `HTTP ${response.status}`;
          throw new ApiError(response.status, msg, data);
        }

        return data as T;
      })
      .catch(async (err: unknown) => {
        clearTimeout(timeoutId);

        // Retry on network error or server error (not client error)
        const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
        const isServerError = err instanceof ApiError && shouldRetry(err.status);

        if ((isNetworkError || isServerError) && attempt < MAX_RETRIES) {
          inFlight.delete(key);
          await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
          return request<T>(method, path, body, attempt + 1);
        }

        throw err;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: Record<string, unknown>) => request<T>('POST', path, body),
    put: <T>(path: string, body: Record<string, unknown>) => request<T>('PUT', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;
