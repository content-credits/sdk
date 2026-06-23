import type { ApiClient } from './client.js';
import type { ObservePostPayload, ObservePostResponse } from '../types/index.js';

export interface PostsApi {
  observe(payload: ObservePostPayload): Promise<ObservePostResponse>;
}

export function createPostsApi(client: ApiClient): PostsApi {
  return {
    // Fire-and-forget discovery + view beacon (design doc §5.1 / §7.1).
    observe(payload: ObservePostPayload): Promise<ObservePostResponse> {
      return client.post<ObservePostResponse>('/posts/observe', {
        apiKey: payload.apiKey,
        url: payload.url,
        canonicalUrl: payload.canonicalUrl,
        title: payload.title,
        ...(payload.author ? { author: payload.author } : {}),
        ...(payload.publishedAt ? { publishedAt: payload.publishedAt } : {}),
        ...(payload.thumbnailUrl ? { thumbnailUrl: payload.thumbnailUrl } : {}),
      });
    },
  };
}
