/**
 * Curated page colours.
 *
 * Replaces the free hex picker. Picking `#00ff00` as a page colour and an
 * unrelated accent produced combinations no template could survive — the palette
 * stopped being a designed thing. Here a page colour is a *family*: one hue,
 * from which a coherent canvas / surface / ink set is derived at a fixed set of
 * lightness steps, in both a light and a dark version.
 *
 * Because every family is generated from the same steps, any page colour pairs
 * with any template and stays legible. What varies is hue and how much chroma
 * the paper carries — not the structure.
 */

import { oklch, hexToOklab, oklabToOklch } from './color';

/**
 * Lightness / chroma steps shared by every family. Tuned so `ink` on `canvas`
 * clears WCAG AA in both modes — asserted in pageColors.test.js.
 *
 * `cMul` scales the family's chroma per role: paper carries a whisper of the
 * hue, ink almost none, accent the most.
 */
const STEPS = {
  light: {
    canvas: { L: 0.966, cMul: 0.28 },
    surface: { L: 0.995, cMul: 0.14 },
    surfaceSubtle: { L: 0.929, cMul: 0.42 },
    ink: { L: 0.222, cMul: 0.5 },
    inkMuted: { L: 0.505, cMul: 0.55 },
    inkFaint: { L: 0.638, cMul: 0.5 },
    accent: { L: 0.567, cMul: 3.4 },
    accentHover: { L: 0.5, cMul: 3.6 },
    accentSoft: { L: 0.886, cMul: 1.5 },
  },
  dark: {
    canvas: { L: 0.181, cMul: 0.42 },
    surface: { L: 0.229, cMul: 0.48 },
    surfaceSubtle: { L: 0.279, cMul: 0.52 },
    ink: { L: 0.949, cMul: 0.18 },
    inkMuted: { L: 0.727, cMul: 0.36 },
    inkFaint: { L: 0.576, cMul: 0.42 },
    accent: { L: 0.702, cMul: 3.1 },
    accentHover: { L: 0.771, cMul: 2.8 },
    accentSoft: { L: 0.327, cMul: 1.5 },
  },
};

/**
 * The families. `h` is OKLCH hue in degrees; `c` is the family's base chroma —
 * greys sit near zero, saturated papers higher.
 */
const FAMILIES = [
  { id: 'graphite', name: 'Graphite', h: 265, c: 0.006 },
  { id: 'paper', name: 'Paper', h: 83, c: 0.012 },
  { id: 'sand', name: 'Sand', h: 74, c: 0.032 },
  { id: 'clay', name: 'Clay', h: 44, c: 0.042 },
  { id: 'ember', name: 'Ember', h: 34, c: 0.05 },
  { id: 'rose', name: 'Rose', h: 8, c: 0.045 },
  { id: 'plum', name: 'Plum', h: 330, c: 0.04 },
  { id: 'violet', name: 'Violet', h: 296, c: 0.042 },
  { id: 'indigo', name: 'Indigo', h: 268, c: 0.045 },
  { id: 'ocean', name: 'Ocean', h: 237, c: 0.045 },
  { id: 'teal', name: 'Teal', h: 196, c: 0.042 },
  { id: 'moss', name: 'Moss', h: 153, c: 0.04 },
  { id: 'olive', name: 'Olive', h: 122, c: 0.038 },
];

function buildPalette(family, mode) {
  const steps = STEPS[mode];
  const out = {};
  for (const [role, { L, cMul }] of Object.entries(steps)) {
    out[role] = oklch(L, family.c * cMul, family.h);
  }
  // `line` is an alpha rule rather than a solid, so it works over any surface.
  out.line =
    mode === 'light' ? 'rgba(18, 18, 18, 0.17)' : 'rgba(255, 255, 255, 0.15)';
  out.buttonInk = out.ink;
  out.buttonInkText = out.canvas;
  return out;
}

/** id → { id, name, h, c, light: {...}, dark: {...} } */
export const pageColors = Object.fromEntries(
  FAMILIES.map((family) => [
    family.id,
    {
      ...family,
      light: buildPalette(family, 'light'),
      dark: buildPalette(family, 'dark'),
    },
  ])
);

export const pageColorList = Object.values(pageColors);
export const pageColorIds = FAMILIES.map((f) => f.id);

export function getPageColor(id) {
  return pageColors[id] || null;
}

/**
 * Closest family to an arbitrary hex, by OKLCH hue.
 *
 * Used only by migration. A v4 user who hand-picked an orange accent can no
 * longer express that as a hex, but throwing their choice away would be worse
 * than landing them on the family that means the same thing — so `#ff6b00`
 * becomes Ember rather than nothing.
 *
 * Near-neutral input has no meaningful hue, so it maps to a grey family by
 * lightness instead of to whatever the noise in its tiny chroma suggests.
 *
 * @returns {string|null} family id, or null if the hex is unreadable
 */
export function nearestPageColor(hex) {
  const lab = hexToOklab(hex);
  if (!lab) return null;
  const { C, h } = oklabToOklch(lab);

  if (C < 0.02) return lab.L > 0.5 ? 'paper' : 'graphite';

  let best = null;
  let bestDelta = Infinity;
  for (const family of FAMILIES) {
    if (family.c < 0.02) continue; // skip the greys — input has real hue
    // Shortest angular distance on the hue circle, in [0, 180].
    const delta = Math.abs(((family.h - h + 540) % 360) - 180);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = family.id;
    }
  }
  return best;
}
