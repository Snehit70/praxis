import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { expressionLine, initialState, press, type CalcKey, type CalcState } from '@/lib/tcsCalc';
import { cn } from '@/lib/utils';

/**
 * Scientific calculator laid out and behaving like the TCS iON one used in the
 * real exams (it can't be embedded: their server forbids framing). Mouse only,
 * as there; Escape closes. Drag it by the title bar.
 */

type Tone = 'plain' | 'num' | 'mem' | 'red' | 'equals';

interface Pad {
  key: CalcKey;
  label: ReactNode;
  name: string;
  col: number;
  row: number;
  span?: number;
  tall?: boolean;
  tone?: Tone;
  small?: boolean;
}

const sup = (base: string, power: string) => (
  <>
    {base}
    <sup className="text-[0.7em]">{power}</sup>
  </>
);
const sub = (base: string, index: string, tail: string) => (
  <>
    {base}
    <sub className="text-[0.7em]">{index}</sub>
    {tail}
  </>
);
const unary = (fn: Extract<CalcKey, { type: 'unary' }>['fn']): CalcKey => ({ type: 'unary', fn });
const binary = (op: Extract<CalcKey, { type: 'binary' }>['op']): CalcKey => ({ type: 'binary', op });
const digit = (d: string): CalcKey => ({ type: 'digit', digit: d });

