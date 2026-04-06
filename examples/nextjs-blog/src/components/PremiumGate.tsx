"use client";

import { useEffect, useRef } from "react";

interface PremiumGateProps {
  apiKey: string;
  children: React.ReactNode;
  teaserParagraphs?: number;
}

// Stable id so the SDK's onAccessGranted callback can find and remove the style.
const GATE_STYLE_ID = "cc-premium-gate-style";

/**
 * Wraps premium article content with the Content Credits paywall.
 *
 * The inline <style> tag is server-rendered so content beyond the teaser is
 * hidden the instant the browser parses the HTML — before any JavaScript runs.
 * This eliminates the flash of full content that would otherwise appear while
 * the SDK is loading and checking access.
 *
 * When the user has access the SDK calls onAccessGranted, which removes the
 * style tag so the full article becomes visible.
 */
export function PremiumGate({
  apiKey,
  children,
  teaserParagraphs = 2,
}: PremiumGateProps) {
  const ccRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    import("@contentcredits/sdk").then(({ ContentCredits }) => {
      ccRef.current = ContentCredits.init({
        apiKey,
        contentSelector: "#premium-content",
        teaserParagraphs,
        onAccessGranted: () => {
          document.getElementById(GATE_STYLE_ID)?.remove();
        },
      });
    });

    return () => {
      ccRef.current?.destroy();
    };
  }, [apiKey, teaserParagraphs]);

  return (
    <>
      {/* Hide content beyond the teaser immediately at parse time (SSR-safe). */}
      <style id={GATE_STYLE_ID}>{`
        #premium-content > *:nth-child(n+${teaserParagraphs + 1}) { display: none !important; }
      `}</style>
      {/* --cc-bg tells the SDK gradient what colour to fade to. */}
      <div id="premium-content" style={{ "--cc-bg": "#fff" } as React.CSSProperties}>
        {children}
      </div>
    </>
  );
}
