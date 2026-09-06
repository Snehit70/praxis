import { expect, test } from 'bun:test';
import { filenameFromDisposition } from './api';

test('filenameFromDisposition reads a quoted attachment name', () => {
  expect(
    filenameFromDisposition('attachment; filename="DBMS-Quiz-1.pdf"', 'paper.pdf'),
  ).toBe('DBMS-Quiz-1.pdf');
});

test('filenameFromDisposition falls back when the header is missing', () => {
  expect(filenameFromDisposition(null, 'paper.pdf')).toBe('paper.pdf');
  expect(filenameFromDisposition('inline', 'paper-answers.pdf')).toBe('paper-answers.pdf');
});
