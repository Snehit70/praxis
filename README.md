# Praxis

IIT Madras BS exam practice platform. The active stack is:

- Frontend: React 19 + Vite + Tailwind CSS v4
- API: Bun server in `server/`
- Database: Postgres
- Images: Cloudflare R2 public bucket
- Production frontend: Vercel
- Production API: AWS EC2 + Docker + Nginx + Let's Encrypt

## Install

```bash
bun install
```

## Local Development

The app reads from the Bun API in `server/`, backed by Postgres. Check whether an API/dev server is already running before starting another one.

```bash
bun install
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run db:import
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run api
bun run dev
```

The frontend expects the API at `http://127.0.0.1:8787` by default. Override with `VITE_API_BASE_URL` when using a deployed API.

Legacy `convex/` and DynamoDB migration files are historical references only. The active runtime path is `src/` -> `server/` -> Postgres.

## Testing

```bash
bun run test:unit
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:api
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:integration
bun run test
```

Testing details, database isolation, and CI behavior are documented in [docs/TESTING.md](docs/TESTING.md).
Primary UX route behavior/state matrix/QA checklist is documented in [docs/PRIMARY-FLOW-UX-PLAN.md](docs/PRIMARY-FLOW-UX-PLAN.md).

## Build

```bash
bun run build
```

## Production

Current production shape:

```text
Browser
  -> https://praxis.snehit70.dev
  -> Vercel static frontend
  -> https://api.praxis.snehit70.dev/api/*
  -> AWS EC2 Nginx TLS proxy
  -> Docker container praxis-api on 127.0.0.1:8787
  -> Docker container praxis-postgres on praxis-net
  -> Cloudflare R2 public image URLs
```

Production API health checks:

```bash
curl -fsS https://api.praxis.snehit70.dev/api/health
curl -fsS https://api.praxis.snehit70.dev/api/health/db
curl -fsS https://api.praxis.snehit70.dev/api/stats
```

Expected production stats after the current import:

- `4` exams
- `130` courses
- `4939` paper variants
- `116704` questions

Full deployment and recovery notes are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Data Source

Production reads from Postgres and R2, but the canonical offline source should stay clean under `data-new/` and `images-new/`. The expected directory shape and cleanup rules are in [docs/DATA-SOURCE.md](docs/DATA-SOURCE.md).
