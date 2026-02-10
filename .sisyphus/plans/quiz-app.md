# Plan: Quiz Application (V1)

## TL;DR

> **Quick Summary**: A responsive web-first quiz application for students (practice/exams) and admins (import/analytics). Uses a hybrid storage model (Convex + Postgres) to handle 3GB+ of question data and images.
> 
> **Deliverables**:
> - Next.js 14 App (Frontend + Auth + Quiz Logic)
> - Database Schema (Postgres: Content / Convex: User State)
> - Image Hosting Setup (Cloudflare R2)
> - Ingestion Scripts (JSON -> DB + R2)
> - 3 Timer Modes (Exam, Practice, Learning)
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Setup -> Schema -> Ingestion -> Quiz Engine -> Analytics

---

## Context

### Original Request
Build a full quiz application (web-first) for IIT Madras BS students. Support self-paced practice, timed exams, and learning mode. Admin panel for management.

### Interview Summary
**Key Decisions**:
- **Stack**: Next.js 14, Clerk (Auth), Convex (User State), Postgres (Content/Archive), Cloudflare R2 (Images).
- **Hosting**: Vercel (App), Supabase/Neon (Postgres), Cloudflare (R2).
- **Content**: Sourced from existing scraped JSON (`questions_sample.json`).
- **Modes**: 
  1. **Standard Exam** (60min hard limit, auto-submit)
  2. **Practice** (Stopwatch, self-paced)
  3. **Learning** (Per-question immediate feedback)
- **Admin**: Edit questions = New Version (v2).
- **Feedback**: No LLM in V1.

### Metis Review
**Identified Gaps** (addressed):
- **Storage**: Convex free tier (1GB) insufficient for 3GB+ images -> Added Cloudflare R2 + Postgres.
- **State Loss**: Browser crash during exam -> Added Convex real-time state syncing.
- **Admin Edits**: modifying questions during active attempts -> Added strict versioning.

---

## Work Objectives

### Core Objective
Deploy a scalable quiz platform that allows students to take varied practice exams with robust progress tracking.

### Concrete Deliverables
- [ ] `schema.prisma` / `schema.sql` (Postgres)
- [ ] `convex/schema.ts` (Convex)
- [ ] `scripts/ingest-paper.ts` (JSON -> DB + R2)
- [ ] `components/quiz/QuizPlayer.tsx` (The Engine)
- [ ] `app/admin/dashboard/page.tsx` (Analytics)
- [ ] `scripts/ingest-bulk.ts` with checkpointing + resume
- [ ] `lib/r2.ts` with upload + signed/public URL helpers

### Definition of Done
- [ ] All 3 timer modes function correctly
- [ ] Images load from R2
- [ ] Progress persists after browser refresh (Convex)
- [ ] Admin edits create new versions without breaking history

### Must Have
- [ ] Mobile responsiveness (Tailwind)
- [ ] LaTeX/Math support (Katex)
- [ ] Code block syntax highlighting
- [ ] Secure Auth (Clerk)
- [ ] Role-based access (Admin vs Student)
- [ ] Attempt resume after refresh/crash

### Must NOT Have (Guardrails)
- [ ] Native mobile app code (React Native)
- [ ] Complex non-MCQ types in V1
- [ ] Real-time proctoring (Webcam)
- [ ] LLM integration in V1
- [ ] Store images inside Postgres

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL verification is executed by the agent using tools.

### Test Decision
- **Infrastructure exists**: NO (will setup)
- **Automated tests**: YES (TDD for logic, Playwright for flows)
- **Framework**: Vitest (Unit) + Playwright (E2E)

### Additional Verification Requirements
- **Ingestion checkpointing** must be verified by stopping and resuming the script without data loss.
- **Versioning** must ensure attempts reference immutable question versions.
- **R2 delivery** must be verified with real image URLs loaded in the quiz UI.

### Agent-Executed QA Scenarios (MANDATORY)

