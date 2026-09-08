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

    const handleScroll = () => {
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
