#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createDbClient } from '../server/db';
import { ensureSchema } from '../server/schema';

const PROVIDER = process.env.DB_PROVIDER_NAME ?? 'database';
const DATABASE_URL = process.env.DATABASE_URL;
const SHOULD_IMPORT = process.env.DB_TRIAL_IMPORT === '1';
const SHOULD_CREATE_SCHEMA = process.env.DB_TRIAL_CREATE_SCHEMA !== '0';
const REPORT_DIR = path.resolve(process.env.DB_TRIAL_REPORT_DIR ?? 'reports/db-provider-trials');

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

function requireDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Set it to the Aiven or Cockroach connection string.');
  }
}

function redactDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = 'REDACTED';
    if (parsed.username) parsed.username = parsed.username ? `${parsed.username}` : '';
    return parsed.toString();
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

async function timed<T>(name: string, fn: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await fn();
  return {
    name,
    ms: Math.round(performance.now() - startedAt),
    value,
  };
}

async function record(checks: Check[], name: string, fn: () => Promise<string>) {
  try {
    const result = await timed(name, fn);
    checks.push({
      name,
      ok: true,
      detail: `${result.value} (${result.ms}ms)`,
    });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runImport() {
  const proc = Bun.spawn(['bun', 'run', 'db:import'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: DATABASE_URL!,
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`db:import exited with code ${code}`);
  }
}

function markdownReport(generatedAt: string, checks: Check[]) {
  const verdict = checks.every((check) => check.ok) ? 'pass' : 'fail';
  const rows = checks
    .map((check) => `| ${check.ok ? 'yes' : 'no'} | ${check.name} | ${check.detail.replaceAll('\n', '<br>')} |`)
    .join('\n');

  return `# DB Provider Trial: ${PROVIDER}

Generated: ${generatedAt}

## Verdict

${verdict}

## Target

- Provider: ${PROVIDER}
- URL: ${redactDatabaseUrl(DATABASE_URL!)}
- Full import attempted: ${SHOULD_IMPORT ? 'yes' : 'no'}
- Schema creation attempted: ${SHOULD_CREATE_SCHEMA ? 'yes' : 'no'}

## Checks

| OK | Check | Detail |
| -- | ----- | ------ |
${rows}

## Commands

\`\`\`bash
DB_PROVIDER_NAME=${PROVIDER} DATABASE_URL='<provider-url>' DB_TRIAL_IMPORT=1 bun run db:trial
\`\`\`
`;
}

async function main() {
  requireDatabaseUrl();
  mkdirSync(REPORT_DIR, { recursive: true });

  const checks: Check[] = [];
  const sql = createDbClient(DATABASE_URL, {
    max: Number(process.env.DB_TRIAL_MAX_CONNECTIONS ?? 3),
    idleTimeout: 10,
    connectionTimeout: 30,
  });

  try {
    await record(checks, 'connectivity', async () => {
      const [row] = await sql<Array<{ ok: number }>>`SELECT 1 AS ok`;
      return `SELECT 1 -> ${row?.ok}`;
    });

    await record(checks, 'server version', async () => {
      const [row] = await sql<Array<{ version: string }>>`SELECT version()`;
      return row?.version ?? '<no version returned>';
    });

    if (SHOULD_CREATE_SCHEMA) {
      await record(checks, 'schema compatibility', async () => {
        await ensureSchema(sql);
        return 'ensureSchema completed';
      });
    }
  } finally {
    await sql.close();
  }

  if (SHOULD_IMPORT) {
    await record(checks, 'full import', async () => {
      await runImport();
      return 'db:import completed';
    });
  }

  const verifySql = createDbClient(DATABASE_URL, {
    max: Number(process.env.DB_TRIAL_MAX_CONNECTIONS ?? 3),
    idleTimeout: 10,
    connectionTimeout: 30,
  });

  try {
    await record(checks, 'runtime counts', async () => {
      const [row] = await verifySql<
        Array<{
          examCount: number;
          courseCount: number;
          paperVariantCount: number;
          questionCount: number;
          optionCount: number;
        }>
      >`
        SELECT
          (SELECT COUNT(*)::int FROM exams) AS "examCount",
          (SELECT COUNT(*)::int FROM courses) AS "courseCount",
          (SELECT COUNT(*)::int FROM paper_variants) AS "paperVariantCount",
          (SELECT COUNT(*)::int FROM questions) AS "questionCount",
          (SELECT COUNT(*)::int FROM options) AS "optionCount"
      `;

      return JSON.stringify(row);
    });

    await record(checks, 'search query compatibility', async () => {
      const rows = await verifySql<Array<{ courseName: string; paperCount: number }>>`
        SELECT c.course_name AS "courseName", COUNT(*)::int AS "paperCount"
        FROM paper_variants p
        JOIN courses c ON c.source_uuid = p.course_uuid
        WHERE c.course_name ILIKE ${'%python%'} ESCAPE '\\'
           OR c.course_code ILIKE ${'%python%'} ESCAPE '\\'
           OR c.canonical_name ILIKE ${'%python%'} ESCAPE '\\'
        GROUP BY c.source_uuid, c.course_name
        ORDER BY COUNT(*) DESC, c.course_name ASC
        LIMIT 5
      `;

      return `${rows.length} rows`;
    });

    await record(checks, 'bundle query compatibility', async () => {
      const rows = await verifySql<Array<{ examUuid: string; courseUuid: string; bundleCount: number }>>`
        SELECT exam_uuid AS "examUuid", course_uuid AS "courseUuid", COUNT(DISTINCT group_id)::int AS "bundleCount"
        FROM paper_variants
        GROUP BY exam_uuid, course_uuid
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `;

      return JSON.stringify(rows[0] ?? null);
    });

    await record(checks, 'paper detail compatibility', async () => {
      const [paper] = await verifySql<Array<{ id: string; uuid: string }>>`
        SELECT id, source_uuid AS "uuid"
        FROM paper_variants
        ORDER BY year DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      `;

      if (!paper) return 'no paper rows available';

      const [questionStats] = await verifySql<Array<{ questionCount: number; optionCount: number }>>`
        SELECT
          COUNT(DISTINCT q.id)::int AS "questionCount",
          COUNT(o.id)::int AS "optionCount"
        FROM questions q
        LEFT JOIN options o ON o.question_id = q.id
        WHERE q.paper_variant_id = ${paper.id}
      `;

      return `${paper.uuid}: ${JSON.stringify(questionStats)}`;
    });

    await record(checks, 'database size query', async () => {
      const [row] = await verifySql<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) AS size
      `;

      return row?.size ?? '<no size returned>';
    });
  } finally {
    await verifySql.close();
  }

  const generatedAt = new Date().toISOString();
  const safeProvider = PROVIDER.toLowerCase().replaceAll(/[^a-z0-9-]+/g, '-').replaceAll(/^-|-$/g, '');
  const reportPath = path.join(REPORT_DIR, `${generatedAt.replaceAll(/[:.]/g, '-')}-${safeProvider}.md`);
  writeFileSync(reportPath, markdownReport(generatedAt, checks));

  checks.forEach((check) => {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  });
  console.log(`Report: ${reportPath}`);

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}

void main();
