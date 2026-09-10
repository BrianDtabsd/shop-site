import { describe, it, expect } from 'vitest';
import {
  parseHex,
  toHex,
  rgbToOklab,
  oklabToRgb,
  hexToOklab,
  oklabToHex,
  oklabToOklch,
  oklchToOklab,
  adjustColor,
  adjustPalette,
  contrastRatio,
  isNeutral,
  NEUTRAL_MODIFIERS,
} from './color';

const SAMPLES = ['#000000', '#ffffff', '#e27348', '#3b82f6', '#8fa890', '#121212', '#f3f2ee'];

describe('conversions', () => {
  it('round-trips hex → OKLab → hex', () => {
    for (const hex of SAMPLES) {
      expect(oklabToHex(hexToOklab(hex))).toBe(hex);
    }
  });

  it('round-trips rgb → OKLab → rgb', () => {
    for (const hex of SAMPLES) {
      const rgb = parseHex(hex);
      const back = oklabToRgb(rgbToOklab(rgb));
      expect(toHex(back)).toBe(hex);
    }
  });

  it('round-trips OKLab ⇄ OKLCH', () => {
    for (const hex of SAMPLES) {
      const lab = hexToOklab(hex);
      const back = oklchToOklab(oklabToOklch(lab));
      expect(back.L).toBeCloseTo(lab.L, 10);
      expect(back.a).toBeCloseTo(lab.a, 10);
      expect(back.b).toBeCloseTo(lab.b, 10);
    }
  });

  it('places black and white at the lightness extremes', () => {
    expect(hexToOklab('#000000').L).toBeCloseTo(0, 5);
    expect(hexToOklab('#ffffff').L).toBeCloseTo(1, 5);
  });

  it('rejects malformed hex', () => {
    expect(parseHex('nope')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex(null)).toBeNull();
  });

  it('accepts shorthand hex', () => {
    expect(parseHex('#fff')).toEqual(parseHex('#ffffff'));
  });
});

describe('modifier neutrality', () => {
  it('treats defaults as neutral', () => {
    expect(isNeutral(NEUTRAL_MODIFIERS)).toBe(true);
    expect(isNeutral({})).toBe(true);
  });

  it('returns the colour untouched when neutral — a preset renders as authored', () => {
    for (const hex of SAMPLES) {
      expect(adjustColor(hex, NEUTRAL_MODIFIERS)).toBe(hex);
    }
  });

  it('returns the palette object itself when neutral', () => {
    const palette = { canvas: '#111111', ink: '#ffffff' };
    expect(adjustPalette(palette, {})).toBe(palette);
  });
});

describe('temperature and tint move the OKLab axes', () => {
  const base = '#808080';

  it('warmer pushes the blue↔yellow axis up', () => {
    const warm = hexToOklab(adjustColor(base, { temperature: 1 }));
    const cool = hexToOklab(adjustColor(base, { temperature: -1 }));
    expect(warm.b).toBeGreaterThan(cool.b);
  });

  // NOTE ON TOLERANCES: results round-trip through 8-bit hex, so a channel that
  // is mathematically untouched still moves by up to ~1/255 in OKLab terms.
  // These tolerances are sized to that quantization, not loosened to pass.
  it('tint pushes the green↔magenta axis, leaving temperature alone', () => {
    const magenta = hexToOklab(adjustColor(base, { tint: 1 }));
    const green = hexToOklab(adjustColor(base, { tint: -1 }));
    expect(magenta.a).toBeGreaterThan(green.a);
    // b is untouched by tint; only hex quantization separates these.
    expect(Math.abs(magenta.b - green.b)).toBeLessThan(0.002);
  });

  it('shifts a near-neutral more than a saturated colour (relatively)', () => {
    // The point of an additive push: a template's accent stays recognisable.
    const neutralShift = Math.abs(
      hexToOklab(adjustColor('#808080', { temperature: 1 })).b - hexToOklab('#808080').b
    );
    const accent = '#3b82f6';
    const accentShift = Math.abs(
      hexToOklab(adjustColor(accent, { temperature: 1 })).b - hexToOklab(accent).b
    );
    // Same absolute push, to within quantization...
    expect(Math.abs(neutralShift - accentShift)).toBeLessThan(0.002);
    // ...but far smaller relative to the accent's existing chroma.
    const accentChroma = oklabToOklch(hexToOklab(accent)).C;
    expect(accentShift / accentChroma).toBeLessThan(0.5);
  });
});

describe('intensity', () => {
  it('drops chroma toward grey at zero', () => {
    const grey = adjustColor('#e27348', { intensity: 0 });
    const { C } = oklabToOklch(hexToOklab(grey));
    expect(C).toBeLessThan(0.01);
  });

  it('raises chroma above one', () => {
    const before = oklabToOklch(hexToOklab('#8fa890')).C;
    const after = oklabToOklch(hexToOklab(adjustColor('#8fa890', { intensity: 1.6 }))).C;
    expect(after).toBeGreaterThan(before);
  });

  it('preserves hue while scaling chroma', () => {
    const before = oklabToOklch(hexToOklab('#3b82f6'));
    const after = oklabToOklch(hexToOklab(adjustColor('#3b82f6', { intensity: 0.5 })));
    // Within a degree. Halving chroma shrinks the a/b vector, so hex
    // quantization translates into a slightly larger angular error.
    expect(Math.abs(after.h - before.h)).toBeLessThan(1);
  });
});

describe('contrast', () => {
  it('pushes ink away from the canvas pivot as contrast rises', () => {
    const palette = { canvas: '#1a1a1a', ink: '#c9c9c9' };
    const boosted = adjustPalette(palette, { contrast: 1.5 });
    expect(contrastRatio(boosted.canvas, boosted.ink)).toBeGreaterThan(
      contrastRatio(palette.canvas, palette.ink)
    );
  });

  it('pulls ink toward the canvas as contrast falls', () => {
    const palette = { canvas: '#1a1a1a', ink: '#c9c9c9' };
    const softened = adjustPalette(palette, { contrast: 0.6 });
    expect(contrastRatio(softened.canvas, softened.ink)).toBeLessThan(
      contrastRatio(palette.canvas, palette.ink)
    );
  });

  it('leaves the canvas itself anchored — the page colour does not drift', () => {
    const palette = { canvas: '#1a1a1a', ink: '#c9c9c9' };
    const boosted = adjustPalette(palette, { contrast: 1.5 });
    expect(boosted.canvas).toBe(palette.canvas);
  });
});

describe('adjustPalette', () => {
  it('passes non-hex values (rgba line colours) through untouched', () => {
    const palette = { canvas: '#111111', line: 'rgba(255, 255, 255, 0.16)' };
    const out = adjustPalette(palette, { contrast: 1.4 });
    expect(out.line).toBe('rgba(255, 255, 255, 0.16)');
  });

  it('never emits an invalid colour under extreme settings', () => {
    const palette = { canvas: '#f3f2ee', ink: '#121212', accent: '#e27348' };
    for (const contrast of [0.5, 1.6]) {
      for (const intensity of [0, 1.8]) {
        for (const temperature of [-1, 1]) {
          for (const tint of [-1, 1]) {
            const out = adjustPalette(palette, { contrast, intensity, temperature, tint });
            for (const value of Object.values(out)) {
              expect(value).toMatch(/^#[0-9a-f]{6}$/);
            }
          }
        }
      }
    }
  });
});

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
