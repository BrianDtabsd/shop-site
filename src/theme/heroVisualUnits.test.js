import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guard against a bug class, not a single bug.
 *
 * The hero decoration lives inside the site canvas, which is NOT the browser
 * window — the Studio sits over or beside it, and the site is a scroll container
 * in its own right. Sizing that decoration in viewport units while positioning it
 * in container-relative units makes the two reference frames disagree: the circle
 * shrank to 22% visible on a wide page and grew to 62% when the site was squeezed.
 *
 * Phase 2 adds per-site-type hero visuals. This test fails loudly if any of them
 * reach for `vw` / `vh` again.
 */

const css = readFileSync(
  fileURLToPath(new URL('../index.css', import.meta.url)),
  'utf8'
);

/** Crude but sufficient: split into `selector { declarations }` blocks. */
function ruleBlocks(source) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    blocks.push({ selector: match[1].trim(), body: match[2] });
  }
  return blocks;
}

const VIEWPORT_UNIT = /\b\d*\.?\d+(vw|vh|vmin|vmax)\b/;

describe('hero visual sizing', () => {
  const heroRules = ruleBlocks(css).filter(
    (b) => b.selector.includes('hero-visual') || b.selector.includes('hero-shell')
  );

  it('finds the hero visual rules at all (guards the test itself)', () => {
    expect(heroRules.length).toBeGreaterThan(5);
  });

  it('never sizes hero decoration in viewport units', () => {
    const offenders = heroRules
      .filter((b) => VIEWPORT_UNIT.test(b.body))
      .map((b) => `${b.selector} → ${b.body.trim().replace(/\s+/g, ' ').slice(0, 90)}`);

    expect(
      offenders,
      'Hero decoration must size against the site container (cqw), not the window ' +
        '(vw/vh). The Studio changes the site width without changing the window width, ' +
        'so the two disagree.'
    ).toEqual([]);
  });

  it('declares the hero as a query container so cqw units resolve', () => {
    const shell = ruleBlocks(css).find((b) => b.selector.includes('.hero-shell'));
    expect(shell, '.hero-shell rule is missing').toBeDefined();
    expect(shell.body).toMatch(/container-type:\s*inline-size/);
    expect(shell.body).toMatch(/container-name:\s*hero/);
  });
});
