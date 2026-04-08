const DETECTION_TIMEOUT_MS = 2_000;

/**
 * Detect whether the Content Credits browser extension is installed.
 *
 * Strategy 1: Load a known icon from the chrome-extension:// URL.
 *   - Fastest and most reliable for Chrome/Edge.
 *
 * Strategy 2: Check a flag the extension sets on window.
 *   - Extension can set `window.__CC_EXTENSION_LOADED = true` in a content script.
 *
 * Strategy 3: Timeout fallback — if neither resolves within DETECTION_TIMEOUT_MS,
 *   assume not installed.
 */
export function detectExtension(extensionId: string): Promise<boolean> {
  if (!extensionId || typeof extensionId !== 'string') {
    return Promise.resolve(false);
  }

  return new Promise(resolve => {
    let resolved = false;

    function done(result: boolean): void {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }

    // Strategy 2: flag check (instantaneous if extension is loaded)
    if ((window as unknown as Record<string, unknown>).__CC_EXTENSION_LOADED === true) {
      done(true);
      return;
    }

    // Strategy 1: image load from chrome-extension:// protocol
    const img = new Image();
    img.onload = (): void => done(true);
    img.onerror = (): void => done(false);
    img.src = `chrome-extension://${extensionId}/icons/icon16.png`;

    // Strategy 3: timeout safety net
    setTimeout(() => done(false), DETECTION_TIMEOUT_MS);
  });
}
