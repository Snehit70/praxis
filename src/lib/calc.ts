/**
 * Safe arithmetic evaluator for the in-exam scientific calculator. A small
 * recursive-descent parser — never `eval` — over numbers, + - * / ^ % (mod),
 * postfix !, parentheses, unary minus, the constants pi / e / ans and a set of
 * one- and two-argument functions. Throws `CalcError` on bad input.
 */

export class CalcError extends Error {}

export type AngleMode = 'deg' | 'rad';

export interface EvaluateOptions {
  /** Unit for sin/cos/tan and their inverses. Defaults to radians. */
  angle?: AngleMode;
  /** Value of `ans` — the previous result. */
  ans?: number;
}

// Trig results this close to zero are float noise (sin 180° = 1.2e-16).
const snap = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x);

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('n! needs a whole number ≥ 0');
  if (n > 170) throw new CalcError('Number too large');
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function combinations(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < r) throw new CalcError('nCr needs whole numbers, n ≥ r ≥ 0');
  let result = 1;
  for (let i = 1; i <= Math.min(r, n - r); i += 1) result = (result * (n - i + 1)) / i;
  return Math.round(result);
}

function permutations(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < r) throw new CalcError('nPr needs whole numbers, n ≥ r ≥ 0');
  let result = 1;
  for (let i = 0; i < r; i += 1) result *= n - i;
  return result;
}

function buildFunctions(angle: AngleMode): Record<string, (...args: number[]) => number> {
  const toRad = angle === 'deg' ? (x: number) => (x * Math.PI) / 180 : (x: number) => x;
  const fromRad = angle === 'deg' ? (x: number) => (x * 180) / Math.PI : (x: number) => x;
  return {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    exp: Math.exp,
    abs: Math.abs,
    sin: (x) => snap(Math.sin(toRad(x))),
    cos: (x) => snap(Math.cos(toRad(x))),
    tan: (x) => snap(Math.tan(toRad(x))),
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    ncr: combinations,
    npr: permutations,
    root: (x, n = 2) => (x < 0 && n % 2 === 1 ? -((-x) ** (1 / n)) : x ** (1 / n)),
  };
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const src = input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/∛/g, 'cbrt')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/\bmod\b/gi, '%');
  let i = 0;
  while (i < src.length) {
    const ch = src.charAt(i);
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9.]/.test(ch)) {
      const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!match) throw new CalcError('Bad number');
      tokens.push({ kind: 'num', value: Number(match[0]) });
      i += match[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const match = /^(log2|[a-z]+)/i.exec(src.slice(i))!;
      tokens.push({ kind: 'id', value: match[0].toLowerCase() });
      i += match[0].length;
    } else if ('+-*/^%()!,'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
    } else {
      throw new CalcError(`Unexpected "${ch}"`);
    }
  }
  return tokens;
}

export function evaluateExpression(input: string, options: EvaluateOptions = {}): number {
  const functions = buildFunctions(options.angle ?? 'rad');
  const constants: Record<string, number> = { pi: Math.PI, e: Math.E };
  if (options.ans !== undefined) constants.ans = options.ans;

  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => {
    const token = peek();
    return token?.kind === 'op' && token.value === value;
  };

  // expr := term (('+' | '-') term)*
  const expr = (): number => {
    let value = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { value: string }).value;
      const rhs = term();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  // term := unary (('*' | '/' | '%') unary | implicit-multiply)*
  const term = (): number => {
    let value = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('%')) {
        const op = (tokens[pos++] as { value: string }).value;
        const rhs = unary();
        if (op === '*') value *= rhs;
        else if (op === '/') value /= rhs;
        else value %= rhs;
      } else if (peek() && (peek()?.kind !== 'op' || isOp('('))) {
        // "2pi", "3(4+1)", "2sqrt(9)"
        value *= unary();
      } else {
        return value;
      }
    }
  };

  // unary := '-' unary | '+' unary | power
  const unary = (): number => {
    if (isOp('-')) {
      pos += 1;
      return -unary();
    }
    if (isOp('+')) {
      pos += 1;
      return unary();
    }
    return power();
  };

  // power := postfix ('^' unary)?   — right-associative
  const power = (): number => {
    const base = postfix();
    if (isOp('^')) {
      pos += 1;
      return base ** unary();
    }
    return base;
  };

  // postfix := primary '!'*
  const postfix = (): number => {
    let value = primary();
    while (isOp('!')) {
      pos += 1;
      value = factorial(value);
    }
    return value;
  };

  const primary = (): number => {
    const token = tokens[pos++];
    if (!token) throw new CalcError('Incomplete expression');
    if (token.kind === 'num') return token.value;
    if (token.kind === 'op' && token.value === '(') {
      const value = expr();
      if (!isOp(')')) throw new CalcError('Missing )');
      pos += 1;
      return value;
    }
    if (token.kind === 'id') {
      const constant = constants[token.value];
      if (constant !== undefined) return constant;
      const fn = functions[token.value];
      if (!fn) throw new CalcError(token.value === 'ans' ? 'No previous answer' : `Unknown "${token.value}"`);
      // fn(a, b, …) with an argument list, or fn x applied to the next power.
      if (isOp('(')) {
        pos += 1;
        const args = [expr()];
        while (isOp(',')) {
          pos += 1;
          args.push(expr());
        }
        if (!isOp(')')) throw new CalcError('Missing )');
        pos += 1;
        return fn(...args);
      }
      return fn(power());
    }
    throw new CalcError(`Unexpected "${token.value}"`);
  };

  if (tokens.length === 0) throw new CalcError('Empty');
  const result = expr();
  if (pos < tokens.length) throw new CalcError('Unexpected input');
  if (!Number.isFinite(result)) throw new CalcError('Not a finite number');
  return result;
}

/** Round away float noise (0.1 + 0.2) without hiding real precision. */
export function formatResult(value: number): string {
  return String(Number.parseFloat(value.toPrecision(12)));
}
