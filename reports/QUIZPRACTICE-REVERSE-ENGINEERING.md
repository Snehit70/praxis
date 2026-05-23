# QuizPractice Reverse Engineering Notes

Generated from live site discovery on 2026-05-06.

Primary artifacts:

- `reports/website-discovery.md`
- `reports/website-discovery.json`
- `tools/rescrape/src/discover-site.ts`
- `tools/rescrape/src/scraper.ts`

## Executive Summary

The upstream site is still an Inertia/Laravel app and still exposes a Ziggy
route table in the HTML. That route table is the most reliable static source
for current endpoint discovery.

The old scraper mechanism remains valid:

- `GET /exam/{exam_uuid}` returns Inertia props with `exam`, `courses`, and the
  encrypted `exam.en_id`.
- `POST /api/get-questions-paper-by-exam` returns grouped paper indexes for a
  course/exam.
- `GET /question-paper/practise/{course_id}/{paper_uuid}` returns the full
  question paper in Inertia props.

The local dataset is stale. Live samples show 2026 paper metadata:

- Quiz 1 / CT: `CT 15 Mar 26`, paper UUID `4b15c17c-372`
- Quiz 2 / CT: `CT 06 Apr 26`, paper UUID `e90571c9-daa`

## Discovery Sources

### 1. Inertia `data-page`

Every sampled page had an `#app[data-page]` JSON payload.

Home props:

- `errors`
- `auth`
- `flash`
- `banner`
- `file_url`
- `file_do_url`
- `exam_date`
- `feedbacks`
- `courses`
- `exams`
- `online_users`
- `subscription_config`

Exam page props:

- `errors`
- `auth`
- `flash`
- `banner`
- `file_url`
- `file_do_url`
- `exam`
- `courses`

### 2. Ziggy Route Table

The live HTML embeds `const Ziggy = {...}`. Current discovery found:

- `127` total routes
- `93` routes relevant to exams/questions/papers/courses/API/subscriptions/admin

This is better than raw JS string search because most client code calls named
routes like `route("question-paper.practise", ...)`, and Ziggy resolves the URI.

### 3. JS Bundle Scan

The discovery tool downloaded the initially linked JS assets and followed lazy
chunk references.

- `71` JS assets scanned
- `166` candidate route/API strings found

The scan is useful for seeing which routes the frontend actually calls, but the
Ziggy table remains the canonical route inventory.

## Confirmed Scraping Flow

### Step 1: Fetch Exam Page

```http
GET https://quizpractice.space/exam/{exam_uuid}
```

Confirmed exam UUIDs:

| Exam | UUID |
| --- | --- |
| Quiz 1 | `9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa` |
| Quiz 2 | `1948ee72-5c62-4816-97c8-7d662330a220` |
| End Term Quiz | `7a6ff569-f50c-40e7-a08b-f5c334392600` |
| OPPE | `4e5fffd3-41e9-4ec7-853c-8af983edb699` |

Extract:

- `props.exam`
- `props.exam.en_id`
- `props.courses`
- Inertia version
- XSRF/session cookies

### Step 2: Fetch Paper Index

```http
POST https://quizpractice.space/api/get-questions-paper-by-exam
X-XSRF-TOKEN: {decoded XSRF cookie}

{
  "course_id": 1,
  "year": "all",
  "exam_id": "{exam.en_id}"
}
```

Response shape:

- Array of groups
- Each group may contain `question_papers`
- Each paper includes fields such as:
  - `id`
  - `group_id`
  - `exam_id`
  - `total_score`
  - `duration`
  - `created_at`
  - `updated_at`
  - `question_paper_name`
  - `question_paper_description`
  - `uuid`
  - `year`
  - `is_new`

### Step 3: Fetch Full Paper

```http
GET https://quizpractice.space/question-paper/practise/{course_id}/{paper_uuid}
X-Inertia: true
X-Inertia-Version: {version from exam page}
```

Response:

- Inertia component: `Quizpractise/PractiseQuestionPaper`
- Full paper at `props.question_paper`
- Includes `questions`

Question keys observed in 2026 samples:

- `id`
- `exam_id`
- `question_paper_id`
- `question_number`
- `question_text_1` through `question_text_5`
- `question_image_1` through `question_image_10`
- `question_images_json`
- `question_type`
- `total_mark`
- `value_start`
- `value_end`
- `created_at`
- `updated_at`
- `question_num_long`
- `answer_type`
- `response_type`
- `have_answers`
- `hash`
- `course_id`
- `is_markdown`
- `question_texts_json`
- `uuid`
- `solutions_count`
- `comments_count`
- `question_image_url`
- `question_texts`
- `course`
- `options`
- `parent_question`

