# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo location

This repo lives at `~/shop-site` and is the **only** copy of this project. It tracks
`github.com/BrianDtabsd/shop-site`. Earlier iterations of this same site exist as separate
GitHub repos (`FrostedGlass` → `BuildOn` → `buildonrepo` → `shop-site`); they are historical
and should not be edited. Do not create sibling folder copies to try out a new look — the
look system is preset-driven and lives inside this repo (see **Theme system** below).

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm test           # Run Vitest once
npm run test:watch # Vitest in watch mode
```

Lint uses ESLint's flat config in `eslint.config.js` and covers the app and Worker
source. Tests use Vitest (pinned to v2 — v3+ requires Vite 6, and this project is on
Vite 5). Coverage is deliberately focused on `src/theme/`, where the pure resolver and
migration logic live; there are no component tests.

## Architecture

**ShopSite** is a React + Vite multi-page marketing and commerce template with studio theming, page visibility controls, and optional Stripe Embedded Checkout.

**Stack:** React 18 + Vite + Tailwind CSS + react-router-dom.

**Entry flow:** `main.jsx` → `App.jsx`. `App.jsx` nests the provider stack in this order:

```
ThemeProvider → BrowserRouter → SiteMetaProvider → TemplateContentProvider
  → VisibilityProvider → StudioShellProvider → StripeEmbeddedCheckoutProvider
  → ScrollContainerProvider → StudioSplitShell → AppRoutes
```

`StudioSplitShell` renders the site in one pane and, when studio mode is on, `SettingsPanel`
beside it (a resizable side panel on desktop, a drag-to-expand bottom sheet on mobile). Because
the site pane scrolls rather than the window, `ScrollContainerContext` hands the scrolling
element to `useScrollReveal` — scroll-linked code must use that context, not `window`.

**Routes** (`/`, `/store`, `/checkout`, `/learn`, `/sales`, `/seller-onboarding`) mount through
`Layout`, which renders `Header` + `Hero` + `<Outlet />` + `Footer`. Note that `Hero` renders on
*every* route, so page content appears below it. Routes are conditionally registered by
`useVisibility`, and `/seller-onboarding` only exists in studio mode.

## Theme system

This is the heart of the template and the thing to understand first.

### The look config

All visual state is one small serializable object:

```js
{ presetId: 'ember', surface: 'glass', mode: 'dark',
  overrides: { accent: '#ff6b00', panelStrength: 0.7 } }
