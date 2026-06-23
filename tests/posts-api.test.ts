import { describe, it, expect, vi } from 'vitest';
import { createPostsApi } from '../src/api/posts';

describe('posts api', () => {
  it('forwards the full observe payload to the client', async () => {
    const client = { post: vi.fn().mockResolvedValue({ success: true, postId: 'post_1' }) } as any;
    const api = createPostsApi(client);

    await api.observe({
      apiKey: 'pub_123',
      url: 'https://example.com/post?utm_source=x',
      canonicalUrl: 'https://example.com/post',
      title: 'Hello',
      author: 'Jane',
      publishedAt: '2026-03-01T00:00:00Z',
      thumbnailUrl: 'https://example.com/img.jpg',
      anonId: 'anon-abc-123',
      referrer: 'https://google.com/search',
    });

    expect(client.post).toHaveBeenCalledWith('/posts/observe', {
      apiKey: 'pub_123',
      url: 'https://example.com/post?utm_source=x',
      canonicalUrl: 'https://example.com/post',
      title: 'Hello',
      author: 'Jane',
      publishedAt: '2026-03-01T00:00:00Z',
      thumbnailUrl: 'https://example.com/img.jpg',
      anonId: 'anon-abc-123',
      referrer: 'https://google.com/search',
    });
  });

  it('omits optional fields when absent', async () => {
    const client = { post: vi.fn().mockResolvedValue({ success: true }) } as any;
    const api = createPostsApi(client);

    await api.observe({
      apiKey: 'pub_123',
      url: 'https://example.com/post',
      canonicalUrl: 'https://example.com/post',
      title: 'Hello',
    });

    expect(client.post).toHaveBeenCalledWith('/posts/observe', {
      apiKey: 'pub_123',
      url: 'https://example.com/post',
      canonicalUrl: 'https://example.com/post',
      title: 'Hello',
    });
  });
});
