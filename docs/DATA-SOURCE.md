# Data Source Guide

Praxis should have one canonical offline dataset shape, even though production reads from Postgres.

## Active Data Flow

```text
quizpractice.space
  |
  | scraper
  v
data-new/                  canonical offline JSON dataset
  |
  | bun run db:import
  v
Postgres                   runtime query source
  |
  | Bun API
  v
Frontend

images-new/
  |
  | rclone copy
  v
Cloudflare R2              runtime image source
```

## Canonical Offline Directories

Use these as the only current local source directories:

```text
data-new/
images-new/
```

Treat these as stale or archival unless explicitly being compared:

```text
data/
images/
data-new-stale-*
reports/
```

The app should not read directly from any local JSON directory at runtime. Local JSON exists for repeatable imports, audits, parity checks, and future migrations.

## Expected `data-new/` Shape

The importer expects exam directories with metadata plus per-course folders:

```text
data-new/
  <exam-name>/
    metadata.json
    <course-name>/
      index.json
      <paper-uuid>.json
```

Rules:

- `metadata.json` owns exam and course metadata.
- Each course directory should contain exactly one `index.json`.
- `index.json` lists paper UUIDs available for that course/exam.
- Each listed paper UUID should have a matching `<paper-uuid>.json`, unless it is a known quarantined source failure.
- Paper JSON is the source for paper metadata, questions, options, images, marks, answers, and parent-child question linkage.

## Expected `images-new/` Shape

```text
images-new/
  question_images/
    <filename>
  option_images/
    <filename>
```

Runtime image URLs are generated from these R2 object paths:

```text
question_images/<filename>
option_images/<filename>
```

Do not flatten these directories. The frontend assumes the category folder is part of the object path.

## What Belongs In Git

Commit:

- Import code.
- Scraper code.
- Data validation scripts.
- Human-readable docs.
- Small deterministic fixtures.

Do not commit:

- `data/`
- `data-new/`
- `images/`
- `images-new/`
- database dumps
- generated reports
- `.env*`
- `.vercel/`

## Import Contract

`server/import-db.ts` is the boundary between offline JSON and runtime Postgres.

The importer should:

1. Read only the configured `DATA_DIR`, defaulting to `data-new/`.
2. Ignore non-exam files at the top level.
3. Import exams, courses, paper variants, questions, and options.
4. Preserve source UUIDs.
5. Preserve `source_path` for traceability.
6. Keep paper variant IDs scoped by exam, course, and paper UUID.
7. Skip missing paper files only when the index points to a paper that is not available locally.

Import command:

```bash
DATA_DIR=/home/snehit/projects/praxis/data-new \
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres \
bun run db:import
```

## Data Cleanliness Checks

Before treating a dataset as canonical, check:

- Every exam directory has `metadata.json`.
- Every course directory has `index.json`.
- Every indexed paper has a corresponding JSON file, except known quarantined source failures.
- Every paper has a resolvable course UUID.
- Every imported paper has at least one non-instructional question unless the source itself is empty.
- Option image filenames referenced by JSON exist under `images-new/option_images/`.
- Question image filenames referenced by JSON exist under `images-new/question_images/`.
- Imported Postgres counts match expected audit counts.
- Live parity mismatches are understood and documented.

Current expected production import counts:

```text
exams: 4
courses: 130
paper variants: 4939
questions: 116704
```

## Future Cleanup Direction

The next data pass should produce a single generated manifest for the canonical offline dataset:

```text
data-new/dataset-manifest.json
```

Suggested manifest fields:

- generated timestamp
- scraper version or git commit
- source base URL
- exam count
- course count
- indexed paper count
- available paper JSON count
- known missing/quarantined paper count
- question image reference count
- option image reference count
- local question image file count
- local option image file count
- import counts after loading into Postgres

That gives us one cheap file to inspect before import, deployment, or backup.
