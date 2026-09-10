import { describe, it, expect } from 'vitest';
import { pageColors, pageColorList, getPageColor, nearestPageColor } from './pageColors';
import { contrastRatio, adjustPalette, parseHex } from './color';

const MODES = ['light', 'dark'];
const ROLES = [
  'canvas',
  'surface',
  'surfaceSubtle',
  'ink',
  'inkMuted',
  'inkFaint',
  'accent',
  'accentHover',
  'accentSoft',
  'line',
  'buttonInk',
  'buttonInkText',
];

describe('page colour families', () => {
  it('offers a broad choice of hues', () => {
    expect(pageColorList.length).toBeGreaterThanOrEqual(12);
  });

  it('gives every family both a light and a dark version', () => {
    for (const family of pageColorList) {
      expect(family.light, `${family.id} light`).toBeDefined();
      expect(family.dark, `${family.id} dark`).toBeDefined();
    }
  });

  it('fills every palette role in every family and mode', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        for (const role of ROLES) {
          expect(family[mode][role], `${family.id}/${mode}/${role}`).toBeDefined();
        }
      }
    }
  });

  it('emits valid hex for every solid role', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        for (const role of ROLES) {
          if (role === 'line') continue; // rgba by design
          expect(family[mode][role], `${family.id}/${mode}/${role}`).toMatch(
            /^#[0-9a-f]{6}$/
          );
        }
      }
    }
  });
});

describe('legibility', () => {
  // The whole point of generating families from shared steps: any page colour
  // pairs with any template and stays readable.
  it('clears WCAG AA (4.5:1) for body ink on canvas, every family and mode', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        const ratio = contrastRatio(family[mode].canvas, family[mode].ink);
        expect(ratio, `${family.id}/${mode} ink on canvas = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('clears WCAG AA for ink on surface too', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        const ratio = contrastRatio(family[mode].surface, family[mode].ink);
        expect(ratio, `${family.id}/${mode} ink on surface`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps muted ink at large-text contrast (3:1) at minimum', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        const ratio = contrastRatio(family[mode].canvas, family[mode].inkMuted);
        expect(ratio, `${family.id}/${mode} muted ink`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps the accent distinguishable from the canvas', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        const ratio = contrastRatio(family[mode].canvas, family[mode].accent);
        expect(ratio, `${family.id}/${mode} accent`).toBeGreaterThanOrEqual(2.5);
      }
    }
  });
});

describe('light and dark are genuinely different', () => {
  it('inverts the canvas/ink relationship between modes', () => {
    for (const family of pageColorList) {
      const lightCanvas = parseHex(family.light.canvas);
      const darkCanvas = parseHex(family.dark.canvas);
      const lightSum = lightCanvas.r + lightCanvas.g + lightCanvas.b;
      const darkSum = darkCanvas.r + darkCanvas.g + darkCanvas.b;
      expect(lightSum, `${family.id}`).toBeGreaterThan(darkSum);
    }
  });
});

describe('families survive extreme modifiers', () => {
  it('still produces valid colour at every modifier extreme', () => {
    for (const family of pageColorList) {
      for (const mode of MODES) {
        const out = adjustPalette(family[mode], {
          contrast: 1.6,
          intensity: 1.8,
          temperature: 1,
          tint: -1,
        });
        for (const [role, value] of Object.entries(out)) {
          if (role === 'line') continue;
          expect(value, `${family.id}/${mode}/${role}`).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});

describe('getPageColor', () => {
  it('returns a known family', () => {
    expect(getPageColor('ocean')).toBe(pageColors.ocean);
  });

  it('returns null for an unknown id rather than throwing', () => {
    expect(getPageColor('chartreuse')).toBeNull();
  });
});

describe('nearestPageColor', () => {
  it('matches a hue to its closest family', () => {
    expect(nearestPageColor('#f43f5e')).toBe('rose');
    expect(nearestPageColor('#3b82f6')).toBe('indigo');
    expect(nearestPageColor('#5faba4')).toBe('teal');
  });

  it('handles the atan2 wrap-around at the red end of the circle', () => {
    // Hues near 0° must not be judged distant from families just past 350°.
    const nearZero = nearestPageColor('#f43f5e'); // hue ~16°
    expect(['rose', 'plum', 'ember']).toContain(nearZero);
  });

  it('sends near-neutrals to a grey family by lightness, not by hue noise', () => {
    expect(nearestPageColor('#1a1a1b')).toBe('graphite');
    expect(nearestPageColor('#f6f5f2')).toBe('paper');
  });

  it('returns null for an unreadable colour', () => {
    expect(nearestPageColor('not-a-colour')).toBeNull();
  });
});