Option keys observed:

- `id`
- `question_id`
- `option_text`
- `option_image`
- `score`
- `is_correct`
- `created_at`
- `updated_at`
- `option_number`
- `option_image_url`

## Live Sample Results

| Exam | Courses | First Course Paper Groups | First Course Papers | First Paper | Questions |
| --- | ---: | ---: | ---: | --- | ---: |
| Quiz 1 | 95 | 12 | 74 | `CT 15 Mar 26` / `4b15c17c-372` | 11 |
| Quiz 2 | 70 | 11 | 64 | `CT 06 Apr 26` / `e90571c9-daa` | 14 |
| End Term Quiz | 95 | 3 | 10 | `IIT M DAD DS QUALIFIER AN EXAM QDS1 13` / `7dc70481-202` | 18 |
| OPPE | 1 | 1 | 1 | `May 2024 OPPE 1 SET 1` / `66f4b08b-d72` | 10 |

Note: the "first course" sample is only a canary. Full scrape may reveal many
more papers across other courses.

## Endpoint Inventory

### Core Data Endpoints

These are directly relevant to our dataset refresh.

| Name | Methods | URI | Status |
| --- | --- | --- | --- |
| `exam.show` | `GET,HEAD` | `exam/{exam}` | Confirmed |
| `api.generated::ULMtxBNUK1iTWkma` | `POST` | `api/get-questions-paper-by-exam` | Confirmed |
| `question-paper.practise` | `GET,HEAD` | `question-paper/practise/{course_id}/{id}` | Confirmed |
| `question-paper.view-question` | `GET,HEAD` | `question-paper/view-question/{question}` | Candidate |
| `question-paper.download` | `GET,HEAD` | `question-paper/download/{course_id}/{id}` | Candidate |
| `question-paper.download-pdf` | `GET,HEAD` | `question-paper/download-pdf/{course_id}/{id}` | Candidate |

### Public / API Discovery Leads

| Name | Methods | URI | Why It Matters |
| --- | --- | --- | --- |
| `api.` | `GET,HEAD` | `api/get_questions` | May expose question search/list API |
| `api.generated::7qFQ2BYnzcxdI4kH` | `GET,HEAD` | `api/get_courses` | Course list API |
| `api.generated::RhySfKUqCJaCG82v` | `GET,HEAD` | `api/topics` | Topic taxonomy |
| `api.topics.stats` | `GET,HEAD` | `api/questions/{question}/topic-stats` | Per-question topic stats |
| `api.generated::gS1OzjcFr9lor2P1` | `POST` | `api/get_similar_questions` | Duplicate/similar question graph |
| `api.generated::t1FhIo1wZTddMZ7Z` | `GET,HEAD` | `api/get_ai_solutions` | Possible AI solution data |
| `api.generated::PvEWH7dhcQpQQqPf` | `GET,HEAD` | `api/get_skip_ai_solutions/{id}` | AI solution control |
| `api.question.flag` | `POST` | `api/question/flag` | Question quality signal |
| `api.question-paper.log_test` | `POST` | `api/question-paper/log_test` | Quiz/test telemetry |

### Question Repository / Search

| Name | Methods | URI |
| --- | --- | --- |
| `questions.repository` | `GET,HEAD` | `questions/repository` |
| `questions.search_repository` | `POST` | `questions/repository` |

These may expose richer search behavior than our current app. The bundle shows
repository UI fields for course, exam, question number, text search, and
solution presence.

### Solutions / Comments / Corrections

| Name | Methods | URI |
| --- | --- | --- |
| `questions.solution.index` | `GET,HEAD` | `questions/{question}/solution` |
| `questions.solution.store` | `POST` | `questions/{question}/solution` |
| `questions.solution.update` | `PUT` | `questions/{question}/solution` |
| `questions.solution.destroy` | `DELETE` | `questions/{question}/solution` |
| `solutions.upvote` | `POST` | `solutions/{solution}/upvote` |
| `solutions.downvote` | `POST` | `solutions/{solution}/downvote` |
| `solutions.view_log` | `POST` | `solutions/{solution}/view_log` |
| `questions.comments.fetch` | `GET,HEAD` | `questions/{question}/comments` |
| `questions.comments.store` | `POST` | `questions/comments` |
| `questions.comments.toggle-like` | `POST` | `questions/comments/{comment}/toggle-like` |
| `questions.corrections.index` | `GET,HEAD` | `questions/{question}/corrections` |
| `questions.corrections.store` | `POST` | `questions/{question}/corrections` |
| `questions.corrections.vote` | `POST` | `questions/corrections/{correction}/vote` |
| `questions.format-fix.store` | `POST` | `questions/{question}/format-fix` |