// Columns 1–6 are the scientific block, 7–11 the number pad.
const PADS: Pad[] = [
  { key: binary('mod'), label: 'mod', name: 'Modulus', col: 1, row: 1 },
  { key: { type: 'memory', op: 'MC' }, label: 'MC', name: 'Memory clear', col: 7, row: 1, tone: 'mem' },
  { key: { type: 'memory', op: 'MR' }, label: 'MR', name: 'Memory recall', col: 8, row: 1, tone: 'mem' },
  { key: { type: 'memory', op: 'MS' }, label: 'MS', name: 'Memory store', col: 9, row: 1, tone: 'mem' },
  { key: { type: 'memory', op: 'M+' }, label: 'M+', name: 'Memory add', col: 10, row: 1, tone: 'mem' },
  { key: { type: 'memory', op: 'M-' }, label: 'M-', name: 'Memory subtract', col: 11, row: 1, tone: 'mem' },

  { key: unary('sinh'), label: 'sinh', name: 'Hyperbolic sine', col: 1, row: 2, small: true },
  { key: unary('cosh'), label: 'cosh', name: 'Hyperbolic cosine', col: 2, row: 2, small: true },
  { key: unary('tanh'), label: 'tanh', name: 'Hyperbolic tangent', col: 3, row: 2, small: true },
  { key: binary('exp'), label: 'Exp', name: 'Times ten to the power', col: 4, row: 2 },
  { key: { type: 'open' }, label: '(', name: 'Open bracket', col: 5, row: 2 },
  { key: { type: 'close' }, label: ')', name: 'Close bracket', col: 6, row: 2 },
  { key: { type: 'back' }, label: <span className="text-2xl leading-none">←</span>, name: 'Backspace', col: 7, row: 2, span: 2, tone: 'red' },
  { key: { type: 'clear' }, label: 'C', name: 'Clear', col: 9, row: 2, tone: 'red' },
  { key: unary('negate'), label: '+/-', name: 'Change sign', col: 10, row: 2, tone: 'red' },
  { key: unary('sqrt'), label: '√', name: 'Square root', col: 11, row: 2 },

  { key: unary('asinh'), label: sup('sinh', '-1'), name: 'Inverse hyperbolic sine', col: 1, row: 3, small: true },
  { key: unary('acosh'), label: sup('cosh', '-1'), name: 'Inverse hyperbolic cosine', col: 2, row: 3, small: true },
  { key: unary('atanh'), label: sup('tanh', '-1'), name: 'Inverse hyperbolic tangent', col: 3, row: 3, small: true },
  { key: unary('log2'), label: sub('log', '2', 'x'), name: 'Log base 2', col: 4, row: 3 },
  { key: unary('ln'), label: 'ln', name: 'Natural log', col: 5, row: 3 },
  { key: unary('log'), label: 'log', name: 'Log base 10', col: 6, row: 3 },
  { key: digit('7'), label: '7', name: '7', col: 7, row: 3, tone: 'num' },
  { key: digit('8'), label: '8', name: '8', col: 8, row: 3, tone: 'num' },
  { key: digit('9'), label: '9', name: '9', col: 9, row: 3, tone: 'num' },
  { key: binary('/'), label: '/', name: 'Divide', col: 10, row: 3 },
  { key: binary('%'), label: '%', name: 'Percent', col: 11, row: 3 },

  { key: { type: 'const', name: 'pi' }, label: 'π', name: 'Pi', col: 1, row: 4 },
  { key: { type: 'const', name: 'e' }, label: 'e', name: "Euler's number", col: 2, row: 4 },
  { key: unary('fact'), label: 'n!', name: 'Factorial', col: 3, row: 4 },
  { key: binary('logy'), label: sub('log', 'y', 'x'), name: 'Log of x to base y', col: 4, row: 4 },
  { key: unary('expx'), label: sup('e', 'x'), name: 'e to the power x', col: 5, row: 4 },
  { key: unary('pow10'), label: sup('10', 'x'), name: '10 to the power x', col: 6, row: 4 },
  { key: digit('4'), label: '4', name: '4', col: 7, row: 4, tone: 'num' },
  { key: digit('5'), label: '5', name: '5', col: 8, row: 4, tone: 'num' },
  { key: digit('6'), label: '6', name: '6', col: 9, row: 4, tone: 'num' },
  { key: binary('*'), label: <span className="text-xl leading-none">*</span>, name: 'Multiply', col: 10, row: 4 },
  { key: unary('recip'), label: '1/x', name: 'Reciprocal', col: 11, row: 4 },

  { key: unary('sin'), label: 'sin', name: 'Sine', col: 1, row: 5, small: true },
  { key: unary('cos'), label: 'cos', name: 'Cosine', col: 2, row: 5, small: true },
  { key: unary('tan'), label: 'tan', name: 'Tangent', col: 3, row: 5, small: true },
  { key: binary('pow'), label: sup('x', 'y'), name: 'x to the power y', col: 4, row: 5 },
  { key: unary('cube'), label: sup('x', '3'), name: 'Cube', col: 5, row: 5 },
  { key: unary('square'), label: sup('x', '2'), name: 'Square', col: 6, row: 5 },
  { key: digit('1'), label: '1', name: '1', col: 7, row: 5, tone: 'num' },
  { key: digit('2'), label: '2', name: '2', col: 8, row: 5, tone: 'num' },
  { key: digit('3'), label: '3', name: '3', col: 9, row: 5, tone: 'num' },
  { key: binary('-'), label: <span className="text-xl leading-none">-</span>, name: 'Subtract', col: 10, row: 5 },
  { key: { type: 'equals' }, label: <span className="text-xl">=</span>, name: 'Equals', col: 11, row: 5, tall: true, tone: 'equals' },

  { key: unary('asin'), label: sup('sin', '-1'), name: 'Inverse sine', col: 1, row: 6, small: true },
  { key: unary('acos'), label: sup('cos', '-1'), name: 'Inverse cosine', col: 2, row: 6, small: true },
  { key: unary('atan'), label: sup('tan', '-1'), name: 'Inverse tangent', col: 3, row: 6, small: true },
  { key: binary('yroot'), label: <><sup className="text-[0.7em]">y</sup>√x</>, name: 'y-th root of x', col: 4, row: 6 },
  { key: unary('cbrt'), label: <span className="text-base leading-none">∛</span>, name: 'Cube root', col: 5, row: 6 },
  { key: unary('abs'), label: '|x|', name: 'Absolute value', col: 6, row: 6 },
  { key: digit('0'), label: '0', name: '0', col: 7, row: 6, span: 2, tone: 'num' },
  { key: digit('.'), label: '.', name: 'Decimal point', col: 9, row: 6, tone: 'num' },
  { key: binary('+'), label: '+', name: 'Add', col: 10, row: 6 },
];

