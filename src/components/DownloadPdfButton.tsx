import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { FileDown, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadPaperPdf } from '@/lib/api';
import { logger } from '@/lib/logger';

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
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const file = await downloadPaperPdf(paperUuid, getToken, {
        courseUuid,
        examUuid,
        answers,
      });
      triggerDownload(file.blob, file.filename);
    } catch (error) {
      logger.error('Failed to download paper PDF', error);
    } finally {
      setBusy(false);
    }
  }, [answers, courseUuid, examUuid, getToken, paperUuid]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className="gap-1.5"
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {label ?? (answers ? 'Answer key' : 'Download PDF')}
    </Button>
  );
}
