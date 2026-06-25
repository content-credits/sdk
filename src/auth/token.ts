interface JwtPayload {
  id?: string;
  _id?: string;
  email?: string;
  exp?: number;
  iat?: number;
}

/**
 * Decode JWT payload without signature verification.
 *
 * SECURITY NOTE: This is intentional. Signature verification happens
 * server-side on every API call. Client-side decoding is only used for:
 * - Checking token expiration before making requests
 * - Reading non-sensitive claims for UI display
 *
 * An attacker crafting fake JWTs gains nothing - the server rejects them.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    // Normalise Base64URL → Base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Returns true if the JWT is expired (or unparseable). */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  // exp is in seconds; compare against current time in seconds
  return Date.now() / 1000 > payload.exp;
}

/** Extract the user ID from a JWT. Returns null if token is invalid. */
export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwt(token);
  return payload ? (payload.id ?? payload._id ?? null) : null;
}
