import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectExtension } from '../src/extension/detector';
import { createExtensionBridge } from '../src/extension/bridge';

vi.stubGlobal('__ACCOUNTS_URL__', 'https://accounts.contentcredits.com');

describe('detectExtension', () => {
  const OriginalImage = globalThis.Image;

  beforeEach(() => {
    vi.useFakeTimers();
    delete (window as any).__CC_EXTENSION_LOADED;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Image = OriginalImage;
  });

  it('returns true immediately when the extension flag is present', async () => {
    (window as any).__CC_EXTENSION_LOADED = true;
    await expect(detectExtension('ext_123')).resolves.toBe(true);
  });

  it('returns false for invalid extension ids', async () => {
    await expect(detectExtension('')).resolves.toBe(false);
  });

  it('resolves true when the extension asset loads', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    await expect(detectExtension('ext_123')).resolves.toBe(true);
  });

  it('falls back to false on image error', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;

    await expect(detectExtension('ext_123')).resolves.toBe(false);
  });
});

describe('extension bridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts request messages back to the page origin', () => {
    const bridge = createExtensionBridge();
    const postSpy = vi.spyOn(window, 'postMessage');

    bridge.requestAuthorization('article_1', 'example.com');
    bridge.requestPurchase({
      articleId: 'article_1',
      hostName: 'example.com',
      location: 'https://example.com/post',
      title: 'Hello',
    });
    bridge.requestLogin('example.com');

    expect(postSpy).toHaveBeenNthCalledWith(1, {
      type: 'request_authorization',
      data: { articleId: 'article_1', hostName: 'example.com' },
    }, window.location.origin);
    expect(postSpy).toHaveBeenNthCalledWith(2, {
      type: 'request_purchase',
      data: {
        articleId: 'article_1',
        hostName: 'example.com',
        location: 'https://example.com/post',
        title: 'Hello',
      },
    }, window.location.origin);
    expect(postSpy).toHaveBeenNthCalledWith(3, {
      type: 'request_login',
      data: { hostName: 'example.com' },
    }, window.location.origin);
  });

  it('routes authorized message and custom-event responses to handlers', () => {
    const bridge = createExtensionBridge();
    const authHandler = vi.fn();
    const purchaseHandler = vi.fn();

    bridge.onAuthorizationResponse(authHandler);
    bridge.onPurchaseResponse(purchaseHandler);
    bridge.attach();

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://accounts.contentcredits.com',
      data: {
        type: 'authorization_response',
        data: {
          isAuthenticated: true,
          doesHaveAccess: true,
          creditBalance: 12,
          requiredCredits: 3,
        },
      },
    }));

    window.dispatchEvent(new CustomEvent('purchase_response', {
      detail: {
        data: {
          doesHaveAccess: true,
          creditsSpent: 3,
          creditBalance: 9,
        },
      },
    }));

    expect(authHandler).toHaveBeenCalledWith(expect.objectContaining({
      isAuthenticated: true,
      doesHaveAccess: true,
    }));
    expect(purchaseHandler).toHaveBeenCalledWith(expect.objectContaining({
      doesHaveAccess: true,
      creditsSpent: 3,
    }));

    bridge.detach();
  });

  it('ignores postMessage events from untrusted origins', () => {
    const bridge = createExtensionBridge();
    const authHandler = vi.fn();
    bridge.onAuthorizationResponse(authHandler);
    bridge.attach();

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://evil.example',
      data: {
        type: 'authorization_response',
        data: { isAuthenticated: true, doesHaveAccess: true },
      },
    }));

    expect(authHandler).not.toHaveBeenCalled();
    bridge.detach();
  });
});
