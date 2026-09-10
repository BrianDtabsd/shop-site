/**
 * Pure look resolver — no React, no DOM, no localStorage.
 *
 * A "look config" is the complete visual identity of a site:
 *
 *   { presetId, surface, mode, overrides: { … } }
 *
 * `overrides` holds ONLY values the user explicitly set. Everything else is
 * derived from the preset. That separation is what makes preset switching
 * non-destructive, gives every control a meaningful "modified" state, and lets a
 * whole site's look be serialized to a few lines of JSON.
 *
 * Layering, lowest precedence first:
 *   1. preset palette + fonts  (foundationPresets[presetId][mode])
 *   2. surface defaults        (glassPresetDefaults[presetId], glass only)
 *   3. user overrides          (config.overrides)
 *
 * The derived formulas below (blur curve, nav opacity floor, border opacity
 * ratio) are carried over verbatim from the previous applyGlassTheme. They encode
 * tuning that is easy to lose and hard to notice losing — change them only
 * deliberately.
 */

import {
  foundationPresets,
  glassPresetDefaults,
} from './foundationPresets';
import { CONTROLS, CONTROL_IDS, appliesToSurface } from './controls';
import { getPageColor } from './pageColors';
import { adjustPalette, contrastRatio } from './color';

export const DEFAULT_LOOK = {
  presetId: 'ember',
  surface: 'glass',
  mode: 'dark',
  overrides: {},
};

const REVEAL_LINE_SPEED = { fast: '0.55s', medium: '0.8s', slow: '1.3s' };
const REVEAL_FADE_SPEED = { fast: '0.8s', medium: '1.2s', slow: '1.8s' };

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '22, 22, 24';
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '22, 22, 24';
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Normalize a possibly-partial or hostile config into a valid one. */
export function normalizeLook(config = {}) {
  const presetId = foundationPresets[config.presetId] ? config.presetId : DEFAULT_LOOK.presetId;
  const surface = config.surface === 'foundation' ? 'foundation' : 'glass';
  const mode = config.mode === 'light' ? 'light' : 'dark';

  // Drop unknown keys so imported junk can never reach the CSS layer.
  const overrides = {};
  const raw = config.overrides && typeof config.overrides === 'object' ? config.overrides : {};
  for (const key of CONTROL_IDS) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined) {
      overrides[key] = raw[key];
    }
  }

  return { presetId, surface, mode, overrides };
}

/** The context each control's `presetValue` is evaluated against. */
function presetContext(look) {
  const preset = foundationPresets[look.presetId] || foundationPresets.ember;
  return {
    preset,
    colors: preset[look.mode],
    surface: look.surface,
    mode: look.mode,
    glassDefaults: glassPresetDefaults[look.presetId] || glassPresetDefaults.ember,
  };
}

/**
 * Resolve the palette actually rendered, in two sanctioned steps.
 *
 * 1. CHOOSE A FAMILY. `pageColor` names a whole curated family, not a hex. Empty
 *    means keep the template's own authored colours. This is the only way to
 *    change hue, and every family ships light and dark versions generated from
 *    shared lightness steps, so it stays legible against any template.
 * 2. MOVE THE SPECTRUM. contrast / intensity / temperature / tint transform that
 *    palette as a whole, preserving the relationships inside it.
 *
 * Nothing here accepts a raw colour from the user, which is the point: a
 * template's palette can be adjusted but never overwritten piecemeal.
 */
function resolvePalette(look, values, ctx) {
  const familyId = String(values.pageColor || '').trim();
  const family = familyId ? getPageColor(familyId) : null;
  const base = family ? family[look.mode] : ctx.colors;

  return adjustPalette(base, {
    contrast: Number(values.contrast) || 1,
    intensity: values.intensity === 0 ? 0 : Number(values.intensity) || 1,
    temperature: Number(values.temperature) || 0,
    tint: Number(values.tint) || 0,
  });
}

/**
 * What every control would be if the user had overridden nothing.
 * Exported so the UI can show "reset to preset" values and compute modified state.
 */
export function presetValues(config) {
  const look = normalizeLook(config);
  const ctx = presetContext(look);
  const out = {};
  for (const control of CONTROLS) {
    out[control.id] = control.presetValue(ctx);
  }
  return out;
}

/**
 * Which overrides actually differ from the preset, and are meaningful on this
 * surface. An override recorded for a control that doesn't apply to the current
 * surface is kept in state (so flipping back restores it) but not counted here.
 */
