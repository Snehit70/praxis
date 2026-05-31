import { useEffect, useState } from 'react';

/**
 * Live `prefers-reduced-motion` reading. Returns `true` when the user has asked
 * the OS to minimise motion, and updates if they change it mid-session. Every
 * decorative animation on the dashboard gates on this.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
