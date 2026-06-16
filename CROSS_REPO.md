# Cross-Repo Dependency Map — Content Credits

AI agents and developers: read this before starting any task that might touch more than one repo.
When a change in one repo could ripple to another, **each affected repo gets its own Conductor workspace on a matching branch**.

---

## Repo Inventory

| Repo | Role | Port |
|------|------|------|
| `content-credits-backend` | Central API + DB — single source of truth | 9000 |
| `content-credits-frontend` | Web app (consumers, publishers, admins) | 3000 |
| `content-credits-extension` | Browser extension (in-page paywall + comments) | — |
| `content-credits-wordpress-plugin` | Publisher WordPress content-gating plugin | — |
| `content-credits-js-sdk` | Drop-in JS library for non-WP publishers | — |
| `content-credits-demo` | Demo site for the JS SDK | — |
| `docs` | Docusaurus developer/publisher documentation | — |
| `infra` | CloudFormation + Nginx + Docker Compose deployment | — |
| `ai-newsroom` | AI Newsroom product (separate product, shares backend patterns) | — |
| `wordpress-ai-newsroom` | WordPress plugin for AI Newsroom | — |

---

## Dependency Graph

```
content-credits-backend  ◄──────────────────────────────────────────────┐
        ▲                                                                │
        │ API calls (all routes)                                         │
        ├─────────────── content-credits-frontend                        │
        │                       ▲                                        │
        │                       │ /auth/login + /auth/callback           │
        ├─────────────── content-credits-extension ◄── content-credits-wordpress-plugin
        │                                                                │
        ├─────────────── content-credits-js-sdk ◄── content-credits-demo│
        │                                                                │
        └─────────────── ai-newsroom                                     │
                                                                         │
infra ──────────────────────────────────────────────────────────────────►┘
docs  ──► (reads all repos, no runtime dependency)
```

---

## What Changes What

Use this table to decide which repos need a workspace when you change something.

| If you change... | Also open a workspace in... | Why |
|-----------------|----------------------------|-----|
| A backend API route path or response shape | `content-credits-frontend`, `content-credits-extension`, `content-credits-js-sdk` | All three call the backend directly |
| JWT token format or auth cookie structure | `content-credits-frontend`, `content-credits-extension`, `content-credits-js-sdk` | All three read or store the token |
| CORS whitelist (extension ID or allowed origins) | `content-credits-backend` | Extension ID is hardcoded in backend CORS config |
| `X-Client` / `X-Extension-Id` header names | `content-credits-backend`, `content-credits-extension` | Backend validates these; extension sends them |
| `/auth/login` or `/auth/callback` route on frontend | `content-credits-extension` | Extension opens these URLs to complete login |
| The `content-credits-api-key` meta tag name | `content-credits-extension`, `content-credits-js-sdk`, `content-credits-wordpress-plugin` | All three read or write this tag |
| `cc_php_data` shape (WordPress plugin JS output) | `content-credits-extension` | Extension reads `cc_php_data.hidden_content` |
| Publisher API key validation logic (backend) | `content-credits-wordpress-plugin`, `content-credits-js-sdk` | Both submit `apiKey` on purchase |
| Credit package model (`packageId` field) | `content-credits-frontend`, `content-credits-extension`, `content-credits-js-sdk` | All submit `packageId` to payment routes |
| Payment / billing routes | `content-credits-frontend`, `content-credits-extension`, `content-credits-js-sdk` | All initiate or handle PayPal flow |
| `ContentCredits.init()` SDK public API | `content-credits-demo`, `docs` | Demo uses SDK directly; docs describe the API |
| Nginx / port config in infra | `content-credits-backend`, `content-credits-frontend` | Ports 9000 and 3000 are hardcoded in infra |
| Auth flow (OTP, Google OAuth) | `content-credits-frontend`, `content-credits-extension`, `content-credits-js-sdk` | Auth UI lives in frontend; token flows to extension and SDK |

---

## Critical Contracts — Never Break Without Coordinating All Affected Repos

1. **Meta tag name** `content-credits-api-key` — written by WP plugin and JS SDK; read by extension and JS SDK. Breaking this silently disables paywalls on all publisher pages.
2. **Chrome extension ID** `lcienoajeipclcpinepileagmpkhaknf` — hardcoded in backend CORS and in the WP plugin JS config. Changing it requires simultaneous backend + plugin update.
3. **JWT format** — extension stores and sends it as a Bearer token; frontend reads it from cookies; JS SDK stores it in localStorage. Any structural change requires all three to ship together.
4. **`/auth/callback` route** — the exact URL the extension and JS SDK redirect to after login. Renaming or removing this breaks extension and SDK login.
5. **`cc_php_data.hidden_content`** — the WP plugin passes gated content here; extension reads it to reveal after unlock. Schema changes require plugin + extension to ship together.
6. **`X-Client: contentcredits-browser-extension` header** — backend uses this to identify and trust extension requests. Do not rename without updating backend CORS middleware.
7. **`packageId` (ObjectId) in billing payloads** — all clients must send the `_id` of a `CreditPackage`, not a name string. Do not mix up the two.

---

## Conductor Workflow — Mandatory for All Cross-Repo Work

When a task touches more than one repo:

1. Check this file to identify all affected repos.
2. Open a Conductor workspace in **each affected repo** with a matching branch name (e.g., `feat/new-auth-flow` in all affected repos).
3. Each workspace runs its own agent independently.
4. Use `.context/` inside each workspace to leave notes for agents in sibling repos (e.g., "API shape changed to X — update your call site").
5. Open PRs in **dependency order**: backend first, then consumers (frontend, extension, SDK), then plugins/demo/docs.
6. Never merge a consumer repo's PR before the backend PR it depends on is merged and deployed.

---

## Local Dev: Run Order

```
1. mongod                          # MongoDB must be up first
2. content-credits-backend         # npm run start:dev  →  :9000
3. content-credits-frontend        # npm run dev        →  :3000
4. content-credits-extension       # npm run dev  (then load dist/chrome/ as unpacked extension)
5. content-credits-wordpress-plugin  # npm run build  (install zip on local WP)
```
