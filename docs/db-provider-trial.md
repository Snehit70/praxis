# DB Provider Trial Plan

This project should test Aiven PostgreSQL and CockroachDB side-by-side before choosing the production database.

## Target Architecture

```text
Vercel frontend
  |
  v
Praxis API
  |
  +--> Aiven PostgreSQL trial
  |
  +--> CockroachDB trial

Cloudflare R2 remains separate:
  - question_images/
  - option_images/
  - raw JSON archive
```

Only one database should remain active after the trial. Raw JSON and images should not be stored in the relational database.

## What We Are Testing

- Can the provider accept the full import?
- Does our schema work unchanged?
- Do API query patterns work unchanged?
- Is search compatible, especially `ILIKE ... ESCAPE`?
- Does paper detail loading work?
- What is the final database size?
- Does the provider have enough free-tier headroom?

## Aiven Trial

Aiven is the safer compatibility target because it is real PostgreSQL.

Create a free PostgreSQL service, copy the service URI, then run:

```bash
DB_PROVIDER_NAME=aiven \
DATABASE_URL='postgres://avnadmin:<password>@<host>:<port>/defaultdb?sslmode=require' \
DB_TRIAL_IMPORT=1 \
bun run db:trial
```

Expected result:

- Schema check should pass.
- Full import should pass.
- Runtime counts should match local import:
  - `4` exams
  - `130` courses
  - `4939` paper variants
  - `116704` questions
- Database size should remain below the `1 GB` free-tier storage limit.

Known Aiven free-tier cautions:

- `1 GB` disk.
- `20` max connections.
- No free-tier connection pooling.
- No SLA.
- Service can be powered off if inactive.

Mitigation after deployment:

- Keep the API DB pool small.
- Add `/health/db`.
- Add a scheduled heartbeat every 6 hours.
- Keep raw JSON and images in R2.
- Keep backup/export commands documented.

## CockroachDB Trial

CockroachDB supports the PostgreSQL wire protocol, but it is not PostgreSQL. Treat it as a compatibility candidate, not a drop-in assumption.

Create a CockroachDB Serverless cluster, copy the PostgreSQL connection string, then run:

```bash
DB_PROVIDER_NAME=cockroach \
DATABASE_URL='postgresql://<user>:<password>@<host>:26257/<database>?sslmode=verify-full' \
DB_TRIAL_IMPORT=1 \
bun run db:trial
```

Expected result:

- Connection should pass.
- Schema may pass, but this must be verified.
- Import may expose Cockroach-specific differences.
- Search query compatibility is the main API-level check.

Likely risk areas:

- PostgreSQL behavior is not 100% identical.
- Import performance can differ.
- Some PostgreSQL functions or DDL behavior can differ.
- Query latency can vary on the free/serverless tier.

## Decision Rule

Use Aiven if:

- Full import fits comfortably under `1 GB`.
- API smoke checks pass.
- Cold/power-off behavior is acceptable with heartbeat.

Use CockroachDB only if:

- Aiven storage or power-off behavior becomes a blocker.
- Full import passes unchanged or with very small changes.
- API smoke checks pass.
- Query latency is acceptable.

Decommission whichever provider loses the trial.

## Report Output

The trial script writes Markdown reports to:

```text
reports/db-provider-trials/
```

The generated report includes:

- redacted connection URL
- schema compatibility result
- import result
- runtime counts
- search query check
- bundle query check
- paper detail check
- database size query result

## API Deployment After Selection

Once the winner is selected:

```text
Vercel frontend -> deployed Praxis API -> selected DB
Vercel frontend -> Cloudflare R2 images
Maintainer machine/CI -> R2 JSON archive
```

Set the deployed API environment:

```bash
DATABASE_URL='<selected provider URL>'
```

Set the Vercel frontend environment later:

```bash
VITE_API_BASE_URL='https://<api-domain>'
```
