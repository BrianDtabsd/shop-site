# Studio Look System — Design

**Date:** 2026-09-08
**Status:** Approved design, pending implementation plan
**Scope:** Phase 1 of a three-phase program

## Problem

The Studio was built to make one site customizable. It is now being used to make
*several kinds of site*, and the seams show.

### What is actually wrong

**1. Customization is gated behind one surface system.**
`LookEditor.jsx:193` wraps page color, accent color, panel strength, background URL,
nav outline, and button style in `{!isFoundation ? (…) : null}`. Selecting the
Foundation surface removes nearly every control from the panel. This single
conditional is the main source of the "each template is siloed" experience — the
looks are not siloed, the *controls* are.

**2. The same five presets are rendered twice.**
`LookEditor.jsx:116` renders `foundationPresetList` as "Theme" via `applyLookPreset`.
`LookEditor.jsx:375` renders the same list again as "Glass Presets" via
`applyGlassPreset`. Two lists, two apply paths, one set of presets.

**3. Selecting a preset silently destroys customization.**
`applyLookPreset` overwrites `primaryColor` and `pageColor`. `applyGlassPreset`
additionally overwrites `panelStrength`, `navOutline`, and `backgroundUrl`. Nothing
records which values the user set versus which came from the preset, so "keep my
accent, change the preset" is impossible and there is no way to display or undo a
customization.

**4. Live settings have no controls; dead settings are persisted.**
`applyGlassTheme` reads `theme.cardPadding`, `theme.cardRadius`, `theme.bodyTextSize`,
and `theme.navOutlineColor` and writes them to CSS variables, but no control exposes
any of them — they are permanently frozen at their defaults. Meanwhile `frostLevel`,
`transparencyLevel`, `frostColor`, and `typographyPreset` are still stored in
`shopsite-theme-v4` but are never read; blur and opacity are derived from
`panelStrength` instead. The persisted state is precisely backwards.

**5. The theme object is flat, which blocks export.**
Preset identity, user overrides, and dead legacy fields share one object with no
structure distinguishing them. There is no way to serialize "this site's
configuration" without shipping the dead fields and guessing which values were
deliberate.

### Why these are one problem

Problems 1, 3, and 5 have a single root cause: **there is no representation of
"what the user changed."** Introducing that representation resolves all three and
produces the artifact needed to export a standalone site.

## Decisions

Settled before design:

| Decision | Choice |
|---|---|
| Scope | Three phases: look system → site types → commerce decoupling. Build phase 1 first. |
| Override model | Layer + Save As — tweaks layer live on the active preset; a save action promotes current state to a named custom look. |
| Export target | `sites/<name>.json` committed in-repo, plus JSON export/import from the Studio. |
| Approach | Layered resolver — a pure `resolveLook()` function over a small config object. |

## Goals

- Every control works on every surface. Nothing disappears based on surface choice.
- Presets and fine-grained controls occupy one continuous panel.
- Any preset can be customized further, and customization survives preset switching.
- A user can see what they changed, reset one control or all of them, and save the
  result as a named look.
- A site's full visual configuration is a small serializable object.

## Non-goals (phase 1)

- Site types (storefront / portfolio / landing / blog) — phase 2.
- Decoupling Stripe and store/checkout into an optional module — phase 3.
- Build-time `--site=<name>` integration — phase 3.
- Redesigning the visual style of the Studio panel chrome itself.
- Changing the five preset palettes. Their content is out of scope; only how they
  are applied changes.

## Design

### Data model

A **look config** is flat, small, and serializable:

```js
{
  presetId: 'ember',      // base preset
  surface: 'glass',       // 'glass' | 'foundation'
  mode: 'dark',           // 'light' | 'dark'
  overrides: {            // ONLY explicitly-changed values
    accent: '#ff6b00',
    panelStrength: 0.7,
  },
}
```

`overrides` is the load-bearing idea. From it follows:

- **Modified state** — a control is modified if its key is in `overrides`.
- **Per-control reset** — delete the key.
- **Non-destructive preset switching** — changing `presetId` leaves `overrides` alone.
- **Export** — serialize the object; it is already the file format.

A **saved look** is the same object with identity:

```js
{ id: 'warm-shop', name: 'Warm Shop', presetId: 'ember', surface: 'glass',
  mode: 'dark', overrides: { … } }
```

Built-in presets and saved looks are therefore the same kind of thing and render in
one gallery.

### Resolver

New module `src/theme/resolveLook.js`. Pure — no React, no DOM, no localStorage.

```js
resolveLook(config) → {
  tokens:   { '--ds-color-canvas': '#111111', … },  // complete, no undefined
  meta:     { presetName, serifScope, surface, mode },
  modified: ['accent', 'panelStrength'],
}
```

Layering order, lowest to highest precedence:

1. **Preset palette** — `foundationPresets[presetId][mode]` plus `fonts` and `serifScope`
2. **Surface defaults** — `glassPresetDefaults[presetId]` when `surface === 'glass'`
3. **User overrides** — `config.overrides`

`useTheme` shrinks to: hold config, call `resolveLook`, write tokens to
`document.documentElement`, set the `data-*` attributes it already sets. The
existing `applyGlassTheme` / `applyFoundationTheme` split moves inside the resolver
as two token-producing branches, so surface stops being a fork in the React layer.

### Control registry

New module `src/theme/controls.js`. Each control is declared as data:

```js
{
  id: 'panelStrength',
  group: 'surface',
  label: 'Panel strength',
  type: 'range',
  min: 0, max: 1, step: 0.05,
  appliesTo: ['glass'],
  reason: 'Foundation surfaces are matte — there is no panel to blur.',
}
```

