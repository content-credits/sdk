import type { SDKEventMap, SDKEventName, SDKEventHandler } from '../types/index.js';

type ListenerMap = {
  [K in SDKEventName]?: Array<SDKEventHandler<K>>;
};

export function createEventEmitter() {
  const listeners: ListenerMap = {};

  function on<K extends SDKEventName>(event: K, handler: SDKEventHandler<K>): () => void {
    if (!listeners[event]) {
      (listeners as Record<string, unknown[]>)[event] = [];
    }
    (listeners[event] as Array<SDKEventHandler<K>>).push(handler);

    // Return unsubscribe function
    return () => off(event, handler);
  }

  function off<K extends SDKEventName>(event: K, handler: SDKEventHandler<K>): void {
    const arr = listeners[event] as Array<SDKEventHandler<K>> | undefined;
    if (!arr) return;
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  }

  function emit<K extends SDKEventName>(event: K, payload: SDKEventMap[K]): void {
    const arr = listeners[event] as Array<SDKEventHandler<K>> | undefined;
    if (arr) {
      arr.forEach(handler => {
        try {
          handler(payload);
        } catch (e) {
          console.warn(`[ContentCredits] Error in "${event}" handler:`, e);
        }
      });
    }

    // Also dispatch as a native CustomEvent on document so vanilla listeners work
    try {
      document.dispatchEvent(
        new CustomEvent(`contentcredits:${event}`, { detail: payload, bubbles: false })
      );
    } catch {
      // ignore environments without CustomEvent
    }
  }

  function removeAll(): void {
    (Object.keys(listeners) as SDKEventName[]).forEach(k => {
      delete listeners[k];
    });
  }

  return { on, off, emit, removeAll };
}

export type EventEmitter = ReturnType<typeof createEventEmitter>;
