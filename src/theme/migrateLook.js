/**
 * Migration from the flat `shopsite-theme-v*` blobs to the layered look config.
 *
 * Pure — takes a raw stored object, returns a look config. Storage access lives
 * in the caller so this stays testable.
 *
 * ORDER MATTERS. The old loader derived `panelStrength` from `transparencyLevel`
 * when the former was absent (a v2/v3 saved state). If dead-field removal ran
 * before that derivation, those users would silently lose their panel setting —
 * destroyed by the very cleanup meant to be safe. Step 2 must precede step 5.
 */

import { foundationPresets } from './foundationPresets';
import { CONTROLS } from './controls';
import { DEFAULT_LOOK, normalizeLook, presetValues } from './resolveLook';

/** Fields the old theme object carried but nothing reads any more. */
export const DEAD_FIELDS = [
  'frostLevel',
  'transparencyLevel',
  'frostColor',
  'typographyPreset',
];

/**
 * Old field name → control id, where they differ.
 * Unlisted control ids kept their name across the migration.
 */
const RENAMED = {
  primaryColor: 'accent',
};

/**
 * @param {object|null} stored - parsed contents of a shopsite-theme-v* key
 * @returns {{presetId, surface, mode, overrides}} a valid look config
 */
export function migrateThemeToLook(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_LOOK, overrides: {} };

  // 2. Derived migration FIRST — recover panelStrength from the old frost slider
  //    before anything drops transparencyLevel. (Step 1, choosing which stored
  //    key to read, happens in the caller's fallback chain.)
  const recovered = { ...stored };
  if (recovered.panelStrength == null && recovered.transparencyLevel != null) {
    recovered.panelStrength = Math.min(
      1,
      Math.max(0.15, Number(recovered.transparencyLevel) || 0.48)
    );
  }

  // 3. Identity fields.
  const presetId = foundationPresets[recovered.foundationPreset]
    ? recovered.foundationPreset
    : DEFAULT_LOOK.presetId;
  const surface = recovered.surfaceSystem === 'foundation' ? 'foundation' : 'glass';
  const mode = recovered.foundationMode === 'light' ? 'light' : 'dark';

  const base = presetValues({ presetId, surface, mode, overrides: {} });

  // 4. Anything differing from what the preset would produce was a real choice.
  //    Anything equal to the preset default is NOT recorded, so it keeps tracking
  //    the preset instead of freezing as a fake override.
  const overrides = {};
  for (const control of CONTROLS) {
    const storedKey =
      Object.keys(RENAMED).find((k) => RENAMED[k] === control.id) || control.id;
    if (!Object.prototype.hasOwnProperty.call(recovered, storedKey)) continue;

    const value = recovered[storedKey];
    if (value === undefined || value === null) continue;
    // Empty strings in the old model meant "unset", not "set to empty".
    if (typeof value === 'string' && value.trim() === '' && base[control.id]) continue;
    if (value === base[control.id]) continue;

    overrides[control.id] = value;
  }

  // 5. Dead fields are simply never copied across — step 2 already took what
  //    they still carried.
  return normalizeLook({ presetId, surface, mode, overrides });
}

/**
 * Read + migrate from storage, preserving the old loader's fallback chain so
 * users who never touched the Studio since v2 still migrate rather than reset.
 *
 * @param {Storage} storage
 * @returns {{look: object, migratedFrom: string|null}}
 */
export function loadLookFromStorage(storage, currentKey, legacyKeys = []) {
  try {
    const raw = storage.getItem(currentKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { look: normalizeLook(parsed), migratedFrom: null };
      }
    }
  } catch {
    /* fall through to legacy */
  }

  for (const key of legacyKeys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      return { look: migrateThemeToLook(parsed), migratedFrom: key };
    } catch {
      /* try the next legacy key */
    }
  }

  return { look: { ...DEFAULT_LOOK, overrides: {} }, migratedFrom: null };
}