Groups: `color`, `surface`, `type`, `shape`, `motion`.

The Look tab renders from this list rather than hand-written JSX per control. Each
rendered control gets its modified badge and reset affordance automatically from
whether its `id` appears in `overrides`.

**Controls whose `appliesTo` excludes the active surface render disabled, with
`reason` shown — they are never removed.** This is the direct fix for problem 1: the
panel keeps its shape and the user learns what the surface actually governs.

The four orphaned live settings gain controls here: `bodyTextSize` and a type-scale
control in `type`; `cardPadding` and `cardRadius` in `shape`; `navOutlineColor`
in `surface`.

This registry is a deliberate, minimal seed of a fully schema-driven Studio. Phase 2
extends it with site-type variants rather than replacing it.

### Panel layout

The Look tab becomes one continuous column:

1. **Look gallery** — built-in presets and saved looks in one grid, each card
   previewing in the current surface and mode. Replaces both existing preset lists.
2. **Surface / Mode** — two segmented controls immediately beneath the gallery,
   because changing either re-skins every gallery preview.
3. **Customize** — the five control groups, rendered from the registry, always all
   present.
4. **Footer bar** — `"3 changes from Ember"`, `Reset all`, `Save as new look`,
   `Export` / `Import`.

### Migration

`shopsite-theme-v4` → `shopsite-look-v5`.

The migration reads a stored v4 object and produces a v5 look config:

Ordering matters here, and the steps must run in this sequence:

1. **Resolve the source blob.** `loadTheme` currently falls back
   `shopsite-theme-v4` → `shopsite-theme-v3` → `shopsite-theme-v2`. The migration must
   preserve that same fallback chain, so users who never touched the Studio since v2
   still migrate rather than being reset.
2. **Run the existing derived migration first.** The current loader derives
   `panelStrength` from `transparencyLevel` when `panelStrength` is absent. This must
   happen *before* dead-field removal — otherwise a v2/v3 user's panel setting is
   discarded by the very cleanup that is supposed to be safe. This is the single
   subtlest step in the migration.
3. **Map identity fields.** `foundationPreset` → `presetId`;
   `surfaceSystem` → `surface`; `foundationMode` → `mode`.
4. **Derive overrides.** For each control in the registry, compare the stored value
   against the value the preset would have produced. **If they differ, record it in
   `overrides`**; otherwise omit it. This preserves genuine customization without
   inheriting preset defaults as fake overrides.
5. **Drop dead fields.** Remove `frostLevel`, `transparencyLevel`, `frostColor`, and
   `typographyPreset` — only now that step 2 has extracted what they still carried.

Absent or unparseable state at every key yields the default look config.

### Export / import

Phase 1 ships Studio-level JSON export and import of a look config. The emitted
object is identical to what phase 3 will store at `sites/<name>.json`, so no format
change is needed later — phase 3 adds the build-time wiring, not a new file format.

Import validates: unknown `presetId` falls back to the default preset with a warning;
unknown override keys are dropped rather than passed through to CSS.

## Testing

The repo currently has no test framework. The resolver and migration are pure
functions over plain data, which is the highest-value test target available here.

Add **Vitest** (Vite is already present, so this is a small addition) and cover:

- **Layering precedence** — overrides beat surface defaults beat preset palette.
- **Override tracking** — setting a value records it; resetting removes it; switching
  presets preserves it.
- **Migration** — a representative v4 blob produces the expected v5 config; a
  v4 value equal to its preset default does *not* become a fake override; dead fields
  are dropped.
- **Migration ordering** — a v2/v3 blob carrying `transparencyLevel` but no
  `panelStrength` migrates to a v5 config with the derived `panelStrength` preserved.
  This is a regression test for the ordering trap in migration step 2.
- **Token completeness sweep** — every preset × surface × mode produces a token set
  with no `undefined` values. This catches a preset missing a palette key, which is
  the most likely failure as new looks are added.
- **Import validation** — unknown preset ids and unknown override keys are handled
  without producing invalid CSS.

## Later phases (sketch, not specified here)

**Phase 2 — site types.** A site type declares which pages, sections, and default
copy exist. Implemented as variants over the phase-1 control registry plus the
existing visibility system. Requires deciding how `src/content/*.js` becomes
type-aware.

**Phase 3 — commerce as a module.** Stripe setup, `/store`, `/checkout`, and
`/seller-onboarding` become an opt-in capability rather than core routes. Also adds
`sites/<name>.json` loading and `npm run build --site=<name>`.

## Success criteria

Phase 1 is done when:

1. Switching between Glass and Foundation changes no control's presence in the panel.
2. Setting an accent, then switching presets, preserves that accent and shows it as
   modified against the new preset.
3. Every control can be individually reset, and the footer reports an accurate count.
4. A customized look can be saved, named, and reselected from the gallery.
5. A look exports to JSON and imports back to a visually identical result.
6. Existing `shopsite-theme-v4` users keep their customization after migration.
7. `npm run build` and `npm run lint` pass; Vitest suite green.

## Risks

- **Migration correctness.** Users have real state in `shopsite-theme-v4`. The
  diff-against-preset heuristic is the risky part; it is directly covered by tests,
  and migration is one-way with the v4 key left in place initially so a bad migration
  is recoverable.
- **Rendering regression.** `applyGlassTheme` contains derived values (blur curve, nav
  opacity floor, border opacity ratios) that are easy to lose in a refactor. The token
  completeness sweep guards presence but not visual fidelity; the derived formulas
  must be moved verbatim, not rewritten.
- **Registry churn.** Rendering controls from data is less flexible than bespoke JSX
  for one-off layouts. Accepted deliberately, since phase 2 depends on it.
