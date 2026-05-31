import type { ReactNode } from 'react';
import { useRevealOnView } from '@/hooks/useRevealOnView';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container that reveals its `.praxis-rise` descendants when it first enters the
 * viewport (see useRevealOnView). Use it around grids, sections, or the hero
 * text cluster; tag the children with `praxis-rise` and a `--rise-delay` for the
 * staggered cascade.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRevealOnView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