#### 1. Quiz Engine Flow
```
Scenario: Complete a Standard Exam
  Tool: Playwright
  Preconditions: User logged in, Exam "Quiz 1" exists
  Steps:
    1. Navigate to: /quiz/start/{exam_id}?mode=exam
    2. Assert: Timer starts at 60:00
    3. Click: Option A for Question 1
    4. Click: Next Button
    5. Assert: Question 2 visible
    6. Reload Page
    7. Assert: Question 2 still visible (State persisted)
    8. Click: Submit
    9. Assert: Redirect to /results/{attempt_id}
  Expected Result: Quiz submitted, score calculated
  Evidence: .sisyphus/evidence/quiz-flow-exam.png
```

#### 2. Admin Versioning
```
Scenario: Edit Question Creates Version
  Tool: Playwright
  Preconditions: Admin logged in, Question Q1 (v1) exists
  Steps:
    1. Navigate to: /admin/questions/{q1_id}
    2. Fill: Text -> "New Question Text"
    3. Click: Save
    4. Assert: Toast "Version 2 created"
    5. Database Check: Select count(*) from questions where parent_id = {q1_id} -> Returns 2
  Expected Result: History preserved, new version active
  Evidence: .sisyphus/evidence/admin-versioning.png
```

#### 3. Ingestion Resume
```
Scenario: Bulk ingestion resumes after interruption
  Tool: Bash
  Preconditions: Ingestion script supports --resume, checkpoint file exists
  Steps:
    1. Run: bun scripts/ingest-bulk.ts --limit 200 --checkpoint .sisyphus/checkpoints/ingest.json
    2. Interrupt process after 200 items
    3. Run: bun scripts/ingest-bulk.ts --resume --checkpoint .sisyphus/checkpoints/ingest.json
    4. Assert: Total questions in DB equals expected count (no duplicates)
  Expected Result: Resume continues from checkpoint, idempotent inserts
  Evidence: .sisyphus/evidence/ingest-resume.log
```

---

## Execution Strategy

### Dev-Loop Integration (MANDATORY)

> Each TODO must be executed via the dev-loop state machine (INIT → PLAN → BRANCH → IMPLEMENT → VERIFY → COMMIT → PR → REVIEW → FIX → MERGE CHECK → CLEAN).
> **One PR per task** (or per tightly-coupled task group if explicitly noted).
> **No direct commits to main.** Always feature/fix branches.

**Per-Task Dev-Loop Steps:**
1. INIT: Confirm task scope and acceptance criteria
2. PLAN: Micro-plan for the task (files + steps)
3. BRANCH: Create `feat/<task-slug>` or `fix/<task-slug>`
4. IMPLEMENT: Make changes
5. VERIFY: Run tests/QA scenarios for this task
6. COMMIT: Conventional commit, one-line
7. PR: Open PR with summary + evidence
8. REVIEW: Address feedback
9. FIX: Amend, re-verify
10. MERGE CHECK: Ensure clean, no conflicts
11. CLEAN: Delete branch after merge

### Parallel Execution Waves

```
Wave 1 (Foundation):
├── Task 1: Project Init (Next.js + Tailwind + Clerk)
├── Task 2: Database Setup (Postgres + Convex + R2)
└── Task 3: Ingestion Script Prototype (Single Paper)

Wave 2 (Core Logic):
├── Task 4: Quiz Engine (State Machine + Timer)
├── Task 5: Question Rendering (HTML + Images + Katex)
└── Task 6: Results & Scoring Engine

Wave 3 (Polish & Admin):
├── Task 7: Admin Panel (Edits + Versions)
├── Task 8: Analytics Dashboard
└── Task 9: Full Data Ingestion (All 3GB)
```

---

## TODOs

- [ ] 1. Project Initialization & Auth Setup
  **What to do**:
  - Initialize Next.js 14 app with TypeScript, Tailwind, Shadcn UI.
  - Setup Clerk authentication (Middleware, Sign-in/up pages).
  - Configure ESLint/Prettier.
  
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**: Wave 1

  **Dev-Loop**: Create PR `feat/project-init-auth`