export function modifiedKeys(config) {
  const look = normalizeLook(config);
  const base = presetValues(look);
  return Object.keys(look.overrides).filter((key) => {
    const control = CONTROLS.find((c) => c.id === key);
    if (!control) return false;
    if (!appliesToSurface(control, look.surface)) return false;
    return look.overrides[key] !== base[key];
  });
}

function glassTokens(values, ctx, colors) {
  const { preset } = ctx;

  // Both come from the resolved palette — never from a user-supplied hex.
  const page = colors.canvas;
  const accent = colors.accent;

  const rawStrength = Number(values.panelStrength);
  const strength = Math.min(1, Math.max(0, Number.isFinite(rawStrength) ? rawStrength : 0.48));
  const panelOpacity = strength;
  // Cards can go fully clear (0) so type floats with no panel behind it.
  const blurPx = strength <= 0.02 ? '0px' : `${Math.round(8 + strength * 36)}px`;
  // Nav stays readable even when cards are cleared.
  const navOpacity = Math.min(0.92, Math.max(0.55, 0.4 + strength * 0.45));
  const panelRgb = hexToRgb(colors.surface);
  const isCards = values.layoutMode === 'cards';
  const bg = String(values.backgroundUrl || '').trim();

  return {
    '--bg-url': bg ? `url('${bg}')` : 'none',

    '--font-display': preset.fonts.display,
    '--font-heading': preset.fonts.heading,
    '--font-body': preset.fonts.body,
    '--font-label': preset.fonts.label,
    '--color-heading': colors.ink,
    '--color-subtitle': colors.inkMuted,
    '--color-body': colors.ink,
    '--text-body-size': values.bodyTextSize,

    '--page-canvas': page,
    '--primary-color': accent,
    '--frost-rgb': panelRgb,
    '--frost-level': blurPx === '0px' ? '16px' : blurPx,
    '--transparency-level': String(panelOpacity),
    '--nav-surface': `rgba(${panelRgb}, ${navOpacity})`,

    '--card-padding': values.cardPadding,
    '--card-radius': values.cardRadius,
    '--card-opacity': isCards ? String(panelOpacity) : '0',
    '--card-border-opacity': isCards ? String(panelOpacity * 0.18) : '0',
    '--card-frost': isCards ? blurPx : '0px',
    '--container-opacity': !isCards ? String(Math.min(0.88, Math.max(0, panelOpacity))) : '0',
    '--container-frost': !isCards ? blurPx : '0px',
    '--container-border-opacity': '0',

    '--nav-border-width': navBorderWidth(values.navOutline),
    '--nav-border-color': colors.line,

    '--ds-color-canvas': page,
    '--ds-color-surface': colors.surface,
    '--ds-color-surface-subtle': colors.surfaceSubtle,
    '--ds-color-ink': colors.ink,
    '--ds-color-ink-muted': colors.inkMuted,
    '--ds-color-ink-faint': colors.inkFaint,
    '--ds-color-line': colors.line,
    '--ds-color-accent': accent,
    '--ds-color-accent-hover': colors.accentHover,
    '--ds-color-accent-soft': colors.accentSoft,
    '--ds-button-ink': accent,
    '--ds-button-ink-text': '#ffffff',

    '--hero-stripe-a': colors.pastelLavender || colors.accentSoft || accent,
    '--hero-stripe-b': colors.pastelTeal || accent,
    '--hero-stripe-c': colors.pastelSage || colors.accentHover || accent,
  };
}

