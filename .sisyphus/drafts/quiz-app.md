# Draft: Quiz Application Plan

## Requirements (Confirmed)
- **Platform**: Web-first, mobile-responsive. Native mobile app later.
- **Roles**:
  - **Student**: Take quizzes, view history/progress.
  - **Admin**: Import papers, edit questions, manage cohorts, view analytics.
- **Quiz Delivery Modes** (Student Choice):
  1. **Standard Exam**: Hard time limit (e.g., 60 mins), auto-submit.
  2. **Practice Mode**: Visible timer, self-paced.
  3. **Learning Mode**: Per-question, untimed, immediate feedback.
- **Content**:
  - **Question Type**: MCQ only (derived from codebase/scraper data).
  - **Source**: Scraped JSON files (start with single paper prototype).
- **Features**:
  - **Scoring**: Per-question logic.
  - **Analytics**: Student results table, item analysis, cohort trends.
  - **Feedback**: Immediate feedback in Learning Mode.
  - **LLM**: No LLM for V1. Future: Local/API for "wrong answer" explanations.
- **Constraints**:
  - **Storage**: Convex (Free tier limit ~1GB) is insufficient for full dataset (3GB+ images + data).
  - **Images**: Hosted on DigitalOcean Spaces (keep as is).

## Technical Decisions
- **Architecture**: Hybrid approach.
  - **App Logic/State**: Convex (Users, Sessions, Live Quiz State).
  - **Bulk Data/Archive**: External Postgres (e.g., Supabase/Neon) or stay with JSON in repo? (Need decision).
  - **Images**: Direct CDN links (DO Spaces).
- **Frontend**: React/Next.js (implied).

## Open Questions
1. **"Text Tag" Meaning**: When you mentioned "Let's talk about text tag", did you mean:
   - How to handle HTML in questions (`question_text_1`)?
   - A specific tagging system for questions (Topic/Difficulty)?
   - Parsing the encrypted/hashed tags seen in `scrape_poc.js`?
2. **Storage Strategy**:
   - Option A: **Convex + External Postgres** (Supabase). Best for querying large datasets.
   - Option B: **Convex + S3/R2** (Store JSON blobs in object storage, fetch on demand). Cheaper, slower query.
3. **Prototype Source**: Which specific JSON file (Exam/Course/Paper) should we use as the "Golden Sample" for the prototype?
4. **Admin Edits**:
   - If Admin edits a question, does it **overwrite** the existing one (affecting past scores) or create a **new version**?
5. **Auth**: Email/Password, Magic Link, or Google SSO?
6. **Attempts**: Unlimited attempts per paper?

## Scope Boundaries
- **IN**: Full web app, Admin panel, 3 timer modes, Analytics, Scraper data ingestion.
- **OUT**: Native mobile app (v1), Real-time proctoring (webcam), Complex non-MCQ types (v1).
