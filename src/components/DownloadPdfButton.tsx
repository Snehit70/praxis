import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { EyeOff, FileDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadPaperPdf, PdfDownloadError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { PdfDownloadDialog, type PdfDownloadPhase } from '@/components/PdfDownloadDialog';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DownloadPdfButton({
  paperUuid,
  courseUuid,
  examUuid,
  answers = false,
  label,
  variant = 'button',
  hint,
}: {
  paperUuid: string;
  courseUuid?: string | null;
  examUuid?: string | null;
  answers?: boolean;
  label?: string;
  /** `link`: a quiet text link, for secondary placements like the cover plate. */
  variant?: 'button' | 'link';
  /** Small note under a `link`, e.g. a spoiler warning on the answer key. */
  hint?: string;
}) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PdfDownloadPhase>('working');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | undefined>();
  const [filename, setFilename] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page drops any build still in flight.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!open || phase !== 'working') return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [open, phase]);

  useEffect(() => {
    if (phase !== 'error') return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((current) => {
        if (!current || current <= 1) return undefined;
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const startDownload = useCallback(async () => {
    if (runningRef.current) {
      setOpen(true);
      return;
    }
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    startedAtRef.current = Date.now();
    setOpen(true);
    setPhase('working');
    setElapsedMs(0);
    setError(null);
    setRetryAfterSeconds(undefined);
    setFilename(null);

    try {
      const file = await downloadPaperPdf(paperUuid, getToken, {
        courseUuid,
        examUuid,
        answers,
        signal: controller.signal,
      });
      triggerDownload(file.blob, file.filename);
      setFilename(file.filename);
      setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now()));
      setPhase('success');
      setOpen(true);
    } catch (caught) {
      if (controller.signal.aborted) {
        logger.info('PDF download cancelled', { paperUuid, answers });
        return;
      }
      logger.error('Failed to download paper PDF', caught);
      setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now()));
      if (caught instanceof PdfDownloadError) {
        setError(caught.message);
        setRetryAfterSeconds(caught.retryAfterSeconds);
      } else {
        setError('Could not download the PDF.');
      }
      setPhase('error');
      setOpen(true);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      runningRef.current = false;
      setBusy(false);
    }
  }, [answers, courseUuid, examUuid, getToken, paperUuid]);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {variant === 'link' ? (
        <button
          type="button"
          onClick={() => void startDownload()}
          aria-busy={busy}
          className="group inline-flex items-start gap-2 rounded-md text-left text-sm text-[rgb(var(--ex-accent-soft,214_232_250))] transition-colors hover:text-white"
        >
          {busy ? (
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : answers ? (
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
          ) : (
            <FileDown className="mt-0.5 h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
          )}
          <span className="flex flex-col">
            <span className="underline decoration-white/25 underline-offset-4 group-hover:decoration-white/60">
              {label ?? (answers ? 'Answer key' : 'Download PDF')}
            </span>
            {hint && <span className="mt-0.5 text-xs text-white/55">{hint}</span>}
          </span>
        </button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void startDownload()}
          className="gap-1.5"
          aria-busy={busy}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {label ?? (answers ? 'Answer key' : 'Download PDF')}
        </Button>
      )}
      {error && !open ? (
        <span className="max-w-[16rem] text-left text-[11px] text-red-400" role="status">
          {error}
        </span>
      ) : null}
      <PdfDownloadDialog
        open={open}
        onOpenChange={setOpen}
        answers={answers}
        phase={phase}
        elapsedMs={elapsedMs}
        filename={filename}
        error={error}
        retryAfterSeconds={retryAfterSeconds}
        onRetry={() => void startDownload()}
        onHide={() => setOpen(false)}
        onCancel={cancelDownload}
      />
    </span>
  );
}
