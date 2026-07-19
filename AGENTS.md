# AGENTS.md — content-credits-js-sdk

`@contentcredits/sdk` — a drop-in TypeScript SDK that adds a paywall and comments widget to any website (alternative to the browser extension, for non-WordPress publishers). Published to npm via GitHub Actions.

> Before starting any task, check `../CROSS_REPO.md` to identify which other repos your change affects and open a Conductor workspace in each one.

---

## Cross-Repo Dependencies

### This repo depends on
- **`content-credits-backend`** — same API surface as the extension (credits, auth, comments)
- **`content-credits-frontend`** — opens accounts URL for auth popup (`https://accounts.contentcredits.com/auth/login`)

### Repos that depend on this
- **`content-credits-demo`** — demo site that calls `ContentCredits.init()`
- **`docs`** — documents the public SDK API

### If you change...
| Change | Also needs a workspace in |
|--------|--------------------------|
| `ContentCredits.init()` options shape | `content-credits-demo`, `docs` |
| Auth popup URL or token handoff mechanism | `content-credits-frontend`, `content-credits-backend` |
| Meta tag name `content-credits-api-key` | `content-credits-extension`, `content-credits-wordpress-plugin` |
| API endpoint calls (routes, payload shape) | `content-credits-backend` |
| npm package name or entry points | `content-credits-demo`, `docs` |

---

## Stack

TypeScript · Shadow DOM · Vitest · Rollup

**Key entry points**:
- `src/index.ts` — public API (`ContentCredits.init`, `destroy`, headless callbacks)
- `src/paywall/gate.ts` — content gating (hide/reveal article nodes)
- `src/paywall/renderer.ts` — shadow-DOM paywall UI (overlay + inline modes)
- `src/ui/styles.ts` — CSS injected into shadow root
- `src/comments/` — comment panel and floating widget
- `src/auth/` — popup auth flow, token storage (localStorage + TTL), session management

---

## Architecture Notes

### Shadow DOM Isolation
Paywall UI lives inside a shadow root — publisher CSS cannot bleed in.

| Mode | Host | CSS |
|------|------|-----|
| `overlay` | `document.body` | `position: fixed; bottom: 0` |
| `inline` | After content element | Normal document flow |

### Auth Flow
Login opens a popup to `accountsUrl`. The popup posts back a `message` event with the token. SDK receives via `window.addEventListener('message', ...)` and stores in `localStorage` with TTL.

### Content Gating (`gate.ts`)
`gate.hide()` hides nodes past the teaser threshold. `gate.reveal()` restores all hidden nodes.
When `paragraphs.length <= teaserParagraphs`, everything is shown. Only `teaserParagraphs: 0` hides all content.

### Paywall Renderer States
`checking → login | purchase | insufficient → loading → granted`
- `loading`: in-place button freeze only, no DOM rebuild (prevents layout shift)
- `granted`: calls `destroy()` to remove shadow host entirely

---

## Development Commands

```bash
npm install
npm run build          # compile to dist/ (ESM + CJS + types)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test           # vitest
npm run test:coverage  # vitest with coverage
```

---

## Releasing to npm

Publishing is **manual and intentionally decoupled from merging**.

1. Merge features to `main` when ready.
2. Go to **GitHub → Actions → "Publish to npm" → Run workflow** (select `main`).
3. Workflow auto-computes the next version, runs checks, publishes, and pushes a git tag.

**Versioning**: major is read from `release-major.txt`; minor auto-increments each publish; patch is always `0`. Never manually edit `package.json` version.

---

## Git Workflow

- `main` is protected — never push directly.
- Branch: `feat/`, `fix/`, `chore/`, `docs/`
- All CI checks (lint → typecheck → tests → build) must pass before merge.
- If this PR is part of a cross-repo change, merge the backend PR **first**.

---

## Harness — how agents work here

**Read first**: `../AGENTS.md` (workspace operating model), `../CROSS_REPO.md` (blast radius + critical contracts), `../docs/adr/README.md` (decision log), `../GLOSSARY.md` (canonical consumer copy).

**Decisions**: before changing architecture, a data model, or a cross-repo contract, scan the ADR index — the constraint may be deliberate. After such a decision, record an ADR (`/adr` skill or `adr-scribe` subagent). Never silently violate an accepted ADR; supersede it.

**Verify before done** (run it yourself or via the `verifier` subagent — never claim green without running):

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

**Subagents** (defined in `.claude/agents/`): delegate noisy work — `verifier` for builds/tests, `reviewer` for a fresh-context pass on every non-trivial diff before a PR, `contract-checker` before merging anything that touches a shared contract.

**Cross-repo work**: matching branch name in every affected repo; PRs merge backend-first (ADR-0008). Leave notes for sibling-repo agents in `.context/` (gitignored scratch) or the workspace planning docs.

