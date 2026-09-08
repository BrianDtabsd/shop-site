# AGENTS.md

Guidance for cloud agents working in this repository.

## Product

**ShopSite** — a React + Vite multi-page marketing and commerce template with studio theming, page visibility controls, and optional Stripe Embedded Checkout. Default copy is generic placeholder content meant to be replaced per client.

## Commands

Standard scripts are in `package.json` and `CLAUDE.md`:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` (default http://localhost:4173) |
| `npm run lint` | ESLint static analysis |

No test framework is configured.

## Cursor Cloud specific instructions

### Services

| Service | When needed | Start |
|---------|-------------|-------|
| **Vite dev server** | Required for local development | `npm run dev` |
| **Cloudflare Worker** (`worker/`) | Optional in dev; required for production Stripe API parity | `cd worker && npm run dev` (port 8787) |
| **Stripe** | Optional for browsing; required for checkout / Connect | Keys in `.env.local` (see below) |

For most frontend work, only the Vite dev server is required. The Vite config embeds Stripe API middleware when `VITE_STRIPE_API_BASE` is unset, so you do not need the Worker running locally unless testing cross-origin or production parity.

### Environment variables

Create `.env.local` at the repo root (gitignored) for Stripe flows:

- `STRIPE_SECRET_KEY` — enables Vite dev middleware checkout endpoints
- `VITE_STRIPE_PUBLISHABLE_KEY` — client-side Embedded Checkout
- `VITE_SHOPSITE_STUDIO_MODE` — `off` hides the settings panel and `/seller-onboarding`

Worker secrets: copy `worker/.dev.vars.example` to `worker/.dev.vars`.

### Studio mode

Studio mode is on by default. The "Open Studio" button mounts `SettingsPanel` *beside* the site
rather than over it: `StudioSplitShell` in `App.jsx` splits the viewport into a scrolling site
pane and a resizable panel (a drag-to-expand bottom sheet on mobile). The panel has five tabs —
Setup, Brand, Pages, Copy, Look.

Runtime override: `?studio=on|off` (persisted in `localStorage`). Build-time:
`VITE_SHOPSITE_STUDIO_MODE=off`.

**Gotcha:** the site pane scrolls, not the window. Anything scroll-linked must read the element
from `ScrollContainerContext` (as `useScrollReveal` does) instead of listening on `window`.

### Theme presets

Looks are data, not separate builds. `src/theme/foundationPresets.js` holds five presets
(`ember`, `consciousness`, `sansFirst`, `inkPaper`, `monochrome`), each with fonts and full
light/dark palettes. `useTheme` resolves `surfaceSystem` (`glass` | `foundation`) +
`foundationPreset` + `foundationMode` into `--ds-*` CSS custom properties on `:root`.

Add a new look by adding a preset entry (and its `glassPresetDefaults` row) — it appears in the
Look tab automatically. Never fork the project to try a new look. Style components with the
`--ds-color-*` tokens rather than hardcoded colors, or they will break across presets and modes.

All studio edits persist to `localStorage` only; there is no config export yet.

### Routing

The app uses `react-router-dom` (not hash-only anchors). Routes include `/`, `/store`, `/checkout`, `/learn`, `/sales`, and `/seller-onboarding` (studio only).

**Gotcha:** `Layout` renders the `<Hero />` section on *every* route, then the page-specific component below it via `<Outlet />`. So on `/store` (and other routes) the homepage hero appears first — scroll past it to see the page content. The page is not "stuck on the homepage"; the route content renders below the hero.

### Lint

`npm run lint` runs ESLint across the app and Worker source.
