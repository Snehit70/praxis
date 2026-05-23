# Testing Guide

This project uses Bun's built-in test runner for both frontend/domain unit tests and API integration tests.

## Test Commands

```bash
bun run test:unit
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:api
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:integration
bun run test
```

Command meanings:

- `test:unit`: runs tests under `src/`.
- `test:api`: runs the Bun API integration suite.
- `test:integration`: alias for the API integration suite, kept for CI and readability.
- `test`: runs unit tests, then integration tests.

## Required Local Services

Unit tests do not require Postgres.

API integration tests require a reachable Postgres server. By default, the test helper uses:

```text
postgres://postgres@127.0.0.1:5432/postgres
```

Override with:

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:api
```

Do not point tests at production. The helper creates and drops temporary schemas, but using production credentials for test runs is still unnecessary risk.

## Database Isolation Model

The API tests use `server/testHelpers.ts`.

For each test:

1. A random schema name is generated.
2. The schema is created in the configured test database.
3. A DB client is created with `search_path=<random_schema>,public`.
4. `ensureSchema()` creates tables and indexes inside the isolated schema.
5. Fixture rows are inserted.
6. The test runs against `createApiFetchHandler()` directly.
7. The schema is dropped in `afterEach`.

This means:

- Tests can mutate data without leaking into later tests.
- Test ordering should not matter.
- The API is exercised without opening a network port.
- Postgres behavior is still real, including SQL syntax, grouping, joins, and constraints.

## Shared Test Helpers

Use `createApiTestContext()` for new API tests:

```ts
import { afterEach, beforeEach, test } from 'bun:test';
import { createApiTestContext, type ApiTestContext } from './testHelpers';

let context: ApiTestContext;

beforeEach(async () => {
  context = await createApiTestContext();
});

afterEach(async () => {
  await context.dispose();
});

test('example', async () => {
  const { response, json } = await context.getJson('/api/stats');
  // assertions
});
```

The context provides:

- `database`: isolated database handles.
- `fetchHandler`: the raw API fetch handler.
- `get(path)`: returns a `Response`.
- `getJson(path)`: returns `{ response, json }`.
- `dispose()`: closes clients and drops the schema.

Use fixture helpers such as `seedAliasCourseFixture()` when a test needs extra data beyond the default fixture.

## What The Current Tests Cover

Unit tests cover:

- Filtering instructional zero-mark prompts.
- Preserving comprehension parent-child linkage.

API integration tests cover:

- Dataset stats.
- Public response headers.
- Exam course listing.
- Global search.
- Blank search behavior.
- Paper listing order and computed marks.
- Alias-course merged paper listing.
- Bundle grouping and variant counts.
- Paper detail context filtering.
- Paper question ordering, option ordering, and parent linkage.
- Unknown route `404`.

## CI

CI is defined in:

```text
.github/workflows/ci.yml
```

It starts a temporary Postgres service and runs:

```bash
bun install --frozen-lockfile
bun run test:unit
bun run test:integration
bun run build
```

The CI database URL is:

```text
postgres://postgres@127.0.0.1:5432/praxis_test
```

## Adding Tests

For pure transformation logic, add tests next to the source file under `src/`.

For API behavior, add tests to `server/app.test.ts` and use `createApiTestContext()`.

Prefer API tests when the behavior depends on:

- SQL filtering, grouping, or ordering.
- Route parameters.
- Query string context such as `courseUuid`, `examUuid`, or `courseUuids`.
- Response shape compatibility with the frontend.

Prefer unit tests when the behavior is pure TypeScript without database access.

## Known Gaps

The current test suite does not yet cover:

- Browser rendering of full paper pages.
- Local-storage resume behavior.
- Timer behavior.
- Image URL rendering against R2.
- Full scraped dataset import.
- Live parity against `quizpractice.space`.
- Performance budgets or Lighthouse checks.

Recommended next additions:

1. Add component-level tests for `PaperPage` rendering states.
2. Add a small import fixture test for `server/import-db.ts`.
3. Add a smoke test that hits a running deployed API health endpoint outside normal CI.
4. Add route-level frontend tests with Playwright once browser testing is introduced.