- [ ] 2. Database & Storage Infrastructure
  **What to do**:
  - Setup Postgres (Supabase/Neon) and define schema (Exams, Papers, Questions, Versions).
  - Setup Convex and define schema (Users, Attempts, LiveState).
  - Setup Cloudflare R2 bucket and CORS policies.
  - Decide public vs signed URL strategy (default: public read, signed optional).
  - Create connection utilities (`lib/db.ts`, `lib/convex.ts`, `lib/r2.ts`).

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend`, `database`]

  **Parallelization**: Wave 1

  **Dev-Loop**: Create PR `feat/db-storage-setup`

- [ ] 3. Content Ingestion Pipeline (Prototype)
  **What to do**:
  - Write script `scripts/ingest-prototype.ts`.
  - Parse `questions_sample.json`.
  - Upload images to R2 (deduplicate by hash).
  - Insert hierarchical data into Postgres (Exam -> Course -> Paper -> Question).
  - Verify integrity (counts match).
  - Record source JSON file path in DB for traceability.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend`, `scripting`]

  **Parallelization**: Wave 1

  **Dev-Loop**: Create PR `feat/ingest-prototype`

- [ ] 4. Quiz Engine Core (The Player)
  **What to do**:
  - Build `QuizPlayer` component with 3 modes.
  - Implement Convex real-time sync (optimistic updates).
  - Handle navigation, option selection, and flagging.
  - Implement Timer hook (server-synchronized).
  - Ensure resuming an attempt rehydrates current question + selections.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`, `react`]

  **Parallelization**: Wave 2

  **Dev-Loop**: Create PR `feat/quiz-engine`

- [ ] 5. Question Rendering & Math
  **What to do**:
  - Build `QuestionDisplay` component.
  - Sanitize HTML content (allowlist tags for safety).
  - Render Images from R2 (with loaders).
  - Integrate `rehype-katex` for Math rendering.
  - Add Syntax Highlighting for code blocks.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**: Wave 2

  **Dev-Loop**: Create PR `feat/question-rendering`

- [ ] 6. Scoring & Results Engine
  **What to do**:
  - Implement server-side scoring logic (Postgres source of truth).
  - Create `AttemptSummary` component.
  - Generate performance breakdown (Time taken, Accuracy).

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend`, `analytics`]

  **Parallelization**: Wave 2

  **Dev-Loop**: Create PR `feat/scoring-results`

- [ ] 7. Admin Management Console
  **What to do**:
  - Build Admin Layout (Sidebar/Nav).
  - Paper Listing & Search.
  - Question Editor (Form + Preview).
  - Implement "New Version" logic on save.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`, `admin-panel`]

  **Parallelization**: Wave 3

  **Dev-Loop**: Create PR `feat/admin-console`

- [ ] 8. Analytics Dashboard
  **What to do**:
  - Aggregate stats (Avg Score, Pass Rate).
  - Item Analysis (Hardest questions).
  - Student Leaderboard (per Exam).
  - Visualize with Recharts/Tremor.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`analytics`, `dataviz`]

  **Parallelization**: Wave 3

  **Dev-Loop**: Create PR `feat/analytics-dashboard`

- [ ] 9. Full Data Migration
  **What to do**:
  - Adapt ingestion script for bulk processing.
  - Run full import (3GB data).
  - Verify all images and questions.
  - Generate search indexes.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend`, `data-engineering`]

  **Parallelization**: Wave 3

  **Dev-Loop**: Create PR `feat/full-data-migration`

---

## Success Criteria

### Final Checklist
- [ ] Users can login via Clerk
- [ ] Quiz timer works and auto-submits
- [ ] Progress is saved if tab is closed
- [ ] Admin edits do not break past attempts
- [ ] Images load fast from R2
- [ ] Math formulas render correctly