/** The keypad's natural width; narrower screens scale the whole calculator down. */
const WIDTH = 463;

// Hall navy: raised keys on a night panel. Digits sit brighter than functions,
// clear keys carry a muted rose, and = takes the exam's soft-white primary.
const TONES: Record<Tone, string> = {
  plain:
    'border-white/[0.08] border-b-black/45 bg-white/[0.05] text-[rgb(var(--ex-accent-soft))]/85 hover:bg-white/[0.1] hover:text-white',
  num: 'border-white/[0.12] border-b-black/45 bg-white/[0.11] text-white hover:bg-white/[0.17]',
  mem: 'border-transparent border-b-black/25 bg-transparent text-muted-foreground hover:bg-white/[0.07] hover:text-foreground',
  red: 'border-rose-300/25 border-b-rose-950/80 bg-rose-500/[0.18] text-rose-100 hover:bg-rose-500/[0.28]',
  equals:
    'border-white/40 border-b-[rgb(var(--ex-line))]/50 bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white',
};

export function ExamCalculator({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CalcState>(initialState);
  const [minimised, setMinimised] = useState(false);
  const [help, setHelp] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Focus the panel so Escape works straight away.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 24) / WIDTH));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const tap = (key: CalcKey) => setState((current) => press(current, key));
  const line = expressionLine(state);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Scientific calculator"
      tabIndex={-1}
      className="exam-panel relative select-none overflow-hidden rounded-xl bg-[#111830]/95 text-foreground shadow-2xl shadow-black/60 outline-none backdrop-blur-md"
      style={{ width: WIDTH, zoom: scale, transform: `translate(${offset.x}px, ${offset.y}px)` } as CSSProperties}
      onKeyDown={(event) => {
        // Keep keys from paging or flagging the question behind.
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
      }}
    >
      {/* Title bar: drag handle, Help, minimise, close. */}
      <div
        className="flex cursor-move touch-none items-center gap-2 border-b border-[rgb(var(--ex-line)/0.14)] bg-[rgb(var(--ex-line)/0.06)] py-2 pl-3 pr-2"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          setOffset({ x: start.ox + (event.clientX - start.x) / scale, y: start.oy + (event.clientY - start.y) / scale });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <span className="flex-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--ex-accent-soft))]/80">
          Scientific Calculator
        </span>
        <button
          type="button"
          onClick={() => setHelp((value) => !value)}
          aria-pressed={help}
          className={cn(
            'h-6 w-[54px] rounded-md border text-xs font-semibold transition-colors',
            help
              ? 'border-[rgb(var(--ex-accent))]/50 bg-[rgb(var(--ex-accent))]/15 text-[rgb(var(--ex-accent-soft))]'
              : 'border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground',
          )}
        >
          {help ? 'Back' : 'Help'}
        </button>
        <button
          type="button"
          onClick={() => setMinimised((value) => !value)}
          aria-label={minimised ? 'Restore calculator' : 'Minimise calculator'}
          aria-expanded={!minimised}
          className="flex h-6 w-6 items-end justify-center rounded-md pb-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          <span className="block h-0.5 w-3 bg-current" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="flex h-6 w-6 items-center justify-center rounded-md text-base leading-none text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          ×
        </button>
      </div>

      {!minimised && (
        <div className="p-3">
          {!help && (
            <div className="mb-1 h-[26px] w-[441px] overflow-hidden whitespace-nowrap rounded-t-md border border-b-0 border-[rgb(var(--ex-line)/0.16)] bg-black/30 px-2.5 pt-1.5 text-right text-[13px] tabular-nums text-muted-foreground [direction:rtl]">
              {/* Right-to-left box so a long expression clips at its start and the newest part stays in view. */}
              <span className="[direction:ltr] [unicode-bidi:isolate]">{line}</span>
            </div>
          )}
          <div className="relative">
            <output
              aria-live="polite"
              aria-label="Result"
              className={cn(
                'mb-2.5 block h-10 w-[441px] overflow-hidden whitespace-nowrap rounded-b-md border border-t-0 border-[rgb(var(--ex-line)/0.16)] bg-black/30 px-2.5 text-right text-[24px] leading-10 tabular-nums',
                state.error ? 'text-rose-300' : 'text-white',
              )}
            >
              {state.entry}
            </output>
            {state.memory !== null && (
              <span
                className="absolute left-2.5 top-2.5 rounded bg-[rgb(var(--ex-accent))]/15 px-1 text-[10px] font-semibold text-[rgb(var(--ex-accent))]"
                title="A value is stored in memory"
              >
                M
              </span>
            )}
          </div>

          {help ? (
            <HelpText />
          ) : (
            <div className="grid grid-cols-[repeat(11,35px)] grid-rows-[repeat(6,25px)] gap-[5px]">
              <fieldset className="col-span-2 col-start-2 row-start-1 flex items-center gap-1.5 pl-1 text-[10px] text-muted-foreground">
                <legend className="sr-only">Angle unit</legend>
                {(['deg', 'rad'] as const).map((angle) => (
                  <label
                    key={angle}
                    className={cn('flex cursor-pointer items-center gap-0.5', state.angle === angle && 'text-[rgb(var(--ex-accent-soft))]')}
                  >
                    <input
                      type="radio"
                      name="calc-angle"
                      checked={state.angle === angle}
                      onChange={() => tap({ type: 'angle', angle })}
                      className="h-3 w-3 accent-[rgb(var(--ex-accent))]"
                    />
                    {angle === 'deg' ? 'Deg' : 'Rad'}
                  </label>
                ))}
              </fieldset>
              {PADS.map((pad) => (
                <button
                  key={pad.name}
                  type="button"
                  aria-label={pad.name}
                  title={pad.name}
                  onClick={() => tap(pad.key)}
                  style={{ gridColumn: `${pad.col} / span ${pad.span ?? 1}`, gridRow: `${pad.row} / span ${pad.tall ? 2 : 1}` }}
                  className={cn(
                    'flex items-center justify-center whitespace-nowrap rounded-md border border-b-[3px] font-semibold leading-none transition-colors active:translate-y-[2px] active:border-b',
                    pad.small ? 'text-[10.5px]' : 'text-xs',
                    TONES[pad.tone ?? 'plain'],
                  )}
                >
                  {pad.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HelpText() {
  return (
    <div className="exam-scroll h-[175px] overflow-y-auto rounded-md border border-[rgb(var(--ex-line)/0.12)] bg-black/20 p-3 text-xs leading-relaxed text-foreground/85">
      <p className="font-semibold text-[rgb(var(--ex-accent-soft))]">How it works</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>Use the mouse. The keyboard is off, as in the exam.</li>
        <li>Press C before starting a new calculation.</li>
        <li>Function keys (sin, √, n!, log, …) act on the number shown, straight away.</li>
        <li>Operators (+, ×, xʸ, mod, …) wait for the next number; = works it out with brackets and the usual order.</li>
        <li>Pick Deg or Rad before you start. Degrees is the default.</li>
        <li>MS stores the shown number, M+ and M- add or subtract it, MR recalls it, MC clears it.</li>
      </ul>
      <p className="mt-2 font-semibold text-[rgb(var(--ex-accent-soft))]">Limits</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>Numbers can be at most 9 characters long when typed.</li>
        <li>After an error, only C works.</li>
        <li>Keep brackets balanced; = closes any left open.</li>
      </ul>
    </div>
  );
}
