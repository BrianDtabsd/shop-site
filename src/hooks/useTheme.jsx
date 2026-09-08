import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  foundationPresets,
  foundationPresetList,
  glassPresetDefaults,
} from '../theme/foundationPresets';
import { CONTROLS_BY_ID } from '../theme/controls';
import {
  DEFAULT_LOOK,
  legacyThemeView,
  normalizeLook,
  presetValues,
  resolveLook,
} from '../theme/resolveLook';
import { loadLookFromStorage } from '../theme/migrateLook';

/**
 * Theme provider over the layered look config.
 *
 * State is `{ presetId, surface, mode, overrides }` — see theme/resolveLook.js.
 * All derivation lives in that pure module; this hook only holds state, persists
 * it, and writes the resolved tokens to the document.
 *
 * `theme` is exposed as a flat COMPATIBILITY VIEW so existing consumers
 * (Button, Header, Hero, Layout) keep reading `theme.buttonShape`,
 * `theme.layoutMode`, and friends unchanged. New code should prefer `values`
 * and `look`.
 */

const LOOK_STORAGE_KEY = 'shopsite-look-v5';
const LEGACY_THEME_KEYS = [
  'shopsite-theme-v4',
  'shopsite-theme-v3',
  'shopsite-theme-v2',
];
const SAVED_LOOKS_KEY = 'shopsite-saved-looks-v1';

/** Old flat field name → control id, for `updateTheme` backwards compatibility. */
const LEGACY_FIELD_ALIASES = {
  primaryColor: 'accent',
  surfaceSystem: '__surface',
  foundationPreset: '__preset',
  foundationMode: '__mode',
};