Older guessed endpoints like `/api/question/{id}/solutions` returned `404`.
The current Ziggy routes show the likely real solution route is:

```text
GET /questions/{question}/solution
```

not:

```text
GET /api/question/{question}/solutions
```

This is a concrete improvement over the older discovery docs.

### Admin / Upload / Submission Routes

The route table exposes many admin and upload routes, but these should be
treated as authentication-protected and not part of the public scraper.

Notable route families:

- `admin.exam.*`
- `admin.question-paper.*`
- `admin.questions.*`
- `admin.course-aliases.*`
- `question-paper.upload`
- `question-paper.upload-post`
- `submissions.create`
- `submissions.store`

These are useful for understanding the source app model, but should not be
called during public data scraping.

## Image Findings

Sampled paper payloads still include:

- filename-only question images such as `GGWQZRABTc1...png`
- option image paths such as `app/option_images/...png`
- normalized arrays like `question_image_url`

Direct probes still returned `404` for:

- `/app/question_images/{filename}`
- `/storage/question_images/{filename}`

Our current app already uses R2 image URLs. For a fresh scrape, do not assume
the upstream direct image URL works. Instead:

1. scrape JSON first
2. extract all image filenames/paths
3. compare against current R2 manifest or bucket listing if available
4. only then decide whether image download is needed

## Bundle Findings

The first bundle scan found few literal `/api/...` strings because the app uses
named Ziggy routes. After following lazy-loaded chunks, the scan found client
references for:

- `api/get-questions-paper-by-exam`
- `api.question-paper.log_test`
- `question-paper.view-question`
- `questions.repository`
- `questions.solution.*`
- `questions.comments.*`
- `questions.format-fix.store`
- `questions.generate-ai-answer-stream`
- `subscription.*`
- `question-paper.upload*`

The chunks also reveal frontend pages/components:

- `Exam/ShowQuestionPapers`
- `Quizpractise/PractiseQuestionPaper`
- `Quizpractise/ViewQuestion`
- `Question/Repository`
- `QuestionPaper/UploadNew`
- `Python/Practise`
- `Subscription/SubscribePage`
- `Admin/Subscriptions/Index`

## Bad Assumptions To Avoid

1. Do not rely on paper UUID alone.
   Use `exam + course + paper UUID`.

2. Do not assume the old `/api/question/{id}/solutions` pattern.
   Current solution routes are under `/questions/{question}/solution`.

3. Do not assume direct upstream image URLs are accessible.
   Use payload filenames and our R2 mapping unless proven otherwise.

4. Do not write a fresh scrape directly into `data/`.
   Scrape into `data-new/`, then diff.

5. Do not assume all new route-table endpoints are public.
   Admin, upload, subscription, and mutation routes are likely auth-protected.

6. Do not assume the home page course prop is the complete course list.
   Home currently reports only `3` course entries; exam pages expose the real
   per-exam course lists.

## Recommended Integration Order

### P0: Safe Data Refresh

Use only confirmed endpoints:

- `exam.show`
- `api/get-questions-paper-by-exam`
- `question-paper.practise`

Run into `data-new/`, then run the diff tool.

### P1: Enrich Discovery

Probe these read-oriented endpoints with real IDs from scraped data:

- `GET /question-paper/view-question/{question}`
- `GET /questions/{question}/solution`
- `GET /questions/{question}/comments`
- `GET /questions/{question}/corrections`
- `GET /api/questions/{question}/topic-stats`
- `POST /api/get_similar_questions`
- `GET /api/topics`
- `GET /api/get_courses`

Save responses as fixtures under `reports/probes/` or `data-new-probes/`, not
inside the production app data.

### P2: Product Integration

Only after confirming public access and stable schemas:

- topic taxonomy
- similar-question links
- public solution metadata/content
- public comments/discussions
- repository search behavior

### P3: Avoid / Defer

Do not integrate:

