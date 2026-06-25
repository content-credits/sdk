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
  clearAuthorizationResponse(): void;
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

  /**
   * Get the event suffix injected by the extension (if available).
   * The extension uses randomized event names to prevent eavesdropping by malicious scripts.
   */
  function getEventSuffix(): string {
    return ((window as unknown as Record<string, unknown>).__CC_EVENT_SUFFIX__ as string) || '';
  }

  // Store event listeners for cleanup in detach()
  let authEventListener: ((e: Event) => void) | null = null;
  let purchaseEventListener: ((e: Event) => void) | null = null;
  let authEventName: string | null = null;
  let purchaseEventName: string | null = null;

  function attach(): void {
    window.addEventListener('message', handleMessage);

    // Extension also dispatches as CustomEvents on window.
    // Use randomized event names if the extension provides a suffix (security hardening).
    const suffix = getEventSuffix();
    authEventName = suffix ? `cc_auth_${suffix}` : 'authorization_response';
    purchaseEventName = suffix ? `cc_purchase_${suffix}` : 'purchase_response';

    authEventListener = (e: Event) => {
      const detail = (e as CustomEvent<{ data: AuthorizationResponseData }>).detail;
      if (detail?.data && authHandler) authHandler(detail.data);
    };
    purchaseEventListener = (e: Event) => {
      const detail = (e as CustomEvent<{ data: PurchaseResponseData }>).detail;
      if (detail?.data && purchaseHandler) purchaseHandler(detail.data);
    };

    window.addEventListener(authEventName, authEventListener);
    window.addEventListener(purchaseEventName, purchaseEventListener);
  }

  function detach(): void {
    window.removeEventListener('message', handleMessage);
    // Clean up CustomEvent listeners
    if (authEventName && authEventListener) {
      window.removeEventListener(authEventName, authEventListener);
    }
    if (purchaseEventName && purchaseEventListener) {
      window.removeEventListener(purchaseEventName, purchaseEventListener);
    }
    authEventListener = null;
    purchaseEventListener = null;
    authEventName = null;
    purchaseEventName = null;
  }

  /**
   * Get the nonce injected by the extension (if available).
   * The extension sets this to prevent spoofed messages from malicious scripts.
   */
  function getNonce(): string | undefined {
    return (window as unknown as Record<string, unknown>).__CC_NONCE__ as string | undefined;
  }

  function requestAuthorization(articleId: string, hostName: string): void {
    const nonce = getNonce();
    window.postMessage(
      { type: 'request_authorization', nonce, data: { articleId, hostName } },
      window.location.origin
    );
  }

  function requestPurchase(params: {
    articleId: string;
    hostName: string;
    location: string;
    title: string;
  }): void {
    const nonce = getNonce();
    window.postMessage(
      { type: 'request_purchase', nonce, data: params },
      window.location.origin
    );
  }

  function requestLogin(hostName: string): void {
    const nonce = getNonce();
    window.postMessage(
      { type: 'request_login', nonce, data: { hostName } },
      window.location.origin
    );
  }

  function onAuthorizationResponse(handler: AuthResponseHandler): void {
    authHandler = handler;
  }

  function clearAuthorizationResponse(): void {
    authHandler = null;
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
    clearAuthorizationResponse,
    onPurchaseResponse,
  };
}
