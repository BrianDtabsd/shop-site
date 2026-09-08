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
    const { tokens, values } = resolveLook({
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { accent: '#ff6b00', panelStrength: 0.9 },
    });
    expect(tokens['--ds-color-accent']).toBe('#ff6b00');
    expect(values.panelStrength).toBe(0.9);
  });
});

describe('override tracking', () => {
  it('reports a value that differs from the preset as modified', () => {
    const look = { presetId: 'ember', surface: 'glass', mode: 'dark', overrides: { accent: '#ff6b00' } };
    expect(modifiedKeys(look)).toContain('accent');
  });

  it('does not report an override that merely equals the preset value', () => {
    const base = presetValues({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    const look = {
      presetId: 'ember',
      surface: 'glass',
      mode: 'dark',
      overrides: { accent: base.accent },
    };
    expect(modifiedKeys(look)).not.toContain('accent');
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
    const overrides = { accent: '#ff6b00' };
    const before = resolveLook({ presetId: 'ember', surface: 'glass', mode: 'dark', overrides });
    const after = resolveLook({ presetId: 'inkPaper', surface: 'glass', mode: 'dark', overrides });

    expect(before.tokens['--ds-color-accent']).toBe('#ff6b00');
    expect(after.tokens['--ds-color-accent']).toBe('#ff6b00');
    // The rest of the look did follow the new preset.
    expect(after.meta.presetId).toBe('inkPaper');
    expect(after.tokens['--ds-color-surface']).toBe(foundationPresets.inkPaper.dark.surface);
  });
});

describe('surface parity', () => {
  it('honours accent and page color on Foundation, which previously ignored both', () => {
    const { tokens } = resolveLook({
      presetId: 'ember',
      surface: 'foundation',
      mode: 'dark',
      overrides: { accent: '#ff6b00', pageColor: '#123456' },
    });
    expect(tokens['--ds-color-accent']).toBe('#ff6b00');
    expect(tokens['--ds-color-canvas']).toBe('#123456');
    expect(tokens['--page-canvas']).toBe('#123456');
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
      overrides: { accent: '#fff', '--evil: red; --x': 'boom', bogus: 1 },
    });
    expect(Object.keys(look.overrides)).toEqual(['accent']);
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
        overrides: { accent: '#ff6b00' },
      })
    );
    expect(view.primaryColor).toBe('#ff6b00');
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