- admin mutation routes
- upload routes
- payment/subscription routes
- AI generation routes that may consume server resources
- user/profile mutation routes

## Commands

Regenerate website discovery:

```bash
cd tools/rescrape
bun run discover-site
```

Run a fresh scrape safely:

```bash
cd tools/rescrape
bun run scrape
```

Diff current data and new scrape:

```bash
bun run scripts/diff-scraped-data.ts
```

## Current Conclusion

The old scraper remains the correct backbone. The most valuable new finding is
the current Ziggy route table, especially the real solution/comment/topic route
families. We should first refresh the core dataset, then separately probe
read-only enrichment endpoints with a small set of question IDs before deciding
what to integrate into Praxis.

## Read-Only Probe Pass

Additional probing was run with:

```bash
cd tools/rescrape
bun run probe-endpoints
```

Artifacts:

- `reports/endpoint-probes/endpoint-probes.md`
- `reports/endpoint-probes/endpoint-probes.json`

### Sample IDs Used

| Exam | Course | Paper UUID | Question ID | Type |
| --- | --- | --- | ---: | --- |
| Quiz 1 | CT | `4b15c17c-372` | `123506` | MCQ |
| Quiz 2 | CT | `e90571c9-daa` | `123946` | MCQ |
| End Term Quiz | English | `7dc70481-202` | `76945` | MCQ |
| OPPE | Intro to python | `66f4b08b-d72` | `68504` | OPPE |

### Probe Results

| Endpoint Family | Result | Interpretation |
| --- | --- | --- |
| `GET /question-paper/view-question/{question}` | `200`, Inertia component `Quizpractise/ViewQuestion` | Public and useful. Returns full `question` prop plus `solutions` prop. |
| `GET /questions/{question}/solution` | `401 {"message":"Unauthenticated."}` | Route exists, but direct solution API is auth-gated. |
| `GET /questions/{question}/comments` | `401 {"message":"Unauthenticated."}` | Route exists, but comments API is auth-gated. |
| `GET /questions/{question}/corrections` | `200 []` | Public read endpoint; currently empty for sampled questions. |
| `GET /api/questions/{question}/topic-stats` | `500 {"message":"Server Error"}` | Route exists but public/sample usage is currently broken or expects extra state. |
| `GET /api/topics` | `200 []` | Public but no topic taxonomy returned. |
| `GET /api/get_courses` | `200` empty body | Route exists but currently returns no body publicly. |
| `GET /api/get_ai_solutions` | `200` empty body | Route exists but currently returns no body publicly. |
| `GET /questions/repository` | `200`, Inertia component `Question/Repository` | Public page; search POST requires captcha based on frontend bundle. |
| `GET /python/practise` | `200`, Inertia component `Python/Practise` | Public tool page, not relevant to data import. |
| `HEAD /question-paper/download/{course_id}/{paper_uuid}` | `404` for sampled papers | The route exists, but route parameter may expect numeric paper ID, not UUID. |
| `HEAD /question-paper/download-pdf/{course_id}/{paper_uuid}` | `401` | Likely auth/subscription protected or wrong ID form. |

### View Question Page

`/question-paper/view-question/{question}` is the strongest enrichment endpoint
found so far. It returns:

- Inertia component: `Quizpractise/ViewQuestion`
- Props:
  - `credit`
  - `question`
  - `solutions`
  - `subscribe_offer_price`
  - `subscribe_duration_days`

The `question` prop has the same core structure as paper questions, with an
embedded `question_paper`. That means it can be used to inspect individual
question pages and possibly recover richer context than the paper-practice
response.

However, for old local questions with `solutions_count > 0`, public
`view-question` still returned:

```json
{
  "solutions": []
}
```

So solution bodies are probably filtered by auth/subscription, or only available
for specific users.

### Repository Search

The `Question/Repository` page is public, but the frontend bundle shows search
submits:

```text
POST questions.repository
```

with fields:

- `selected_course`
- `search`
- `year`
- `exam`
- `response`
- `captcha_valid`
- `has_solution`

Because it uses captcha, this should not be part of automated scraping.

### Updated Integration Judgment

Integrate later, after full scrape:

- `question-paper.view-question` for individual-question enrichment
- `questions.corrections.index` if corrections become non-empty

Do not integrate now:

- solutions/comments APIs, because they are auth-gated
- topic stats, because sampled public calls return `500`
- repository search, because it is captcha protected
- AI solution endpoints, because public responses are empty and the route may be resource-sensitive
