/**
 * Client-side mirror of the backend's canonicalization rules
 * (content-credits-backend/src/utils/canonicalHost.ts + canonicalUrl.ts,
 * see POST_IDENTITY_AND_REVAMP_PLAN.md §2.2).
 *
 * The backend stays authoritative — it re-canonicalizes everything the SDK
 * sends. This helper exists so the beacon (`/posts/observe`) and the paywall
 * (`/credits/*`) agree on post identity *before* the request leaves the
 * browser, and so the SDK can dedupe/display consistently offline.
 *
 * Policy (kept identical to the backend on purpose — do not drift):
 *  - Fold `www.` -> apex, always. `www.example.com` === `example.com`.
 *  - Do NOT fold other subdomains. `blog.example.com` stays distinct.
 *  - Lowercase; strip protocol, port, path, query, fragment, trailing dot.
 *  - Accept a bare hostname or a full URL; resolve punycode/IDN via the URL API.
 *  - canonicalUrl: force https, drop fragment, drop tracking params
 *    (utm_*, fbclid, gclid, ref, mc_cid/mc_eid, igshid), sort remaining
 *    query params, normalize trailing slash.
 */

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^ref$/i,
  /^mc_(cid|eid)$/i,
  /^igshid$/i,
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAM_PATTERNS.some(re => re.test(key));
}

/** Mirrors backend `canonicalHost()` — fold www, lowercase, strip everything else. */
export function canonicalHost(input: string): string {
  if (!input) return '';
  let h = input.trim().toLowerCase();
  try {
    h = new URL(h.includes('://') ? h : `https://${h}`).hostname;
  } catch {
    h = h.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  }
  h = h.replace(/\.$/, ''); // trailing dot
  h = h.replace(/^www\./, ''); // fold www
  return h;
}

/** Mirrors backend `canonicalUrl()` — the dedup key, never used for display. */
export function canonicalUrl(input: string): string {
  if (!input) return '';
  const raw = input.trim();

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return raw.toLowerCase();
  }

  const host = canonicalHost(url.hostname);

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const keptParams: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (isTrackingParam(key)) continue;
    keptParams.push([key, value]);
  }
  keptParams.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const query = keptParams.length
    ? '?' + keptParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';

  return `https://${host}${pathname}${query}`;
}
