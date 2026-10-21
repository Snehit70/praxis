import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2, Minus, Plus, X } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Full-screen viewer for question figures (tables, charts, diagrams). Figures
 * open fitted to the screen — small scans are scaled *up* so table text is
 * legible — and can be zoomed (buttons, + / -, ctrl+wheel, double-click) and
 * panned by dragging. Esc or a click on the backdrop closes it.
 */

type OpenImage = (src: string, alt: string) => void;

const ImageZoomContext = createContext<OpenImage | null>(null);

/** Opener for the nearest viewer, or null when figures aren't zoomable here. */
export function useImageZoom() {
  return useContext(ImageZoomContext);
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

export function ImageZoomProvider({ children }: { children: React.ReactNode }) {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const open = useCallback<OpenImage>((src, alt) => {
    logger.info('Exam figure opened', { src });
    setImage({ src, alt });
  }, []);
  return (
    <ImageZoomContext.Provider value={open}>
      {children}
      {image && <ImageLightbox src={image.src} alt={image.alt} onClose={() => setImage(null)} />}
    </ImageZoomContext.Provider>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);

  // Fit the figure to the viewport, allowing up to 3x upscale for small scans.
  const computeFit = useCallback((w: number, h: number) => {
    const maxW = window.innerWidth * 0.92 - 32;
    const maxH = window.innerHeight - 140;
    return Math.min(maxW / w, maxH / h, 3);
  }, []);

  useEffect(() => {
    if (!natural) return;
    const onResize = () => setFit(computeFit(natural.w, natural.h));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [natural, computeFit]);

  const stepZoom = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.findIndex((step) => step >= current - 0.001);
      const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))];
      return next ?? current;
    });
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      // Swallow exam shortcuts (← → F, 1–6) while the viewer is up.
      event.stopPropagation();
      if (event.key === 'Escape') onClose();
      else if (event.key === '+' || event.key === '=') stepZoom(1);
      else if (event.key === '-') stepZoom(-1);
      else if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, stepZoom]);

  const onWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    stepZoom(event.deltaY < 0 ? 1 : -1);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const el = scrollRef.current;
    const start = drag.current;
    if (!el || !start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
    el.scrollLeft = start.left - dx;
    el.scrollTop = start.top - dy;
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    // A plain click on the backdrop (not the figure, not a drag) closes.
    if (start && !start.moved && event.target === event.currentTarget) onClose();
  };

  const width = natural ? Math.round(natural.w * fit * zoom) : undefined;
  const pannable = natural ? natural.w * fit * zoom > window.innerWidth * 0.92 || natural.h * fit * zoom > window.innerHeight - 140 : false;
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Figure'}
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-sm text-white/70">{alt}</p>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#14161b]/90 p-1">
          <button type="button" className={btn} onClick={() => stepZoom(-1)} aria-label="Zoom out" title="Zoom out (-)">
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-14 rounded-lg px-2 py-1.5 text-sm tabular-nums text-white/85 hover:bg-white/10"
            title="Fit to screen (0)"
          >
            {Math.round(fit * zoom * 100)}%
          </button>
          <button type="button" className={btn} onClick={() => stepZoom(1)} aria-label="Zoom in" title="Zoom in (+)">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" className={btn} onClick={() => setZoom(1)} aria-label="Fit to screen" title="Fit to screen (0)">
            <Maximize2 className="h-4 w-4" />
          </button>
          <a href={src} target="_blank" rel="noreferrer" className={btn} aria-label="Open original in new tab" title="Open original">
            <ExternalLink className="h-4 w-4" />
          </a>
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <button ref={closeRef} type="button" className={btn} onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        className={`flex min-h-0 flex-1 overflow-auto px-4 pb-6 ${pannable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* m-auto centres the figure while still letting it scroll once zoomed past the viewport. */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const img = event.currentTarget;
            const size = { w: img.naturalWidth, h: img.naturalHeight };
            setNatural(size);
            setFit(computeFit(size.w, size.h));
          }}
          onDoubleClick={() => setZoom((current) => (current > 1 ? 1 : 2))}
          style={width ? { width, maxWidth: 'none' } : undefined}
          className="m-auto select-none rounded-lg bg-white p-2 shadow-2xl shadow-black/60 [image-rendering:auto]"
        />
      </div>
      <p className="pointer-events-none pb-3 text-center text-xs text-white/45">
        Double-click to zoom · drag to pan · Esc to close
      </p>
    </div>,
    document.body,
  );
}
