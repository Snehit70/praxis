import { useEffect, useRef } from 'react';

/**
 * Adds `reveal-on` to the element the first time it scrolls into view, then
 * stops observing (reveal-once — no restless re-animation on scroll-up).
 * Descendants tagged `.praxis-rise` animate up off that class; per-child stagger
 * comes from their `--rise-delay` var (see index.css).
 *
 * Under reduced-motion the class is applied immediately so content is simply
 * present, never hidden. Above-the-fold containers intersect at mount and so
 * reveal right away — giving the load-stagger — while deeper ones wait for
 * scroll, which is exactly the "both" behaviour we want.
 */
export function useRevealOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-on');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('reveal-on');
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
