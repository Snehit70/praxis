import type { DbClient } from './db';
import { isIP } from 'node:net';

export function resolveClientIp(request: Request, peer: string | null, trustedProxies: ReadonlySet<string>): string | null {
  const address = peer?.replace(/^::ffff:/, '') ?? null;
  if (!address || !trustedProxies.has(address)) return address;
  const forwarded = request.headers.get('x-real-ip')?.trim();
  return forwarded && isIP(forwarded) ? forwarded : address;
}

export type ContentDecision =
  | { status: 'allowed' }
  | { status: 'limited'; retryAfter: number }
  | { status: 'challenge'; siteKey: string };

export interface ContentChallenge {
  siteKey: string;
  verify: (token: string, userId: string) => Promise<boolean>;
}

/** One grant per account and database paper variant, valid for 24 hours.
 * The account lock serializes distinct-paper admission across API replicas.
 * Existing grants are checked first, so refreshes never consume another slot.
 */
export function createContentGuard(sql: DbClient, challenge: ContentChallenge | null = null) {
  async function admit(userId: string, paperId: string, verified: boolean): Promise<ContentDecision> {
    return sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      const [active] = await tx`
        SELECT 1 FROM paper_access_grants
        WHERE user_id = ${userId} AND paper_id = ${paperId} AND expires_at > now()
      `;
      if (active) return { status: 'allowed' };
      const [counts] = await tx<Array<{ minute: number; hour: number; day: number; retryAfter: number }>>`
        WITH recent AS (
          SELECT created_at FROM paper_access_grants
          WHERE user_id = ${userId} AND created_at > now() - interval '24 hours'
        ), windows AS (
          SELECT seconds, max_papers, count(r.created_at)::int AS count,
            min(extract(epoch FROM r.created_at)) + seconds AS resets_at
          FROM (VALUES (60, 10), (3600, 60), (86400, 200)) AS limits(seconds, max_papers)
          LEFT JOIN recent r ON r.created_at > now() - seconds * interval '1 second'
          GROUP BY seconds, max_papers
        )
        SELECT coalesce(max(count) FILTER (WHERE seconds = 60), 0)::int AS minute,
          coalesce(max(count) FILTER (WHERE seconds = 3600), 0)::int AS hour,
          coalesce(max(count) FILTER (WHERE seconds = 86400), 0)::int AS day,
          coalesce(max(greatest(1, ceil(resets_at - extract(epoch FROM now()))))
            FILTER (WHERE count >= max_papers), 0)::int AS "retryAfter"
        FROM windows
      `;
      if (counts!.retryAfter) return { status: 'limited', retryAfter: counts!.retryAfter };
      if (challenge && !verified && (counts!.minute >= 5 || counts!.hour >= 20)) {
        return { status: 'challenge', siteKey: challenge.siteKey };
      }
      await tx`
        INSERT INTO paper_access_grants (user_id, paper_id, created_at, expires_at)
        VALUES (${userId}, ${paperId}, now(), now() + interval '24 hours')
        ON CONFLICT (user_id, paper_id) DO UPDATE SET created_at = now(), expires_at = now() + interval '24 hours'
      `;
      return { status: 'allowed' };
    });
  }
  return async (userId: string, paperId: string, token?: string | null): Promise<ContentDecision> => {
    const decision = await admit(userId, paperId, false);
    if (decision.status !== 'challenge' || !challenge || !token || token.length > 2048) return decision;
    // Network verification runs outside the DB transaction and its account lock.
    if (!await challenge.verify(token, userId)) return decision;
    return admit(userId, paperId, true);
  };
}

/** Bounded process-local IP protection, before token verification or SQL work. */
export function createIpLimiter(now: () => number = Date.now, limit = 240, capacity = 20_000) {
  const buckets = new Map<string, { startsAt: number; count: number }>();
  let lastSweep = 0;
  return (ip: string): number => {
    const time = now();
    if (time - lastSweep >= 60_000) {
      for (const [key, bucket] of buckets) {
        if (time - bucket.startsAt >= 60_000) buckets.delete(key);
      }
      lastSweep = time;
    }
    let bucket = buckets.get(ip);
    if (!bucket || time - bucket.startsAt >= 60_000) {
      if (!bucket && buckets.size >= capacity) return 60;
      bucket = { startsAt: time, count: 0 };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count === limit + 1) console.warn('API IP request limit reached', { ip });
    return bucket.count > limit ? Math.max(1, Math.ceil((bucket.startsAt + 60_000 - time) / 1000)) : 0;
  };
}

