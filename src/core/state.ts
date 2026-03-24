import type { SDKState, User } from '../types/index.js';

export function createInitialState(): SDKState {
  return {
    isLoading: false,
    isExtensionAvailable: false,
    isLoggedIn: false,
    hasAccess: false,
    isLoaded: false,
    user: null,
    creditBalance: null,
    requiredCredits: null,
  };
}

export function createState() {
  let current: SDKState = createInitialState();
  const subscribers: Array<(state: SDKState) => void> = [];

  function get(): SDKState {
    return { ...current };
  }

  function set(patch: Partial<SDKState>): void {
    current = { ...current, ...patch };
    subscribers.forEach(fn => fn(get()));
  }

  function subscribe(fn: (state: SDKState) => void): () => void {
    subscribers.push(fn);
    return () => {
      const i = subscribers.indexOf(fn);
      if (i >= 0) subscribers.splice(i, 1);
    };
  }

  function reset(): void {
    current = createInitialState();
    subscribers.forEach(fn => fn(get()));
  }

  function setUser(user: User | null): void {
    set({
      user,
      isLoggedIn: user !== null,
      creditBalance: user?.credits ?? null,
    });
  }

  return { get, set, subscribe, reset, setUser };
}

export type StateStore = ReturnType<typeof createState>;
