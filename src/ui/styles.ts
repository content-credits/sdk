export function getPaywallStyles(primaryColor: string, fontFamily: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ─── Inline paywall panel ──────────────────────────────────────────── */
    .cc-paywall-inline {
      width: 100%;
      padding: 32px 28px 28px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-top: 3px solid ${primaryColor};
      border-radius: 0 0 12px 12px;
      text-align: center;
      font-family: ${fontFamily};
    }
    .cc-paywall-inline h2 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
      letter-spacing: -0.015em;
      line-height: 1.25;
    }
    .cc-paywall-inline p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 20px;
    }

    /* ─── Overlay paywall panel ─────────────────────────────────────────── */
    /*
     * Fixed to the bottom of the viewport, full width.
     * Elevation uses layered shadows — no harsh border-top line.
     * Thin hairline at the top (1px shadow) + ambient shadow for depth.
     */
    .cc-paywall-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: #fff;
      box-shadow:
        0 -1px 0 rgba(15, 23, 42, 0.07),
        0 -4px 12px rgba(15, 23, 42, 0.04),
        0 -24px 64px rgba(15, 23, 42, 0.07);
      font-family: ${fontFamily};
    }

    /*
     * Gradient that fades the article content into the panel.
     * Multi-stop with a cubic-ease-ish curve so it reads as depth,
     * not as an obvious white overlay.
     * initOverlay() overrides this via inline style with the real page bg colour.
     */
    .cc-paywall-overlay-gradient {
      position: absolute;
      top: -160px;
      left: 0;
      right: 0;
      height: 160px;
      pointer-events: none;
      background: linear-gradient(
        to bottom,
        transparent        0%,
        rgba(255,255,255,0.08)  30%,
        rgba(255,255,255,0.55)  60%,
        rgba(255,255,255,0.90)  82%,
        #ffffff            100%
      );
    }

    /* Top slot — publisher-supplied content */
    .cc-paywall-overlay-slot {
      padding: 18px 24px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    /* SDK's own action section below the slot */
    .cc-paywall-overlay-body {
      padding: 14px 24px 26px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }

    /* ─── Slot typography ───────────────────────────────────────────────── */
    .cc-slot-heading {
      font-size: 19px;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
      line-height: 1.3;
      letter-spacing: -0.015em;
    }
    .cc-slot-subheading {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      text-align: center;
    }
    .cc-slot-text {
      font-size: 13px;
      color: #64748b;
      text-align: center;
      line-height: 1.55;
    }

    /* Visual separator between slot and body */
    .cc-slot-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #94a3b8;
    }
    .cc-slot-divider::before,
    .cc-slot-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* ─── Buttons ───────────────────────────────────────────────────────── */
    /*
     * All primary paywall CTAs use .cc-btn-primary (filled, brand colour).
     * .cc-btn-ghost is for low-emphasis secondary links.
     * No outline variant in paywall states — one clear hierarchy.
     */
    .cc-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      height: 46px;
      padding: 0 22px;
      border: none;
      border-radius: 10px;
      font-family: ${fontFamily};
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s ease, transform 0.1s ease;
      width: 100%;
      max-width: 380px;
      letter-spacing: -0.01em;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .cc-btn:hover:not(:disabled) { filter: brightness(1.07); }
    .cc-btn:active:not(:disabled) { transform: scale(0.975); }
    .cc-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .cc-btn-primary  { background: ${primaryColor}; color: #fff; }
    .cc-btn-secondary { background: #0f172a; color: #fff; }

    /* Ghost: text-link-style secondary action */
    .cc-btn-ghost {
      background: transparent;
      color: #64748b;
      height: 36px;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0;
    }
    .cc-btn-ghost:hover:not(:disabled) {
      color: #0f172a;
      background: #f1f5f9;
      filter: none;
    }

    /* Kept for backwards-compat with paywallTopSlot button items */
    .cc-btn-outline {
      background: transparent;
      color: #0f172a;
      border: 1.5px solid #cbd5e1;
    }
    .cc-btn-outline:hover:not(:disabled) {
      border-color: #94a3b8;
      filter: none;
      background: #f8fafc;
    }

    /* ─── Credit badge ───────────────────────────────────────────────────── */
    .cc-credit-badge {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      color: #475569;
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    /* ─── Inline state description text ─────────────────────────────────── */
    .cc-state-detail {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
    }

    /* ─── Spinner (lives inside .cc-btn-primary while loading) ──────────── */
    .cc-spinner {
      display: inline-block;
      width: 17px;
      height: 17px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      animation: cc-spin 0.6s linear infinite;
      flex-shrink: 0;
    }
    @keyframes cc-spin { to { transform: rotate(360deg); } }

    /* ─── "Powered by" attribution ───────────────────────────────────────── */
    .cc-powered-by {
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 0.01em;
    }
    .cc-powered-by a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 600;
    }
    .cc-powered-by a:hover { text-decoration: underline; }

    /* ─── Mobile: tighter vertical padding ──────────────────────────────── */
    @media (max-width: 480px) {
      .cc-paywall-overlay-slot { padding: 14px 16px 0; gap: 4px; }
      .cc-paywall-overlay-body { padding: 12px 16px 20px; gap: 10px; }
      .cc-slot-heading { font-size: 17px; }
    }
  `;
}

export function getCommentStyles(primaryColor: string, fontFamily: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Widget Button ───────────────────────────────────── */
    .cc-widget-btn {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      width: auto;
      height: 60px;
      background: ${primaryColor};
      border-radius: 10px 0 0 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding-left: 12px;
      padding-right: 6px;
      z-index: 2147483646;
      box-shadow: -2px 0 16px rgba(0,0,0,0.12);
      cursor: pointer;
      user-select: none;
      font-family: ${fontFamily};
      transition: background 0.2s;
      pointer-events: all;
    }
    .cc-widget-btn:hover { filter: brightness(1.08); }

    .cc-widget-icon { color: #fff; display: flex; align-items: center; }
    .cc-widget-badge {
      background: #fff;
      color: ${primaryColor};
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 12px;
      font-weight: 700;
      min-width: 20px;
      text-align: center;
    }
    .cc-widget-drag-handle {
      color: rgba(255,255,255,0.7);
      cursor: grab;
      display: flex;
      align-items: center;
      padding: 0 4px;
    }
    .cc-widget-drag-handle:active { cursor: grabbing; }

    /* ── Panel Overlay ───────────────────────────────────── */
    .cc-panel-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 2147483645;
      opacity: 0;
      transition: opacity 0.25s;
      pointer-events: all;
    }
    .cc-panel-backdrop.cc-visible { opacity: 1; }

    .cc-panel {
      position: fixed;
      top: 0; right: -500px;
      width: 460px;
      max-width: 95vw;
      height: 100%;
      background: #f9fafb;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 32px rgba(0,0,0,0.12);
      transition: right 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: ${fontFamily};
      pointer-events: all;
    }
    .cc-panel.cc-open { right: 0; }

    /* ── Panel Header ────────────────────────────────────── */
    .cc-panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
      flex-shrink: 0;
    }
    .cc-panel-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      flex: 1;
    }
    .cc-panel-count {
      font-size: 13px;
      color: #6b7280;
      font-weight: 400;
    }
    .cc-panel-close-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      display: flex;
      align-items: center;
      border-radius: 6px;
      transition: background 0.15s;
    }
    .cc-panel-close-btn:hover { background: #f3f4f6; }

    .cc-back-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      display: none;
      align-items: center;
      border-radius: 6px;
      transition: background 0.15s;
    }
    .cc-back-btn.cc-visible { display: flex; }
    .cc-back-btn:hover { background: #f3f4f6; }

    /* ── Sort Bar ────────────────────────────────────────── */
    .cc-sort-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-bottom: 1px solid #f3f4f6;
      background: #fff;
      flex-shrink: 0;
    }
    .cc-sort-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
    .cc-sort-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: ${fontFamily};
      transition: background 0.15s, color 0.15s;
    }
    .cc-sort-btn:hover { background: #f3f4f6; }
    .cc-sort-btn.cc-active { background: #111827; color: #fff; }

    /* ── Comments List ───────────────────────────────────── */
    .cc-comments-list {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .cc-comments-list::-webkit-scrollbar { width: 4px; }
    .cc-comments-list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

    /* ── Comment Card ────────────────────────────────────── */
    .cc-comment-card {
      padding: 16px 20px;
      background: #fff;
      border-bottom: 1px solid #f3f4f6;
    }
    .cc-comment-card.cc-reply {
      padding-left: 36px;
      background: #fafafa;
    }

    .cc-comment-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .cc-comment-author-row { display: flex; align-items: center; gap: 10px; }

    .cc-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      overflow: hidden;
    }
    .cc-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .cc-author-name {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    .cc-comment-time {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .cc-comment-body {
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
      margin-bottom: 12px;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .cc-comment-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cc-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      padding: 3px 6px;
      border-radius: 6px;
      font-family: ${fontFamily};
      transition: background 0.15s, color 0.15s;
    }
    .cc-action-btn:hover { background: #f3f4f6; }
    .cc-action-btn.cc-liked { color: #ef4444; }
    .cc-action-btn.cc-danger:hover { color: #ef4444; background: #fef2f2; }
    .cc-action-btn.cc-owner-actions { margin-left: auto; }

    /* ── Reply Subthread ─────────────────────────────────── */
    .cc-subthread-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 20px 8px;
      background: #f9fafb;
    }

    /* ── Empty / Loading / Error ─────────────────────────── */
    .cc-empty-state, .cc-loading-state, .cc-error-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
    }
    .cc-empty-state p, .cc-loading-state p, .cc-error-state p {
      font-size: 14px;
      font-weight: 500;
      color: #9ca3af;
      margin-bottom: 6px;
    }
    .cc-empty-state span, .cc-loading-state span, .cc-error-state span {
      font-size: 13px;
      color: #d1d5db;
    }
    .cc-error-state .cc-retry-btn {
      margin-top: 16px;
      padding: 8px 16px;
      background: #111827;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: ${fontFamily};
    }
    .cc-error-icon { color: #ef4444; margin-bottom: 12px; }

    .cc-spinner-lg {
      width: 28px; height: 28px;
      border: 2px solid #e5e7eb;
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: cc-spin 0.7s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes cc-spin { to { transform: rotate(360deg); } }

    /* ── Compose Box ─────────────────────────────────────── */
    .cc-compose {
      border-top: 1px solid #e5e7eb;
      padding: 12px 20px;
      background: #fff;
      flex-shrink: 0;
      position: relative;
    }

    .cc-compose-textarea {
      width: 100%;
      min-height: 72px;
      max-height: 180px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: ${fontFamily};
      color: #111827;
      resize: vertical;
      outline: none;
      background: #fff;
      transition: border-color 0.15s;
      line-height: 1.5;
    }
    .cc-compose-textarea:focus { border-color: ${primaryColor}; }
    .cc-compose-textarea::placeholder { color: #9ca3af; }

    .cc-compose-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      gap: 8px;
    }
    .cc-compose-cancel {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: #6b7280;
      font-family: ${fontFamily};
      padding: 6px;
      display: none;
    }
    .cc-compose-cancel.cc-visible { display: block; }
    .cc-compose-submit {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      background: ${primaryColor};
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: ${fontFamily};
      margin-left: auto;
      transition: opacity 0.15s;
    }
    .cc-compose-submit:disabled { opacity: 0.55; cursor: not-allowed; }

    .cc-spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: cc-spin 0.7s linear infinite;
    }

    /* ── Login Overlay inside compose ────────────────────── */
    .cc-login-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .cc-login-overlay p {
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .cc-login-overlay-btn {
      height: 40px;
      padding: 0 20px;
      background: ${primaryColor};
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: ${fontFamily};
    }
  `;
}
