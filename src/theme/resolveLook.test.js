import { describe, it, expect } from 'vitest';
import {
  resolveLook,
  normalizeLook,
  presetValues,
  modifiedKeys,
  legacyThemeView,
  DEFAULT_LOOK,
} from './resolveLook';
import { CONTROLS, CONTROL_IDS } from './controls';
import { foundationPresets, glassPresetDefaults } from './foundationPresets';
import { pageColors } from './pageColors';

const SURFACES = ['glass', 'foundation'];
const MODES = ['light', 'dark'];
const PRESET_IDS = Object.keys(foundationPresets);

describe('layering precedence', () => {
  it('uses the preset palette when nothing is overridden', () => {
    const { tokens } = resolveLook({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    expect(tokens['--ds-color-accent']).toBe(foundationPresets.ember.dark.accent);
  });

  it('lets surface defaults supply panel strength', () => {
    const { values } = resolveLook({ presetId: 'monochrome', surface: 'glass', mode: 'dark' });
    expect(values.panelStrength).toBe(glassPresetDefaults.monochrome.panelStrength);
  });

  it('lets an override beat both the preset and the surface default', () => {
    const { values } = resolveLook({
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { panelStrength: 0.9 },
    });
    expect(values.panelStrength).toBe(0.9);
  });

  it('swaps the whole palette when a page-colour family is chosen', () => {
    const stock = resolveLook({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    const teal = resolveLook({
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { pageColor: 'teal' },
    });
    expect(teal.tokens['--ds-color-canvas']).toBe(pageColors.teal.dark.canvas);
    expect(teal.tokens['--ds-color-canvas']).not.toBe(stock.tokens['--ds-color-canvas']);
  });

  it('refuses a raw hex as a page colour — families only', () => {
    const { tokens } = resolveLook({
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { pageColor: '#ff00ff' },
    });
    // Unknown family id falls back to the template's own canvas.
    expect(tokens['--ds-color-canvas']).toBe(foundationPresets.ember.dark.canvas);
  });

  it('applies the spectrum without replacing any colour outright', () => {
    const stock = resolveLook({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    const warmed = resolveLook({
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { temperature: 0.8 },
    });
    expect(warmed.tokens['--ds-color-ink']).not.toBe(stock.tokens['--ds-color-ink']);
    // Still recognisably the same accent hue, not an arbitrary new colour.
    expect(warmed.colors.accent).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('override tracking', () => {
  it('reports a value that differs from the preset as modified', () => {
    const look = {
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { pageColor: 'ocean' },
    };
    expect(modifiedKeys(look)).toContain('pageColor');
  });

  it('does not report an override that merely equals the preset value', () => {
    const base = presetValues({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    const look = {
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { contrast: base.contrast },
    };
    expect(modifiedKeys(look)).not.toContain('contrast');
  });

  it('does not count overrides for controls that do not apply to the surface', () => {
    const look = {
      presetId: 'ember',
      surface: 'foundation',
      mode: 'dark',
      overrides: { panelStrength: 0.9 },
    };
    // Still stored, so flipping back to Glass restores it...
    expect(normalizeLook(look).overrides.panelStrength).toBe(0.9);
    // ...but not advertised as a change to a Foundation look.
    expect(modifiedKeys(look)).not.toContain('panelStrength');
  });

  it('preserves overrides across a preset switch', () => {
    const overrides = { pageColor: 'ocean', contrast: 1.3 };
    const before = resolveLook({ presetId: 'ember', surface: 'glass', mode: 'dark', overrides });
    const after = resolveLook({ presetId: 'inkPaper', surface: 'glass', mode: 'dark', overrides });

    // The chosen family and spectrum survive the template change...
    expect(before.meta.pageColorId).toBe('ocean');
    expect(after.meta.pageColorId).toBe('ocean');
    expect(after.values.contrast).toBe(1.3);
    // ...and the template still changed underneath them.
    expect(after.meta.presetId).toBe('inkPaper');
    expect(after.tokens['--font-display']).toBe(foundationPresets.inkPaper.fonts.display);
  });
});

describe('surface parity', () => {
  it('honours the page family on Foundation, which previously ignored it', () => {
    const { tokens } = resolveLook({
      presetId: 'ember',
      surface: 'foundation',
      mode: 'dark',
      overrides: { pageColor: 'plum' },
    });
    expect(tokens['--ds-color-canvas']).toBe(pageColors.plum.dark.canvas);
    expect(tokens['--page-canvas']).toBe(pageColors.plum.dark.canvas);
    expect(tokens['--ds-color-accent']).toBe(pageColors.plum.dark.accent);
  });

  it('keeps Foundation matte regardless of overrides', () => {
    const { tokens } = resolveLook({
      presetId: 'ember',
      surface: 'foundation',
      mode: 'dark',
      overrides: { panelStrength: 0.9 },
    });
    expect(tokens['--card-frost']).toBe('0px');
    expect(tokens['--transparency-level']).toBe('1');
  });

  it('exposes every control on both surfaces, gating only via appliesTo', () => {
    for (const surface of SURFACES) {
      const applicable = CONTROLS.filter((c) => c.appliesTo.includes(surface));
      expect(applicable.length).toBeGreaterThan(0);
    }
    // Only genuinely surface-specific controls are Glass-only.
    const glassOnly = CONTROLS.filter((c) => !c.appliesTo.includes('foundation')).map((c) => c.id);
    expect(glassOnly.sort()).toEqual(['backgroundUrl', 'navStyle', 'panelStrength']);
  });
});

describe('token completeness sweep', () => {
  it('produces a complete token set for every preset x surface x mode', () => {
    for (const presetId of PRESET_IDS) {
      for (const surface of SURFACES) {
        for (const mode of MODES) {
          const { tokens } = resolveLook({ presetId, surface, mode });
          for (const [name, value] of Object.entries(tokens)) {
            expect(
              value,
              `${presetId}/${surface}/${mode} produced an empty ${name}`
            ).toBeDefined();
            expect(
              String(value),
              `${presetId}/${surface}/${mode} produced an undefined ${name}`
            ).not.toMatch(/undefined|NaN/);
            expect(String(value).trim()).not.toBe('');
          }
        }
      }
    }
  });

  it('resolves a value for every registered control in every combination', () => {
    for (const presetId of PRESET_IDS) {
      for (const surface of SURFACES) {
        for (const mode of MODES) {
          const { values } = resolveLook({ presetId, surface, mode });
          for (const id of CONTROL_IDS) {
            expect(values[id], `${presetId}/${surface}/${mode} missing ${id}`).toBeDefined();
          }
        }
      }
    }
  });
});

describe('normalizeLook hardening', () => {
  it('falls back to the default preset for an unknown id', () => {
    expect(normalizeLook({ presetId: 'nope' }).presetId).toBe(DEFAULT_LOOK.presetId);
  });

  it('drops unknown override keys so imported junk cannot reach CSS', () => {
    const look = normalizeLook({
      presetId: 'ember',
      overrides: { pageColor: 'teal', '--evil: red; --x': 'boom', bogus: 1 },
    });
    expect(Object.keys(look.overrides)).toEqual(['pageColor']);
  });

  it('coerces invalid surface and mode to valid values', () => {
    const look = normalizeLook({ surface: 'hologram', mode: 'sepia' });
    expect(look.surface).toBe('glass');
    expect(look.mode).toBe('dark');
  });

  it('survives a completely empty config', () => {
    const { tokens } = resolveLook({});
    expect(tokens['--ds-color-canvas']).toBeDefined();
  });
});

describe('legacy theme view', () => {
  // Every `theme.*` field read by Button, Header, Hero, Layout and App today.
  // Harvested from the source; if a component starts reading a new field, add it
  // here so the compatibility contract stays enforced rather than assumed.
  const CONSUMED_BY_COMPONENTS = [
    'backgroundPattern',
    'backgroundUrl',
    'bodyTextSize',
    'buttonGlow',
    'buttonJump',
    'buttonShape',
    'buttonStyle',
    'cardPadding',
    'cardRadius',
    'floatStrength',
    'foundationMode',
    'foundationPreset',
    'layoutMode',
    'navOutline',
    'navOutlineColor',
    'navStyle',
    'pageColor',
    'panelStrength',
    'parallaxDepth',
    'primaryColor',
    'respectReducedMotion',
    'revealSpeed',
    'surfaceSystem',
  ];

  it('supplies every field the existing components read, in all combinations', () => {
    for (const presetId of PRESET_IDS) {
      for (const surface of SURFACES) {
        for (const mode of MODES) {
          const view = legacyThemeView(resolveLook({ presetId, surface, mode }));
          for (const field of CONSUMED_BY_COMPONENTS) {
            expect(
              view[field],
              `${presetId}/${surface}/${mode} lost theme.${field}`
            ).toBeDefined();
          }
        }
      }
    }
  });

  it('maps renamed fields back to their old names', () => {
    const view = legacyThemeView(
      resolveLook({
        presetId: 'inkPaper',
        surface: 'foundation',
        mode: 'light',
        overrides: { pageColor: 'ember' },
      })
    );
    expect(view.primaryColor).toBe(pageColors.ember.light.accent);
    expect(view.surfaceSystem).toBe('foundation');
    expect(view.foundationPreset).toBe('inkPaper');
    expect(view.foundationMode).toBe('light');
  });
});

describe('dataset output', () => {
  it('exposes reduced-motion preference so useScrollReveal need not read storage', () => {
    const on = resolveLook({ overrides: { respectReducedMotion: true } });
    const off = resolveLook({ overrides: { respectReducedMotion: false } });
    expect(on.dataset.respectReducedMotion).toBe('true');
    expect(off.dataset.respectReducedMotion).toBe('false');
  });

  it('forces docked nav on Foundation', () => {
    const { dataset } = resolveLook({ surface: 'foundation', overrides: { navStyle: 'floating' } });
    expect(dataset.navStyle).toBe('docked');
  });
});
