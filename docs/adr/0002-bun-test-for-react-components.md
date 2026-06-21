# Use Bun's test runner (not Vitest) for React component tests

**Status:** accepted

We add frontend component-testing capability on the **existing `bun test`
runner** — with `@testing-library/react` + `@testing-library/jest-dom` and a
**happy-dom** DOM shim — rather than introducing Vitest. The DOM environment is
scoped to the frontend suite only, via a CLI `--preload` on the `src` run, so
the server integration tests keep running on clean Bun globals.

## Why

The whole suite — pure-logic `src/` tests and Postgres-backed `server/`
integration tests — already runs on `bun test`, and `test:unit` is literally
`bun test ./src`. Component tests dropped under `src/` (named `*.test.tsx`) ride
the existing command and CI step for free; all the round adds is a DOM preload.
A second runner would mean two configs, two CI steps, and a split mental model —
against the project's minimal-friction stance — for a payoff (richer React
ecosystem) we don't yet need while testing prop-driven presentational
components.

## Considered options

- **Add Vitest** (jsdom/happy-dom + Testing Library) — the most battle-tested
  React path, fewer surprises with React 19 `act()`/async flushing, and it would
  reuse `vite.config.ts`. Rejected for this round because it splits the suite
  across two runners for a safety margin we don't need yet. Revisit if we hit a
  genuine Bun + React 19 + Testing Library wall.
- **Global `bunfig.toml` preload** — one line, but registers DOM globals for
  *every* `bun test` run, including the server suite, coupling two unrelated test
  sets and quietly breaking the day a server test touches global `fetch`.

## Consequences

- `test:unit` becomes `bun test --preload ./test/setup-dom.ts ./src`;
  `test:integration` (`bun test ./server`) is untouched, so DOM globals never
  reach the API tests.
- Convention: `*.test.tsx` = component tests (DOM), `*.test.ts` = pure logic.
- happy-dom is lighter but less complete than jsdom; if a test needs an API
  happy-dom lacks, the fix is swapping the preload to jsdom — the Testing Library
  test code is unchanged, so it's a one-line fallback, not a rewrite.
- Components under test (`QuestionNavigator`, `ResultsSummary`, `OptionButton`)
  are exported in place from `PaperPage.tsx` rather than extracted to their own
  files — testability pressure noted, full extraction deferred.
