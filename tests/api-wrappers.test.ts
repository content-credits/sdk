import { describe, it, expect, vi } from 'vitest';
import { createCreditsApi } from '../src/api/credits';
import { createCommentsApi } from '../src/api/comments';

describe('credits api', () => {
  it('forwards checkAccess payload to the client', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const api = createCreditsApi(client);
    await api.checkAccess({
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });

    expect(client.post).toHaveBeenCalledWith('/credits/check-article-access', {
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });
  });

  it('forwards purchase payload to the client', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    const api = createCreditsApi(client);
    await api.purchaseArticle({
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });

    expect(client.post).toHaveBeenCalledWith('/credits/purchase-article', {
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });
  });
});

describe('comments api', () => {
  it('uses encoded page url and sort for getComments', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ thread: {}, comments: [] }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    const api = createCommentsApi(client);
    await api.getComments({
      pageUrl: 'https://example.com/post?a=1&b=two words',
      sortBy: 'TOP',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/comments/comments/by-url?url=https%3A%2F%2Fexample.com%2Fpost%3Fa%3D1%26b%3Dtwo%20words&sortBy=TOP'
    );
  });

  it('omits null parentCommentId when posting a top-level comment', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ _id: 'comment_1' }),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    const api = createCommentsApi(client);
    await api.postComment({
      threadId: 'thread_1',
      content: 'hello world',
      parentCommentId: null,
    });

    expect(client.post).toHaveBeenCalledWith('/comments/comments', {
      threadId: 'thread_1',
      content: 'hello world',
    });
  });

  it('passes through the remaining comment endpoints', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({ _id: 'comment_1' }),
      delete: vi.fn().mockResolvedValue({ _id: 'comment_1' }),
    } as any;

    const api = createCommentsApi(client);

    await api.ensureThread({ pageUrl: 'https://example.com/post', hostname: 'example.com' });
    expect(client.post).toHaveBeenCalledWith('/comments/threads/ensure', {
      pageUrl: 'https://example.com/post',
      hostname: 'example.com',
    });

    await api.editComment('comment_1', 'updated');
    expect(client.put).toHaveBeenCalledWith('/comments/comments/comment_1', { content: 'updated' });

    await api.deleteComment('comment_1');
    expect(client.delete).toHaveBeenCalledWith('/comments/comments/comment_1');

    await api.toggleLike('comment_1');
    expect(client.post).toHaveBeenCalledWith('/comments/comments/comment_1/toggle-like', {});
  });
});
