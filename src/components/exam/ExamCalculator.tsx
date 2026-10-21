import { useEffect, useRef, useState } from 'react';
import { Delete, X } from 'lucide-react';
import { CalcError, evaluateExpression, formatResult, type AngleMode } from '@/lib/calc';
import { cn } from '@/lib/utils';

/**
 * Scientific calculator, modelled on the virtual one the real exam software
 * (TCS iON) provides: 2nd for inverse functions, Deg/Rad, memory keys and Ans.
 * Type or tap an expression; Enter evaluates. The result stays in the field so
 * the next operator continues from it, and recent results are listed.
 */

type Kind = 'num' | 'fn' | 'op' | 'eq' | 'clear' | 'back' | 'toggle' | 'mem';

interface Key {
  label: string;
  insert?: string;
  kind?: Kind;
  title?: string;
  /** Replacement while 2nd is on. */
  second?: { label: string; insert: string; title?: string };
}

const KEYS: Key[] = [
  { label: '2nd', kind: 'toggle', title: 'Second functions (inverse trig, eˣ, 10ˣ, ∛, nPr)' },
  { label: 'DEG', kind: 'toggle', title: 'Switch degrees / radians' },
  { label: 'MC', kind: 'mem', title: 'Clear memory' },
  { label: 'MR', kind: 'mem', title: 'Recall memory' },
  { label: 'M+', kind: 'mem', title: 'Add result to memory' },
  { label: 'M−', kind: 'mem', title: 'Subtract result from memory' },

  { label: 'sin', insert: 'sin(', kind: 'fn', second: { label: 'sin⁻¹', insert: 'asin(' } },
  { label: 'cos', insert: 'cos(', kind: 'fn', second: { label: 'cos⁻¹', insert: 'acos(' } },
  { label: 'tan', insert: 'tan(', kind: 'fn', second: { label: 'tan⁻¹', insert: 'atan(' } },
  { label: 'ln', insert: 'ln(', kind: 'fn', second: { label: 'eˣ', insert: 'e^(' } },
  { label: 'log', insert: 'log(', kind: 'fn', second: { label: '10ˣ', insert: '10^(' } },
  { label: 'C', kind: 'clear', title: 'Clear' },

  { label: 'x²', insert: '^2', kind: 'fn', second: { label: 'x³', insert: '^3' } },
  { label: 'xʸ', insert: '^', kind: 'fn', title: 'Power', second: { label: 'ʸ√x', insert: 'root(', title: 'root(x, y) — y-th root of x' } },
  { label: '√', insert: '√(', kind: 'fn', second: { label: '∛', insert: '∛(' } },
  { label: '1/x', insert: '^(-1)', kind: 'fn', title: 'Reciprocal' },
  { label: 'n!', insert: '!', kind: 'fn', title: 'Factorial' },
  { label: '⌫', kind: 'back' },

  { label: 'π', kind: 'fn' },
  { label: '(', kind: 'op' },
  { label: '7', kind: 'num' }, { label: '8', kind: 'num' }, { label: '9', kind: 'num' },
  { label: '÷', insert: '/', kind: 'op' },

  { label: 'e', kind: 'fn' },
  { label: ')', kind: 'op' },
  { label: '4', kind: 'num' }, { label: '5', kind: 'num' }, { label: '6', kind: 'num' },
  { label: '×', insert: '*', kind: 'op' },

  { label: 'nCr', insert: 'nCr(', kind: 'fn', title: 'nCr(n, r) — combinations', second: { label: 'nPr', insert: 'nPr(', title: 'nPr(n, r) — permutations' } },
  { label: 'mod', insert: ' mod ', kind: 'op', title: 'Remainder', second: { label: '|x|', insert: 'abs(', title: 'Absolute value' } },
  { label: '1', kind: 'num' }, { label: '2', kind: 'num' }, { label: '3', kind: 'num' },
  { label: '−', insert: '-', kind: 'op' },

  { label: 'Ans', insert: 'ans', kind: 'fn', title: 'Previous result' },
  { label: ',', kind: 'op', title: 'Separates nCr / root arguments' },
  { label: '0', kind: 'num' }, { label: '.', kind: 'num' },
  { label: '=', kind: 'eq' },
  { label: '+', kind: 'op' },
];

