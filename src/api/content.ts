import { tokenStorage } from '../auth/storage.js';
import type { PublisherContentResponse } from '../types/index.js';

/**
 * Server-side-teaser content fetch.
 *
 * Deliberately NOT built on `createApiClient` (`src/api/client.ts`), for two
 * reasons:
 *
 * 1. **Host.** This endpoint lives on the *publisher's* domain, not on the
 *    Content Credits API base URL. `createApiClient` prefixes every path with
 *    `apiBaseUrl`, which would rewrite the host. The endpoint arrives as a
 *    complete absolute URL (from `data-cc-content-endpoint`) and is used
 *    verbatim — the SDK never constructs or hardcodes a route path.
 * 2. **401 handling.** The shared client treats a 401 as "the Content Credits
 *    session is dead": it silently refreshes, then clears both tokens and
 *    emits `auth:logout`. A 401 from a publisher's own route says nothing
 *    about the reader's Content Credits session (a misconfigured plugin, a
 *    clock-skewed JWT check) and must never sign the reader out.
 */

const CONTENT_REQUEST_TIMEOUT_MS = 12_000;

/** `status: 0` means the request never produced an HTTP response. */
export class ContentFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /**
     * Contract code when the publisher supplied one (`UNAUTHENTICATED`,
     * `NO_ACCESS`, `UPSTREAM_UNAVAILABLE`), otherwise a locally-assigned one
     * (`NO_TOKEN`, `NETWORK_ERROR`, `MALFORMED_RESPONSE`).
     */
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ContentFetchError';
  }
}

function asContentResponse(value: unknown): PublisherContentResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as PublisherContentResponse;
}

/**
 * GET the full article HTML from the publisher's content endpoint.
 *
 * @param endpoint Absolute URL of the route for THIS post, exactly as the
 *                 publisher configured it.
 * @returns The raw (unsanitized) HTML string. Callers MUST sanitize before
 *          inserting it into the page — see `sanitizeHtml` in `src/ui/sanitize.ts`.
 * @throws {ContentFetchError} on any non-success outcome.
 */
export async function fetchGatedContent(endpoint: string): Promise<string> {
  const token = tokenStorage.get();
  if (!token) {
    throw new ContentFetchError(0, 'No access token available for the content request.', 'NO_TOKEN');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONTENT_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
      credentials: 'omit', // explicit Bearer header, never ambient cookies
    });
  } catch {
    clearTimeout(timeoutId);
    // Network failure, CORS rejection, or the timeout above firing.
    throw new ContentFetchError(0, 'Could not reach the content endpoint.', 'NETWORK_ERROR');
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  clearTimeout(timeoutId);

  const body = asContentResponse(parsed);

  if (!response.ok || body?.success !== true) {
    throw new ContentFetchError(
      response.status,
      body?.message ?? `Content request failed (HTTP ${response.status}).`,
      body?.code
    );
  }

  if (typeof body.content !== 'string') {
    // 200 + success:true but no content string — the route is misconfigured.
    // Treated as a failure so the reader gets the retry state rather than a
    // silently emptied article element.
    throw new ContentFetchError(response.status, 'Content endpoint returned no content.', 'MALFORMED_RESPONSE');
  }

  return body.content;
}
