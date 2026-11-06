/**
 * Engine for the on-screen scientific calculator, matching how the TCS iON
 * exam calculator behaves so practice feels like the real thing:
 *
 * - Numbers are typed into the main display (at most 9 characters).
 * - Function keys (sin, √, n!, …) act on the displayed number at once and the
 *   expression line shows the term, e.g. `sind(30)`; pressing another function
 *   wraps it: `sqrt(sind(30))`.
 * - Operator keys queue the number and the operator on the expression line;
 *   `=` evaluates the whole line with the usual precedence.
 * - Deg/Rad, memory (MC MR MS M+ M−), backspace and C as on the original.
 *
 * Written from the original's observable behaviour; no code is shared with it.
 * Pure: `press(state, key)` returns the next state.
 */

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | 'mod' | 'pow' | 'yroot' | 'logy' | 'exp';

export type UnaryFn =
  | 'sinh' | 'cosh' | 'tanh' | 'asinh' | 'acosh' | 'atanh'
  | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan'
  | 'log2' | 'ln' | 'log' | 'fact' | 'expx' | 'pow10'
  | 'sqrt' | 'cbrt' | 'abs' | 'square' | 'cube' | 'recip' | 'negate';

export type CalcKey =
  | { type: 'digit'; digit: string }
  | { type: 'const'; name: 'pi' | 'e' }
  | { type: 'unary'; fn: UnaryFn }
  | { type: 'binary'; op: BinaryOp }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'equals' }
  | { type: 'back' }
  | { type: 'clear' }
  | { type: 'memory'; op: 'MC' | 'MR' | 'MS' | 'M+' | 'M-' }
  | { type: 'angle'; angle: 'deg' | 'rad' };

interface Operand {
  value: number;
  /** How the operand reads on the expression line. */
  show: string;
  /** A function term or bracket group, shown on the expression line before an operator is pressed. */
  term: boolean;
}

type Token = { t: 'num'; value: number; show: string } | { t: 'op'; op: BinaryOp } | { t: 'open' };

export interface CalcState {
  tokens: Token[];
  /** The main display. */
  entry: string;
  /** A computed value standing in for the typed entry (function result, group, constant, MR). */
  operand: Operand | null;
  /** The person is typing digits, so backspace and +/- edit the entry. */
  typing: boolean;
  /** The next digit starts a new number. */
  fresh: boolean;
  /** After `=`: the finished expression, kept on the expression line. */
  done: string | null;
  error: boolean;
  angle: 'deg' | 'rad';
  memory: number | null;
}

export const MAX_ENTRY = 9;
export const MATH_ERROR = 'Math Error';

export function initialState(): CalcState {
  return {
    tokens: [],
    entry: '0',
    operand: null,
    typing: false,
    fresh: true,
    done: null,
    error: false,
    angle: 'deg',
    memory: null,
  };
}

/** Display rounding: trims float noise (0.1+0.2 → 0.3) but keeps genuine long decimals (1/3). */
export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return MATH_ERROR;
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
  if (Object.is(value, -0) || value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude < 1e-8 || magnitude > 1e8) return String(value);
  if (Number(value.toFixed(8)) % 1 === 0) return value.toFixed(0);
  // Shortest fixed form whose next eight digits are all zero.
  for (let places = 1; places < 10; places += 1) {
    const short = Number(value.toFixed(places));
    if (short !== 0 && short === Number(value.toFixed(places + 8))) return String(short);
  }
  return String(value);
}

// Multiples of a quarter turn, where the float result should be exact.
function quarterTurns(x: number, angle: 'deg' | 'rad'): number | null {
  const k = angle === 'deg' ? x / 90 : x / (Math.PI / 2);
  const nearest = Math.round(k);
  return Math.abs(k - nearest) < 1e-9 ? nearest : null;
}