export function ExamCalculator({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expr, setExpr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const [angle, setAngle] = useState<AngleMode>('deg');
  const [second, setSecond] = useState(false);
  const [ans, setAns] = useState<number | undefined>(undefined);
  const [memory, setMemory] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const compute = () => evaluateExpression(expr, { angle, ans });

  const evaluate = () => {
    if (!expr.trim()) return;
    try {
      const value = compute();
      const result = formatResult(value);
      setHistory((prev) => [{ expr, result }, ...prev].slice(0, 4));
      setAns(value);
      setExpr(result);
      setError(null);
    } catch (err) {
      setError(err instanceof CalcError ? err.message : 'Invalid expression');
    }
  };

  // M+ / M− act on the field's value (evaluating it first), like a hand calculator.
  const addToMemory = (sign: 1 | -1) => {
    if (!expr.trim()) return;
    try {
      const value = compute();
      setMemory((current) => current + sign * value);
      setAns(value);
      setExpr(formatResult(value));
    } catch (err) {
      setError(err instanceof CalcError ? err.message : 'Invalid expression');
    }
  };

  const press = (key: Key) => {
    setError(null);
    const active = second && key.second ? key.second : null;
    if (key.kind === 'eq') evaluate();
    else if (key.kind === 'clear') setExpr('');
    else if (key.kind === 'back') setExpr((value) => value.slice(0, -1));
    else if (key.label === '2nd') setSecond((value) => !value);
    else if (key.label === 'DEG') setAngle((value) => (value === 'deg' ? 'rad' : 'deg'));
    else if (key.label === 'MC') setMemory(0);
    else if (key.label === 'MR') setExpr((value) => value + formatResult(memory));
    else if (key.label === 'M+') addToMemory(1);
    else if (key.label === 'M−') addToMemory(-1);
    else {
      setExpr((value) => value + (active?.insert ?? key.insert ?? key.label));
      // 2nd is one-shot, as on a hand calculator.
      if (active) setSecond(false);
    }
    inputRef.current?.focus();
  };

  const keyLabel = (key: Key) => {
    if (key.label === 'DEG') return angle === 'deg' ? 'DEG' : 'RAD';
    if (second && key.second) return key.second.label;
    return key.label;
  };

  return (
    <div
      role="dialog"
      aria-label="Scientific calculator"
      className="exam-panel w-[min(23rem,calc(100vw-2rem))] rounded-xl bg-[#14161b]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-md"
      // Keep typing here from paging or flagging the question behind.
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculator</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {history.length > 0 && (
        <ul className="mb-1.5 space-y-0.5 text-right text-xs tabular-nums text-muted-foreground">
          {history
            .slice()
            .reverse()
            .map((item, index) => (
              <li key={`${index}-${item.expr}`}>
                <button
                  type="button"
                  className="block w-full truncate text-right hover:text-foreground"
                  title="Use this result"
                  onClick={() => setExpr((value) => value + item.result)}
                >
                  {item.expr} = <span className="text-foreground/80">{item.result}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          evaluate();
        }}
        className="relative"
      >
        <input
          ref={inputRef}
          value={expr}
          onChange={(event) => {
            setExpr(event.target.value);
            setError(null);
          }}
          aria-label="Expression"
          aria-invalid={Boolean(error)}
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          className={cn(
            'w-full rounded-md border bg-black/30 px-3 pb-2 pt-4 text-right font-mono text-lg tabular-nums text-foreground outline-none',
            error ? 'border-red-500/60' : 'border-[rgba(214,178,110,0.22)] focus:border-[#62aef0]/60',
          )}
        />
        {/* Mode indicators, like a calculator's status line. */}
        <span className="pointer-events-none absolute left-2.5 top-1 flex gap-2 text-[10px] font-semibold tracking-wide text-muted-foreground">
          <span>{angle.toUpperCase()}</span>
          {second && <span className="text-[#d6b26e]">2ND</span>}
          {memory !== 0 && <span title={`Memory: ${formatResult(memory)}`}>M</span>}
        </span>
      </form>
      <p className="mt-1 h-4 text-right text-[11px] text-red-400" aria-live="polite">
        {error}
      </p>
      <div className="mt-1 grid grid-cols-6 gap-1.5">
        {KEYS.map((key) => {
          const toggledOn = key.label === '2nd' && second;
          return (
            <button
              key={key.label}
              type="button"
              onClick={() => press(key)}
              title={(second && key.second?.title) || key.title}
              aria-pressed={key.label === '2nd' ? second : undefined}
              aria-label={key.kind === 'back' ? 'Backspace' : key.kind === 'clear' ? 'Clear' : undefined}
              className={cn(
                'rounded-md border py-1.5 font-medium transition-colors',
                key.kind === 'num' ? 'text-sm' : 'text-xs',
                key.kind === 'eq'
                  ? 'border-[#62aef0]/50 bg-[#62aef0]/80 text-white hover:bg-[#62aef0]'
                  : toggledOn
                  ? 'border-[#d6b26e]/50 bg-[#d6b26e]/20 text-[#e7c98d]'
                  : key.kind === 'num'
                  ? 'border-white/10 bg-black/30 text-foreground hover:bg-white/10'
                  : key.kind === 'toggle' || key.kind === 'mem'
                  ? 'border-white/5 bg-transparent text-muted-foreground hover:bg-white/10 hover:text-foreground'
                  : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/10 hover:text-foreground',
                second && key.second && 'text-[#e7c98d]',
              )}
            >
              {key.kind === 'back' ? <Delete className="mx-auto h-4 w-4" /> : keyLabel(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
