import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { PdfDownloadDialog } from './PdfDownloadDialog';

test('working dialog shows elapsed time and a hide control', () => {
  const onHide = mock(() => {});
  render(
    <PdfDownloadDialog
      open
      onOpenChange={() => {}}
      answers={false}
      phase="working"
      elapsedMs={8_000}
      progress={48}
      etaSeconds={8}
      onRetry={() => {}}
      onHide={onHide}
    />,
  );

  expect(screen.getByRole('dialog', { name: /building question paper/i })).toBeTruthy();
  expect(screen.getByText('0:08 elapsed')).toBeTruthy();
  expect(screen.getByText('about 8s left')).toBeTruthy();
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
      progress={30}
      etaSeconds={null}
      error="The PDF renderer is busy. Try again in a moment."
      retryAfterSeconds={12}
      onRetry={onRetry}
      onHide={() => {}}
    />,
  );

  expect(screen.getByText(/could not build the pdf/i)).toBeTruthy();
  expect(screen.getByText(/renderer is busy/i)).toBeTruthy();
  expect(screen.getByText('retry in 12s')).toBeTruthy();
  expect(screen.getByRole('button', { name: /try again/i })).toBeDisabled();
});
