# QuizPractice.space Architecture Analysis

## Overview
QuizPractice.space is a **Server-Side Rendered (SSR) Single Page Application (SPA)** built using the **Inertia.js** protocol, which bridges a **Laravel** backend with a **Vue.js 3** frontend. This architecture allows the application to serve dynamic content without a separate REST/GraphQL API for every view, instead passing "page props" as JSON objects embedded in the initial HTML or via subsequent XHR requests.

## Technology Stack

| Component | Technology | Evidence |
|-----------|------------|----------|
| **Frontend** | **Vue.js 3** + **Inertia.js** | Source maps, `.vue` component chunks, `data-page` attribute in DOM, `X-Inertia` headers. |
| **Backend** | **Laravel** (PHP) | Cookies (`XSRF-TOKEN`, `quizpractice_session`), standard Laravel session handling, folder structure (`/build/assets`). |
| **Styling** | **Tailwind CSS** | Class names observed in HTML (`bg-green-500`, `flex`, `min-h-screen`). |
| **Database** | **SQL** (MySQL/PostgreSQL) | Data structure (`id`, `group_id`, `created_at`) indicates a standard relational database. |
| **CDN/Storage** | **DigitalOcean Spaces** | Assets served from `saram.blr1.cdn.digitaloceanspaces.com`. |
| **Analytics** | **Google Analytics** | `G-NG0FKME7Z2` tag observed. |

## Data Flow & API Structure

The application does not use a traditional public API. Instead, it relies on:
1.  **Inertia Requests**: 
    -   GET requests to URLs like `/exam/{uuid}` return either a full HTML page (initial load) or a JSON response (subsequent navigation) containing the page component and props.
    -   Key data (Exams, Courses) is often embedded directly in the `data-page` JSON blob in the initial HTML.

2.  **Internal JSON Endpoints**:
    -   Specific data fetching (like filtering question papers) is done via internal POST endpoints.
    -   **Endpoint**: `POST /api/get-questions-paper-by-exam`
    -   **Payload**: `{ "course_id": 1, "year": "all", "exam_id": "ENCRYPTED_ID" }`
    -   This endpoint is protected by **CSRF tokens** but does not require user authentication for public exams.

## Database Schema (Inferred)

Based on the JSON payloads, the relational model is:

-   **Exams**
    -   `id` (Integer)
    -   `uuid` (String, e.g., `9251bc3a...`)
    -   `exam_name` (e.g., "Quiz 1")
    -   `en_id` (Encrypted ID used for API calls)

-   **Courses**
    -   `id` (Integer)
    -   `course_name` (e.g., "Computational Thinking")
    -   `course_code` (e.g., "CT")

-   **QuestionPapers** (Groups)
    -   `id` (Integer)
    -   `exam_id` (FK)
    -   `group_id` (FK - possibly links to a date/session)
    -   `question_paper_name`
    -   `uuid` (Used for navigation)

-   **Questions**
    -   `id` (Integer)
    -   `question_paper_id` (FK)
    -   `text` / `images`
    -   `options` (Array)
    -   `correct_answer`

## Authentication & Security

-   **Session-based Auth**: Uses `quizpractice_session` cookie.
-   **CSRF Protection**: Critical. Every POST request must include an `X-XSRF-TOKEN` header matching the decoded `XSRF-TOKEN` cookie.
-   **No Login Required**: The "Practice" section is public.
-   **Anti-Scraping**: 
    -   JavaScript event listeners block `F12`, `Ctrl+Shift+I`, and `Ctrl+U`.
    -   No advanced WAF (like Cloudflare Turnstile) observed on API endpoints.

## Scraping Feasibility

The application is **highly scrapeable**. The "Inertia Bypass" method allows direct access to the underlying JSON data without parsing HTML, provided valid cookies and CSRF tokens are maintained.