const toRadians = (x: number, angle: 'deg' | 'rad') => (angle === 'deg' ? (x * Math.PI) / 180 : x);
const fromRadians = (x: number, angle: 'deg' | 'rad') => (angle === 'deg' ? (x * 180) / Math.PI : x);
const mod = (a: number, n: number) => ((a % n) + n) % n;

// Lanczos approximation, for factorials of non-integers.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const n = z - 1;
  const sum = LANCZOS.reduce((total, coefficient, i) => (i === 0 ? coefficient : total + coefficient / (n + i)), 0);
  const t = n + 7.5;
  return Math.sqrt(2 * Math.PI) * t ** (n + 0.5) * Math.exp(-t) * sum;
}

function factorial(n: number): number {
  if (n < 0) return Number.NaN;
  if (n > 170) return Number.POSITIVE_INFINITY;
  if (!Number.isInteger(n)) return gamma(n + 1);
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

/** x^(1/n), with real odd roots of negatives (∛−8 = −2). */
function nthRoot(x: number, n: number): number {
  if (x < 0 && Number.isInteger(n) && Math.abs(n) % 2 === 1) return -((-x) ** (1 / n));
  return x ** (1 / n);
}

export function applyUnary(fn: UnaryFn, x: number, angle: 'deg' | 'rad'): number {
  switch (fn) {
    case 'sin': {
      const k = quarterTurns(x, angle);
      if (k !== null) return [0, 1, 0, -1][mod(k, 4)] ?? 0;
      return Math.sin(toRadians(x, angle));
    }
    case 'cos': {
      const k = quarterTurns(x, angle);
      if (k !== null) return [1, 0, -1, 0][mod(k, 4)] ?? 0;
      return Math.cos(toRadians(x, angle));
    }
    case 'tan': {
      const k = quarterTurns(x, angle);
      if (k !== null) return k % 2 === 0 ? 0 : Number.NaN;
      return Math.tan(toRadians(x, angle));
    }
    case 'asin': return fromRadians(Math.asin(x), angle);
    case 'acos': return fromRadians(Math.acos(x), angle);
    case 'atan': return fromRadians(Math.atan(x), angle);
    case 'sinh': return Math.sinh(x);
    case 'cosh': return Math.cosh(x);
    case 'tanh': return Math.tanh(x);
    case 'asinh': return Math.asinh(x);
    case 'acosh': return Math.acosh(x);
    case 'atanh': return Math.atanh(x);
    case 'log2': return Math.log2(x);
    case 'ln': return Math.log(x);
    case 'log': return Math.log10(x);
    case 'fact': return factorial(x);
    case 'expx': return Math.exp(x);
    case 'pow10': return 10 ** x;
    case 'sqrt': return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'abs': return Math.abs(x);
    case 'square': return x * x;
    case 'cube': return x * x * x;
    case 'recip': return 1 / x;
    case 'negate': return -x;
  }
}

function applyBinary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return (a / 100) * b;
    case 'mod': return a % b;
    case 'pow': return a ** b;
    case 'yroot': return nthRoot(a, b);
    case 'logy': return Math.log(a) / Math.log(b);
    case 'exp': return a * 10 ** b;
  }
}

const PRECEDENCE: Record<BinaryOp, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, mod: 2, pow: 3, yroot: 3, logy: 3, exp: 3,
};

// Names as the expression line prints them; trig carries the angle unit (sind, sinr).
const UNARY_SHOW: Record<UnaryFn, string> = {
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh',
  sin: 'sin', cos: 'cos', tan: 'tan', asin: 'asin', acos: 'acos', atan: 'atan',
  log2: 'logXbase2', ln: 'ln', log: 'log', fact: 'fact', expx: 'powe', pow10: 'powten',
  sqrt: 'sqrt', cbrt: 'cuberoot', abs: 'abs', square: 'sqr', cube: 'cube', recip: 'reciproc', negate: 'negate',
};
const ANGLED = new Set<UnaryFn>(['sin', 'cos', 'tan', 'asin', 'acos', 'atan']);

