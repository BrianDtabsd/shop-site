/**
 * Studio control registry.
 *
 * Every customizable look setting is declared here as data. The Look tab renders
 * itself from this list, and `resolveLook` uses `presetValue` to decide what a
 * control's value is when the user has not overridden it.
 *
 * A control declares which surfaces it applies to. Controls that do not apply to
 * the active surface are rendered DISABLED with `reason` shown — never removed.
 * Panels that change shape when you flip a switch are why the old editor felt like
 * separate templates rather than one system.
 *
 * @see resolveLook.js — consumes `presetValue` and `id`
 * @see ../components/LookEditor.jsx — renders from `group` / `type`
 */

export const BOTH = ['glass', 'foundation'];
export const GLASS_ONLY = ['glass'];

/** Display order of groups in the Look tab. */
export const CONTROL_GROUPS = [
  { id: 'color', label: 'Color' },
  { id: 'surface', label: 'Surface' },
  { id: 'type', label: 'Type' },
  { id: 'shape', label: 'Shape' },
  { id: 'motion', label: 'Motion' },
];

const PAGE_SWATCHES = [
  { label: 'Mono black', value: '#0a0a0b' },
  { label: 'Charcoal', value: '#111111' },
  { label: 'Ink', value: '#0e1216' },
  { label: 'Warm dark', value: '#161513' },
  { label: 'Paper', value: '#f3f2ee' },
  { label: 'Cream', value: '#f5f2ea' },
];

const ACCENT_SWATCHES = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Mono white', value: '#ffffff' },
  { label: 'Ember', value: '#e27348' },
  { label: 'Orange', value: '#ff6b00' },
  { label: 'Mauve', value: '#b9a4c0' },
  { label: 'Teal', value: '#5faba4' },
  { label: 'Ink', value: '#75b9ea' },
  { label: 'Rose', value: '#f43f5e' },
];

/**
 * The control list.
 *
 * `presetValue(ctx)` returns the value this control takes from the preset when the
 * user has not overridden it. ctx = { preset, colors, surface, mode, glassDefaults }.
 * It must be pure and must not read the override layer.
 */
