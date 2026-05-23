# Full Course Parity Report

Generated: 2026-05-23

## Verdict

The audited local data is now in source/local parity for Foundation, Diploma, and Degree course scopes.

- Foundation remaining courses: clean.
- Diploma courses: clean, `41/41` course-exam pairs.
- Degree courses: clean, `121/121` course-exam pairs.
- Build validation passed with `bun run build`.

The audit compares our local Postgres/API view against live QuizPractice source pages for paper bundles, paper UUIDs, paper metadata, question counts, question identity/order/type/marks/text/hash/image/answer metadata, and option text/image/score/correctness/order.

## Work Completed

### Foundation

Foundation course parity was already clean after the earlier course-by-course pass. The report is preserved at:

- `reports/foundation-course-report.md`

The report includes Quiz 1, Quiz 2, and End Term where applicable. OPPE is excluded from this audit scope because it has a different structure and should be handled separately.

### Diploma

The first Diploma pass exposed two kinds of issues:

- The audit script was accidentally inheriting the Python/Foundation exam filter and skipped Quiz 2.
- A few stale local-only End Term aliases existed under `data-new` and did not exist in the live source.

Fixes applied:

- Expanded `scripts/audit-python-course.ts` to support `AUDIT_SCOPE=diploma`.
- Included Quiz 1, Quiz 2, and End Term for Diploma.
- Reconciled current-source mismatches for BDM, MLF, MLT, and PDSA.
- Moved stale local-only Diploma folders to `data-new-stale-diploma-local-only/`.
- Re-imported the DB.

Final result:

- `41/41` Diploma course-exam pairs clean.
- Report: `reports/diploma-course-report.md`

### Degree

The first Degree pass found only two live-content mismatches:

- `Quiz 1 / AI`
- `Quiz 1 / LLM`

Fixes applied:

- Expanded `scripts/audit-python-course.ts` to support `AUDIT_SCOPE=degree`.
- Included Quiz 1, Quiz 2, and End Term for Degree.
- Reconciled Quiz 1 AI and LLM from live QuizPractice source pages.
- Re-imported the DB.

Final result:

- `121/121` Degree course-exam pairs clean.
- Report: `reports/degree-course-report.md`

## Current Data State

Latest import summary:

- Exams: `4`
- Courses: `130`
- Paper variants: `4939`
- Questions: `116704`
- JSON files under `data-new`: `5216`
- Raw JSON size: `476M`
- Local images size: `4.1G`

One known quarantined/missing source file remains outside the completed parity scope:

- `data-new/Quiz 2/Programming Concepts Indian Institute Of Technology, Madras - Bs In Data Science And Applications Using Java/738b9700-bd4.json`

This was previously a repeated source-side failure and is skipped by the importer.

## Image Hosting State

Cloudflare R2 image upload completed successfully.

Verified R2 object state from the previous upload:

- Question images: `28,500` objects, `3.095 GiB`
- Option images: `45,637` objects, `800.813 MiB`
- Total images: `74,137` objects, `3.877 GiB`

The Cloudflare dashboard can lag behind actual object state, so a lower dashboard number immediately after upload should not be treated as failure without checking via `rclone size`.

## JSON Hosting Recommendation

Do not use Convex for this dataset. The `0.5 GB` storage limit is too tight for raw JSON plus future growth, and Convex is not the right storage shape for this import archive.

Use two different storage layers:

- Hosted Postgres for the runtime app database.
- Cloudflare R2 for raw JSON, images, backups, and import artifacts.

Cloudflare R2 can host the raw JSON. Current raw JSON is `476M`; combined with images the project is still roughly `4.35 GiB`, which is acceptable for an R2-backed object-storage plan. R2 should be treated as object storage, not as the query database for the app.

Suggested upload target:

```bash
rclone copy data-new r2:praxis-data/data-new \
  --ignore-existing \
  --fast-list \
  --transfers 32 \
  --checkers 128 \
  --stats 10s \
  --progress \
  --log-file reports/r2-json-upload.log \
  --log-level INFO
```

If using the existing bucket instead of a separate data bucket:

```bash
rclone copy data-new r2:praxis-images/data-new \
  --ignore-existing \
  --fast-list \
  --transfers 32 \
  --checkers 128 \
  --stats 10s \
  --progress \
  --log-file reports/r2-json-upload.log \
  --log-level INFO
```

## Deployment Direction

The app should deploy with:

- Vercel for the React frontend.
- A hosted Postgres provider for the imported relational DB.
- A small hosted API server, or a serverless-compatible API if adapted later.
- Cloudflare R2 public URLs for images.
- Cloudflare R2 private/public archive prefix for raw JSON.

Vercel env changes can be done later with `vercel env add` or `vercel env pull` once the production DB/API URLs are finalized.

## Repeatable Checks

```bash
AUDIT_SCOPE=foundation COURSE_AUDIT_REQUEST_DELAY_MS=100 bun run scripts/audit-python-course.ts
AUDIT_SCOPE=diploma COURSE_AUDIT_REQUEST_DELAY_MS=100 bun run scripts/audit-python-course.ts
AUDIT_SCOPE=degree COURSE_AUDIT_REQUEST_DELAY_MS=80 bun run scripts/audit-python-course.ts
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run db:import
bun run build
```