function readSavedLooks() {
  try {
    const raw = localStorage.getItem(SAVED_LOOKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && entry.id && entry.name)
      .map((entry) => ({ ...normalizeLook(entry), id: entry.id, name: entry.name }));
  } catch {
    return [];
  }
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'look'
  );
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [look, setLook] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_LOOK, overrides: {} };
    return loadLookFromStorage(localStorage, LOOK_STORAGE_KEY, LEGACY_THEME_KEYS).look;
  });
  const [savedLooks, setSavedLooks] = useState(readSavedLooks);

  const resolved = useMemo(() => resolveLook(look), [look]);

  useEffect(() => {
    try {
      localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify(look));
    } catch (e) {
      console.warn('Theme: could not persist look', e);
    }
  }, [look]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify(savedLooks));
    } catch (e) {
      console.warn('Theme: could not persist saved looks', e);
    }
  }, [savedLooks]);

  // Write resolved tokens + data attributes to the document.
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(resolved.tokens)) {
      root.style.setProperty(name, value);
    }
    for (const [name, value] of Object.entries(resolved.dataset)) {
      root.dataset[name] = value;
    }
    document.body.dataset.layoutMode = resolved.values.layoutMode;
    document.body.dataset.surface = resolved.meta.surface;
  }, [resolved]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const setOverride = useCallback((id, value) => {
    if (!CONTROLS_BY_ID[id]) return;
    setLook((prev) => ({ ...prev, overrides: { ...prev.overrides, [id]: value } }));
  }, []);

  /** Clear one control so it tracks the preset again. */
  const resetControl = useCallback((id) => {
    setLook((prev) => {
      if (!(id in prev.overrides)) return prev;
      const next = { ...prev.overrides };
      delete next[id];
      return { ...prev, overrides: next };
    });
  }, []);

  /** Drop every override, keeping preset / surface / mode. */
  const resetOverrides = useCallback(() => {
    setLook((prev) => ({ ...prev, overrides: {} }));
  }, []);

  /**
   * Switch preset WITHOUT discarding customization — the whole point of the
   * layered model. Overrides ride along and show as modified against the new base.
   */
  const applyPreset = useCallback((presetId) => {
    if (!foundationPresets[presetId]) return;
    setLook((prev) => ({ ...prev, presetId }));
  }, []);

  const setSurface = useCallback((surface) => {
    setLook((prev) => ({ ...prev, surface: surface === 'foundation' ? 'foundation' : 'glass' }));
  }, []);

  const setMode = useCallback((mode) => {
    setLook((prev) => ({ ...prev, mode: mode === 'light' ? 'light' : 'dark' }));
  }, []);

  /** Back-compat shim for callers still passing flat theme patches. */
  const updateTheme = useCallback((updates = {}) => {
    setLook((prev) => {
      let next = { ...prev, overrides: { ...prev.overrides } };
      for (const [rawKey, value] of Object.entries(updates)) {
        const key = LEGACY_FIELD_ALIASES[rawKey] || rawKey;
        if (key === '__surface') next.surface = value === 'foundation' ? 'foundation' : 'glass';
        else if (key === '__mode') next.mode = value === 'light' ? 'light' : 'dark';
        else if (key === '__preset') {
          if (foundationPresets[value]) next.presetId = value;
        } else if (CONTROLS_BY_ID[key]) next.overrides[key] = value;
      }
      return next;
    });
  }, []);

  /** Full reset back to the shipped default look. */
  const resetTheme = useCallback(() => {
    setLook({ ...DEFAULT_LOOK, overrides: {} });
    try {
      localStorage.removeItem(LOOK_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Saved looks ────────────────────────────────────────────────────────────

  const saveCurrentAsLook = useCallback(
    (name) => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return null;
      const base = slugify(trimmed);
      const existing = new Set(savedLooks.map((l) => l.id));
      let id = base;
      let n = 2;
      while (existing.has(id)) id = `${base}-${n++}`;

      const entry = { ...normalizeLook(look), id, name: trimmed };
      setSavedLooks((prev) => [...prev, entry]);
      return entry;
    },
    [look, savedLooks]
  );

  const applySavedLook = useCallback(
    (id) => {
      const entry = savedLooks.find((l) => l.id === id);
      if (!entry) return;
      setLook(normalizeLook(entry));
    },
    [savedLooks]
  );

  const deleteSavedLook = useCallback((id) => {
    setSavedLooks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // ── Export / import ────────────────────────────────────────────────────────

  /** The exact shape phase 3 will store at sites/<name>.json. */
  const exportLook = useCallback(
    (name) => JSON.stringify({ name: name || null, look: normalizeLook(look) }, null, 2),
    [look]
  );

  const importLook = useCallback((json) => {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      const candidate = parsed && parsed.look ? parsed.look : parsed;
      const normalized = normalizeLook(candidate);
      setLook(normalized);
      return { ok: true, look: normalized };
    } catch (e) {
      return { ok: false, error: e.message || 'Could not read that look file.' };
    }
  }, []);

  // ── Compatibility view ─────────────────────────────────────────────────────

  const theme = useMemo(() => legacyThemeView(resolved), [resolved]);

  const value = useMemo(
    () => ({
      // new API
      look,
      values: resolved.values,
      meta: resolved.meta,
      modified: resolved.modified,
      isModified: (id) => resolved.modified.includes(id),
      presetValueFor: (id) => presetValues(look)[id],
      setOverride,
      resetControl,
      resetOverrides,
      applyPreset,
      setSurface,
      setMode,
      savedLooks,
      saveCurrentAsLook,
      applySavedLook,
      deleteSavedLook,
      exportLook,
      importLook,
      // compatibility
      theme,
      updateTheme,
      resetTheme,
      foundationPresetList,
      glassPresetDefaults,
    }),
    [
      look,
      resolved,
      theme,
      savedLooks,
      setOverride,
      resetControl,
      resetOverrides,
      applyPreset,
      setSurface,
      setMode,
      saveCurrentAsLook,
      applySavedLook,
      deleteSavedLook,
      exportLook,
      importLook,
      updateTheme,
      resetTheme,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
