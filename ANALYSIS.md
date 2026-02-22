# Praxis Application Analysis Report

**Date**: February 2026  
**Status**: Comprehensive Review Complete  
**Version**: 2.0

## Executive Summary

Praxis is an IIT Madras BS program exam practice platform built with React 19, Vite 7, and DynamoDB backend. **Data import is now complete** with 85,824 questions across 115 courses.

### Key Findings

| Area | Status | Severity |
|------|--------|----------|
| Data Import | ✅ Complete | Resolved |
| Core Quiz Functionality | Working | Good |
| UI/UX Polish | Needs work | Medium |
| Architecture | Dual-DB confusion | Medium |
| Authentication | Not implemented | Low (MVP) |

### Quick Stats

| Metric | Count |
|--------|-------|
| Papers | 354 |
| Questions | 85,824 |
| Courses | 115 |
| Question Types | MCQ, MSQ, SA, COMPREHENSION |

## Quick Links

- [Data Gap Analysis](docs/DATA-GAP-ANALYSIS.md) - Why only 1.2% of questions are imported
- [UI/UX Review](docs/UI-UX-REVIEW.md) - Interface issues and recommendations
- [Architecture Review](docs/ARCHITECTURE-REVIEW.md) - Tech stack evaluation

---

## 1. Current State Overview

### What's Working

- **Quiz taking flow**: Users can navigate Exam → Course → Paper → Quiz
- **Question rendering**: Text, images (via R2 CDN), options all display correctly
- **Sub-question handling**: COMPREHENSION questions properly group sub-questions
- **Answer validation**: Immediate feedback on answer selection
- **Score tracking**: Stats calculated correctly per quiz session
- **Course filtering**: Questions filtered by courseId (PR #8 fix)

### What's Missing/Needs Work

1. **OPPE data sparse** - Only 1 paper imported (raw data only has 1)
2. **Non-functional buttons** - Sign In, Get Started, mobile menu do nothing
3. **No authentication** - Login UI exists but no backend
4. **No progress persistence** - Quiz progress lost on page refresh
5. **No dark mode toggle** - Theme CSS exists but no UI control

---

## 2. Data Import (Complete ✅)

### The Numbers

| Metric | Count |
|--------|-------|
| Papers | 354 |
| Questions | 85,824 |
| Courses | 115 |
| Exam Types | 4 |

### Data Model

Each paper UUID represents an exam event. The same paper appears in multiple course directories, with each course seeing different question subsets.

**Example**: Paper `a3d88545-398` has 282 questions distributed across 16 courses (CT, Maths2, Statistics2, etc.)

**See**: [docs/DATA-GAP-ANALYSIS.md](docs/DATA-GAP-ANALYSIS.md) for full breakdown

---

## 3. UI/UX Issues Summary

### Critical Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Dead "Sign In" button | Header | Confuses users |
| Dead "Get Started" button | HomePage | Broken CTA |
| Mobile menu non-functional | Header | Mobile unusable |
| No loading states | Quiz pages | Poor UX |

### Design Issues

- Generic Tailwind defaults (purple gradients, system fonts)
- No visual hierarchy differentiation between exam types
- Card hover states inconsistent
- No skeleton loaders during data fetch

**See**: [docs/UI-UX-REVIEW.md](docs/UI-UX-REVIEW.md) for full analysis

---

## 4. Architecture Issues

### Dual Database Confusion

The project has **two database configurations**:

1. **Convex** - Schema defined in `convex/schema.ts`, provider in `main.tsx`
2. **DynamoDB** - Actual data storage, queries via `convex/dynamo.ts`

This creates confusion about the source of truth. Convex is set up but unused for storage.

### Recommendation

Either:
- **Migrate fully to Convex** (simpler, real-time, free tier sufficient)
- **Remove Convex, keep DynamoDB** (more control, AWS ecosystem)

**See**: [docs/ARCHITECTURE-REVIEW.md](docs/ARCHITECTURE-REVIEW.md) for tech evaluation

---

## 5. Completed Work (PRs #7 & #8)

### PR #7: Quiz Display Fixes (Merged)
- Fixed R2 CDN image URL construction
- Filtered junk "hall ticket" questions
- Implemented sub-question nesting for COMPREHENSION types
- Fixed answer state management for nested questions
- Corrected stats calculation

### PR #8: Multi-Course Filtering (Merged)
- Added `courseId` to question schema
- Updated import script to store course info
- Added FilterExpression for courseId in DynamoDB queries
- Updated routing to include courseId parameter
- Created and ran backfill script for existing data

---

## 6. Prioritized Action Items

### P0 - Critical (Done ✅)
1. [x] Run full data import (85,824 questions imported)

### P1 - High Priority
2. [ ] Fix or remove non-functional Sign In button
3. [ ] Fix or remove non-functional Get Started button
4. [ ] Add loading states/skeletons to all pages
5. [ ] Implement dark mode toggle
6. [ ] Add proper error boundaries
7. [ ] Fix mobile navigation menu

### P2 - Medium Priority
8. [ ] Resolve Convex vs DynamoDB architecture
9. [ ] Add quiz timer feature
10. [ ] Implement progress persistence (localStorage)
11. [ ] Add exam analytics/stats page

### P3 - Low Priority (Future)
12. [ ] Implement authentication
13. [ ] Add spaced repetition for wrong answers
14. [ ] Social features (leaderboards)
15. [ ] PWA support for offline mode

---

## 7. Technical Debt

| Debt Item | Location | Effort |
|-----------|----------|--------|
| Unused Convex schema | `convex/schema.ts` | Low |
| Hardcoded exam mappings | `src/lib/examMapping.ts` | Medium |
| No pagination in queries | `convex/dynamo.ts` | Medium |
| No caching layer | All queries | Medium |
| Missing TypeScript strictness | `tsconfig.json` | Low |

---

## 8. Resource Constraints

Per user requirements:
- Stay within **AWS Free Tier** (DynamoDB: 25GB, 25 RCU/WCU)
- Stay within **Convex Free Tier** (if used)
- Minimize compute usage

### Current Usage Estimate
- DynamoDB: ~50MB (well under 25GB limit)
- R2 storage: ~1.5GB images (already uploaded)
- Convex: Minimal (only serving as API layer)

---

## Appendix: File Locations

### Core Application
```
src/
├── pages/
│   ├── HomePage.tsx      # Landing page
│   ├── ExamPage.tsx      # Exam → Courses
│   ├── CoursePage.tsx    # Course → Papers
│   └── PaperPage.tsx     # Quiz interface
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

### Backend/Data
```
convex/
├── schema.ts       # Unused Convex schema
└── dynamo.ts       # DynamoDB queries

scripts/
├── import-dynamodb.ts      # Data import
└── backfill-course-id.ts   # Migration script

data/                       # Raw JSON (94K questions)
├── Quiz 1/
├── Quiz 2/
├── End Term Quiz/
└── OPPE/
```

---

*Generated by Claude Code analysis session*
