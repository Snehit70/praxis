import { afterEach, describe, expect, test } from 'bun:test';
import { ApiRequestError, getPaperByUuid, getQuestionsByPaperUuid } from './api';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('paper API authentication', () => {
  test('sends the current session token for details and questions and keeps cancellation', async () => {
    const calls: RequestInit[] = [];
    globalThis.fetch = (async (_input, init) => {
      calls.push(init!);
      return Response.json({});
    }) as typeof fetch;
    const controller = new AbortController();
    let token = 'first-session';
    const options = { getToken: async () => token, signal: controller.signal };
    await getPaperByUuid('paper-1', null, null, options);
    token = 'refreshed-session';
    await getQuestionsByPaperUuid('paper-1', null, null, options);
    expect(new Headers(calls[0]!.headers).get('authorization')).toBe('Bearer first-session');
    expect(new Headers(calls[1]!.headers).get('authorization')).toBe('Bearer refreshed-session');
    expect(calls.every((call) => call.signal === controller.signal)).toBe(true);
  });

  test('explains when a rate-limited reader can retry', async () => {
    globalThis.fetch = (async () => new Response('{}', {
      status: 429, headers: { 'retry-after': '120' },
    })) as typeof fetch;
    try {
      await getQuestionsByPaperUuid('paper-1');
      throw new Error('Expected a rate limit error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRequestError);
      expect((error as ApiRequestError).status).toBe(429);
      expect((error as Error).message).toContain('2 minutes');
    }
  });
});
