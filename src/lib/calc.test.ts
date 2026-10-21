import { expect, test } from 'bun:test';
import { CalcError, evaluateExpression, formatResult } from './calc';

const calc = (input: string) => formatResult(evaluateExpression(input));

test('respects precedence, parentheses and unary minus', () => {
  expect(calc('2 + 3 * 4')).toBe('14');
  expect(calc('(2 + 3) * 4')).toBe('20');
  expect(calc('-3^2')).toBe('-9');
  expect(calc('2^3^2')).toBe('512');
  expect(calc('10 % 4')).toBe('2');
});

test('handles functions, constants, implicit multiplication and symbols', () => {
  expect(calc('sqrt(16) + ln(e)')).toBe('5');
  expect(calc('log(1000)')).toBe('3');
  expect(calc('2pi')).toBe(formatResult(2 * Math.PI));
  expect(calc('3(4+1)')).toBe('15');
  expect(calc('6 × 7 ÷ 2')).toBe('21');
  expect(calc('√9')).toBe('3');
});

test('scientific functions, angle modes, factorial, nCr and ans', () => {
  const deg = (input: string) => formatResult(evaluateExpression(input, { angle: 'deg' }));
  expect(deg('sin(30)')).toBe('0.5');
  expect(deg('sin(180)')).toBe('0');
  expect(deg('asin(1)')).toBe('90');
  expect(calc('cos(pi)')).toBe('-1');
  expect(calc('5!')).toBe('120');
  expect(calc('3!^2')).toBe('36');
  expect(calc('nCr(5,2)')).toBe('10');
  expect(calc('nPr(5,2)')).toBe('20');
  expect(calc('root(27,3)')).toBe('3');
  expect(calc('∛(-8)')).toBe('-2');
  expect(calc('log2(8) + 10 mod 4')).toBe('5');
  expect(formatResult(evaluateExpression('ans*2', { ans: 21 }))).toBe('42');
  expect(() => evaluateExpression('ans')).toThrow(CalcError);
  expect(() => evaluateExpression('2.5!')).toThrow(CalcError);
});

test('rounds float noise', () => {
  expect(calc('0.1 + 0.2')).toBe('0.3');
  expect(calc('((39-41)/40)/((840-760)/800)')).toBe('-0.5');
});

test('rejects malformed or non-finite input', () => {
  for (const bad of ['', '2 +', '(1', 'foo(2)', '1/0', '2 $ 3', 'alert(1)']) {
    expect(() => evaluateExpression(bad)).toThrow(CalcError);
  }
});
