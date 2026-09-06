import { Check, Circle, FileDown, LoaderCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatElapsedClock } from '@/lib/pdfDownloadProgress';

export type PdfDownloadPhase = 'working' | 'success' | 'error';

const STEPS = [
  { id: 'questions', label: 'Load questions', from: 0 },
  { id: 'figures', label: 'Fetch figures', from: 22 },
  { id: 'print', label: 'Print pages', from: 55 },
] as const;

function stepState(progress: number, from: number, nextFrom: number | undefined, phase: PdfDownloadPhase) {
  if (phase === 'success') return 'done' as const;
  if (phase === 'error') return progress >= from ? 'done' : 'todo';
  if (progress >= (nextFrom ?? 100)) return 'done' as const;
  if (progress >= from) return 'current' as const;
  return 'todo' as const;
}

export function PdfDownloadDialog({
  open,
  onOpenChange,
  answers,
  phase,
  elapsedMs,
  progress,
  etaSeconds,
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
  progress: number;
  etaSeconds: number | null;
  filename?: string | null;
  error?: string | null;
  retryAfterSeconds?: number;
  onRetry: () => void;
  onHide: () => void;
}) {
  const titleId = answers ? 'pdf-download-answers-title' : 'pdf-download-paper-title';
  const kind = answers ? 'answer key' : 'question paper';
  const barWidth = phase === 'success' ? 100 : phase === 'error' ? progress : progress;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissable={phase !== 'working'}
      labelledBy={titleId}
      className="sm:max-w-md"
    >
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#d6b26e]/80">
          Download
        </p>
        <h2 id={titleId} className="mt-1 font-display text-xl font-normal tracking-tight">
          {phase === 'success'
            ? 'Saved'
            : phase === 'error'
              ? 'Could not build the PDF'
              : `Building ${kind}`}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {phase === 'working' &&
            'Figures are pulled in before print, so they land in the file. This usually takes 10 to 20 seconds.'}
          {phase === 'success' && (filename ? `Saved as ${filename}.` : 'The PDF is in your downloads.')}
          {phase === 'error' && (error ?? 'The renderer did not finish. Try again.')}
        </p>

        <div className="mt-5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-black/30 ring-1 ring-inset ring-[rgba(214,178,110,0.14)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barWidth}
            aria-label="PDF build progress"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-300',
                phase === 'error' ? 'bg-red-400/80' : 'bg-[#d6b26e]',
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-xs tabular-nums text-muted-foreground">
            <span>{formatElapsedClock(elapsedMs)} elapsed</span>
            <span>
              {phase === 'working' && etaSeconds !== null && `about ${etaSeconds}s left`}
              {phase === 'working' && etaSeconds === null && 'still printing'}
              {phase === 'success' && 'done'}
              {phase === 'error' &&
                (retryAfterSeconds
                  ? `retry in ${retryAfterSeconds}s`
                  : 'stopped')}
            </span>
          </div>
        </div>

        <ol className="mt-5 space-y-2.5" aria-label="Build steps">
          {STEPS.map((step, index) => {
            const nextFrom = STEPS[index + 1]?.from;
            const state = stepState(progress, step.from, nextFrom, phase);
            return (
              <li key={step.id} className="flex items-center gap-2.5 text-sm">
                {state === 'done' ? (
                  <Check className="h-3.5 w-3.5 text-[#d6b26e]" aria-hidden="true" />
                ) : state === 'current' ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#d6b26e]" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    state === 'todo' && 'text-muted-foreground',
                    state === 'current' && 'text-foreground',
                    state === 'done' && 'text-foreground/80',
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {phase === 'working' ? (
            <Button variant="ghost" onClick={onHide}>
              Hide
            </Button>
          ) : null}
          {phase === 'error' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onRetry} disabled={Boolean(retryAfterSeconds && retryAfterSeconds > 0)} className="gap-1.5">
                <FileDown className="h-4 w-4" />
                Try again
              </Button>
            </>
          ) : null}
          {phase === 'success' ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
