import type { ApiClient } from './client.js';
import type { CheckAccessResponse, PurchaseResponse } from '../types/index.js';

export function createCreditsApi(client: ApiClient) {
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
    }): Promise<PurchaseResponse> {
      return client.post<PurchaseResponse>('/credits/purchase-article', {
        apiKey: params.apiKey,
        postUrl: params.postUrl,
        postName: params.postName,
        hostName: params.hostName,
      });
    },
  };
}
