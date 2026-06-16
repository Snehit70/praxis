import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Drives a slow scroll parallax on a single element by writing the shifted
 * offset (in px) to its `--scroll-shift` custom property. One rAF-throttled
 * scroll listener — the element composes the var into its own transform.
 *
 * Auto-trimmed on touch / small screens and disabled under reduced-motion, per
 * the dashboard motion contract: lively on desktop, calm everywhere else.
 */
export function useScrollParallax<T extends HTMLElement>(factor = 0.18, max = 100) {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const desktop = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    if (reduced || !desktop.matches) {
      el.style.setProperty('--scroll-shift', '0px');
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      // Clamp so the over-sized backdrop never drifts far enough to reveal its edges.
      const shift = Math.min(window.scrollY * factor, max);
      el.style.setProperty('--scroll-shift', `${shift.toFixed(2)}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, factor, max]);

  return ref;
}
