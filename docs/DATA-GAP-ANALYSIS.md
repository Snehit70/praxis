# Data Import Analysis

**Date**: February 2026  
**Status**: ✅ Import Complete

## Summary

All available data has been successfully imported. The data model uses **paper UUID** as a unique exam identifier, with questions distributed across courses.

---

## 1. Final Statistics

| Metric | Count |
|--------|-------|
| **Papers** | 354 |
| **Questions** | 85,824 |
| **Courses** | 115 |
| **Exam Types** | 4 |

### By Exam Type

| Exam Type | Papers | Est. Questions |
|-----------|--------|----------------|
| Quiz 1 | 141 | ~30,000 |
| Quiz 2 | 82 | ~22,000 |
| End Term | 130 | ~30,000 |
| OPPE | 1 | ~30 |

### Top 10 Courses by Questions

| Course | Questions |
|--------|-----------|
| Maths2 | 4,397 |
| CT | 3,399 |
| Statistics2 | 3,392 |
| English1 | 3,223 |
| English2 | 3,187 |
| MLT | 3,138 |
| PDSA | 3,134 |
| DBMS | 2,744 |
| Java | 2,667 |
| AppDev1 | 2,621 |

### Question Types

| Type | Count | Percentage |
|------|-------|------------|
| MCQ | 53,193 | 62.0% |
| SA (Short Answer) | 19,627 | 22.9% |
| MSQ (Multiple Select) | 12,642 | 14.7% |
| COMPREHENSION | 353 | 0.4% |
| OPPE | 9 | 0.0% |

---

## 2. Data Model Discovery

### Key Finding: Paper-Course Relationship

The raw JSON files contained **3,874 files** but only **354 unique paper UUIDs**. This is because:

- Each paper UUID represents an **exam event**
- The same paper appears in **multiple course directories**
- Each course directory contains only the **questions for that course**

**Example**: Paper `a3d88545-398`
- Appears in 16 course directories
- CT: 14 questions
- Maths2: 14 questions
- Statistics2: 28 questions
- DL(CV): 38 questions
- Total: 282 questions across all courses

This is the correct structure for an exam where different courses see different question subsets.

### Data Storage

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `quiz-papers` | `uuid` | Unique exam papers (354) |
| `quiz-questions` | `paperUuid` + `questionNumber` | All questions with courseId |

---

## 3. Storage Usage

### DynamoDB

| Item Type | Count | Est. Size |
|-----------|-------|-----------|
| Papers | 354 | ~200 KB |
| Questions | 85,824 | ~85 MB |
| **Total** | 86,178 | **~85 MB** |

Free tier limit: 25 GB ✅ Well within limits

### R2 (Images)

- Question images: 9,186 files
- Option images: 17,466 files
- Total: ~1.5 GB

---

## 4. Import Process

The import was completed using an adaptive rate-limiting script that:
- Starts with moderate rate (300ms delay)
- Backs off on throttle (2x delay)
- Speeds up on success (reduce delay)
- Total time: ~68 minutes

Run command:
```bash
bun run scripts/import-dynamodb.ts
```

---

*Import completed February 2026*
