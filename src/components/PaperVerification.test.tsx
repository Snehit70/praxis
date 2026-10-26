import { afterEach, expect, mock, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PaperVerification } from './PaperVerification';

const browser = window as Window & { turnstile?: {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
} };
afterEach(() => { cleanup(); delete browser.turnstile; });

test('binds verification to the paper-access action and account, then cleans up its widget', async () => {
  let settings: Record<string, unknown> = {};
  const remove = mock(() => {});
  browser.turnstile = { render: (_element, options) => { settings = options; return 'widget-1'; }, remove };
  const onVerified = mock(() => {});
  const view = render(<PaperVerification siteKey="site-key" binding="account-binding" onVerified={onVerified} onBack={() => {}} />);
  await act(async () => { await Promise.resolve(); });
  expect(settings.sitekey).toBe('site-key');
  expect(settings.action).toBe('paper-access');
  expect(settings.cData).toBe('account-binding');
  act(() => { (settings.callback as (token: string) => void)('single-use-token'); });
  expect(onVerified).toHaveBeenCalledWith('single-use-token');
  view.unmount();
  expect(remove).toHaveBeenCalledWith('widget-1');
});

test('expired verification offers recovery and back navigation without starting a run', async () => {
  let settings: Record<string, unknown> = {};
  browser.turnstile = { render: (_element, options) => { settings = options; return 'widget-1'; }, remove: () => {} };
  const onBack = mock(() => {});
  const onVerified = mock(() => {});
  render(<PaperVerification siteKey="site-key" binding="account-binding" onVerified={onVerified} onBack={onBack} />);
  await act(async () => { await Promise.resolve(); });
  act(() => { (settings['expired-callback'] as () => void)(); });
  expect(screen.getByRole('alert').textContent).toContain('expired');
  expect(screen.getByRole('button', { name: 'Retry verification' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onVerified).not.toHaveBeenCalled();
});
