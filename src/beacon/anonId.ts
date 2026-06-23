/**
 * Anonymous view-dedup id (design doc §7.4): a rotating, non-PII identifier
 * used by the backend to dedup anonymous-reader view events within a 30-minute
 * window. This is intentionally NOT a session id — it's stored long-lived
 * (1 year TTL) in localStorage so the same anonymous reader is recognized
 * across visits, but it carries no PII and rotates once it expires.
 *
 * Mirrors the storage shape used by `src/auth/storage.ts` (localStorage +
 * explicit TTL), just keyed differently and with no auth semantics at all.
 */

const ANON_ID_KEY = 'cc_anon_id';
const ANON_ID_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

interface StoredAnonId {
  value: string;
  expiresAt: number;
}

/** Generates an opaque random id — prefers crypto.randomUUID, falls back otherwise. */
function generateAnonId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to manual fallback
  }

  // Fallback random-string generator (no crypto.randomUUID available, e.g. older browsers).
  const rand = (): string => Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

function readStored(): StoredAnonId | null {
  try {
    const raw = localStorage.getItem(ANON_ID_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAnonId;
    if (!parsed || typeof parsed.value !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (Date.now() > parsed.expiresAt) return null; // expired
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  try {
    const record: StoredAnonId = { value, expiresAt: Date.now() + ANON_ID_TTL_MS };
    localStorage.setItem(ANON_ID_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (e.g. private mode with strict settings) — degrade
    // gracefully; the caller still gets a value, it just won't persist.
  }
}

/**
 * Returns the persisted anonId, generating and storing a new one the first
 * time it's needed (or after the previous one has expired/TTL'd out).
 */
export function getOrCreateAnonId(): string {
  const existing = readStored();
  if (existing) return existing.value;

  const id = generateAnonId();
  writeStored(id);
  return id;
}