export const CONTROLS = [
  // ── Color ──────────────────────────────────────────────────────────────────
  {
    id: 'pageColor',
    group: 'color',
    label: 'Page color',
    help: 'The background field behind everything.',
    type: 'swatch',
    options: PAGE_SWATCHES,
    allowCustom: true,
    appliesTo: BOTH,
    presetValue: ({ colors }) => colors.canvas,
  },
  {
    id: 'accent',
    group: 'color',
    label: 'Accent color',
    help: 'Buttons, links, and highlights.',
    type: 'swatch',
    options: ACCENT_SWATCHES,
    allowCustom: true,
    appliesTo: BOTH,
    presetValue: ({ colors }) => colors.accent,
  },

  // ── Surface ────────────────────────────────────────────────────────────────
  {
    id: 'panelStrength',
    group: 'surface',
    label: 'Panel strength',
    help: 'Drag left to fade cards away so type floats on the page. Nav stays put.',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    appliesTo: GLASS_ONLY,
    reason: 'Foundation surfaces are matte — there is no panel to blur.',
    presetValue: ({ glassDefaults }) => glassDefaults.panelStrength,
  },
  {
    id: 'backgroundUrl',
    group: 'surface',
    label: 'Background image',
    help: 'Optional photo underneath the glass.',
    type: 'text',
    placeholder: 'https://…',
    appliesTo: GLASS_ONLY,
    reason: 'Foundation is opaque paper — a photo behind it would never show.',
    presetValue: ({ glassDefaults }) => glassDefaults.backgroundUrl,
  },
  {
    id: 'layoutMode',
    group: 'surface',
    label: 'Layout',
    type: 'segmented',
    options: [
      { label: 'Cards', value: 'cards' },
      { label: 'Full page', value: 'container' },
    ],
    appliesTo: BOTH,
    presetValue: () => 'cards',
  },
  {
    id: 'navOutline',
    group: 'surface',
    label: 'Nav outline',
    type: 'segmented',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Thin', value: 'thin' },
      { label: 'Thick', value: 'thick' },
    ],
    appliesTo: BOTH,
    presetValue: ({ glassDefaults, surface }) =>
      surface === 'glass' ? glassDefaults.navOutline : 'thin',
  },
  {
    // Was a live theme input with no control — permanently stuck at its default.
    id: 'navOutlineColor',
    group: 'surface',
    label: 'Nav outline color',
    help: 'Defaults to the preset line color.',
    type: 'color',
    appliesTo: BOTH,
    presetValue: ({ colors }) => colors.line,
  },

  // ── Type ───────────────────────────────────────────────────────────────────
  {
    // Was a live theme input with no control.
    id: 'bodyTextSize',
    group: 'type',
    label: 'Body text size',
    type: 'segmented',
    options: [
      { label: 'S', value: '15px' },
      { label: 'M', value: '16px' },
      { label: 'L', value: '17px' },
      { label: 'XL', value: '18px' },
    ],
    appliesTo: BOTH,
    presetValue: () => '16px',
  },

  // ── Shape ──────────────────────────────────────────────────────────────────
  {
    // Was a live theme input with no control.
    id: 'cardRadius',
    group: 'shape',
    label: 'Corner radius',
    type: 'segmented',
    options: [
      { label: 'Sharp', value: '0.5rem' },
      { label: 'Soft', value: '1.25rem' },
      { label: 'Round', value: '2rem' },
      { label: 'Pill', value: '2.5rem' },
    ],
    appliesTo: BOTH,
    // Foundation's editorial paper reads better with a tighter corner; this
    // preserves each surface's previous hardcoded default.
    presetValue: ({ surface }) => (surface === 'foundation' ? '0.5rem' : '1.25rem'),
  },
  {
    // Was a live theme input with no control.
    id: 'cardPadding',
    group: 'shape',
    label: 'Card padding',
    type: 'segmented',
    options: [
      { label: 'Tight', value: '1rem' },
      { label: 'Normal', value: '1.5rem' },
      { label: 'Roomy', value: '2rem' },
    ],
    appliesTo: BOTH,
    presetValue: () => '1.5rem',
  },
  {
    id: 'buttonShape',
    group: 'shape',
    label: 'Button shape',
    type: 'segmented',
    options: [
      { label: 'Pill', value: 'pill' },
      { label: 'Rounded', value: 'rounded' },
      { label: 'Sharp', value: 'sharp' },
    ],
    appliesTo: BOTH,
    presetValue: () => 'rounded',
  },
  {
    id: 'buttonStyle',
    group: 'shape',
    label: 'Button style',
    type: 'segmented',
    options: [
      { label: 'Filled', value: 'filled' },
      { label: 'Outline', value: 'outline' },
      { label: 'Empty', value: 'empty' },
    ],
    appliesTo: BOTH,
    presetValue: () => 'filled',
  },
  {
    id: 'buttonGlow',
    group: 'shape',
    label: 'Glow on click',
    type: 'toggle',
    appliesTo: BOTH,
    presetValue: () => false,
  },
  {
    id: 'buttonJump',
    group: 'shape',
    label: 'Jump on hover',
    type: 'toggle',
    appliesTo: BOTH,
    presetValue: () => true,
  },

  // ── Motion ─────────────────────────────────────────────────────────────────
  {
    id: 'navStyle',
    group: 'motion',
    label: 'Nav style',
    help: 'Floating: nav is transparent over the hero, fills in on scroll.',
    type: 'segmented',
    options: [
      { label: 'Docked', value: 'docked' },
      { label: 'Floating', value: 'floating' },
    ],
    appliesTo: GLASS_ONLY,
    reason: 'Foundation nav is always docked — there is no translucency to fill in.',
    presetValue: () => 'docked',
  },
  {
    id: 'floatStrength',
    group: 'motion',
    label: 'Float lift',
    help: 'How much cards lift on hover.',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    appliesTo: BOTH,
    presetValue: () => 0.5,
  },
  {
    id: 'parallaxDepth',
    group: 'motion',
    label: 'Parallax depth',
    help: 'Scroll-driven depth shift on hero visuals.',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    format: (v) => `${Math.round(v * 100)}%`,
    appliesTo: BOTH,
    presetValue: () => 0.4,
  },
  {
    id: 'revealSpeed',
    group: 'motion',
    label: 'Reveal speed',
    type: 'segmented',
    options: [
      { label: 'Fast', value: 'fast' },
      { label: 'Medium', value: 'medium' },
      { label: 'Slow', value: 'slow' },
    ],
    appliesTo: BOTH,
    presetValue: () => 'medium',
  },
  {
    id: 'respectReducedMotion',
    group: 'motion',
    label: 'Respect reduced-motion preference',
    type: 'toggle',
    appliesTo: BOTH,
    presetValue: () => true,
  },
];

/** Fast lookup by control id. */
export const CONTROLS_BY_ID = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));

/** Every valid override key. Used to reject junk on import. */
export const CONTROL_IDS = CONTROLS.map((c) => c.id);

export function controlsInGroup(groupId) {
  return CONTROLS.filter((c) => c.group === groupId);
}

export function appliesToSurface(control, surface) {
  return control.appliesTo.includes(surface);
}
