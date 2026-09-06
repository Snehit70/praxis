import { expect, test } from 'bun:test';
import { formatElapsedClock, remainingEtaSeconds, workingProgress } from './pdfDownloadProgress';

test('formatElapsedClock pads seconds', () => {
  expect(formatElapsedClock(0)).toBe('0:00');
  expect(formatElapsedClock(12_000)).toBe('0:12');
  expect(formatElapsedClock(75_000)).toBe('1:15');
});

test('workingProgress eases toward 90 and never claims 100', () => {
  expect(workingProgress(0)).toBe(0);
  expect(workingProgress(8_000)).toBeGreaterThan(40);
  expect(workingProgress(8_000)).toBeLessThan(80);
  expect(workingProgress(16_000)).toBe(90);
  expect(workingProgress(60_000)).toBe(90);
});

test('remainingEtaSeconds goes null after the typical window', () => {
  expect(remainingEtaSeconds(1_000)).toBe(15);
  expect(remainingEtaSeconds(16_000)).toBeNull();
});
