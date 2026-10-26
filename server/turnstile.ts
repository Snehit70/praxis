import { createHash } from 'node:crypto';
import type { ContentChallenge } from './contentGuard';

export function challengeBinding(userId: string) {
  return createHash('sha256').update(userId).digest('hex');
}

export function readTurnstileChallenge(): ContentChallenge | null {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const hostname = process.env.TURNSTILE_HOSTNAME?.trim();
  if (!siteKey && !secret && !hostname) return null;
  if (!siteKey || !secret || !hostname) throw new Error('Turnstile requires site key, secret key, and hostname');
  return createTurnstileChallenge({ siteKey, secret, hostname });
}

export function createTurnstileChallenge(
  { siteKey, secret, hostname }: { siteKey: string; secret: string; hostname: string },
  fetcher: typeof fetch = fetch,
): ContentChallenge {
  return {
    siteKey,
    async verify(token, userId) {
      try {
        const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret, response: token }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return false;
        const result = await response.json() as {
          success?: boolean; hostname?: string; action?: string; cdata?: string;
        };
        return result.success === true && result.hostname === hostname &&
          result.action === 'paper-access' && result.cdata === challengeBinding(userId);
      } catch {
        console.warn('Turnstile verification unavailable');
        return false;
      }
    },
  };
}
