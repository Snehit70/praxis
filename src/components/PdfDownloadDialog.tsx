import { Check, FileDown, TriangleAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import coverArt from '@/assets/paper-cover.webp';

export type PdfDownloadPhase = 'working' | 'success' | 'error';

/** Past this, say so rather than let the bar look stuck. */
const SLOW_AFTER_MS = 20_000;

export function PdfDownloadDialog({
  open,
  onOpenChange,
  answers,
  phase,
  elapsedMs,
  filename,
  error,
  retryAfterSeconds,
  onRetry,
  onHide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answers: boolean;
  phase: PdfDownloadPhase;
  elapsedMs: number;
  filename?: string | null;
  error?: string | null;
  retryAfterSeconds?: number;
  onRetry: () => void;
  onHide: () => void;
}) {
  const titleId = answers ? 'pdf-download-answers-title' : 'pdf-download-paper-title';
  const kind = answers ? 'answer key' : 'question paper';
  const slow = phase === 'working' && elapsedMs > SLOW_AFTER_MS;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissable={phase !== 'working'}
      labelledBy={titleId}
      className="overflow-hidden sm:max-w-sm"
    >
      {/* Art strip: the same quiet hall as the cover. */}
      <div aria-hidden="true" className="relative h-28 overflow-hidden">
        <img src={coverArt} alt="" className="h-full w-full object-cover object-[50%_38%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1530] via-[#0E1530]/30 to-transparent" />
      </div>

      <div className="-mt-6 px-6 pb-6">
        <div
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-sm',
            phase === 'error'
              ? 'border-red-400/40 bg-red-950/60 text-red-300'
              : 'border-[rgba(214,178,110,0.45)] bg-[#0E1530]/90 text-[#e6c88a]',
          )}
        >
          {phase === 'success' ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : phase === 'error' ? (
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FileDown className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <h2 id={titleId} className="mt-3 font-display text-2xl font-normal tracking-tight">
          {phase === 'success'
            ? 'Saved to your downloads'
            : phase === 'error'
              ? 'Could not build the PDF'
              : `Preparing your ${kind}`}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground" aria-live="polite">
          {phase === 'working' &&
            (slow ? 'Taking longer than usual. Hang on, it is still working.' : 'Usually a few seconds.')}
          {phase === 'success' && (filename ?? 'The PDF is ready.')}
          {phase === 'error' &&
            (error ?? 'The renderer did not finish.') +
              (retryAfterSeconds ? ` You can retry in ${retryAfterSeconds}s.` : '')}
        </p>

        {phase === 'working' && (
          <div
            className="relative mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Preparing PDF"
          >
            <div className="pdf-sweep absolute inset-y-0 w-2/5 rounded-full bg-[#d6b26e]" />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {phase === 'working' && (
            <Button variant="ghost" onClick={onHide}>
              Hide
            </Button>
          )}
          {phase === 'error' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={onRetry}
                disabled={Boolean(retryAfterSeconds && retryAfterSeconds > 0)}
                className="gap-1.5"
              >
                <FileDown className="h-4 w-4" />
                Try again
              </Button>
            </>
          )}
          {phase === 'success' && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </div>
      </div>
    </Dialog>
  );
}
