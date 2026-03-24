import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';

const FEATURES = [
  {
    icon: '🔒',
    title: 'Content Gating',
    desc: 'Lock premium content behind a paywall in seconds using a single CSS selector. No PHP, no server-side splitting.',
  },
  {
    icon: '💬',
    title: 'Threaded Comments',
    desc: 'Full comment system with threading, likes, edit, delete, and sorting — all in a Shadow DOM panel that never conflicts with your CSS.',
  },
  {
    icon: '🪙',
    title: 'Credit-Based Payments',
    desc: 'Readers pre-purchase credits in bulk and spend them per article. No card friction at the point of reading.',
  },
  {
    icon: '🔐',
    title: 'Secure Auth',
    desc: 'Tokens stored in memory with sessionStorage fallback. No cookies. Popup-based login with mobile redirect fallback.',
  },
  {
    icon: '🧩',
    title: 'Extension Integration',
    desc: 'Automatically detects the Content Credits Chrome extension for a seamless one-click access experience.',
  },
  {
    icon: '📦',
    title: 'Zero Dependencies',
    desc: 'Pure TypeScript. Ships as ESM, CJS, and UMD. Works via CDN script tag or npm install — no framework required.',
  },
];

const QUICK_SNIPPET = `<!-- 1. Add one script tag -->
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_KEY"
  data-content-selector="#premium-content"
></script>

<!-- 2. Wrap your premium content -->
<div id="premium-content">
  <p>This content is gated. Readers pay per article.</p>
</div>

<!-- That's it. The SDK handles everything else. -->`;

export default function Home(): ReactNode {
  return (
    <Layout
      title="Content Credits SDK — Drop-in paywall & comments"
      description="Add a paywall and threaded comment system to any website in under 5 minutes. Credit-based, secure, zero dependencies."
    >
      {/* Hero */}
      <header className="hero-banner">
        <div className="container">
          <span className="hero-badge">SDK v2.0 · TypeScript · Zero dependencies</span>
          <h1>Monetise your content.<br />One script tag.</h1>
          <p className="hero-subtitle">
            Add a full paywall and threaded comment system to any website in under 5 minutes.
            No subscriptions. Readers pay per article with pre-purchased credits.
          </p>
          <div className="hero-ctas">
            <Link className="button button--primary button--lg" to="/getting-started/quick-start">
              Get Started →
            </Link>
            <Link className="button button--secondary button--lg" to="/intro">
              See how it works
            </Link>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stats-inner">
          <div className="stat-item">
            <span className="stat-number">&lt; 5 min</span>
            <span className="stat-label">Setup time</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">1 tag</span>
            <span className="stat-label">To go live</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Dependencies</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">TypeScript</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: 8 }}>
            Everything you need
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--ifm-color-emphasis-600)', marginBottom: 40 }}>
            One SDK, two powerful systems — paywall and comments — fully integrated.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick start code */}
      <section className="quickstart-section">
        <div className="quickstart-inner">
          <h2>Start in 30 seconds</h2>
          <p className="quickstart-sub">No build step, no npm, no configuration file required.</p>
          <CodeBlock language="html">{QUICK_SNIPPET}</CodeBlock>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link className="button button--primary button--lg" to="/getting-started/installation">
              Full installation guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '60px 0', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Ready to integrate?</h2>
          <p style={{ color: 'var(--ifm-color-emphasis-600)', marginBottom: 28, fontSize: '1.1rem' }}>
            Get your publisher API key from the Content Credits dashboard and follow the guide.
          </p>
          <div className="hero-ctas">
            <Link className="button button--primary button--lg" href="https://app.contentcredits.com">
              Get your API key
            </Link>
            <Link className="button button--secondary button--lg" to="/api-reference/contentcredits-class">
              API Reference
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