const BINARY_SHOW: Record<BinaryOp, string> = {
  '+': '+', '-': '-', '*': '*', '/': '/', '%': '%', mod: ' mod ', pow: '^', yroot: ' yroot ', logy: ' logxBasey ', exp: 'e+',
};

/** Evaluate `[num, op, num, …]` with precedence; `pow` groups right to left. */
function evaluateFlat(items: Array<number | BinaryOp>): number {
  const values: number[] = [];
  const ops: BinaryOp[] = [];
  const reduce = () => {
    const b = values.pop()!;
    const a = values.pop()!;
    values.push(applyBinary(ops.pop()!, a, b));
  };
  for (const item of items) {
    if (typeof item === 'number') {
      values.push(item);
      continue;
    }
    for (let top = ops.at(-1); top; top = ops.at(-1)) {
      const higher = PRECEDENCE[top] > PRECEDENCE[item] || (PRECEDENCE[top] === PRECEDENCE[item] && item !== 'pow');
      if (!higher) break;
      reduce();
    }
    ops.push(item);
  }
  while (ops.length) reduce();
  return values[0] ?? 0;
}

function lastOpenIndex(tokens: Token[]): number {
  for (let i = tokens.length - 1; i >= 0; i -= 1) if (tokens[i]?.t === 'open') return i;
  return -1;
}

const flatten = (tokens: Token[]): Array<number | BinaryOp> =>
  tokens.flatMap((token): Array<number | BinaryOp> => (token.t === 'num' ? [token.value] : token.t === 'op' ? [token.op] : []));

const showTokens = (tokens: Token[]) =>
  tokens.map((token) => (token.t === 'num' ? token.show : token.t === 'op' ? BINARY_SHOW[token.op] : '(')).join('');

function currentValue(state: CalcState): number {
  return state.operand ? state.operand.value : Number(state.entry);
}

function currentShow(state: CalcState): string {
  return state.operand ? state.operand.show : formatNumber(Number(state.entry));
}

/** The expression line above the main display. */
export function expressionLine(state: CalcState): string {
  if (state.done !== null) return state.done;
  return showTokens(state.tokens) + (state.operand?.term ? state.operand.show : '');
}

function withResult(state: CalcState, value: number, operand: Omit<Operand, 'value'>): CalcState {
  const entry = formatNumber(value);
  const error = !Number.isFinite(value);
  return { ...state, entry, error, operand: { value, ...operand }, typing: false, fresh: true };
}

// After `=`, the next key either starts afresh (digits) or continues from the result.
function continueFromResult(state: CalcState): CalcState {
  if (state.done === null) return state;
  return { ...state, done: null, tokens: [] };
}

