# CLAUDE.md — Content Credits JS SDK

Guidelines for AI agents (and humans) working in this repo.

## What this repo is

`@contentcredits/sdk` — a drop-in TypeScript SDK that adds a paywall and comments widget to any website. Published to npm via GitHub Actions with OIDC Trusted Publishing (no stored npm token).

Key entry points:
- `src/index.ts` — public API surface (`ContentCredits.init`, `destroy`, headless callbacks)
- `src/paywall/gate.ts` — content gating (hides/reveals article nodes)
- `src/paywall/renderer.ts` — shadow-DOM paywall UI (overlay + inline modes)
- `src/ui/styles.ts` — all CSS injected into the shadow root
- `src/comments/` — comment panel and floating widget
- `src/auth/` — popup auth flow, token storage, session management
- `examples/nextjs-blog/` — demo site (deployed to Vercel, separate repo: `content-credits-demo`)

---

## Git workflow

**The `main` branch is protected. Never push directly to it.**

### 1. Create a feature branch

```bash
git checkout main && git pull
git checkout -b feat/your-feature-name   # or fix/, chore/, docs/
```

Branch naming:
| Prefix | Use for |
|--------|---------|
| `feat/` | New features or SDK capabilities |
| `fix/` | Bug fixes |
| `chore/` | Tooling, deps, CI, config changes |
| `docs/` | Documentation only |

### 2. Make changes and commit

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add dark-mode support to overlay paywall
fix: gate no longer hides content when DOM already contains only teaser paragraphs
chore: upgrade rollup to 4.x
```

- One logical change per commit
- Keep commits focused — reviewers read them

### 3. Push and open a PR

```bash
git push -u origin feat/your-feature-name
gh pr create --fill
```

CI runs automatically on every PR (lint → typecheck → tests → build). All checks must pass before merge.

### 4. Merge

Squash-merge or merge commit — both fine. Delete the branch after merge.

---

## Development commands

```bash
npm install          # install dependencies
npm run build        # compile to dist/ (ESM + CJS + types)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # vitest (watch mode)
npm run test:coverage  # vitest with coverage report
```

Tests live in `tests/`. Run the full suite before opening a PR.

---

## Releasing to npm

Publishing is **manual and intentionally decoupled from merging**.

> Merge features to `main` whenever they are ready. Release to npm when a meaningful batch of changes warrants a version bump.

### How to publish

1. Make sure `main` is in the state you want to ship
2. Go to **GitHub → Actions → "Publish to npm" → Run workflow** (select `main`)
3. The workflow auto-computes the next version (see versioning below), runs all checks, publishes, and pushes a git tag

### Bumping the major version

Edit `release-major.txt` (contains a single integer, e.g. `2`) and commit it on a feature branch → merge → then trigger the workflow. The workflow will publish `{NEW_MAJOR}.0.0`.

### Versioning rules (auto-computed by the workflow)

- Major is read from `release-major.txt`
- Minor increments automatically on each publish (patch is always `0`)
- The latest `v{MAJOR}.*.*` git tag is the baseline; the next publish is `MAJOR.(latest_minor + 1).0`
- **Never manually edit `package.json` version** — the workflow sets it

---

## Architecture notes

### Shadow DOM isolation

The paywall UI lives inside a shadow root so publisher CSS cannot bleed in. Two modes:

| Mode | Host attachment | CSS position |
|------|----------------|--------------|
| `overlay` | `document.body` (via `createShadowHost`) | `position: fixed; bottom: 0` |
| `inline` | After content element (via `createInlineShadowHost`) | Normal document flow |

### Content gating (`gate.ts`)

`gate.hide()` hides nodes after the teaser threshold and injects a fade element (inline mode only — overlay mode renders its own gradient inside the panel). `gate.reveal()` restores all hidden nodes cleanly.

Important: when `paragraphs.length <= teaserParagraphs`, the gate shows everything (the server already split the teaser). Only `teaserParagraphs: 0` explicitly hides all content.

### Paywall renderer (`renderer.ts`)

States: `checking → login | purchase | insufficient → loading → granted`

- `loading`: in-place button freeze only — no DOM rebuild (prevents layout shift)
- `granted`: calls `destroy()` to remove the shadow host entirely
- `paywallTopSlot`: accepts a structured `PaywallSlotItem[]`, React element, `HTMLElement`, or factory function `(container) => void`

### Auth flow

Login opens a popup to `accountsUrl`. The popup posts a message back with the token; the SDK receives it via `window.addEventListener('message', ...)`. Tokens are stored in `localStorage` with a TTL; refresh is handled transparently.
