import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

export interface InsightsReport {
  markdown: string;
  fileName: string;
}

/** Download and copy for the AI report. Built on click, so it reflects the run as it stands. */
function useReportActions(onBuild: () => InsightsReport) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetRef.current) window.clearTimeout(resetRef.current);
  }, []);

  const settle = (state: 'copied' | 'failed') => {
    setCopyState(state);
    if (resetRef.current) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setCopyState('idle'), 2200);
  };

  const download = () => {
    const { markdown, fileName } = onBuild();
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    logger.info('Insights report downloaded', { fileName, bytes: markdown.length });
  };

  const copy = async () => {
    const { markdown } = onBuild();
    try {
      await navigator.clipboard.writeText(markdown);
      settle('copied');
      logger.info('Insights report copied', { bytes: markdown.length });
    } catch (error) {
      logger.warn('Insights report copy failed', { error: String(error) });
      settle('failed');
    }
  };

  return { download, copy, copyState };
}

/**
 * "Analyse with AI": one joined pair of buttons. Download saves a Markdown
 * report written for a chat model; Copy puts the same text on the clipboard.
 */
export function AnalyseWithAI({ onBuild, className }: { onBuild: () => InsightsReport; className?: string }) {
  const { download, copy, copyState } = useReportActions(onBuild);
  const segment =
    'inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ex-accent))]';

  return (
    <div
      role="group"
      aria-label="Analyse with AI"
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-lg border border-[rgb(var(--ex-accent)/0.35)] bg-[rgb(var(--ex-accent)/0.07)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={download}
        title="Download a Markdown report of this sitting to paste into ChatGPT, Claude or Gemini"
        className={cn(segment, 'text-[rgb(var(--ex-accent-soft))] hover:bg-[rgb(var(--ex-accent)/0.16)] hover:text-white')}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Analyse with AI
        <Download className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </button>
      <span className="w-px bg-[rgb(var(--ex-accent)/0.3)]" aria-hidden="true" />
      <button
        type="button"
        onClick={() => void copy()}
        title="Copy the report to paste straight into a chat"
        className={cn(segment, 'text-foreground/85 hover:bg-white/[0.06] hover:text-foreground')}
      >
        {copyState === 'copied' ? (
          <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy blocked' : 'Copy'}</span>
      </button>
    </div>
  );
}
