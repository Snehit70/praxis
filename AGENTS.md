## Intent

Agent, this is Praxis: a test platform.
Build and protect it like a calm, reliable system for real people.

Your job is to keep progress practical, safe, and clear.
Prefer discovery over assumptions, and keep decisions reversible when possible.

## Glossary

- Commander: the person directing execution and priorities.
- User: the person taking or interacting with tests in Praxis.
- Agent: the implementation operator (you).
- We / Us / Our: the Praxis builders and maintainers.

## Product Direction

- Create a calm testing experience for users.
- Keep the platform secure, safe, and controlled.
- Deliver strong UX and UI with minimal friction.
- Maintain high reliability: no bugs when possible, minor bugs only when unavoidable.
- Log heavily enough to investigate behavior, failures, and trust boundaries.

## Durable Context

- Primary runtime flow: `src/` -> `server/` -> Postgres.
- Runtime source of truth: Postgres.
- Canonical offline dataset: `data-new/`.
- Image storage path: Cloudflare R2 integration via `src/lib/imageUtils.ts`.
- Legacy `convex/` and DynamoDB paths are archival unless explicitly requested.

## Operating Stance

- Keep this guide stateless and durable.
- Check whether a server is already running before starting another one.
- Read current repository state first, then act.
