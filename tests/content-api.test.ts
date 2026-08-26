/**
 * Publisher content endpoint (v1 contract):
 *   200 → { success: true, content: "<full post HTML>" }
 *   401 → { success: false, code: "UNAUTHENTICATED" }
 *   403 → { success: false, code: "NO_ACCESS" }
 *   503 → { success: false, code: "UPSTREAM_UNAVAILABLE" }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGatedContent, ContentFetchError } from '../src/api/content';

let tokenPresent = true;

vi.mock('../src/auth/storage.js', () => ({
  tokenStorage: {
    has: () => tokenPresent,
    get: () => (tokenPresent ? 'token_123' : null),
    set: vi.fn(),
    clear: vi.fn(),
  },
  refreshTokenStorage: { get: vi.fn(() => null), set: vi.fn(), clear: vi.fn() },
}));

const ENDPOINT = 'https://example.com/wp-json/content-credits/v1/posts/42/content';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('fetchGatedContent', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    tokenPresent = true;
  });

  it('returns the content string on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { success: true, content: '<p>Full</p>' }))
    );
    await expect(fetchGatedContent(ENDPOINT)).resolves.toBe('<p>Full</p>');
  });

  it('sends the reader bearer token and no cookies, to the URL as given', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, content: '<p>Full</p>' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchGatedContent(ENDPOINT);

    const [url, init] = fetchMock.mock.calls[0];
    // No path building — the configured endpoint is used exactly as supplied.
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer token_123');
    expect(init.credentials).toBe('omit');
  });

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'NO_ACCESS'],
    [503, 'UPSTREAM_UNAVAILABLE'],
  ])('surfaces status %i as code %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { success: false, code })));

    const err = await fetchGatedContent(ENDPOINT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentFetchError);
    expect((err as ContentFetchError).status).toBe(status);
    expect((err as ContentFetchError).code).toBe(code);
  });

  it('throws NO_TOKEN without calling the network when signed out', async () => {
    tokenPresent = false;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const err = await fetchGatedContent(ENDPOINT).catch((e: unknown) => e);
    expect((err as ContentFetchError).code).toBe('NO_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws NETWORK_ERROR when the request never lands', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = await fetchGatedContent(ENDPOINT).catch((e: unknown) => e);
    expect((err as ContentFetchError).code).toBe('NETWORK_ERROR');
    expect((err as ContentFetchError).status).toBe(0);
  });

  it('throws MALFORMED_RESPONSE on a 200 with no content string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { success: true })));

    const err = await fetchGatedContent(ENDPOINT).catch((e: unknown) => e);
    expect((err as ContentFetchError).code).toBe('MALFORMED_RESPONSE');
  });

  it('rejects a 200 whose body is not the success shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { success: false, code: 'NO_ACCESS' }))
    );

    await expect(fetchGatedContent(ENDPOINT)).rejects.toBeInstanceOf(ContentFetchError);
  });

  it('rejects when the response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      })
    );

    await expect(fetchGatedContent(ENDPOINT)).rejects.toBeInstanceOf(ContentFetchError);
  });
});
