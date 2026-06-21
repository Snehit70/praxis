# Testing Guide

This project uses Bun's built-in test runner for three kinds of tests on a single runner:

- **Pure-logic unit tests** (`*.test.ts` under `src/`) — no DOM, no database.
- **React component tests** (`*.test.tsx` under `src/`) — rendered in a happy-dom
  DOM with `@testing-library/react`. See [Frontend Component Tests](#frontend-component-tests).
- **API integration tests** (`server/*.test.ts`) — against a real, isolated Postgres schema.

The rationale for staying on `bun test` rather than adding Vitest for the React
layer is recorded in [ADR 0002](./adr/0002-bun-test-for-react-components.md).

## Test Commands

```bash
bun run test:unit
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:api
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run test:integration
bun run test
```

Command meanings:

- `test:unit`: runs all tests under `src/` — both pure-logic (`*.test.ts`) and
  React component (`*.test.tsx`) tests. It loads `test/setup-dom.ts` via
  `--preload` to register the DOM only for this run.
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

## Frontend Component Tests

React components are tested with `@testing-library/react` against a
[happy-dom](https://github.com/capricorn86/happy-dom) DOM, on the same
`bun test` runner — no Vitest, no second config.

The DOM is scoped to the frontend suite only. `test:unit` runs
`bun test --preload ./test/setup-dom.ts ./src`, and `setup-dom.ts`:

1. Registers happy-dom's `window`/`document`/`navigator` on `globalThis`.
2. Loads the `@testing-library/jest-dom` matchers (`toBeInTheDocument`, ...).
3. Calls `cleanup()` in an `afterEach` so trees never leak across tests.

The server integration suite (`bun test ./server`) does **not** load this
preload, so it keeps running on clean Bun globals.

Notes and gotchas:

- **Registration order matters.** happy-dom must register the DOM *before*
  `@testing-library/dom` is loaded — its `screen` export binds to `document.body`
  at module-evaluation time. `setup-dom.ts` therefore registers first, then pulls
  in Testing Library via dynamic `import()`. Don't convert those to static imports.
- **Matcher types.** `src/testing-library.d.ts` merges the jest-dom matchers onto
  `bun:test`'s `Matchers` so editors and `tsc` understand them.
- **Test files are excluded from the build typecheck** (`tsconfig.json`
  `exclude`), matching how `*.test.ts` was already treated — they're verified by
  running, not by `tsc -b`.
- A component must be **exported** to be tested in isolation. Some live inside
  larger page files (e.g. `QuestionNavigator`, `ResultsSummary`, `OptionButton`
  are exported from `PaperPage.tsx`).

Minimal example:

```tsx
import { test, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ResultsSummary } from './PaperPage';

test('shows the breakdown', () => {
  render(<ResultsSummary stats={stats} onTryAgain={() => {}} />);
  expect(screen.getByText('Correct')).toBeInTheDocument();
});
```

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
- Practice-run grading: per-question correctness, score/incorrect/skipped tally,
  and post-submission review states (including comprehension aggregation).

Component tests cover:

- `QuestionNavigator` — progress colouring during a run vs. correct/incorrect/
  skipped/manual colouring in review, the legend swap, and the "Next incorrect" jump.
- `ResultsSummary` — score/percentage, the correct/incorrect/skipped breakdown,
  and the gated "Review incorrect" action.
- `OptionButton` — selection during a run and correct/incorrect/locked states
  after submission.

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

For pure transformation logic, add `*.test.ts` next to the source file under `src/`.

For React components, add `*.test.tsx` next to the source (or page) file under
`src/`. Render with `@testing-library/react` and query by role/text/label — the
DOM and matchers are wired up by the `test:unit` preload. Export the component if
it is currently defined inside a larger file without being exported.

For API behavior, add tests to `server/app.test.ts` and use `createApiTestContext()`.

Prefer API tests when the behavior depends on:

- SQL filtering, grouping, or ordering.
- Route parameters.
- Query string context such as `courseUuid`, `examUuid`, or `courseUuids`.
- Response shape compatibility with the frontend.

Prefer unit tests when the behavior is pure TypeScript without database access.

## Known Gaps

Component-level testing now exists (see [Frontend Component Tests](#frontend-component-tests)),
but it currently covers only the review-flow sub-components of `PaperPage`. The
suite does not yet cover:

- The full `PaperPage` as an integration unit (it depends on the network, Clerk
  auth, timers, and local storage — all of which need mocking first).
- Timer behavior (fake timers, low-time warnings, auto-submit).
- Local-storage resume behavior.
- Image URL rendering against R2.
- Full scraped dataset import.
- Live parity against `quizpractice.space`.
- Performance budgets or Lighthouse checks.

Recommended next additions:

1. Build the mocking layer (api module, Clerk, fake timers, `localStorage`) and
   add a full `PaperPage` integration test on top of the component infra.
2. Add timer + resume tests once fake timers and a storage mock exist.
3. Add a small import fixture test for `server/import-db.ts`.
4. Add a smoke test that hits a running deployed API health endpoint outside normal CI.
5. Add route-level end-to-end tests with Playwright once a browser harness is introduced.
