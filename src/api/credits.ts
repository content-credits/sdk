import type { ApiClient } from './client.js';
import type { CheckAccessResponse, PurchaseResponse, EventSurface } from '../types/index.js';

export interface CreditsApi {
  checkAccess(params: { apiKey: string; postUrl: string; postName: string; hostName: string }): Promise<CheckAccessResponse>;
  purchaseArticle(params: { apiKey: string; postUrl: string; postName: string; hostName: string; decisionId?: string; surface?: EventSurface }): Promise<PurchaseResponse>;
}

export function createCreditsApi(client: ApiClient): CreditsApi {
  return {
    checkAccess(params: {
      apiKey: string;
      postUrl: string;
      postName: string;
      hostName: string;
    }): Promise<CheckAccessResponse> {
      return client.post<CheckAccessResponse>('/credits/check-article-access', {
        apiKey: params.apiKey,
        postUrl: params.postUrl,
        postName: params.postName,
        hostName: params.hostName,
      });
    },

    purchaseArticle(params: {
      apiKey: string;
      postUrl: string;
      postName: string;
      hostName: string;
      decisionId?: string;
      surface?: EventSurface;
    }): Promise<PurchaseResponse> {
      return client.post<PurchaseResponse>('/credits/purchase-article', {
        apiKey: params.apiKey,
        postUrl: params.postUrl,
        postName: params.postName,
        hostName: params.hostName,
        ...(params.decisionId ? { decisionId: params.decisionId } : {}),
        ...(params.surface ? { surface: params.surface } : {}),
      });
    },
  };
}
