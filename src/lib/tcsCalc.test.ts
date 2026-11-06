import { expect, test } from 'bun:test';
import { expressionLine, formatNumber, initialState, press, type CalcKey, type CalcState } from './tcsCalc';

// Key script: digits and '.', operators, and named keys in braces.
const NAMED: Record<string, CalcKey> = {
  '(': { type: 'open' },
  ')': { type: 'close' },
  '=': { type: 'equals' },
  '<': { type: 'back' },
  '+': { type: 'binary', op: '+' },
  '-': { type: 'binary', op: '-' },
  '*': { type: 'binary', op: '*' },
  '/': { type: 'binary', op: '/' },
  '%': { type: 'binary', op: '%' },
  '{mod}': { type: 'binary', op: 'mod' },
  '{pow}': { type: 'binary', op: 'pow' },
  '{yroot}': { type: 'binary', op: 'yroot' },
  '{logy}': { type: 'binary', op: 'logy' },
  '{exp}': { type: 'binary', op: 'exp' },
  '{pi}': { type: 'const', name: 'pi' },
  '{C}': { type: 'clear' },
  '{rad}': { type: 'angle', angle: 'rad' },
  '{MS}': { type: 'memory', op: 'MS' },
  '{M+}': { type: 'memory', op: 'M+' },
  '{M-}': { type: 'memory', op: 'M-' },
  '{MR}': { type: 'memory', op: 'MR' },
  '{MC}': { type: 'memory', op: 'MC' },
};
const UNARY = ['sin', 'cos', 'tan', 'asin', 'sqrt', 'cbrt', 'fact', 'square', 'recip', 'negate', 'log', 'ln', 'log2', 'abs'];

function run(script: string, from: CalcState = initialState()): CalcState {
  const keys = script.match(/\{[^}]+\}|./g) ?? [];
  return keys.reduce((state, raw) => {
    if (/^[0-9.]$/.test(raw)) return press(state, { type: 'digit', digit: raw });
    const name = raw.slice(1, -1);
    if (UNARY.includes(name)) return press(state, { type: 'unary', fn: name as never });
    const key = NAMED[raw];
    if (!key) throw new Error(`unknown key ${raw}`);
    return press(state, key);
  }, from);
}

test('respects operator precedence and shows the expression', () => {
  const state = run('2+3*4=');
  expect(state.entry).toBe('14');
  expect(expressionLine(state)).toBe('2+3*4');
});

test('shows the running value as operators close off terms', () => {
  expect(run('2+3*').entry).toBe('3');
  expect(run('2*3+').entry).toBe('6');
  expect(run('2+3*4-').entry).toBe('14');
});

test('a second operator replaces the first', () => {
  const state = run('5+*2=');
  expect(state.entry).toBe('10');
  expect(expressionLine(state)).toBe('5*2');
});

test('functions act on the display at once and nest on the expression line', () => {
  let state = run('30{sin}');
  expect(state.entry).toBe('0.5');
  expect(expressionLine(state)).toBe('sind(30)');
  state = run('{sqrt}', state);
  expect(expressionLine(state)).toBe('sqrt(sind(30))');
  state = run('2+9{sqrt}=');
  expect(state.entry).toBe('5');
  expect(expressionLine(state)).toBe('2+sqrt(9)');
});

test('typing after a function replaces its term', () => {
  const state = run('2+9{sqrt}4=');
  expect(state.entry).toBe('6');
});

test('trig is exact at quarter turns and respects Deg/Rad', () => {
  expect(run('180{sin}').entry).toBe('0');
  expect(run('90{cos}').entry).toBe('0');
  expect(run('90{tan}').entry).toBe('Math Error');
  expect(run('{rad}{pi}{cos}').entry).toBe('-1');
  expect(run('1{asin}').entry).toBe('90');
});

test('brackets group and auto-close on =', () => {
  expect(run('(2+3)*4=').entry).toBe('20');
  expect(expressionLine(run('(2+3)*4='))).toBe('(2+3)*4');
  expect(run('2*(3+4=').entry).toBe('14');
  expect(run('2(3+4)=').entry).toBe('14');
});

test('binary scientific operators', () => {
  expect(run('7{mod}3=').entry).toBe('1');
  expect(run('2{pow}10=').entry).toBe('1024');
  expect(run('27{yroot}3=').entry).toBe('3');
  expect(run('8{logy}2=').entry).toBe('3');
  expect(run('2.5{exp}3=').entry).toBe('2500');
  expect(run('50%20=').entry).toBe('10');
});

test('factorial, including non-integers and overflow', () => {
  expect(run('5{fact}').entry).toBe('120');
  expect(run('.5{fact}').entry).toMatch(/^0\.88622692545/);
  expect(run('171{fact}').entry).toBe('Infinity');
});

test('entry is limited to nine characters and one dot', () => {
  expect(run('1234567890').entry).toBe('123456789');
  expect(run('1.2.3').entry).toBe('1.23');
});

test('backspace edits only a typed number', () => {
  expect(run('123<').entry).toBe('12');
  expect(run('5<').entry).toBe('0');
  expect(run('9{sqrt}<').entry).toBe('3');
});

test('+/- flips a typed number in place', () => {
  expect(run('12{negate}3').entry).toBe('-123');
  expect(run('12{negate}+5=').entry).toBe('-7');
});

test('memory keys', () => {
  let state = run('5{MS}{C}3{M+}{C}{MR}');
  expect(state.entry).toBe('8');
  state = run('2{M-}{MR}', state);
  expect(state.entry).toBe('6');
  state = run('{MC}', state);
  expect(state.memory).toBeNull();
  // A stored number is final: the next digit starts a new one.
  expect(run('5{MS}7').entry).toBe('7');
});

test('after = digits start over and operators continue from the result', () => {
  expect(run('2+3=4').entry).toBe('4');
  expect(expressionLine(run('2+3=4'))).toBe('');
  const state = run('2+3=*2=');
  expect(state.entry).toBe('10');
  expect(expressionLine(state)).toBe('5*2');
});

test('an error locks the keys until C', () => {
  let state = run('1/0=');
  expect(state.entry).toBe('Infinity');
  state = run('5+', state);
  expect(state.entry).toBe('Infinity');
  state = run('{C}5', state);
  expect(state.entry).toBe('5');
});

test('display rounding trims float noise only', () => {
  expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  expect(formatNumber(1 / 3)).toBe('0.3333333333333333');
  expect(formatNumber(-0)).toBe('0');
  expect(formatNumber(1e-9)).toBe('1e-9');
});
