import { expect, mock, test } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { OptionButton } from './PaperPage';

const option = { optionText: 'Paris', optionImage: null };

test('during the run an option is a live toggle reflecting selection', () => {
  const onClick = mock(() => {});
  render(
    <OptionButton
      option={option}
      optionIndex={0}
      isSelected
      isCorrect={false}
      showResults={false}
      onClick={onClick}
    />,
  );

  const button = screen.getByRole('button');
  expect(button).not.toBeDisabled();
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toHaveAccessibleName(/Option A, selected/);

  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('after submit a correct option reads as correct and locks', () => {
  render(
    <OptionButton
      option={option}
      optionIndex={0}
      isSelected={false}
      isCorrect
      showResults
      onClick={() => {}}
    />,
  );

  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button.className).toContain('green');
  expect(button).toHaveAccessibleName(/Option A, correct/);
});

test('after submit a chosen wrong option reads as incorrect', () => {
  render(
    <OptionButton
      option={option}
      optionIndex={1}
      isSelected
      isCorrect={false}
      showResults
      onClick={() => {}}
    />,
  );

  const button = screen.getByRole('button');
  expect(button.className).toContain('red');
  expect(button).toHaveAccessibleName(/Option B, selected, incorrect/);
});

test('after submit an unchosen wrong option is muted, not flagged', () => {
  render(
    <OptionButton
      option={option}
      optionIndex={2}
      isSelected={false}
      isCorrect={false}
      showResults
      onClick={() => {}}
    />,
  );

  const button = screen.getByRole('button');
  expect(button.className).toContain('opacity-50');
  // No correct/incorrect verdict appended to the label.
  expect(button).toHaveAccessibleName('Option C');
});

test('a click is ignored once results are shown (button is disabled)', () => {
  const onClick = mock(() => {});
  render(
    <OptionButton
      option={option}
      optionIndex={0}
      isSelected={false}
      isCorrect
      showResults
      onClick={onClick}
    />,
  );

  fireEvent.click(screen.getByRole('button'));
  expect(onClick).not.toHaveBeenCalled();
});

test('renders a fallback when an option has neither text nor image', () => {
  render(
    <OptionButton
      option={{ optionText: '', optionImage: null }}
      optionIndex={3}
      isSelected={false}
      isCorrect={false}
      showResults={false}
      onClick={() => {}}
    />,
  );

  expect(screen.getByText(/Option content unavailable/i)).toBeInTheDocument();
});
