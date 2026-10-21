import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lightweight modal dialog (no Radix). Handles Escape-to-close, backdrop click,
 * body scroll lock, initial focus, and a simple Tab focus trap. Render the
 * trigger yourself and drive `open`/`onOpenChange` from the parent.
 */
const EXIT_MS = 140;

// Lets DialogClose run the exit animation before the parent unmounts us.
const DialogCloseContext = React.createContext<((then?: () => void) => void) | null>(null);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, clicking the backdrop / pressing Escape will not close it. */
  dismissable?: boolean;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  dismissable = true,
  labelledBy,
  className,
  children,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [closing, setClosing] = React.useState(false);
  const closeTimer = React.useRef<number | undefined>(undefined);

  // Play the short exit animation, then hand control back to the parent.
  const requestClose = React.useCallback(
    (then?: () => void) => {
      if (closeTimer.current !== undefined) return;
      const finish = then ?? (() => onOpenChange(false));
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }
      setClosing(true);
      closeTimer.current = window.setTimeout(finish, EXIT_MS);
    },
    [onOpenChange],
  );
  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // The component stays mounted while closed, so clear the last exit before a
  // reopen; otherwise the stale timer makes every later close a no-op.
  React.useEffect(() => {
    if (!open) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    setClosing(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus [data-autofocus], else the first focusable element (or the panel), once mounted.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
      (focusable ?? panel).focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissable) {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissable, requestClose]);

  if (!open) return null;

  return createPortal(
    <DialogCloseContext.Provider value={requestClose}>
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        aria-hidden="true"
        onClick={() => dismissable && requestClose()}
        data-closing={closing || undefined}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in data-[closing]:animate-fade-out"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-closing={closing || undefined}
        className={cn(
          'squircle animate-dialog-in data-[closing]:animate-dialog-out relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
    </DialogCloseContext.Provider>,
    document.body,
  );
}

export function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  const requestClose = React.useContext(DialogCloseContext);
  return (
    <button
      type="button"
      onClick={() => (requestClose ? requestClose(onClose) : onClose())}
      aria-label="Close"
      className={cn(
        'absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center squircle rounded-xl bg-black/30 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        className,
      )}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