function foundationTokens(values, ctx, colors) {
  const { preset } = ctx;

  // Foundation previously hardcoded these and ignored the user entirely. It now
  // honours the same palette Glass does — while staying matte, which is what
  // actually distinguishes the surface.
  const page = colors.canvas;
  const accent = colors.accent;

  return {
    '--bg-url': 'none',

    '--font-display': preset.fonts.display,
    '--font-heading': preset.fonts.heading,
    '--font-body': preset.fonts.body,
    '--font-label': preset.fonts.label,
    '--color-heading': colors.ink,
    '--color-subtitle': colors.inkMuted,
    '--color-body': colors.ink,
    '--text-body-size': values.bodyTextSize,

    '--primary-color': accent,
    '--page-canvas': page,

    // Matte: no blur, fully opaque surfaces. This is the surface's identity.
    '--frost-level': '0px',
    '--transparency-level': '1',
    '--frost-rgb': '255, 255, 255',
    '--card-opacity': '1',
    '--card-border-opacity': '1',
    '--card-frost': '0px',
    '--container-opacity': '1',
    '--container-frost': '0px',
    '--container-border-opacity': '0',

    '--card-padding': values.cardPadding,
    '--card-radius': values.cardRadius,

    '--nav-surface': page,
    '--nav-border-width': navBorderWidth(values.navOutline),
    '--nav-border-color': colors.line,

    '--ds-color-canvas': page,
    '--ds-color-surface': colors.surface,
    '--ds-color-surface-subtle': colors.surfaceSubtle,
    '--ds-color-ink': colors.ink,
    '--ds-color-ink-muted': colors.inkMuted,
    '--ds-color-ink-faint': colors.inkFaint,
    '--ds-color-line': colors.line,
    '--ds-color-accent': accent,
    '--ds-color-accent-hover': colors.accentHover,
    '--ds-color-accent-soft': colors.accentSoft,
    '--ds-button-ink': colors.buttonInk,
    '--ds-button-ink-text': colors.buttonInkText,

    '--hero-stripe-a': colors.pastelLavender || colors.accentSoft || accent,
    '--hero-stripe-b': colors.pastelTeal || accent,
    '--hero-stripe-c': colors.pastelSage || colors.accentHover || accent,
  };
}

function navBorderWidth(navOutline) {
  if (navOutline === 'none') return '0px';
  if (navOutline === 'thick') return '2px';
  return '1px';
}

function motionTokens(values) {
  return {
    '--float-strength': String(values.floatStrength ?? 0.5),
    '--parallax-depth': String(values.parallaxDepth ?? 0.4),
    '--reveal-line-speed': REVEAL_LINE_SPEED[values.revealSpeed] || '0.8s',
    '--reveal-fade-speed': REVEAL_FADE_SPEED[values.revealSpeed] || '1.2s',
  };
}

/**
 * Resolve a look config into everything the app needs to render it.
 *
 * @returns {{
 *   tokens: Record<string,string>,   // CSS custom properties, complete
 *   values: Record<string,any>,      // resolved control values
 *   dataset: Record<string,string>,  // data-* attributes for <html>
 *   meta: object,
 *   modified: string[],
 * }}
 */
/**
 * Flat view of a resolved look, using the pre-refactor field names.
 *
 * Button, Header, Hero and Layout read `theme.buttonShape`, `theme.layoutMode`
 * and friends directly. Keeping this mapping pure means the contract those
 * components depend on is covered by tests rather than by hope.
 */
export function legacyThemeView(resolved) {
  return {
    ...resolved.values,
    surfaceSystem: resolved.meta.surface,
    foundationPreset: resolved.meta.presetId,
    foundationMode: resolved.meta.mode,
    primaryColor: resolved.colors.accent,
    pageColor: resolved.colors.canvas,
    // No longer user-settable — derived from the palette so the outline follows
    // the page colour and spectrum. Still supplied because Header reads it.
    navOutlineColor: resolved.colors.line,
    backgroundPattern: 'none',
  };
}

export function resolveLook(config) {
  const look = normalizeLook(config);
  const ctx = presetContext(look);

  // Preset defaults, then the user's overrides on top.
  const values = { ...presetValues(look) };
  for (const [key, value] of Object.entries(look.overrides)) {
    values[key] = value;
  }

  // Family choice + spectrum, resolved once and shared by both surfaces.
  const colors = resolvePalette(look, values, ctx);

  const surfaceTokens =
    look.surface === 'foundation'
      ? foundationTokens(values, ctx, colors)
      : glassTokens(values, ctx, colors);

  return {
    tokens: { ...surfaceTokens, ...motionTokens(values) },
    values,
    /** The palette actually rendered, after family swap and spectrum. */
    colors,
    dataset: {
      surface: look.surface,
      foundationMode: look.mode,
      foundationPreset: look.presetId,
      serifScope: ctx.preset.serifScope,
      navStyle: look.surface === 'glass' ? values.navStyle : 'docked',
      // Read by useScrollReveal — avoids it reaching into localStorage.
      respectReducedMotion: values.respectReducedMotion === false ? 'false' : 'true',
    },
    meta: {
      presetId: look.presetId,
      presetName: ctx.preset.name,
      surface: look.surface,
      mode: look.mode,
      serifScope: ctx.preset.serifScope,
      layoutMode: values.layoutMode,
      pageColorId: String(values.pageColor || '') || null,
      /** Surfaced so the Studio can warn when a spectrum move hurts readability. */
      contrastRatio: contrastRatio(colors.canvas, colors.ink),
    },
    modified: modifiedKeys(look),
  };
}
