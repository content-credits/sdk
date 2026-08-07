/**
 * Global test setup — provides an in-memory Web Storage implementation.
 *
 * Why this exists: under newer Node (which ships its own experimental native
 * `localStorage`, inert unless launched with `--localstorage-file`), the
 * vitest jsdom environment leaves `globalThis.localStorage` /
 * `globalThis.sessionStorage` undefined. Any test that touches storage —
 * beacon anon-id, auth token storage/rotation, the comment widget's saved
 * position — then throws in setup ("Cannot read properties of undefined").
 *
 * We install a small, spec-shaped Storage shim and, crucially, expose it as
 * the global `Storage` class. Some tests deliberately monkey-patch
 * `Storage.prototype.getItem/setItem` to assert graceful degradation when
 * storage throws; keeping the instances' methods on this class's prototype
 * makes those overrides take effect exactly as they would in a browser.
 */
import { beforeEach } from 'vitest';

class MemoryStorage {
  private _data = new Map<string, string>();

  get length(): number {
    return this._data.size;
  }

  clear(): void {
    this._data.clear();
  }

  getItem(key: string): string | null {
    return this._data.has(key) ? (this._data.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this._data.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this._data.delete(String(key));
  }

  key(index: number): string | null {
    return Array.from(this._data.keys())[index] ?? null;
  }
}

function define(target: unknown, name: string, value: unknown): void {
  if (!target) return;
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

// Expose the class globally so `Storage.prototype.*` overrides in tests resolve
// to the same prototype our instances use.
define(globalThis, 'Storage', MemoryStorage);

const local = new MemoryStorage();
const session = new MemoryStorage();
const win = (globalThis as { window?: unknown }).window;

define(globalThis, 'localStorage', local);
define(globalThis, 'sessionStorage', session);
define(win, 'localStorage', local);
define(win, 'sessionStorage', session);

// Guarantee isolation between tests even for suites that don't clear themselves.
beforeEach(() => {
  local.clear();
  session.clear();
});
