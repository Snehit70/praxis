import type { DbClient } from './db';

export interface PdfGuardConfig {
  downloadsEnabled: boolean;
  bypassUserIds: Set<string>;
  burstLimit: number;
  burstWindowSeconds: number;
  hourlyLimit: number;
  dailyLimit: number;
  maxConcurrent: number;
}

export type PdfGuardDenial = {
  ok: false;
  status: 429 | 503;
  error: string;
  retryAfterSeconds?: number;
  window?: 'burst' | 'hourly' | 'daily' | 'concurrent';
};

export type PdfGuardAllow = {
  ok: true;
  bypassed: boolean;
};

const DEFAULTS: Omit<PdfGuardConfig, 'bypassUserIds' | 'downloadsEnabled'> = {
  burstLimit: 3,
  burstWindowSeconds: 5 * 60,
  hourlyLimit: 8,
  dailyLimit: 24,
  maxConcurrent: 2,
};

export function parseEnvFlag(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  return fallback;
}

export function parseBypassUserIds(raw: string | undefined) {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readPdfGuardConfig(): PdfGuardConfig {
  return {
    downloadsEnabled: parseEnvFlag(process.env.PDF_DOWNLOADS_ENABLED, true),
    bypassUserIds: parseBypassUserIds(process.env.PDF_RATE_LIMIT_BYPASS_USER_IDS),
    burstLimit: envInt('PDF_BURST_LIMIT', DEFAULTS.burstLimit),
    burstWindowSeconds: envInt('PDF_BURST_WINDOW_SECONDS', DEFAULTS.burstWindowSeconds),
    hourlyLimit: envInt('PDF_HOURLY_LIMIT', DEFAULTS.hourlyLimit),
    dailyLimit: envInt('PDF_DAILY_LIMIT', DEFAULTS.dailyLimit),
    maxConcurrent: envInt('PDF_MAX_CONCURRENT', DEFAULTS.maxConcurrent),
  };
}

function floorWindow(nowMs: number, sizeSeconds: number) {
  const sizeMs = sizeSeconds * 1000;
  return new Date(Math.floor(nowMs / sizeMs) * sizeMs);
}

function secondsUntil(windowStart: Date, sizeSeconds: number) {
  return Math.max(1, Math.ceil((windowStart.getTime() + sizeSeconds * 1000 - Date.now()) / 1000));
}

async function bumpBucket(
  tx: DbClient,
  userId: string,
  bucket: string,
  windowStart: Date,
  limit: number,
) {
  const rows = await tx<Array<{ count: number }>>`
    INSERT INTO pdf_rate_buckets (clerk_user_id, bucket, window_start, count)
    VALUES (${userId}, ${bucket}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (clerk_user_id, bucket, window_start)
    DO UPDATE SET count = pdf_rate_buckets.count + 1
    WHERE pdf_rate_buckets.count < ${limit}
    RETURNING count
  `;

  if (rows[0]) {
    return { ok: true as const, count: rows[0].count };
  }

  const [current] = await tx<Array<{ count: number }>>`
    SELECT count
    FROM pdf_rate_buckets
    WHERE clerk_user_id = ${userId}
      AND bucket = ${bucket}
      AND window_start = ${windowStart.toISOString()}
    LIMIT 1
  `;

  return { ok: false as const, count: current?.count ?? limit };
}

class PdfGuardDenied extends Error {
  constructor(public denial: PdfGuardDenial) {
    super(denial.error);
  }
}

export async function consumePdfDownloadSlot(
  sql: DbClient,
  userId: string,
  paperUuid: string,
  answers: boolean,
  config: PdfGuardConfig,
): Promise<PdfGuardAllow | PdfGuardDenial> {
  if (!config.downloadsEnabled) {
    console.warn('pdf download blocked by kill switch', { userId, paperUuid });
    return {
      ok: false,
      status: 503,
      error: 'PDF downloads are temporarily disabled',
    };
  }

  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`pdf:${userId}`}))`;

      await tx`
        INSERT INTO users (clerk_user_id) VALUES (${userId})
        ON CONFLICT (clerk_user_id) DO NOTHING
      `;

      const [user] = await tx<Array<{ pdfRateLimitBypass: boolean }>>`
        SELECT pdf_rate_limit_bypass AS "pdfRateLimitBypass"
        FROM users
        WHERE clerk_user_id = ${userId}
        LIMIT 1
      `;

      const bypassed = Boolean(user?.pdfRateLimitBypass) || config.bypassUserIds.has(userId);
      const nowMs = Date.now();
      const burstStart = floorWindow(nowMs, config.burstWindowSeconds);
      const hourStart = floorWindow(nowMs, 3600);
      const dayStart = floorWindow(nowMs, 86400);

      if (!bypassed) {
        const burst = await bumpBucket(tx, userId, 'burst', burstStart, config.burstLimit);
        if (!burst.ok) {
          console.warn('pdf download rate limited', {
            userId,
            paperUuid,
            window: 'burst',
            count: burst.count,
            limit: config.burstLimit,
          });
          throw new PdfGuardDenied({
            ok: false,
            status: 429,
            error: 'Too many PDF downloads. Try again in a few minutes.',
            retryAfterSeconds: secondsUntil(burstStart, config.burstWindowSeconds),
            window: 'burst',
          });
        }

        const hourly = await bumpBucket(tx, userId, 'hour', hourStart, config.hourlyLimit);
        if (!hourly.ok) {
          console.warn('pdf download rate limited', {
            userId,
            paperUuid,
            window: 'hourly',
            count: hourly.count,
            limit: config.hourlyLimit,
          });
          throw new PdfGuardDenied({
            ok: false,
            status: 429,
            error: 'Hourly PDF download limit reached. Try again later.',
            retryAfterSeconds: secondsUntil(hourStart, 3600),
            window: 'hourly',
          });
        }

        const daily = await bumpBucket(tx, userId, 'day', dayStart, config.dailyLimit);
        if (!daily.ok) {
          console.warn('pdf download rate limited', {
            userId,
            paperUuid,
            window: 'daily',
            count: daily.count,
            limit: config.dailyLimit,
          });
          throw new PdfGuardDenied({
            ok: false,
            status: 429,
            error: 'Daily PDF download limit reached. Try again tomorrow.',
            retryAfterSeconds: secondsUntil(dayStart, 86400),
            window: 'daily',
          });
        }
      }

      await tx`
        INSERT INTO pdf_download_events (clerk_user_id, paper_uuid, answers, bypassed)
        VALUES (${userId}, ${paperUuid}, ${answers ? 1 : 0}, ${bypassed ? 1 : 0})
      `;

      console.info('pdf download allowed', { userId, paperUuid, answers, bypassed });
      return { ok: true, bypassed } satisfies PdfGuardAllow;
    });
  } catch (error) {
    if (error instanceof PdfGuardDenied) return error.denial;
    throw error;
  }
}

let inFlightPdfs = 0;

export function tryAcquirePdfRenderSlot(maxConcurrent: number) {
  if (inFlightPdfs >= maxConcurrent) return false;
  inFlightPdfs += 1;
  return true;
}

export function releasePdfRenderSlot() {
  inFlightPdfs = Math.max(0, inFlightPdfs - 1);
}

/** Test helper: reset the in-process Chromium concurrency counter. */
export function resetPdfRenderSlotsForTests() {
  inFlightPdfs = 0;
}
