# Live Parity Check

This document explains how to run and interpret live parity checks between:

- Source: `https://quizpractice.space`
- Local API: `http://127.0.0.1:8787`

Script: `scripts/live-parity-check.ts`

## Why this exists

Earlier full runs were getting blocked by source-side `429 Too Many Requests`.
The script is now hardened to complete reliably using retries, backoff, pacing, and checkpoint resume.

## Features in current script

- Automatic retry for transient source errors (`429`, `5xx`)
- Exponential backoff + jitter between retries
- Per-course pacing between requests
- Checkpoint/resume support so reruns continue from saved progress
- Exam-scoped execution support for batch runs

## Output files

Generated in `reports/`:

- `live-parity-check.json` (full machine-readable report)
- `live-parity-check.md` (human-readable summary)
- `live-parity-check.checkpoint.json` (resume state)

## Prerequisites

1. API server must be running:
   - `DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run api`
2. DB should be imported from current dataset:
   - `DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run db:import`

## Standard run

```bash
bun run scripts/live-parity-check.ts
```

## Useful run modes

### Slower/safer pacing

```bash
PARITY_REQUEST_DELAY_MS=600 PARITY_MAX_RETRIES=8 bun run scripts/live-parity-check.ts
```

### Single exam only

```bash
PARITY_ONLY_EXAM_UUID=9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa bun run scripts/live-parity-check.ts
```

### Start from a specific exam (continue remaining exams)

```bash
PARITY_START_EXAM_UUID=1948ee72-5c62-4816-97c8-7d662330a220 bun run scripts/live-parity-check.ts
```

## Environment flags

- `PARITY_REQUEST_DELAY_MS` (default: `350`)
- `PARITY_MAX_RETRIES` (default: `6`)
- `PARITY_ONLY_EXAM_UUID` (optional)
- `PARITY_START_EXAM_UUID` (optional)
- `LOCAL_API_BASE` (default: `http://127.0.0.1:8787`)

## Interpreting failures

- `sourceError` populated:
  - Source-side fetch issue (rate-limit, temporary backend issue, etc.)
- `localError` populated:
  - Local API issue (server down, route failure, DB issue)
- No `sourceError`/`localError`, but `ok=false`:
  - Real parity mismatch in group set/order/content

## Latest full run snapshot

From run generated on `2026-05-21T12:47:00.374Z`:

- Courses compared: `246`
- Exact parity: `193`
- Failures: `53`
- Order failures: `41`
- Content failures: `17`
- Group-set failures: `41`
- Source errors: `0`
- Local errors: `0`

This confirms transport/rate-limit failures are resolved in the parity workflow; remaining rows are true data differences to reconcile.
