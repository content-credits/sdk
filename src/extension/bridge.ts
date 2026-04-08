import type {
  ExtensionMessage,
  AuthorizationResponseData,
  PurchaseResponseData,
} from '../types/index.js';

declare const __ACCOUNTS_URL__: string;

/**
 * The set of origins we will accept postMessage messages from.
 * Only the accounts frontend and the current page itself (for extension relay).
 */
function getAllowedOrigins(): string[] {
  const origins = [__ACCOUNTS_URL__];
  // Allow current page origin (extension relays messages through the page)
  try {
    origins.push(window.location.origin);
  } catch {
    // ignore
  }
  return origins;
}

type AuthResponseHandler = (data: AuthorizationResponseData) => void;
type PurchaseResponseHandler = (data: PurchaseResponseData) => void;

export interface ExtensionBridge {
  attach(): void;
  detach(): void;
  requestAuthorization(articleId: string, hostName: string): void;
  requestPurchase(params: { articleId: string; hostName: string; location: string; title: string }): void;
  requestLogin(hostName: string): void;
  onAuthorizationResponse(handler: AuthResponseHandler): void;
  onPurchaseResponse(handler: PurchaseResponseHandler): void;
}

export function createExtensionBridge(): ExtensionBridge {
  let authHandler: AuthResponseHandler | null = null;
  let purchaseHandler: PurchaseResponseHandler | null = null;

  function handleMessage(event: MessageEvent): void {
    // Security: validate the origin before trusting any message
    const allowed = getAllowedOrigins();
    if (!allowed.includes(event.origin) && event.origin !== window.location.origin) {
      return;
    }

    const msg = event.data as ExtensionMessage | null;
    if (!msg || typeof msg !== 'object' || !msg.type) return;

    switch (msg.type) {
      case 'authorization_response': {
        const data = (msg.data ?? (event as unknown as { detail: { data: AuthorizationResponseData } }).detail?.data) as AuthorizationResponseData | undefined;
        if (data && authHandler) authHandler(data);
        break;
      }
      case 'purchase_response': {
        const data = (msg.data ?? (event as unknown as { detail: { data: PurchaseResponseData } }).detail?.data) as PurchaseResponseData | undefined;
        if (data && purchaseHandler) purchaseHandler(data);
        break;
      }
    }
  }

  function attach(): void {
    window.addEventListener('message', handleMessage);
    // Extension also dispatches as CustomEvents on window
    window.addEventListener('authorization_response', (e) => {
      const detail = (e as CustomEvent<{ data: AuthorizationResponseData }>).detail;
      if (detail?.data && authHandler) authHandler(detail.data);
    });
    window.addEventListener('purchase_response', (e) => {
      const detail = (e as CustomEvent<{ data: PurchaseResponseData }>).detail;
      if (detail?.data && purchaseHandler) purchaseHandler(detail.data);
    });
  }

  function detach(): void {
    window.removeEventListener('message', handleMessage);
  }

  function requestAuthorization(articleId: string, hostName: string): void {
    window.postMessage(
      { type: 'request_authorization', data: { articleId, hostName } },
      window.location.origin
    );
  }

  function requestPurchase(params: {
    articleId: string;
    hostName: string;
    location: string;
    title: string;
  }): void {
    window.postMessage(
      { type: 'request_purchase', data: params },
      window.location.origin
    );
  }

  function requestLogin(hostName: string): void {
    window.postMessage(
      { type: 'request_login', data: { hostName } },
      window.location.origin
    );
  }

  function onAuthorizationResponse(handler: AuthResponseHandler): void {
    authHandler = handler;
  }

  function onPurchaseResponse(handler: PurchaseResponseHandler): void {
    purchaseHandler = handler;
  }

  return {
    attach,
    detach,
    requestAuthorization,
    requestPurchase,
    requestLogin,
    onAuthorizationResponse,
    onPurchaseResponse,
  };
}
