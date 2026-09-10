/**
 * Colour engine — OKLab / OKLCH conversions and palette modifiers.
 *
 * Pure functions over plain numbers. No React, no DOM.
 *
 * WHY OKLAB: a template's palette is a set of considered *relationships*, not a
 * bag of hex codes. Letting someone drop an arbitrary hex into it destroys the
 * design. Modifiers let you move the whole palette while keeping those
 * relationships intact — and OKLab's axes happen to be exactly the controls a
 * photographer already knows:
 *
 *   b axis  →  blue ↔ yellow   →  TEMPERATURE
 *   a axis  →  green ↔ magenta →  TINT
 *   L axis  →  lightness       →  CONTRAST (expanded around a pivot)
 *   C (hypot(a,b)) → chroma    →  INTENSITY
 *
 * So "warmer" is a real, uniform perceptual shift rather than a hue rotation
 * that would send greens somewhere unintended.
 *
 * Conversion matrices are Björn Ottosson's OKLab definition.
 */

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/* ── sRGB ⇄ linear ──────────────────────────────────────────────────────── */

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* ── hex ⇄ rgb ──────────────────────────────────────────────────────────── */

export function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function toHex({ r, g, b }) {
  const part = (v) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/* ── rgb ⇄ OKLab ────────────────────────────────────────────────────────── */

export function rgbToOklab({ r, g, b }) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
}

export const hexToOklab = (hex) => {
  const rgb = parseHex(hex);
  return rgb ? rgbToOklab(rgb) : null;
};

export const oklabToHex = (lab) => toHex(oklabToRgb(lab));

/* ── OKLab ⇄ OKLCH ──────────────────────────────────────────────────────── */

export function oklabToOklch({ L, a, b }) {
  return {
    L,
    C: Math.sqrt(a * a + b * b),
    h: (Math.atan2(b, a) * 180) / Math.PI,
  };
}

export function oklchToOklab({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return { L, a: Math.cos(rad) * C, b: Math.sin(rad) * C };
}

/** Build a hex from OKLCH directly — how the curated page colours are defined. */
export function oklch(L, C, h) {
  return oklabToHex(oklchToOklab({ L, C, h }));
}

/* ── Modifiers ──────────────────────────────────────────────────────────── */

/**
 * The spectrum controls. Every value is neutral at its default, so an untouched
 * look renders the preset exactly as authored.
 *
 * @typedef {object} Modifiers
 * @property {number} contrast   0.5 … 1.6   (1 = as authored)
 * @property {number} intensity  0 … 1.8     (1 = as authored; 0 = greyscale)
 * @property {number} temperature -1 … 1     (0 = neutral; + warmer, - cooler)
 * @property {number} tint       -1 … 1      (0 = neutral; + magenta, - green)
 */
export const NEUTRAL_MODIFIERS = {
  contrast: 1,
  intensity: 1,
  temperature: 0,
  tint: 0,
};

/** How far a full-swing temperature/tint push moves the OKLab axis. */
const AXIS_RANGE = 0.055;

export function isNeutral(mods = {}) {
  const m = { ...NEUTRAL_MODIFIERS, ...mods };
  return (
    m.contrast === 1 && m.intensity === 1 && m.temperature === 0 && m.tint === 0
  );
}

/**
 * Apply modifiers to a single colour.
 *
 * @param {string} hex     the colour as authored by the preset
 * @param {Modifiers} mods
 * @param {number} pivot   lightness that contrast expands around — pass the
 *                         canvas lightness so the page stays put while
 *                         everything else moves away from or toward it.
 */
export function adjustColor(hex, mods = {}, pivot = 0.5) {
  const m = { ...NEUTRAL_MODIFIERS, ...mods };
  const lab = hexToOklab(hex);
  if (!lab) return hex;
  if (isNeutral(m)) return hex;

  // Contrast: push lightness away from the pivot.
  const L = clamp01(pivot + (lab.L - pivot) * m.contrast);

  // Intensity: scale chroma. Applied to the axes together so hue is preserved.
  let a = lab.a * m.intensity;
  let b = lab.b * m.intensity;

  // Temperature and tint are additive pushes along OKLab's own axes.
  // A near-neutral colour picks up the cast; a saturated one barely shifts,
  // which is what keeps a template's accent recognisably itself.
  b += m.temperature * AXIS_RANGE;
  a += m.tint * AXIS_RANGE;

  return oklabToHex({ L, a, b });
}

/**
 * Apply modifiers across a whole palette, using the canvas as the contrast
 * pivot so the page colour itself stays anchored.
 *
 * Keys whose values are not hex (rgba() line colours, for instance) pass
 * through untouched.
 */
export function adjustPalette(palette, mods = {}, pivotKey = 'canvas') {
  if (isNeutral(mods)) return palette;
  const pivotLab = hexToOklab(palette[pivotKey]);
  const pivot = pivotLab ? pivotLab.L : 0.5;

  const out = {};
  for (const [key, value] of Object.entries(palette)) {
    out[key] =
      typeof value === 'string' && parseHex(value) ? adjustColor(value, mods, pivot) : value;
  }
  return out;
}

/* ── Contrast reporting ─────────────────────────────────────────────────── */

/** WCAG relative luminance. */
export function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const f = (c) => srgbToLinear(c);
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

/** WCAG contrast ratio, 1 … 21. Used to warn when a look becomes unreadable. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}
