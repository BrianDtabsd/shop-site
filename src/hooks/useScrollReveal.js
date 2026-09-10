import { useEffect } from 'react';
import { useScrollContainer } from '../context/ScrollContainerContext';

export function useScrollReveal() {
  const { scrollElementRef, hasScrollElement } = useScrollContainer();

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The theme's reduced-motion setting arrives as a data attribute written by
    // useTheme (see theme/resolveLook.js). Reading the attribute instead of
    // localStorage keeps this hook out of the storage-key business — the key has
    // already been renamed once.
    const respectReduced = document.documentElement.dataset.respectReducedMotion !== 'false';

    if (!hasScrollElement || !scrollElement || (prefersReduced && respectReduced)) {
      return undefined;
    }

    // --- Intersection Observer for Reveal Animations ---
    const observerOptions = { root: scrollElement, rootMargin: '0px', threshold: 0.12 };

    const observer = new IntersectionObserver((entries, observerInstance) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observerInstance.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const observeElements = () => {
      scrollElement
        .querySelectorAll('.anim-trigger:not(.is-visible)')
        .forEach((el) => observer.observe(el));
    };

    const timer = setTimeout(observeElements, 100);

    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(scrollElement, { childList: true, subtree: true });

    // --- Parallax on scroll ---
    const parallaxElements = () =>
      scrollElement.querySelectorAll('.anim-parallax');

    /*
     * Direction-aware layer separation.
     *
     * `--parallax-y` is a function of POSITION, so it can only ever slide layers
     * as you move down the page. `--scroll-spread` is a function of DIRECTION: it
     * accumulates while you scroll down and unwinds while you scroll back up, so
     * the hero slabs pull apart and draw together again as you reverse. It is
     * clamped to 0…1 rather than tracking absolute offset, which means the effect
     * is reversible from anywhere on the page instead of depending on where the
     * hero happens to be.
     */
    let spread = 0;
    let lastTop = scrollElement.scrollTop;
    const SPREAD_PER_PX = 1 / 420;

    const handleScroll = () => {
      const top = scrollElement.scrollTop;
      const delta = top - lastTop;
      lastTop = top;

      if (delta !== 0) {
        spread = Math.min(1, Math.max(0, spread + delta * SPREAD_PER_PX));
        document.documentElement.style.setProperty('--scroll-spread', spread.toFixed(3));
        document.documentElement.dataset.scrollDir = delta > 0 ? 'down' : 'up';
      }

      const depth = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--parallax-depth')
      ) || 0;
      if (depth <= 0.01) return;

      const viewH = scrollElement.clientHeight;

      parallaxElements().forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const offset = (elCenter - viewH / 2) / viewH;
        const shift = offset * depth * -60;
        el.style.setProperty('--parallax-y', `${shift.toFixed(1)}px`);
      });
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      mutationObserver.disconnect();
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [hasScrollElement, scrollElementRef]);
}
