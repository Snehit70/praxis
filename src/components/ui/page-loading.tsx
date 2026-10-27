import { Loader2 } from 'lucide-react';

export function PageLoading({ label = 'Loading page' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
