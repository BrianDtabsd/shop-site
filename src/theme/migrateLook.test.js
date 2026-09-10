import { describe, it, expect } from 'vitest';
import { migrateThemeToLook, loadLookFromStorage, DEAD_FIELDS } from './migrateLook';
import { presetValues, DEFAULT_LOOK } from './resolveLook';
import { foundationPresets } from './foundationPresets';
import { pageColorIds } from './pageColors';

/** Minimal in-memory Storage stand-in. */
function fakeStorage(entries = {}) {
  return {
    getItem: (k) => (k in entries ? entries[k] : null),
    setItem: (k, v) => {
      entries[k] = v;
    },
    removeItem: (k) => {
      delete entries[k];
    },
  };
}

describe('migrateThemeToLook', () => {
  it('maps identity fields across', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'inkPaper',
      surfaceSystem: 'foundation',
      foundationMode: 'light',
    });
    expect(look).toMatchObject({ presetId: 'inkPaper', surface: 'foundation', mode: 'light' });
  });

  it('recovers a hand-picked accent as the nearest page-colour family', () => {
    // Raw hexes are no longer expressible, but discarding a deliberately tuned
    // look would be worse than landing on the family that means the same thing.
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      primaryColor: '#ff6b00',
    });
    // hue 45.1° — Clay sits at 44°, the closest curated family.
    expect(look.overrides.pageColor).toBe('clay');
  });

  it('never carries a raw hex into the new overrides', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      primaryColor: '#3b82f6',
      pageColor: '#0e1216',
    });
    for (const value of Object.values(look.overrides)) {
      expect(String(value)).not.toMatch(/^#/);
    }
    expect(pageColorIds).toContain(look.overrides.pageColor);
  });

  it('maps a near-neutral accent to a grey family rather than a random hue', () => {
    const dark = migrateThemeToLook({
      foundationPreset: 'monochrome',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      primaryColor: '#1a1a1b',
    });
    expect(dark.overrides.pageColor).toBe('graphite');
  });

  it('does NOT record a value that merely equals the preset default', () => {
    const base = presetValues({ presetId: 'ember', surface: 'glass', mode: 'dark' });
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      primaryColor: base.accent,
      pageColor: base.pageColor,
    });
    expect(look.overrides).not.toHaveProperty('accent');
    expect(look.overrides).not.toHaveProperty('pageColor');
  });

  it('drops every dead field', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      frostLevel: '20px',
      frostColor: '25, 25, 27',
      typographyPreset: 'modern',
      panelStrength: 0.5,
    });
    for (const dead of DEAD_FIELDS) {
      expect(look.overrides).not.toHaveProperty(dead);
    }
  });

  it('treats an empty string as unset rather than as a deliberate blank', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      pageColor: '   ',
      backgroundUrl: '   ',
    });
    expect(look.overrides).not.toHaveProperty('pageColor');
    expect(look.overrides).not.toHaveProperty('backgroundUrl');
  });

  it('falls back to defaults for junk input', () => {
    expect(migrateThemeToLook(null)).toMatchObject({ presetId: DEFAULT_LOOK.presetId });
    expect(migrateThemeToLook('nope')).toMatchObject({ presetId: DEFAULT_LOOK.presetId });
    expect(migrateThemeToLook({ foundationPreset: 'ghost' }).presetId).toBe(DEFAULT_LOOK.presetId);
  });
});

describe('migration ordering (regression)', () => {
  // The trap: transparencyLevel is a DEAD field, but on v2/v3 saves it is the
  // only carrier of the user's panel setting. Dropping dead fields before
  // deriving panelStrength would silently discard it.
  it('recovers panelStrength from transparencyLevel before dropping dead fields', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      transparencyLevel: 0.8,
      // no panelStrength — this is a v2/v3 shaped save
    });
    expect(look.overrides.panelStrength).toBe(0.8);
    expect(look.overrides).not.toHaveProperty('transparencyLevel');
  });

  it('applies the old clamp floor when recovering', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      transparencyLevel: 0.05,
    });
    expect(look.overrides.panelStrength).toBe(0.15);
  });

  it('leaves an explicit panelStrength alone', () => {
    const look = migrateThemeToLook({
      foundationPreset: 'ember',
      surfaceSystem: 'glass',
      foundationMode: 'dark',
      panelStrength: 0.3,
      transparencyLevel: 0.9,
    });
    expect(look.overrides.panelStrength).toBe(0.3);
  });
});

describe('loadLookFromStorage', () => {
  const CURRENT = 'shopsite-look-v5';
  const LEGACY = ['shopsite-theme-v4', 'shopsite-theme-v3', 'shopsite-theme-v2'];

  it('reads the current key without migrating', () => {
    const storage = fakeStorage({
      [CURRENT]: JSON.stringify({ presetId: 'monochrome', surface: 'glass', mode: 'light' }),
    });
    const { look, migratedFrom } = loadLookFromStorage(storage, CURRENT, LEGACY);
    expect(look.presetId).toBe('monochrome');
    expect(migratedFrom).toBeNull();
  });

  it('migrates from v4 when the current key is absent', () => {
    const storage = fakeStorage({
      'shopsite-theme-v4': JSON.stringify({
        foundationPreset: 'sansFirst',
        surfaceSystem: 'glass',
        foundationMode: 'light',
        primaryColor: '#ff6b00',
      }),
    });
    const { look, migratedFrom } = loadLookFromStorage(storage, CURRENT, LEGACY);
    expect(migratedFrom).toBe('shopsite-theme-v4');
    expect(look.presetId).toBe('sansFirst');
    expect(look.overrides.pageColor).toBe('clay');
  });

  it('preserves the v4 -> v3 -> v2 fallback chain', () => {
    const storage = fakeStorage({
      'shopsite-theme-v2': JSON.stringify({
        foundationPreset: 'ember',
        surfaceSystem: 'glass',
        foundationMode: 'dark',
        transparencyLevel: 0.7,
      }),
    });
    const { look, migratedFrom } = loadLookFromStorage(storage, CURRENT, LEGACY);
    expect(migratedFrom).toBe('shopsite-theme-v2');
    expect(look.overrides.panelStrength).toBe(0.7);
  });

  it('returns defaults when storage is empty', () => {
    const { look } = loadLookFromStorage(fakeStorage(), CURRENT, LEGACY);
    expect(look).toMatchObject({ ...DEFAULT_LOOK, overrides: {} });
  });

  it('survives corrupt JSON at every key', () => {
    const storage = fakeStorage({ [CURRENT]: '{oops', 'shopsite-theme-v4': 'nope' });
    const { look } = loadLookFromStorage(storage, CURRENT, LEGACY);
    expect(foundationPresets[look.presetId]).toBeDefined();
  });
});
