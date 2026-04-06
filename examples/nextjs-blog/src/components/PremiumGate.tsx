"use client";

import { useEffect, useRef } from "react";

interface PremiumGateProps {
  apiKey: string;
  children: React.ReactNode;
}

/**
 * Wraps premium article content with the Content Credits paywall.
 *
 * Must be a Client Component ("use client") because the SDK manipulates the DOM.
 * The SDK is loaded via dynamic import inside useEffect so it never runs during
 * Next.js SSG/SSR (which has no `document`).
 */
export function PremiumGate({ apiKey, children }: PremiumGateProps) {
  const ccRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    import("@contentcredits/sdk").then(({ ContentCredits }) => {
      ccRef.current = ContentCredits.init({
        apiKey,
        contentSelector: "#premium-content",
        teaserParagraphs: 2,
      });
    });

    return () => {
      ccRef.current?.destroy();
    };
  }, [apiKey]);

  return <div id="premium-content">{children}</div>;
}
