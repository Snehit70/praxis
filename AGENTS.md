# Agent Guide

Keep this file short and stateless. Put durable project details in `README.md` or `docs/`.

## Source Of Truth

- Active app path: `src/` -> `server/` -> Postgres.
- Runtime data source: Postgres.
- Offline canonical scrape source: `data-new/`.
- Images: Cloudflare R2, referenced through `src/lib/imageUtils.ts`.
- Legacy `convex/` and DynamoDB scripts are archival unless a task explicitly targets them.

## Stack

- Bun runtime and test runner.
- React 19, Vite 7, Tailwind CSS v4.
- React Router routes:
  - `/`
  - `/search`
  - `/exam/:examId`
  - `/exam/:examId/course/:courseId`
  - `/paper/:paperId`
- Bun API in `server/`.
- Postgres schema in `server/schema.ts`.
- Import pipeline in `server/import-db.ts`.

## Working Rules

- Check whether a server is already running before starting another one.
- Read files before editing them.
- Use `rg` / `rg --files` for discovery.
- Prefer focused changes and narrow validation.
- Do not revert unrelated local changes.
- Never commit secrets, scraped data, dumps, images, reports, `.env*`, or `.vercel/`.

## Commands

```bash
bun install
bun run dev
bun run api
bun run build
bun run test:unit
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:api
bun run test
```

## Documentation

- Deployment: `docs/DEPLOYMENT.md`
- Testing: `docs/TESTING.md`
- Live parity: `docs/live-parity-check.md`
- Course/data modeling: `docs/course-assessment-and-ui-model.md`
