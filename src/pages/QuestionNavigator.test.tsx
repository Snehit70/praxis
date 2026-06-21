import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuestionNavigator } from './PaperPage';
import type { PracticeRunPageState, PracticeRunReviewState } from '@/lib/practiceRun';

const baseProps = {
  flagged: [false, false, false],
  flaggedCount: 0,
  currentIndex: 0,
  onJump: () => {},
  onJumpNextFlagged: () => {},
};

const states: PracticeRunPageState[] = ['done', 'partial', 'none'];

test('run mode colours by progress and shows the progress legend', () => {
  render(<QuestionNavigator {...baseProps} states={states} />);

  expect(screen.getByRole('heading')).toHaveTextContent('Questions');
  expect(screen.getByText('1/3 done')).toBeInTheDocument();
  expect(screen.getByText('Answered')).toBeInTheDocument();
  expect(screen.getByText('Partial')).toBeInTheDocument();
  expect(screen.getByText('Unanswered')).toBeInTheDocument();
  // Outcome legend and the next-incorrect jump belong to review mode only.
  expect(screen.queryByText('Correct')).not.toBeInTheDocument();
  expect(screen.queryByText(/Next incorrect/)).not.toBeInTheDocument();
});

test('review mode switches to outcome heading, counter, and legend', () => {
  const reviewStates: PracticeRunReviewState[] = ['correct', 'incorrect', 'unanswered'];
  render(
    <QuestionNavigator
      {...baseProps}
      states={states}
      reviewStates={reviewStates}
      incorrectCount={1}
      onJumpNextIncorrect={() => {}}
    />,
  );

  expect(screen.getByRole('heading')).toHaveTextContent('Review');
  // One correct of three gradable pages — only 'manual' pages are excluded, so
  // the unanswered/skipped page still counts toward the denominator.
  expect(screen.getByText('1/3 correct')).toBeInTheDocument();
  expect(screen.getByText('Correct')).toBeInTheDocument();
  expect(screen.getByText('Incorrect')).toBeInTheDocument();
  expect(screen.getByText('Skipped')).toBeInTheDocument();
  // Progress-legend terms are gone.
  expect(screen.queryByText('Answered')).not.toBeInTheDocument();
});

test('review cells carry correctness colours and accessible labels', () => {
  const reviewStates: PracticeRunReviewState[] = ['correct', 'incorrect', 'unanswered'];
  render(
    <QuestionNavigator
      {...baseProps}
      states={states}
      reviewStates={reviewStates}
      incorrectCount={1}
      onJumpNextIncorrect={() => {}}
    />,
  );

  const correctCell = screen.getByRole('button', { name: 'Go to question 1, correct' });
  const incorrectCell = screen.getByRole('button', { name: 'Go to question 2, incorrect' });
  const skippedCell = screen.getByRole('button', { name: 'Go to question 3, skipped' });

  expect(correctCell.className).toContain('emerald');
  expect(incorrectCell.className).toContain('red');
  expect(skippedCell.className).toContain('text-muted-foreground');
});

test('"Next incorrect" appears only with incorrect answers and fires its handler', () => {
  const onJumpNextIncorrect = mock(() => {});
  const reviewStates: PracticeRunReviewState[] = ['correct', 'incorrect', 'unanswered'];
  render(
    <QuestionNavigator
      {...baseProps}
      states={states}
      reviewStates={reviewStates}
      incorrectCount={1}
      onJumpNextIncorrect={onJumpNextIncorrect}
    />,
  );

  const button = screen.getByText('Next incorrect (1)');
  fireEvent.click(button);
  expect(onJumpNextIncorrect).toHaveBeenCalledTimes(1);
});

test('"Next incorrect" is hidden when nothing is incorrect', () => {
  const reviewStates: PracticeRunReviewState[] = ['correct', 'correct', 'manual'];
  render(
    <QuestionNavigator
      {...baseProps}
      states={states}
      reviewStates={reviewStates}
      incorrectCount={0}
      onJumpNextIncorrect={() => {}}
    />,
  );

  expect(screen.queryByText(/Next incorrect/)).not.toBeInTheDocument();
  // A page needing manual evaluation surfaces the Manual legend entry.
  expect(screen.getByText('Manual')).toBeInTheDocument();
});
