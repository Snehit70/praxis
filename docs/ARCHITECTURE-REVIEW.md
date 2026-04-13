# Architecture Review

**Date**: February 2026  
**Severity**: Medium  
**Status**: Analysis Complete

## Summary

The application uses a **modern React stack** with Bun + Postgres as the active backend. The main architectural issue is now **stale documentation and legacy Convex/DynamoDB files** that no longer represent the runtime path, plus missing application layers like caching and richer error handling.

---

## 1. Current Tech Stack

| Layer | Technology | Version | Status |
|-------|------------|---------|--------|
| Runtime | Bun | Latest | Good |
| Framework | React | 19 | Good |
| Build Tool | Vite | 7 | Good |
| Styling | Tailwind CSS | v4 | Good |
| Routing | React Router | v7 | Good |
| UI Components | Radix + shadcn | Latest | Good |
| Backend | Bun API + Postgres | Good | Active runtime |
| CDN | Cloudflare R2 | - | Good |
| Icons | Lucide React | Latest | Good |

### Verdict: Stack is Modern and Appropriate

The core choices are solid for this use case. Main issues are implementation, not technology selection.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React 19 + Vite 7 + React Router v7                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Pages: Home → Exam → Course → Paper (Quiz)          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Bun API (`server/`)                      │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ app.ts           │    │ import-db.ts                │   │
│  │ route handlers   │    │ JSON -> Postgres pipeline   │   │
│  └──────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                               │
│  ┌────────────────────┐    ┌─────────────────────────────┐  │
│  │ paper_variants     │    │ questions / options         │  │
│  │ exams / courses    │    │ ordered quiz content        │  │
│  └────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare R2 CDN                           │
│  ┌────────────────────┐    ┌─────────────────────────────┐  │
│  │ question_images/   │    │ option_images/              │  │
│  │ 9,186 files        │    │ 17,466 files                │  │
│  └────────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Issues

### 3.1 Runtime vs Legacy File Confusion

**Problem**: The active path is Bun + Postgres, but several docs still describe Convex/DynamoDB as the main backend.

**Impact**:
- Confuses developers about the source of truth
- Slows down onboarding and future feature work
- Encourages edits in legacy folders instead of `server/`

**Recommendation**:
- Keep `server/` + Postgres as the documented source of truth
- Mark `convex/` and old DynamoDB scripts as archival
- Update docs and guides before deeper backend work

### 3.2 No Caching Layer

Every page load queries DynamoDB directly. No caching means:
- Higher latency
- More DynamoDB read units consumed
- Same data fetched repeatedly

**Options**:
1. **React Query/TanStack Query** - Client-side caching
2. **Convex's built-in caching** - If migrating to Convex
3. **Redis/Upstash** - Server-side caching (overkill for this)

**Recommendation**: Add React Query for client-side caching.

### 3.3 No Error Boundary

Currently, if DynamoDB fails:
- No user-facing error
- Blank page or console error
- No retry mechanism

**Fix**: Add React Error Boundary with fallback UI.

### 3.4 No Authentication Layer

Auth UI exists but no backend:
- Sign In button does nothing
- No user sessions
- No progress tracking per user

**For MVP**: Remove auth UI or add "Coming Soon" state.
**For Production**: Implement Clerk, Auth0, or Convex Auth.

---

## 4. Data Model Analysis

### Current Postgres Schema

**paper_variants Table**
```
PK: paperId (UUID)
Attributes:
  - paperName: string
  - examType: string (quiz1, quiz2, endterm, oppe)
  - courseId: string
  - courseName: string
  - year: number
```

**questions Table**
```
PK: paperId (UUID)
SK: questionId (UUID)
Attributes:
  - questionText: string
  - questionImage: string | null
  - questionType: string (MCQ, MSQ, NAT, COMPREHENSION)
  - options: Array<{id, text, image}>
  - correctAnswer: string | string[]
  - courseId: string (added in PR #8)
  - courseName: string (added in PR #8)
  - parentQuestionId: string | null (for sub-questions)
```

### Issues

1. **No GSI for courseId** - Filtering by course requires scan
2. **No GSI for examType** - Same issue
3. **Images stored as filenames** - URL construction in frontend

### Recommended Indexes

```
GSI1: examType-courseId-index
  PK: examType
  SK: courseId

GSI2: courseId-year-index  
  PK: courseId
  SK: year
```

---

## 5. Frontend Architecture

### Current Structure

```
src/
├── main.tsx           # App entry, providers
├── App.tsx            # Router config
├── index.css          # Tailwind + theme
├── pages/
│   ├── HomePage.tsx
│   ├── ExamPage.tsx
│   ├── CoursePage.tsx
│   └── PaperPage.tsx
├── components/
│   ├── layout/
│   │   └── RootLayout.tsx
│   └── ui/
│       ├── button.tsx
│       └── card.tsx
└── lib/
    ├── examMapping.ts
    ├── courseMapping.ts
    ├── paperUtils.ts
    └── imageUtils.ts
```