```

`overrides` holds **only** what the user explicitly changed. That separation is
load-bearing: a control is "modified" iff its key is present, resetting a control
deletes the key, switching presets leaves overrides intact, and exporting a site's
look is just serializing this object.

### Modules

**`src/theme/foundationPresets.js`** defines five named looks — `ember`, `consciousness`,
`sansFirst`, `inkPaper`, `monochrome`. Each carries a font set (`display`, `heading`,
`body`, `label`), a `serifScope` (`none` | `display` | `titles`) keeping serif faces off
body and UI copy, and **complete light and dark palettes**. `glassPresetDefaults` layers
glass-only values (panel strength, nav outline) on top.

**`src/theme/controls.js`** is the control registry. Every customizable setting is
declared as data: `id`, `group`, `label`, input type, which surfaces it `appliesTo`, a
`reason` shown when it doesn't apply, and `presetValue(ctx)` giving its un-overridden
value. **Adding a setting means adding a registry entry** — the Look tab renders itself
from this list and derives modified-state and reset for free.

**`src/theme/resolveLook.js`** is a pure function — no React, no DOM, no storage —
layering **preset palette → surface defaults → user overrides** into a complete token
set. It also exports `legacyThemeView`, the flat `theme.*` shape older components still
read; that mapping is covered by tests, so don't inline it.

**`src/theme/migrateLook.js`** converts old flat `shopsite-theme-v*` blobs into look
configs. **Its step order is deliberate** — `panelStrength` must be recovered from
`transparencyLevel` *before* dead fields are dropped, or v2/v3 users silently lose their
panel setting. There is a regression test for exactly this.

**`src/hooks/useTheme.jsx`** is now thin: hold config, call the resolver, write tokens
and `data-*` attributes, persist. It exposes both the new API (`look`, `values`,
`modified`, `setOverride`, `resetControl`, `applyPreset`, saved looks, export/import)
and the legacy `theme` / `updateTheme` shims.

**`src/components/LookEditor.jsx`** renders the Look tab from the registry: one gallery
holding built-in presets *and* the user's saved looks, then surface/mode, then all
control groups, then a footer showing the change count.

### Rules

**Prefer `--ds-*` tokens over hardcoded Tailwind colors.** A component reading
`--ds-color-ink` follows every preset and both modes for free; one hardcoding
`text-white` breaks in light mode.

**Never hide a control based on surface.** Controls that don't apply render *disabled
with their reason*. Panels that change shape when you flip a switch are what made the
old editor feel like separate templates rather than one system.

**Never fork the project to try a new look.** Add a preset entry, or save a customized
look from the Studio.

## Studio

The gear button opens `SettingsPanel`, which has five tabs: **Setup** (`SetupGuide`), **Brand**
(inline `BrandEditor` over `useSiteMeta`), **Pages** (`VisibilityEditor`), **Copy**
(`TemplateContentEditor`), **Look** (`LookEditor`).

Studio mode is on by default. Turn it off for client deploys with `VITE_SHOPSITE_STUDIO_MODE=off`,
or at runtime with `?studio=on|off` (persisted). See `src/lib/studioMode.js`.

**Studio edits persist to `localStorage`**, under these keys:

- `shopsite-look-v5` — the look config
- `shopsite-saved-looks-v1` — the user's named looks
- `shopsite-site-meta-overrides-v1` — brand name, titles, meta description
- `shopsite-template-content-overrides-v1` — marketing copy overrides
- `shopsite-visibility-v1` — which pages/sections are shown
- `shopsite-studio-mode`, `shopsite-studio-panel-width-v1` — studio UI state

`shopsite-theme-v4`, `v3` and `v2` are read once and migrated to `v5`. They are left in
place rather than deleted, so a bad migration is recoverable.

### Known limitation

The Look tab can export and import a look as JSON, but **brand, copy, and page
visibility are still localStorage-only** — a fully configured site cannot yet be built
as a standalone deployable. Phase 3 adds `sites/<name>.json` and
`npm run build --site=<name>`; the exported look object is already that file's format.
See `docs/superpowers/specs/2026-09-08-studio-look-system-design.md`.

## Content and branding

Default marketing copy lives in `src/content/*.js` (`home`, `hero`, `pricing`, `faq`, `blog`,
`sales`, `store`, `systemLogic`), each overridable live via Studio. Brand defaults live in
`src/config/siteMeta.js` and are merged with overrides by `useSiteMeta`, which also keeps
`document.title` and the meta description in sync.

## Animation system

CSS classes (`anim-trigger`, `anim-fade-up`, `anim-line`, `anim-wrap`) defined in `src/index.css`
trigger via `useScrollReveal` (`src/hooks/useScrollReveal.js`), which uses IntersectionObserver
against the studio scroll container to add `.is-visible`. Respects `prefers-reduced-motion`.
Stagger delays are set via inline `transitionDelay` style props; speed is tunable through the
`--reveal-*` custom properties.

## Styling conventions

- Styling is Tailwind utilities inline, layered over the `--ds-*` token system — no CSS modules.
- Reach for design tokens for color and type so presets and light/dark keep working.
- Icons via `<iconify-icon icon="solar:...">` web component (from the `iconify-icon` package).
- Use `clsx` + `tailwind-merge` for conditional class composition.

## Stripe

Checkout endpoints exist in two places that must stay in parity:

- `vite.config.js` — a dev-only middleware plugin serving `/api/stripe/*` from `STRIPE_SECRET_KEY`
- `worker/` — the Cloudflare Worker used in production

Optional Stripe Connect destination charges activate when
`STRIPE_CONNECT_DESTINATION_ACCOUNT` is set. Env vars and Worker secrets are documented in
`AGENTS.md`; `.env.local` is gitignored.

## `src/lib/auraCms.js`

CMS bridge for the Aura preview runtime, communicating via `window.parent.postMessage`. Exports
`fetchAuraCMSCollection()` and the `useAuraCMSCollection()` hook. Currently unused by any
component; wired up for future CMS-driven content.
