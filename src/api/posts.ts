import type { ApiClient } from './client.js';
import type { ObservePostPayload, ObservePostResponse, OfferShownPayload, OfferShownResponse, OfferActionPayload } from '../types/index.js';

export interface PostsApi {
  observe(payload: ObservePostPayload): Promise<ObservePostResponse>;
  offerShown(payload: OfferShownPayload): Promise<OfferShownResponse>;
  offerAction(payload: OfferActionPayload): Promise<{ success?: boolean; ignored?: boolean }>;
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
        ...(payload.surface ? { surface: payload.surface } : {}),
        ...(payload.pageViewId ? { pageViewId: payload.pageViewId } : {}),
        ...(payload.internal ? { internal: true } : {}),
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
        ...(payload.pageViewId ? { pageViewId: payload.pageViewId } : {}),
        ...(payload.internal ? { internal: true } : {}),
      });
    },

    // Reader action on a displayed offer (sign-in started, checkout opened,
    // dismissed), keyed on the decisionId from offerShown. Fire-and-forget.
    offerAction(payload: OfferActionPayload): Promise<{ success?: boolean; ignored?: boolean }> {
      return client.post<{ success?: boolean; ignored?: boolean }>('/posts/offer-action', {
        apiKey: payload.apiKey,
        url: payload.url,
        hostName: payload.hostName,
        decisionId: payload.decisionId,
        action: payload.action,
        ...(payload.surface ? { surface: payload.surface } : {}),
        ...(payload.consent ? { consent: payload.consent } : {}),
        ...(payload.pageViewId ? { pageViewId: payload.pageViewId } : {}),
        ...(payload.internal ? { internal: true } : {}),
      });
    },
  };
}
