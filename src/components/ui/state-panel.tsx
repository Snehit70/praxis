import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatePanelTone = 'neutral' | 'error';

interface StatePanelProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: StatePanelTone;
  dashed?: boolean;
  compact?: boolean;
  announce?: boolean;
}

export function StatePanel({
  icon,
  title,
  description,
  actions,
  tone = 'neutral',
  dashed = false,
  compact = false,
  announce = false,
}: StatePanelProps) {
  return (
    <section
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
      className={cn(
        'rounded-2xl border px-6 text-center',
        compact ? 'py-10' : 'py-12',
        dashed ? 'border-dashed' : 'border-solid',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10'
          : 'border-border bg-card/50',
      )}
    >
      {icon && <div className="mx-auto mb-4 flex w-fit items-center justify-center">{icon}</div>}
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </section>
  );
}