export function press(state: CalcState, key: CalcKey): CalcState {
  if (key.type === 'clear') return { ...initialState(), angle: state.angle, memory: state.memory };
  if (key.type === 'angle') return { ...state, angle: key.angle };
  // An error freezes the calculator until C, as on the original.
  if (state.error) return state;

  switch (key.type) {
    case 'digit': {
      const next = continueFromResult(state);
      let entry = next.fresh ? '0' : next.entry;
      if (key.digit === '.') {
        if (entry.includes('.')) return next;
        entry = `${entry}.`;
      } else {
        entry = entry === '0' ? key.digit : entry === '-0' ? `-${key.digit}` : entry + key.digit;
      }
      if (entry.length > MAX_ENTRY) return next;
      return { ...next, entry, operand: null, typing: true, fresh: false };
    }

    case 'const': {
      const value = key.name === 'pi' ? Math.PI : Math.E;
      return withResult(continueFromResult(state), value, { show: formatNumber(value), term: false });
    }

    case 'unary': {
      const x = currentValue(state);
      const next = continueFromResult(state);
      if (key.fn === 'negate' && state.typing) {
        const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`;
        return { ...next, entry };
      }
      const inner = state.operand?.term ? state.operand.show : currentShow(state);
      const name = UNARY_SHOW[key.fn] + (ANGLED.has(key.fn) ? (state.angle === 'deg' ? 'd' : 'r') : '');
      return withResult(next, applyUnary(key.fn, x, state.angle), { show: `${name}(${inner})`, term: true });
    }

    case 'binary': {
      const next = continueFromResult(state);
      const last = next.tokens[next.tokens.length - 1];
      // A second operator in a row replaces the first.
      if (last?.t === 'op' && next.fresh && !next.operand) {
        return { ...next, tokens: [...next.tokens.slice(0, -1), { t: 'op', op: key.op }] };
      }
      const tokens: Token[] = [...next.tokens, { t: 'num', value: currentValue(state), show: currentShow(state) }];
      // Show the value of the part of the line this operator closes off.
      const groupStart = lastOpenIndex(tokens) + 1;
      let start = tokens.length - 1;
      while (start - 2 >= groupStart) {
        const op = tokens[start - 1];
        if (op?.t !== 'op' || PRECEDENCE[op.op] < PRECEDENCE[key.op]) break;
        start -= 2;
      }
      const shown = evaluateFlat(flatten(tokens.slice(start)));
      return {
        ...next,
        tokens: [...tokens, { t: 'op', op: key.op }],
        entry: formatNumber(shown),
        error: !Number.isFinite(shown),
        operand: null,
        typing: false,
        fresh: true,
      };
    }

    case 'open': {
      const next = continueFromResult(state);
      const tokens = [...next.tokens];
      // A number already standing before "(" multiplies the group: 2(3+4).
      if (state.done === null && (state.typing || state.operand)) {
        tokens.push({ t: 'num', value: currentValue(state), show: currentShow(state) }, { t: 'op', op: '*' });
      }
      tokens.push({ t: 'open' });
      return { ...next, tokens, entry: '0', operand: null, typing: false, fresh: true };
    }

    case 'close': {
      const open = lastOpenIndex(state.tokens);
      if (open < 0 || state.done !== null) return state;
      const inner: Token[] = [...state.tokens.slice(open + 1), { t: 'num', value: currentValue(state), show: currentShow(state) }];
      const value = evaluateFlat(flatten(inner));
      return withResult({ ...state, tokens: state.tokens.slice(0, open) }, value, {
        show: `(${showTokens(inner)})`,
        term: true,
      });
    }

    case 'equals': {
      if (state.done !== null) return state;
      let tokens: Token[] = [...state.tokens, { t: 'num', value: currentValue(state), show: currentShow(state) }];
      let line = showTokens(tokens);
      // Close any brackets left open.
      for (let open = lastOpenIndex(tokens); open >= 0; open = lastOpenIndex(tokens)) {
        const value = evaluateFlat(flatten(tokens.slice(open + 1)));
        tokens = [...tokens.slice(0, open), { t: 'num', value, show: '' }];
        line += ')';
      }
      const value = evaluateFlat(flatten(tokens));
      return {
        ...withResult({ ...state, tokens: [] }, value, { show: formatNumber(value), term: false }),
        done: line,
      };
    }

    case 'back': {
      if (!state.typing) return state;
      let entry = state.entry.slice(0, -1);
      if (entry === '' || entry === '-') entry = '0';
      return { ...state, entry };
    }

    case 'memory': {
      const x = currentValue(state);
      switch (key.op) {
        case 'MC': return { ...state, memory: null };
        case 'MS': return settle({ ...state, memory: x });
        case 'M+': return settle({ ...state, memory: (state.memory ?? 0) + x });
        case 'M-': return settle({ ...state, memory: (state.memory ?? 0) - x });
        case 'MR': {
          const value = state.memory ?? 0;
          return withResult(continueFromResult(state), value, { show: formatNumber(value), term: false });
        }
      }
    }
  }
}

// After a memory store, the displayed number is final: typing starts a new one.
function settle(state: CalcState): CalcState {
  if (state.operand) return { ...state, typing: false, fresh: true };
  const value = Number(state.entry);
  return { ...state, operand: { value, show: formatNumber(value), term: false }, typing: false, fresh: true };
}
