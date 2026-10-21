import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { PdfDownloadDialog } from './PdfDownloadDialog';

test('working dialog shows progress state and a hide control', () => {
  const onHide = mock(() => {});
  render(
    <PdfDownloadDialog
      open
      onOpenChange={() => {}}
      answers={false}
      phase="working"
      elapsedMs={8_000}
      onRetry={() => {}}
      onHide={onHide}
    />,
  );

  expect(screen.getByRole('dialog', { name: /preparing your question paper/i })).toBeTruthy();
  expect(screen.getByLabelText('Preparing PDF')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('error dialog surfaces the server message and retry', () => {
  const onRetry = mock(() => {});
  render(
    <PdfDownloadDialog
      open
      onOpenChange={() => {}}
      answers
      phase="error"
      elapsedMs={4_000}
      error="The PDF renderer is busy. Try again in a moment."
      retryAfterSeconds={12}
      onRetry={onRetry}
      onHide={() => {}}
    />,
  );

  expect(screen.getByText(/could not build the pdf/i)).toBeTruthy();
  expect(screen.getByText(/renderer is busy/i)).toBeTruthy();
  expect(screen.getByText(/retry in 12s/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
});
