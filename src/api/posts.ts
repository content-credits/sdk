import type { ApiClient } from './client.js';
import type { ObservePostPayload, ObservePostResponse, OfferShownPayload, OfferShownResponse } from '../types/index.js';

export interface PostsApi {
  observe(payload: ObservePostPayload): Promise<ObservePostResponse>;
  offerShown(payload: OfferShownPayload): Promise<OfferShownResponse>;
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
        ...(payload.anonId ? { anonId: payload.anonId } : {}),
        ...(payload.referrer ? { referrer: payload.referrer } : {}),
        ...(payload.consent ? { consent: payload.consent } : {}),
      });
    },

    // Offer-exposure event: a gated paywall state was shown. Returns the
    // server-minted decisionId that links a later purchase back to this offer.
    offerShown(payload: OfferShownPayload): Promise<OfferShownResponse> {
      return client.post<OfferShownResponse>('/posts/offer-shown', {
        apiKey: payload.apiKey,
        url: payload.url,
        hostName: payload.hostName,
        state: payload.state,
        surface: payload.surface,
        ...(payload.anonId ? { anonId: payload.anonId } : {}),
        ...(payload.consent ? { consent: payload.consent } : {}),
        ...(payload.referrer ? { referrer: payload.referrer } : {}),
      });
    },
  };
}
