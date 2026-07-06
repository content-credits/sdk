import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createState, createInitialState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';

describe('state', () => {
  it('creates the expected initial state', () => {
    expect(createInitialState()).toEqual({
      isLoading: false,
      isExtensionAvailable: false,
      isLoggedIn: false,
      hasAccess: false,
      isLoaded: false,
      user: null,
      creditBalance: null,
      requiredCredits: null,
    });
  });

  it('notifies subscribers on patch updates and reset', () => {
    const store = createState();
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);

    store.set({ isLoading: true, requiredCredits: 4 });
    expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({
      isLoading: true,
      requiredCredits: 4,
    }));

    store.reset();
    expect(subscriber).toHaveBeenLastCalledWith(createInitialState());

    unsubscribe();
    store.set({ isLoaded: true });
    expect(subscriber).toHaveBeenCalledTimes(2);
  });

  it('sets the user and derives login/balance state', () => {
    const store = createState();
    store.setUser({
      _id: 'user_1',
      firstName: 'Ava',
      lastName: 'Stone',
      email: 'ava@example.com',
      credits: 11,
      roles: ['consumer'],
      isVerified: true,
      isActive: true,
    });

    expect(store.get()).toEqual(expect.objectContaining({
      isLoggedIn: true,
      creditBalance: 11,
      user: expect.objectContaining({ _id: 'user_1' }),
    }));

    store.setUser(null);
    expect(store.get()).toEqual(expect.objectContaining({
      isLoggedIn: false,
      creditBalance: null,
      user: null,
    }));
  });
});

describe('events', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    warnSpy.mockClear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('emits to registered listeners and native document events', () => {
    const emitter = createEventEmitter();
    const handler = vi.fn();
    const domHandler = vi.fn();

    emitter.on('paywall:hidden', handler);
    document.addEventListener('contentcredits:paywall:hidden', domHandler as EventListener);

    emitter.emit('paywall:hidden', {});

    expect(handler).toHaveBeenCalledWith({});
    expect(domHandler).toHaveBeenCalledTimes(1);
    const event = domHandler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({});
  });

  it('supports unsubscribe, off, removeAll, and isolates handler failures', () => {
    const emitter = createEventEmitter();
    const healthy = vi.fn();
    const broken = vi.fn(() => {
      throw new Error('boom');
    });

    const unsubscribe = emitter.on('auth:logout', healthy);
    emitter.on('auth:logout', broken);

    emitter.emit('auth:logout', {});
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.off('auth:logout', broken);
    emitter.emit('auth:logout', {});
    expect(healthy).toHaveBeenCalledTimes(1);

    emitter.on('auth:logout', healthy);
    emitter.removeAll();
    emitter.emit('auth:logout', {});
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
