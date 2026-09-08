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
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

Lint uses ESLint's flat config in `eslint.config.js` and covers the app and Worker source. No test framework is configured.

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

**`src/theme/foundationPresets.js`** defines five named looks — `ember`, `consciousness`,
`sansFirst`, `inkPaper`, `monochrome`. Each preset carries a font set (`display`, `heading`,
`body`, `label`), a `serifScope` (`none` | `display` | `titles`) that keeps serif faces off body
and UI copy, and **complete light and dark palettes**. `glassPresetDefaults` in the same file
layers glass-only values (panel strength, nav outline) on top of the shared preset.

**`src/hooks/useTheme.jsx`** holds the active theme and applies it. Three fields drive everything:

| Field | Values | Meaning |
|---|---|---|
| `surfaceSystem` | `glass` \| `foundation` | Which rendering system paints surfaces |
| `foundationPreset` | one of the five preset ids | Shared font + color pair |
| `foundationMode` | `light` \| `dark` | Which half of the preset palette is used |

The hook writes the resolved values to `:root` as CSS custom properties and sets
`document.documentElement.dataset.foundationMode`. Design tokens are the `--ds-color-*` family
(`canvas`, `surface`, `surfaceSubtle`, `ink`, `inkMuted`, `inkFaint`, `line`, `accent`,
`accentHover`, `accentSoft`, plus `--ds-button-ink`/`--ds-button-ink-text`). Motion vars
(`--reveal-fade-speed`, `--reveal-line-speed`, `--parallax-depth`, `--float-strength`) come from
the same place.

**Prefer these tokens over hardcoded Tailwind colors.** A component that reads `--ds-color-ink`
follows every preset and both modes for free; one that hardcodes `text-white` breaks in light mode.

**`src/components/LookEditor.jsx`** is the preset picker UI in the Studio "Look" tab. Adding a
new look means adding an entry to `foundationPresets` (plus its `glassPresetDefaults` row) — it
then appears in the picker automatically. It does **not** mean copying the project.

## Studio

The gear button opens `SettingsPanel`, which has five tabs: **Setup** (`SetupGuide`), **Brand**
(inline `BrandEditor` over `useSiteMeta`), **Pages** (`VisibilityEditor`), **Copy**
(`TemplateContentEditor`), **Look** (`LookEditor`).

Studio mode is on by default. Turn it off for client deploys with `VITE_SHOPSITE_STUDIO_MODE=off`,
or at runtime with `?studio=on|off` (persisted). See `src/lib/studioMode.js`.

**All studio edits persist to `localStorage` only**, under these keys:

- `shopsite-theme-v4` — theme/preset state (`v2`/`v3` are read for migration)
- `shopsite-site-meta-overrides-v1` — brand name, titles, meta description
- `shopsite-template-content-overrides-v1` — marketing copy overrides
- `shopsite-visibility-v1` — which pages/sections are shown
- `shopsite-studio-mode`, `shopsite-studio-panel-width-v1` — studio UI state

### Known limitation

There is currently **no export or import of studio configuration**. A customized site exists only
in one browser profile and cannot be turned into a standalone deployable build. Making this state
serializable to a JSON site-config — so a configured site can be duplicated, checked in, and built
independently — is the main outstanding architectural work.

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
