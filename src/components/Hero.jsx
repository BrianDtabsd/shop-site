import React from 'react';
import Button from './Button';
import { useTemplateContent } from '../hooks/useTemplateContent';
import { useTheme } from '../hooks/useTheme';

/**
 * Grid-aligned slab stack.
 *
 * Replaces the old corner circle. A circle's bounding box has no relationship to
 * a rectangular column, so cropping it at the gutter looked arbitrary no matter
 * where the cut landed — the left edge of the page was indented and the right was
 * not. Slabs share the page's geometry: the back slab's right edge sits exactly on
 * the content column's right edge, mirroring the text indent, and the stack bleeds
 * only downward, which reads as deliberate.
 *
 * Each slab carries `anim-parallax` individually with its own --depth, so the
 * layers pull apart as you scroll rather than sliding as one flat sheet.
 */
function HeroSlabVisual() {
  return (
    <div className="hero-visual hero-visual--slabs" aria-hidden="true">
      <div className="hero-slab hero-slab--back anim-parallax" />
      <div className="hero-slab hero-slab--mid anim-parallax" />
      <div className="hero-slab hero-slab--front anim-parallax" />
      <div className="hero-slab__rule anim-parallax" />
      <div className="hero-visual__explore">
        <span>Explore</span>
        <iconify-icon icon="solar:arrow-down-linear" width="14" height="14"></iconify-icon>
      </div>
    </div>
  );
}

/** Color Consciousness–style diagonal pastel stripes. */
function HeroStripeVisual() {
  return (
    <div className="hero-visual hero-visual--stripes anim-parallax" aria-hidden="true">
      <div className="hero-visual__stripe hero-visual__stripe--a" />
      <div className="hero-visual__stripe hero-visual__stripe--b" />
      <div className="hero-visual__stripe hero-visual__stripe--c" />
    </div>
  );
}

export default function Hero() {
  const { mergedHero: h } = useTemplateContent();
  const { theme } = useTheme();
  const isFoundation = theme.surfaceSystem === 'foundation';
  const preset = theme.foundationPreset || 'ember';
  return (
    <section
      id="system-view"
      className={`hero-shell relative min-h-[760px] lg:min-h-[820px] overflow-hidden px-6 md:px-8 lg:px-12 border-b ${
        isFoundation ? 'border-[color:var(--ds-color-line)]' : 'border-transparent'
      }`}
    >
      {isFoundation && preset === 'consciousness' ? (
        <HeroStripeVisual />
      ) : (
        <HeroSlabVisual />
      )}

      <div className="z-10 max-w-7xl mr-auto ml-auto pt-10 pb-28 lg:pt-16 lg:pb-32 relative">
        <div
          className="anim-trigger is-visible max-w-[760px]"
          style={{
            maskImage:
              'linear-gradient(90deg, transparent, black 0%, black 100%, transparent)',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent, black 0%, black 100%, transparent)',
          }}
        >
          <h1 className="font-display text-[3.3rem] sm:text-[4.4rem] lg:text-[5.5rem] leading-[0.98] tracking-[-0.045em] font-light max-w-[12ch] mb-7 drop-shadow-sm">
            <span className="anim-wrap block">
              <span className="anim-line inline-block">{h.titleLine1}</span>
            </span>
            <span className="anim-wrap block">
              <span className="anim-line inline-block">{h.titleLine2}</span>
            </span>
            <span className="anim-wrap block">
              <span className="anim-line inline-block">{h.titleLine3}</span>
            </span>
          </h1>

          <p className="max-w-[42rem] text-[1.05rem] sm:text-[1.15rem] lg:text-[1.2rem] leading-[1.7] card-subtitle font-normal mb-10 anim-fade-up">
            {h.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4 mb-14">
            <Button href={h.primaryCtaHref} variant="primary" className="anim-fade-up">
              {h.primaryCtaLabel}
              <iconify-icon
                icon="solar:arrow-right-linear"
                width="16"
                height="16"
                className="ml-2"
              ></iconify-icon>
            </Button>

            <Button href={h.secondaryCtaHref} variant="outline" className="anim-fade-up">
              {h.secondaryCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
