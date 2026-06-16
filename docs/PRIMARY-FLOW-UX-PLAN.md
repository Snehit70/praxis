# Primary Flow UX Plan

Scope: `/` -> `/search` -> `/exam/:examId` -> `/exam/:examId/course/:courseId` -> `/paper/:paperId`

This document captures current behavior, expected UI states, QA checks, and explicit boundaries for iterative UX improvement.

## 1) Route Behavior Notes

### `/` Home
- Purpose: entry point for discovery.
- Key actions:
  - free-text search redirects to `/search?q=...`
  - exam-type cards deep-link to `/exam/:examId`
- Data dependencies:
  - stats from `GET /api/stats`
- UX expectations:
  - page remains useful if stats fail (fallback values + partial render)

### `/search`
- Purpose: global discovery across courses and papers.
- Key actions:
  - submit search query as URL state (`q` param)
  - route-level result cards to course and paper pages
- Data dependencies:
  - `GET /api/search?q=...`
- UX expectations:
  - URL query is canonical state
  - retry available on request failure

### `/exam/:examId`
- Purpose: browse courses within one exam type.
- Key actions:
  - in-page course filtering by text
  - deep-link into course page
- Data dependencies:
  - `GET /api/exams/:examUuid/courses`
- UX expectations:
  - invalid exam handled explicitly
  - retry available on request failure
  - `search` URL param syncs into local input state

### `/exam/:examId/course/:courseId`
- Purpose: browse paper bundles/variants for a course.
- Key actions:
  - in-page filter for bundle/paper text
  - start test via paper variant card
- Data dependencies:
  - `GET /api/exams/:examUuid/courses/:courseUuid`
  - `GET /api/exams/:examUuid/courses/:courseUuid/bundles`
- UX expectations:
  - merged-course aliases are supported through query params
  - retry available on request failure

### `/paper/:paperId`
- Purpose: attempt and review one paper.
- Key actions:
  - answer questions
  - submit and view results
  - timed attempt controls (start/pause/reset)
- Data dependencies:
  - `GET /api/papers/:paperUuid`
  - `GET /api/papers/:paperUuid/questions`
- UX expectations:
  - local session persistence survives refresh
  - retry available on request failure
  - progress reflects meaningful answers only
  - auto-graded score excludes manual-eval question types

## 2) UI State Matrix

| Route | Loading | Empty | Error | Success |
|---|---|---|---|---|
| `/` | stats skeletons | n/a | partial-degrade (logs + fallback copy) | hero + exam grid + stats + programs |
| `/search` | search skeleton | no query / no matches panel | error panel + retry | courses/papers sections |
| `/exam/:examId` | section skeleton | no courses panel | error panel + retry | grouped level sections |
| `/exam/:examId/course/:courseId` | section skeleton | no papers panel | error panel + retry | bundle cards + paper variants |
| `/paper/:paperId` | paper skeleton | no questions panel | error panel + retry | full attempt experience |

## 3) UX Constraints

- Keep routing model and URL structure stable.
- Preserve Postgres-backed runtime behavior and existing API contracts.
- Keep improvements incremental and reversible.
- Prefer reusable UI primitives for state feedback consistency.
- Prioritize mobile readability and clear touch actions on every changed screen.

## 4) Non-goals (Current Iteration)

- No auth redesign.
- No major information architecture rewrite.
- No new scoring model beyond current correctness semantics.
- No cross-route state orchestration beyond existing URL/local component state.
- No visual brand overhaul across the whole app in this phase.

## 5) QA Checklist (Primary Flow)

### Functional
- Home search submits and lands on `/search?q=...`.
- Search results link to the correct exam/course/paper routes.
- Exam page handles valid and invalid `examId` correctly.
- Course page handles merged aliases and still loads bundles.
- Paper page can load, answer, submit, retry load failures, and restart attempts.

### State & Error Handling
- Every primary route with remote data shows loading UI before success.
- Empty states show clear user guidance and a next action.
- Error states expose at least one immediate recovery action (retry/back/home).
- Retry triggers in-place re-fetch without full page refresh.

### Paper Attempt Integrity
- Empty MSQ selections are not counted as answered.
- Blank short-answer input is not counted as answered.
- Auto-graded percent/score is based only on MCQ/MSQ.
- Manual-eval response count is shown in result summary when present.
- Timer start/pause/reset and auto-submit-on-expiry behavior remain intact.

### Mobile UX
- Header and primary actions remain visible and tappable on narrow screens.
- State panels wrap actions without clipping.
- Question/option cards remain readable without horizontal scroll.
- Sticky submit/progress UI does not block critical content interaction.

## 6) Suggested Execution Order For Next Passes

1. Accessibility pass for primary flow (focus states, semantics, SR labels).
2. Interaction polish on paper attempt (navigation helpers, reduced cognitive load).
3. Route-specific microcopy pass for calmer tone and clearer recovery guidance.
4. Expand this same state-matrix + QA approach to non-primary routes/features.
