import { Check, FileDown, TriangleAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import coverArt from '@/assets/paper-cover.webp';

export type PdfDownloadPhase = 'working' | 'success' | 'error';

/** Past this, say so rather than let the bar look stuck. */
const SLOW_AFTER_MS = 20_000;

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

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
  onCancel,
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
  /** Close the dialog and let the build finish in the background. */
  onHide: () => void;
  /** Stop the build altogether. */
  onCancel: () => void;
}) {
  const titleId = answers ? 'pdf-download-answers-title' : 'pdf-download-paper-title';
  const kind = answers ? 'answer key' : 'question paper';
  const working = phase === 'working';
  const slow = working && elapsedMs > SLOW_AFTER_MS;

  return (
    <Dialog
      open={open}
      // While working, Escape or a backdrop click only hides the dialog; the
      // build keeps going and the button shows its spinner.
      onOpenChange={(next) => (next || !working ? onOpenChange(next) : onHide())}
      labelledBy={titleId}
      className="overflow-hidden border-[rgb(var(--ex-line)/0.22)] bg-[#0E1530] sm:max-w-sm"
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
              ? 'border-rose-400/40 bg-rose-950/60 text-rose-300'
              : phase === 'success'
                ? 'border-emerald-300/45 bg-[#0E1530]/90 text-emerald-200'
                : 'border-[rgb(var(--ex-line)/0.3)] bg-[#0E1530]/90 text-[rgb(var(--ex-accent-soft))]',
          )}
        >
          {working && (
            // A slow orbit around the badge: alive, but not urgent.
            <span
              aria-hidden="true"
              className="absolute -inset-px animate-spin rounded-full border border-transparent border-t-[rgb(var(--ex-accent))] [animation-duration:1.4s] motion-reduce:hidden"
            />
          )}
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
          {working &&
            (slow
              ? 'Taking longer than usual. It is still working.'
              : answers
                ? 'Typesetting every question with its answer. Usually a few seconds.'
                : 'Typesetting every question. Usually a few seconds.')}
          {phase === 'success' && (filename ?? 'The PDF is ready.')}
          {phase === 'error' &&
            (error ?? 'The renderer did not finish.') +
              (retryAfterSeconds ? ` You can retry in ${retryAfterSeconds}s.` : '')}
        </p>

        {working && (
          <div className="mt-5 flex items-center gap-3">
            <div
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
              role="progressbar"
              aria-label={`Preparing ${kind}`}
            >
              <div className="pdf-sweep absolute inset-y-0 w-2/5 rounded-full bg-[rgb(var(--ex-accent))]" />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          {working && (
            <>
              <Button
                variant="ghost"
                onClick={onCancel}
                className="mr-auto px-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                onClick={onHide}
                className="border border-white/[0.12] hover:border-white/25 hover:bg-white/[0.06]"
              >
                Keep in background
              </Button>
            </>
          )}
          {phase === 'error' && (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              >
                Close
              </Button>
              <Button
                onClick={onRetry}
                disabled={Boolean(retryAfterSeconds && retryAfterSeconds > 0)}
                className="gap-1.5 bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white"
              >
                <FileDown className="h-4 w-4" />
                Try again
              </Button>
            </>
          )}
          {phase === 'success' && (
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white"
              data-autofocus
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
