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
  blocks: React.ReactNode[];
  teaserCount?: number;
}

/**
 * Headless paywall — the SDK delivers state only.
 * All content visibility, teaser clamping, and paywall UI
 * are handled entirely by this component using React state.
 */
export function PremiumGate({ apiKey, blocks, teaserCount = 3 }: PremiumGateProps) {
  const sdkRef = useRef<any>(null);
  const [state, setState] = useState<CCState>(INITIAL_STATE);

  useEffect(() => {
    import("@contentcredits/sdk").then(({ ContentCredits }) => {
      const cc = ContentCredits.init({
        apiKey,
        headless: true,
        enableComments: false,
        onStateChange: (s: CCState) => setState({ ...s }),
      });
      sdkRef.current = cc;
      // Sync initial state immediately after init
      setState({ ...(cc.getState() as CCState) });
    });

    return () => {
      sdkRef.current?.destroy();
      sdkRef.current = null;
    };
  }, [apiKey]);

  const login = useCallback(() => sdkRef.current?.login(), []);
  const purchase = useCallback(() => sdkRef.current?.purchase(), []);
  const buyMoreCredits = useCallback(() => sdkRef.current?.buyMoreCredits(), []);

  const { isLoading, isLoaded, isLoggedIn, hasAccess, creditBalance, requiredCredits } = state;
  const balance = creditBalance ?? 0;
  const cost = requiredCredits;
  const canAfford = cost !== null && balance >= cost;
  const notEnough = isLoggedIn && !hasAccess && cost !== null && !canAfford;

  return (
    <div>
      {/* ── Article content — full or teaser ─────────────────────────────── */}
      {hasAccess ? (
        <div className="prose-content">{blocks}</div>
      ) : (
        <div className="relative overflow-hidden">
          <div className="prose-content">{blocks.slice(0, teaserCount)}</div>
          {/* Gradient fade over the last visible paragraph */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, #f9fafb 75%)",
            }}
          />
        </div>
      )}

      {/* ── Paywall panel ─────────────────────────────────────────────────── */}
      {!hasAccess && (
        <div className="border-t-[3px] border-gray-900 mt-2 pt-12 pb-16">
          <div className="max-w-sm mx-auto text-center">

            {/* ── Loading skeleton ── */}
            {!isLoaded && (
              <div className="animate-pulse space-y-4">
                <div className="h-7 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
                <div className="h-12 bg-gray-300 rounded-full w-full mt-6" />
              </div>
            )}

            {/* ── Not logged in ── */}
            {isLoaded && !isLoggedIn && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2
                  className="text-3xl font-bold leading-snug mb-3"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  Sign in to read this story.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  This article is available to Content Credits members. Sign in
                  or create a free account to continue reading.
                </p>
                <button
                  onClick={login}
                  className="w-full bg-gray-900 hover:bg-gray-700 active:bg-black text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
                >
                  Sign In to Read
                </button>
                <p className="mt-5 text-xs text-gray-400">
                  No account?{" "}
                  <button
                    onClick={login}
                    className="underline underline-offset-2 hover:text-gray-700 transition-colors"
                  >
                    Create one free
                  </button>
                </p>
              </>
            )}

            {/* ── Logged in, not enough credits ── */}
            {isLoaded && isLoggedIn && notEnough && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2
                  className="text-3xl font-bold leading-snug mb-3"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  You need more credits.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  This article costs{" "}
                  <span className="font-semibold text-gray-700">
                    {cost} credits
                  </span>
                  . Your balance is{" "}
                  <span className="font-semibold text-gray-700">
                    {balance} credits
                  </span>
                  .
                </p>
                <button
                  onClick={buyMoreCredits}
                  className="w-full bg-gray-900 hover:bg-gray-700 active:bg-black text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
                >
                  Get More Credits
                </button>
              </>
            )}

            {/* ── Logged in, can purchase ── */}
            {isLoaded && isLoggedIn && !notEnough && !hasAccess && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2
                  className="text-3xl font-bold leading-snug mb-3"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  Unlock this story.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  {cost !== null ? (
                    <>
                      Spend{" "}
                      <span className="font-semibold text-gray-700">
                        {cost} credits
                      </span>{" "}
                      from your balance of{" "}
                      <span className="font-semibold text-gray-700">
                        {balance}
                      </span>{" "}
                      to read the full article instantly.
                    </>
                  ) : (
                    "Purchase access to read the full article."
                  )}
                </p>
                <button
                  onClick={purchase}
                  className="w-full bg-gray-900 hover:bg-gray-700 active:bg-black text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
                >
                  {cost !== null ? `Unlock for ${cost} Credits` : "Unlock Article"}
                </button>

                {/* "or" divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
                  onClick={buyMoreCredits}
                  className="w-full border border-gray-300 hover:border-gray-500 text-gray-700 hover:text-gray-900 text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors"
                >
                  Get More Credits
                </button>
              </>
            )}

          </div>

          {/* Branding */}
          <p className="text-center text-xs text-gray-300 mt-10">
            Powered by{" "}
            <a
              href="https://contentcredits.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-500 transition-colors"
            >
              Content Credits
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
