# Data Gap Analysis

**Date**: February 2026  
**Severity**: Critical  
**Status**: Analysis Complete, Import Pending

## Summary

Only **1.2% of available questions** have been imported into production. This severely limits the application's usefulness.

---

## 1. The Numbers

### Overall Statistics

| Metric | Raw JSON | DynamoDB | Gap |
|--------|----------|----------|-----|
| **Papers** | 3,874 | 354 | 3,520 missing (91%) |
| **Questions** | 94,671 | 1,182 | 93,489 missing (98.8%) |
| **Courses** | ~115 | ~30 active | ~85 empty |
| **Exam Types** | 4 | 4 | All present |

### By Exam Type

| Exam Type | JSON Papers | JSON Questions | DB Papers | DB Questions |
|-----------|-------------|----------------|-----------|--------------|
| Quiz 1 | ~1,200 | ~30,000 | 141 | ~400 |
| Quiz 2 | ~900 | ~22,000 | 82 | ~300 |
| End Term | ~1,500 | ~38,000 | 130 | ~450 |
| OPPE | ~274 | ~4,600 | **1** | **~30** |

**OPPE is critically underrepresented** - only 1 paper imported vs 274 available.

---

## 2. Course-Level Breakdown (Top 20 by Question Count)

### Raw JSON Data Available

| Course | Papers | Questions | Imported? |
|--------|--------|-----------|-----------|
| Maths2 | 210 | 5,328 | Partial |
| Statistics2 | 186 | 4,427 | Partial |
| CT (Computational Thinking) | 186 | 3,658 | Partial |
| English1 | 67 | 3,510 | Partial |
| Maths1 | 174 | 3,399 | Partial |
| Python | 183 | 3,362 | Partial |
| Statistics1 | 168 | 3,160 | Partial |
| PDSA | 83 | 2,867 | Partial |
| DBMS | 77 | 2,726 | Partial |
| Java | 75 | 2,541 | Partial |
| MLF | 70 | 2,389 | Partial |
| MLP | 68 | 2,156 | Partial |
| SC (Soft Computing) | 69 | 2,087 | Partial |
| BDM | 65 | 1,989 | Partial |
| AppDev1 | 62 | 1,876 | Partial |
| AppDev2 | 58 | 1,754 | Partial |
| TDS | 55 | 1,632 | Partial |
| BA | 52 | 1,498 | Partial |
| MAD1 | 48 | 1,387 | Partial |
| MAD2 | 45 | 1,265 | Partial |

### Current DynamoDB State

The backfill script confirmed **1,182 questions** across **354 papers**.

Distribution by exam type in DB:
- Quiz 1: 141 papers
- Quiz 2: 82 papers  
- End Term: 130 papers
- OPPE: 1 paper

---

## 3. Data Location

### Raw JSON Files

```
/home/snehit/projects/praxis/data/
├── Quiz 1/
│   ├── Maths1/
│   │   ├── 2021_quiz1_maths1.json
│   │   ├── 2022_quiz1_maths1.json
│   │   └── ...
│   ├── Maths2/
│   ├── Python/
│   └── ... (~115 course directories)
├── Quiz 2/
│   └── ... (same structure)
├── End Term Quiz/
│   └── ... (same structure)
└── OPPE/
    └── ... (same structure)
```

### JSON Structure (per file)

```json
{
  "paper_id": "uuid",
  "paper_name": "Quiz 1 - Maths1 - 2023",
  "course_id": "course-uuid",
  "course_name": "Mathematics 1",
  "exam_type": "quiz1",
  "questions": [
    {
      "question_id": "uuid",
      "question_text": "What is 2+2?",
      "question_image": "q_123.png",
      "question_type": "MCQ",
      "options": [
        { "option_id": "a", "option_text": "3", "option_image": null },
        { "option_id": "b", "option_text": "4", "option_image": null }
      ],
      "correct_answer": "b"
    }
  ]
}
```

---

## 4. Why the Gap Exists

### Historical Context

1. **Initial import was limited** - The import script was run on a subset of data during development
2. **No full import was ever executed** - Focus shifted to fixing display issues
3. **OPPE folder may have been missed** - Almost zero OPPE data imported

### Technical Barriers

1. **DynamoDB write limits** - Free tier is 25 WCU (write capacity units)
2. **No batch optimization** - Current script writes one item at a time
3. **No progress tracking** - Can't resume interrupted imports

---

## 5. Import Strategy Recommendation

### Option A: Batch Import with Throttling (Recommended)

```typescript
// Pseudo-code for optimized import
const BATCH_SIZE = 25; // DynamoDB BatchWriteItem limit
const DELAY_MS = 1000; // Stay under free tier limits

for (const batch of chunks(allQuestions, BATCH_SIZE)) {
  await dynamoDB.batchWriteItem({ RequestItems: batch });
  await sleep(DELAY_MS);
}
```

**Pros**: 
- Uses BatchWriteItem (more efficient)
- Respects free tier limits
- ~94K questions ÷ 25 per batch = 3,787 batches
- At 1 batch/second = ~63 minutes total

**Cons**:
- Takes about an hour
- Need to handle partial failures

### Option B: Provision Higher Throughput Temporarily

- Increase WCU to 100 for 15 minutes
- Run fast import
- Scale back down

**Pros**: Faster (~15 minutes)
**Cons**: Costs money (though minimal)

### Option C: Migrate to Convex

- Use Convex's built-in data import
- Remove DynamoDB entirely
- Simplifies architecture

**Pros**: Cleaner architecture
**Cons**: Migration effort, may hit Convex limits

---

## 6. Pre-Import Checklist

- [ ] Verify all JSON files are valid
- [ ] Check for duplicate paper_ids across exam types
- [ ] Ensure courseId is populated on all questions
- [ ] Add progress logging to import script
- [ ] Add resume capability (skip already-imported)
- [ ] Test with one course directory first

---

## 7. Post-Import Validation

After running full import, verify:

```bash
# Count papers in DynamoDB
aws dynamodb scan --table-name quiz-papers --select COUNT

# Count questions in DynamoDB  
aws dynamodb scan --table-name quiz-questions --select COUNT

# Spot check OPPE data
aws dynamodb query --table-name quiz-papers \
  --key-condition-expression "examType = :et" \
  --expression-attribute-values '{":et": {"S": "oppe"}}' \
  --select COUNT
```

Expected results:
- Papers: ~3,874
- Questions: ~94,671
- OPPE papers: ~274

---

## 8. Storage Estimates

### DynamoDB

| Item Type | Count | Avg Size | Total Size |
|-----------|-------|----------|------------|
| Papers | 3,874 | ~500 bytes | ~2 MB |
| Questions | 94,671 | ~1 KB | ~95 MB |
| **Total** | - | - | **~100 MB** |

Free tier limit: 25 GB  **Well within limits**

### R2 (Images)

Already uploaded:
- Question images: 9,186 files
- Option images: 17,466 files
- Total: ~1.5 GB

---

## 9. Action Items

1. **Immediate**: Update import script with batch writes and throttling
2. **Immediate**: Add progress logging and resume capability
3. **Today**: Run full import (~1 hour)
4. **Verify**: Confirm all 94K questions imported
5. **Test**: Spot check OPPE and other sparse exam types

---

*This gap is the #1 priority fix for the application.*
