import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResultsSummary } from './PaperPage';

const baseStats = {
  correct: 6,
  incorrect: 3,
  skipped: 1,
  gradableTotal: 10,
  scoredMarks: 12,
  totalMarks: 20,
  manualEvalCount: 0,
};

test('renders the score, percentage, and correct/incorrect/skipped breakdown', () => {
  render(<ResultsSummary stats={baseStats} onTryAgain={() => {}} />);

  expect(screen.getByText('12')).toBeInTheDocument(); // scored marks
  expect(screen.getByText(/\/ 20 marks/)).toBeInTheDocument();
  // 6 of 10 = 60%
  expect(screen.getByText(/60%/)).toBeInTheDocument();

  // Breakdown tiles carry the three counts under their labels.
  const correct = screen.getByText('Correct').closest('div') as HTMLElement;
  const incorrect = screen.getByText('Incorrect').closest('div') as HTMLElement;
  const skipped = screen.getByText('Skipped').closest('div') as HTMLElement;
  expect(within(correct).getByText('6')).toBeInTheDocument();
  expect(within(incorrect).getByText('3')).toBeInTheDocument();
  expect(within(skipped).getByText('1')).toBeInTheDocument();
});

test('"Review incorrect" shows only when there are incorrect answers and a handler', () => {
  const onReviewIncorrect = mock(() => {});
  render(
    <ResultsSummary
      stats={baseStats}
      onTryAgain={() => {}}
      onReviewIncorrect={onReviewIncorrect}
    />,
  );

  const button = screen.getByRole('button', { name: /Review incorrect/ });
  fireEvent.click(button);
  expect(onReviewIncorrect).toHaveBeenCalledTimes(1);
});

test('"Review incorrect" is hidden when nothing is incorrect', () => {
  const allCorrect = { ...baseStats, correct: 9, incorrect: 0, skipped: 1 };
  render(
    <ResultsSummary stats={allCorrect} onTryAgain={() => {}} onReviewIncorrect={() => {}} />,
  );

  expect(screen.queryByRole('button', { name: /Review incorrect/ })).not.toBeInTheDocument();
});

test('"Review incorrect" is hidden when no handler is supplied even with incorrect answers', () => {
  render(<ResultsSummary stats={baseStats} onTryAgain={() => {}} />);

  expect(screen.queryByRole('button', { name: /Review incorrect/ })).not.toBeInTheDocument();
});

test('falls back to a correct-count headline when the paper carries no marks', () => {
  const noMarks = { ...baseStats, totalMarks: 0, scoredMarks: 0 };
  render(<ResultsSummary stats={noMarks} onTryAgain={() => {}} />);

  expect(screen.getByText(/\/ 10 correct/)).toBeInTheDocument();
});

test('surfaces the time-expired auto-submit notice', () => {
  render(<ResultsSummary stats={baseStats} onTryAgain={() => {}} timeExpired />);

  expect(screen.getByText(/time expired/i)).toBeInTheDocument();
});

test('no breakdown strip when there is nothing auto-gradable', () => {
  const manualOnly = {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    gradableTotal: 0,
    scoredMarks: 0,
    totalMarks: 0,
    manualEvalCount: 2,
  };
  render(<ResultsSummary stats={manualOnly} onTryAgain={() => {}} />);

  expect(screen.queryByText('Skipped')).not.toBeInTheDocument();
  expect(screen.getByText(/require manual evaluation/i)).toBeInTheDocument();
});
