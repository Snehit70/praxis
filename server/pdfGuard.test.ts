import { describe, expect, test } from 'bun:test';
import { parseBypassUserIds, parseEnvFlag } from './pdfGuard';

describe('pdf guard env parsing', () => {
  test('treats off/false/0 as disabled', () => {
    expect(parseEnvFlag('off', true)).toBe(false);
    expect(parseEnvFlag('FALSE', true)).toBe(false);
    expect(parseEnvFlag('0', true)).toBe(false);
  });

  test('empty env keeps the fallback', () => {
    expect(parseEnvFlag(undefined, true)).toBe(true);
    expect(parseEnvFlag('  ', false)).toBe(false);
  });

  test('splits clerk ids and drops blanks', () => {
    expect([...parseBypassUserIds(' user_a, user_b ,,user_c ')]).toEqual([
      'user_a',
      'user_b',
      'user_c',
    ]);
    expect(parseBypassUserIds(undefined).size).toBe(0);
  });
});
