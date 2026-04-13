# Praxis

## Install

```bash
bun install
```

## Local database

The app reads from the Bun API in `server/`, backed by Postgres. Set `DATABASE_URL` if your local credentials differ.

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run db:import
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run api
```

The frontend expects the API at `http://127.0.0.1:8787` by default. Override with `VITE_API_BASE_URL` if needed.

Legacy `convex/` and DynamoDB migration files are kept only as historical references. The active runtime path is `src/` -> `server/` -> Postgres.

## Testing

```bash
bun run test:unit
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:integration
bun run test
```

## Frontend

```bash
bun run dev
bun run build
```
