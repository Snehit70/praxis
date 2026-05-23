# Scraping Strategy: QuizPractice.space

## Objective
Replicate the database content of QuizPractice.space, including Exams, Courses, Question Papers, and Questions.

## Strategy: The "Inertia Bypass"

We will mimic the behavior of the Inertia.js frontend client to fetch raw JSON data directly from the backend. This avoids the fragility of HTML parsing and allows us to get structured data.

### Phase 1: Hierarchy Discovery
**Target**: Identify all "Exams" (Top-level entities like Quiz 1, Quiz 2).
-   **Source**: Homepage `https://quizpractice.space/`
-   **Method**: Extract Inertia `data-page` JSON or parse `href` attributes for `/exam/{uuid}` links.
-   **Known Entities**:
    -   Quiz 1
    -   Quiz 2
    -   End Term
    -   OPPE

### Phase 2: Session & Metadata Extraction
**Target**: Get valid Cookies, CSRF Token, and Course List for each Exam.
-   **Action**: `GET https://quizpractice.space/exam/{EXAM_UUID}`
-   **Extract**:
    -   `Set-Cookie`: `XSRF-TOKEN` and `quizpractice_session`.
    -   `data-page.props.courses`: List of all courses (ID + Name).
    -   `data-page.props.exam.en_id`: **CRITICAL**. This encrypted ID is required for the next step.

### Phase 3: Question Paper Enumeration
**Target**: Get the list of all available Question Papers for every Course.
-   **Action**: `POST https://quizpractice.space/api/get-questions-paper-by-exam`
-   **Headers**:
    -   `X-XSRF-TOKEN`: Decoded from cookie.
    -   `Cookie`: Full session cookies.
-   **Payload**:
    ```json
    {
        "course_id": {COURSE_ID},
        "year": "all",
        "exam_id": "{ENCRYPTED_EXAM_ID}"
    }
    ```
-   **Output**: JSON array of Question Papers (containing `uuid` and `id`).

### Phase 4: Content Extraction
**Target**: Get the actual questions for each Question Paper.
-   **Action**: `GET https://quizpractice.space/question-paper/practise/{COURSE_ID}/{QP_UUID}`
-   **Headers**: `X-Inertia: true` (Optional, but cleaner)
-   **Extract**: `data-page.props.question_paper.questions`
-   **Data**: Question text, options, correct answers, image URLs.

### Phase 5: Asset Download (Optional but Recommended)
-   Iterate through question data.
-   Identify image URLs (`cdn.digitaloceanspaces.com`).
-   Download and save locally to replicate the full experience.

## Implementation Plan

### Tools
-   **Runtime**: Node.js / Bun (TypeScript)
-   **Libraries**:
    -   `axios` / `fetch`: For HTTP requests.
    -   `cheerio`: For extracting initial `data-page` from HTML (if not using Inertia headers for initial load).
    -   `fs`: For saving data.

### Directory Structure
```
quiz-scraper/
├── data/
│   ├── exams/
│   │   ├── {exam_id}/
│   │   │   ├── courses.json
│   │   │   ├── {course_id}/
│   │   │   │   ├── papers_index.json
│   │   │   │   ├── {paper_uuid}.json
├── src/
│   ├── types.ts       # Data models
│   ├── client.ts      # HTTP client with CookieJar
│   ├── scraper.ts     # Main logic
│   └── index.ts       # Entry point
```

### Rate Limiting & Ethics
-   **Concurrency**: 1 request at a time (sequential) to avoid server load.
-   **Delay**: 500ms - 1000ms between requests.
-   **User-Agent**: Use a standard browser User-Agent string.
