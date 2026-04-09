"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface CCState {
  isLoading: boolean;
  isLoaded: boolean;
  isLoggedIn: boolean;
  hasAccess: boolean;
  creditBalance: number | null;
  requiredCredits: number | null;
}

const INITIAL_STATE: CCState = {
  isLoading: false,
  isLoaded: false,
  isLoggedIn: false,
  hasAccess: false,
  creditBalance: null,
  requiredCredits: null,
};

interface PremiumGateProps {
  apiKey: string;
  slug: string;
  teaserBlocks: React.ReactNode[];
}

/**
 * Overlay paywall component.
 *
 * Security model:
 *  - Only `teaserBlocks` (first 3 paragraphs) arrive from the server.
 *    The full article is never in the page HTML or RSC payload.
 *  - When the SDK confirms access (hasAccess: true), we call
 *    GET /api/article/[slug]/content with the CC access token.
 *    That route verifies the token with the CC API server-side before
 *    returning the content — so the full article is never sent to a
 *    user who hasn't paid, even if they fake the SDK state.
 *
 * UI model:
 *  - Teaser content is shown with a gradient fade at the bottom.
 *  - A full-width sticky paywall bar sits below, blocking further reading.
 *  - Once access is confirmed, the full article replaces the teaser inline.
 */
export function PremiumGate({ apiKey, slug, teaserBlocks }: PremiumGateProps) {
  const sdkRef = useRef<any>(null);
  const [state, setState] = useState<CCState>(INITIAL_STATE);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // Initialise SDK
  useEffect(() => {
    import("@contentcredits/sdk").then(({ ContentCredits }) => {
      const cc = ContentCredits.init({
        apiKey,
        headless: true,
        enableComments: false,
        onStateChange: (s: CCState) => setState({ ...s }),
      });
      sdkRef.current = cc;
      setState({ ...(cc.getState() as CCState) });
    });

    return () => {
      sdkRef.current?.destroy();
      sdkRef.current = null;
    };
  }, [apiKey]);

  // Fetch full content once access is confirmed
  useEffect(() => {
    if (!state.hasAccess || fullContent || fetchError) return;

    const token = sdkRef.current?.getToken() as string | null;

    if (!token) {
      setFetchError(true);
      return;
    }

    fetch(`/api/article/${slug}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("denied");
        return r.json();
      })
      .then((data: { content: string }) => setFullContent(data.content))
      .catch(() => setFetchError(true));
  }, [state.hasAccess, slug, fullContent, fetchError]);

  const login = useCallback(() => sdkRef.current?.login(), []);
  const purchase = useCallback(() => sdkRef.current?.purchase(), []);
  const buyMoreCredits = useCallback(() => sdkRef.current?.buyMoreCredits(), []);

  const { isLoaded, isLoggedIn, hasAccess, creditBalance, requiredCredits } = state;
  const balance = creditBalance ?? 0;
  const cost = requiredCredits;
  const canAfford = cost !== null && balance >= cost;
  const notEnough = isLoggedIn && !hasAccess && cost !== null && !canAfford;

  // ── Access granted: render full article ────────────────────────────────────
  if (hasAccess) {
    if (fetchError) {
      return (
        <p className="text-sm text-red-500 py-6">
          Could not load article content. Please refresh the page and try again.
        </p>
      );
    }
    if (!fullContent) {
      // Content fetch in flight
      return (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      );
    }

    // Render full article content
    const blocks = fullContent.split("\n\n").map((block, i) => {
      if (block.startsWith("## ")) {
        return (
          <h2 key={i} className="text-2xl font-bold mt-10 mb-4 text-gray-900">
            {block.slice(3)}
          </h2>
        );
      }
      if (block.startsWith("```")) {
        const lines = block.split("\n");
        const code = lines.slice(1, -1).join("\n");
        return (
          <pre key={i} className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-sm my-6 font-mono">
            <code>{code}</code>
          </pre>
        );
      }
      return (
        <p key={i} className="text-gray-700 leading-relaxed mb-5 text-lg">
          {block}
        </p>
      );
    });

    return <div className="prose-content">{blocks}</div>;
  }

  // ── Paywalled: teaser + overlay ────────────────────────────────────────────
  return (
    <>
      {/* Teaser content with gradient fade */}
      <div className="relative">
        <div className="prose-content">{teaserBlocks}</div>

        {/* Gradient fade — blends teaser into the paywall panel */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 0%, #f9fafb 85%)" }}
        />
      </div>

      {/* Full-width sticky paywall overlay */}
      <div
        className="absolute left-0 right-0 bottom-0 py-8 mt-2"
        style={{
          // Break out of the max-w-2xl container to span the full viewport
          background: "white",
          borderTop: "3px solid #111",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div className="max-w-sm mx-auto text-center px-4">

          {/* Loading skeleton */}
          {!isLoaded && (
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-12 bg-gray-300 rounded-full w-full mt-4" />
            </div>
          )}

          {/* Not logged in */}
          {isLoaded && !isLoggedIn && (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
                Premium Article
              </p>
              <h2
                className="text-2xl font-bold leading-snug mb-2"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Sign in to keep reading.
              </h2>
              <p className="text-gray-500 text-sm mb-5">
                This story is for Content Credits members. Sign in or create a free account.
              </p>
              <button
                onClick={login}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
              >
                Sign In to Read
              </button>
              <p className="mt-4 text-xs text-gray-400">
                No account?{" "}
                <button onClick={login} className="underline underline-offset-2 hover:text-gray-700 transition-colors">
                  Create one free
                </button>
              </p>
            </>
          )}

          {/* Logged in, not enough credits */}
          {isLoaded && notEnough && (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
                Premium Article
              </p>
              <h2
                className="text-2xl font-bold leading-snug mb-2"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                You need more credits.
              </h2>
              <p className="text-gray-500 text-sm mb-5">
                This article costs <strong className="text-gray-700">{cost} credits</strong>.
                Your balance is <strong className="text-gray-700">{balance}</strong>.
              </p>
              <button
                onClick={buyMoreCredits}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
              >
                Get More Credits
              </button>
            </>
          )}

          {/* Logged in, can purchase */}
          {isLoaded && isLoggedIn && !notEnough && !hasAccess && (
            <>
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
                Premium Article
              </p>
              <h2
                className="text-2xl font-bold leading-snug mb-2"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Unlock this story.
              </h2>
              <p className="text-gray-500 text-sm mb-5">
                {cost !== null ? (
                  <>
                    Spend <strong className="text-gray-700">{cost} credits</strong> from your
                    balance of <strong className="text-gray-700">{balance}</strong>.
                  </>
                ) : (
                  "Purchase access to read the full article."
                )}
              </p>
              <button
                onClick={purchase}
                className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
              >
                {cost !== null ? `Unlock for ${cost} Credits` : "Unlock Article"}
              </button>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button
                onClick={buyMoreCredits}
                className="w-full border border-gray-300 hover:border-gray-500 text-gray-700 text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
              >
                Get More Credits
              </button>
            </>
          )}

          {fetchError && (
            <p className="text-xs text-red-500 mt-3">
              Could not load article. Please refresh and try again.
            </p>
          )}

        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          Powered by{" "}
          <a href="https://contentcredits.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">
            Content Credits
          </a>
        </p>
      </div>
    </>
  );
}
