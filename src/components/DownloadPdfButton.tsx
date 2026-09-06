import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { FileDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadPaperPdf, PdfDownloadError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { PdfDownloadDialog, type PdfDownloadPhase } from '@/components/PdfDownloadDialog';
import { remainingEtaSeconds, workingProgress } from '@/lib/pdfDownloadProgress';

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
}: {
  paperUuid: string;
  courseUuid?: string | null;
  examUuid?: string | null;
  answers?: boolean;
  label?: string;
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

  const progress = phase === 'success' ? 100 : workingProgress(elapsedMs);
  const etaSeconds = phase === 'working' ? remainingEtaSeconds(elapsedMs) : null;

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
      });
      triggerDownload(file.blob, file.filename);
      setFilename(file.filename);
      setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now()));
      setPhase('success');
      setOpen(true);
    } catch (caught) {
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
      runningRef.current = false;
      setBusy(false);
    }
  }, [answers, courseUuid, examUuid, getToken, paperUuid]);

  return (
    <span className="inline-flex flex-col items-start gap-1">
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
        progress={progress}
        etaSeconds={etaSeconds}
        filename={filename}
        error={error}
        retryAfterSeconds={retryAfterSeconds}
        onRetry={() => void startDownload()}
        onHide={() => setOpen(false)}
      />
    </span>
  );
}
