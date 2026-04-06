"use client";

import { useEffect } from "react";
import { ContentCredits } from "@contentcredits/sdk";

interface PremiumGateProps {
  apiKey: string;
  children: React.ReactNode;
}

/**
 * Wraps premium article content with the Content Credits paywall.
 *
 * Must be a Client Component ("use client") because it uses useEffect
 * to initialise the SDK after the DOM is available.
 *
 * The SDK targets the #premium-content element and hides everything after
 * the configured teaser paragraphs until the reader purchases access.
 */
export function PremiumGate({ apiKey, children }: PremiumGateProps) {
  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      contentSelector: "#premium-content",
      teaserParagraphs: 2,
    });

    // Clean up when navigating away (important for SPA-style navigation)
    return () => cc.destroy();
  }, [apiKey]);

  return <div id="premium-content">{children}</div>;
}
