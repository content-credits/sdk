import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, ApiError } from '../src/api/client';
import { createEventEmitter } from '../src/core/events';

// Minimal mock event emitter
function makeMockEmitter() {
  const emitter = createEventEmitter();
  vi.spyOn(emitter, 'emit');
  return emitter;
}

const BASE_URL = 'https://api.contentcredits.com';

describe('createApiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('makes a GET request to the correct URL', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: 'hello' }), { status: 200 })
    );

    const emitter = makeMockEmitter();
    const client = createApiClient(BASE_URL, emitter);
    const result = await client.get('/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/test`);
    expect(options.method).toBe('GET');
    expect(result).toEqual({ success: true, data: 'hello' });
  });

  it('makes a POST request with body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const emitter = makeMockEmitter();
    const client = createApiClient(BASE_URL, emitter);
    await client.post('/credits/purchase-article', { apiKey: 'key', postUrl: 'https://example.com' });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toMatchObject({ apiKey: 'key' });
  });

  it('throws ApiError on non-OK response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    );

    const emitter = makeMockEmitter();
    const client = createApiClient(BASE_URL, emitter);
    await expect(client.get('/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('emits auth:logout and throws on 401', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const emitter = makeMockEmitter();
    const client = createApiClient(BASE_URL, emitter);
    await expect(client.get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(emitter.emit).toHaveBeenCalledWith('auth:logout', {});
  });

  it('deduplicates concurrent identical requests', async () => {
    const mockFetch = vi.mocked(fetch);
    let resolveFn!: (v: Response) => void;
    const promise = new Promise<Response>(r => (resolveFn = r));
    mockFetch.mockReturnValue(promise);

    const emitter = makeMockEmitter();
    const client = createApiClient(BASE_URL, emitter);

    // Fire two identical requests at the same time
    const [p1, p2] = [client.get('/same'), client.get('/same')];
    resolveFn(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await Promise.all([p1, p2]);

    // Only one actual fetch should have been made
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