### Issues

1. **No separation of concerns** - Pages contain all logic
2. **No custom hooks** - Data fetching duplicated
3. **No state management** - Quiz state not centralized
4. **Utils in lib/** - Should be in hooks/ or services/

### Recommended Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── pages/           # Route components only
├── components/
│   ├── layout/
│   ├── ui/
│   └── quiz/        # Quiz-specific components
├── hooks/           # Custom hooks
│   ├── useQuiz.ts
│   ├── usePapers.ts
│   └── useQuestions.ts
├── services/        # API calls
│   └── dynamodb.ts
├── stores/          # State management (if needed)
│   └── quizStore.ts
├── types/           # TypeScript types
│   └── index.ts
└── utils/           # Pure utility functions
    ├── imageUtils.ts
    └── formatters.ts
```

---

## 6. Build & Deployment

### Current Setup

- **Build**: `vite build`
- **Dev**: `vite dev`
- **Deploy**: Not configured (manual?)

### Missing

1. **CI/CD pipeline** - No GitHub Actions
2. **Preview deployments** - No PR previews
3. **Environment validation** - Partial (VITE_CONVEX_URL only)

### Recommended

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - run: bun test
```

---

## 7. Performance Considerations

### Current State

| Metric | Status | Notes |
|--------|--------|-------|
| Bundle size | Unknown | Need to measure |
| TTI (Time to Interactive) | Unknown | Need to measure |
| LCP (Largest Contentful Paint) | Unknown | Need to measure |
| Code splitting | Minimal | Only route-based |

### Recommendations

1. **Add bundle analyzer** - `rollup-plugin-visualizer`
2. **Lazy load routes** - `React.lazy()` for page components
3. **Image optimization** - R2 images should have width/height
4. **Preload critical data** - Use `<link rel="preload">`

---

## 8. Security Considerations

### Current State

| Area | Status |
|------|--------|
| Auth | Not implemented |
| API Keys | In .env (good) |
| CORS | Handled by Convex |
| Input validation | Minimal |

### Concerns

1. **AWS credentials in .env** - Fine for dev, need secrets manager for prod
2. **No rate limiting** - DynamoDB queries unlimited
3. **No input sanitization** - User input not validated

---

## 9. Scalability Analysis

### Current Limits

| Resource | Free Tier Limit | Current Usage | Headroom |
|----------|-----------------|---------------|----------|
| DynamoDB Storage | 25 GB | ~100 MB | 99.6% |
| DynamoDB RCU | 25 | ~5 | 80% |
| DynamoDB WCU | 25 | ~1 | 96% |
| Convex | 1M function calls/month | Unknown | Unknown |
| R2 | 10 GB | 1.5 GB | 85% |

### Bottlenecks (if scaling)

1. **DynamoDB scans** - Full table scans don't scale
2. **No pagination** - Loading all questions at once
3. **Client-side filtering** - Should be server-side

---

## 10. Recommended Improvements

### P0 - Critical

1. [ ] Remove or use Convex schema (resolve dual-DB)
2. [ ] Add error boundaries
3. [ ] Add loading states

### P1 - High Priority

4. [ ] Add React Query for caching
5. [ ] Create custom hooks for data fetching
6. [ ] Add DynamoDB GSIs for efficient queries
7. [ ] Set up CI/CD pipeline

### P2 - Medium Priority

8. [ ] Restructure src/ directory
9. [ ] Add bundle analysis
10. [ ] Implement proper error handling
11. [ ] Add environment validation for all vars

### P3 - Future

12. [ ] Add authentication
13. [ ] Add server-side pagination
14. [ ] Add monitoring/analytics
15. [ ] Consider edge caching (Cloudflare)

---

## 11. Migration Path: Convex vs DynamoDB

### If Keeping DynamoDB

```
Effort: Low
Steps:
1. Remove convex/schema.ts
2. Keep convex/dynamo.ts as API layer
3. Add GSIs for efficient queries
4. Add React Query for caching
```

### If Migrating to Convex

```
Effort: Medium
Steps:
1. Update convex/schema.ts to match data
2. Create import script for Convex
3. Update queries to use Convex directly
4. Remove DynamoDB dependencies
5. Update .env to remove AWS creds
```

### Recommendation

For a project of this size (95K questions, single developer), **Convex is simpler**:
- Built-in real-time
- Automatic caching
- Simpler queries
- No AWS credential management
- Free tier is sufficient

However, if you want to stay in AWS ecosystem or need more control, **keeping DynamoDB** is also valid.

---

*Architectural cleanup should happen after the data import gap is resolved.*
