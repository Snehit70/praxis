# Diploma Course Data Audit

Generated: 2026-05-23T02:08:19.435Z

## Verdict

Diploma courses can be given a data clean chit for source/local parity. The remaining notes are render-risk categories already handled by the current Paper UI, not missing data.

## Scope

Compared local courses classified as Diploma in Programming or Diploma in Data Science by `src/lib/courseMapping.ts` against live QuizPractice source pages.

The audit checks:

- source paper bundles vs local bundle API
- source paper UUIDs vs local paper UUIDs
- paper name, description, and group id
- included question count after applying our import filter
- question UUID/order/type/marks/hash/text/image/answer metadata
- option text/image/score/correctness/order
- render-risk categories for Python formatting

## Summary

| Exam          | Course                                          | Source papers | Local papers | Source groups | Local groups | Missing | Extra | Papers with issues | Clean |
| ------------- | ----------------------------------------------- | ------------- | ------------ | ------------- | ------------ | ------- | ----- | ------------------ | ----- |
| Quiz 1        | AppDev1                                         | 41            | 41           | 10            | 10           | 0       | 0     | 0                  | yes   |
| Quiz 1        | AppDev2                                         | 51            | 51           | 10            | 10           | 0       | 0     | 0                  | yes   |
| Quiz 1        | BA                                              | 6             | 6            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | BDM                                             | 5             | 5            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Business Analytics                              | 31            | 31           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 1        | DBMS                                            | 50            | 50           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | DLGenAI                                         | 10            | 10           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Introduction To Deep Learning And Generative Ai | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Java                                            | 45            | 45           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | MLF                                             | 52            | 52           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | MLP                                             | 26            | 26           | 6             | 6            | 0       | 0     | 0                  | yes   |
| Quiz 1        | MLT                                             | 59            | 59           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Modern Application Development I                | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | PDSA                                            | 47            | 47           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | System Commands                                 | 34            | 34           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | AppDev1                                         | 37            | 37           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 2        | AppDev2                                         | 36            | 36           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 2        | BDM                                             | 22            | 22           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Business Analytics                              | 39            | 39           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 2        | DBMS                                            | 46            | 46           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Java                                            | 45            | 45           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | MLF                                             | 51            | 51           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 2        | MLP                                             | 21            | 21           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 2        | MLT                                             | 40            | 40           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | PDSA                                            | 41            | 41           | 8             | 8            | 0       | 0     | 0                  | yes   |
| Quiz 2        | System Commands                                 | 15            | 15           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | AppDev1                                         | 48            | 48           | 10            | 10           | 0       | 0     | 0                  | yes   |
| End Term Quiz | AppDev2                                         | 42            | 42           | 10            | 10           | 0       | 0     | 0                  | yes   |
| End Term Quiz | BDM                                             | 45            | 45           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Business Analytics                              | 49            | 49           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | DBMS                                            | 59            | 59           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Introduction To Deep Learning And Generative Ai | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Java                                            | 54            | 54           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | MLF                                             | 52            | 52           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | MLP                                             | 45            | 45           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | MLT                                             | 64            | 64           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Modern Application Development I                | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Modern Application Development Ii               | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | PDSA                                            | 62            | 62           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | System Commands                                 | 56            | 56           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | TDS                                             | 50            | 50           | 11            | 11           | 0       | 0     | 0                  | yes   |

## Render Risk Notes

| Exam          | Course                                          | Observed categories                                    |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Quiz 1        | AppDev1                                         | answer_input_questions: 7<br>html_inline_markup: 5     |
| Quiz 1        | AppDev2                                         | answer_input_questions: 12<br>html_inline_markup: 11   |
| Quiz 1        | BA                                              | answer_input_questions: 84                             |
| Quiz 1        | BDM                                             | answer_input_questions: 20                             |
| Quiz 1        | Business Analytics                              | answer_input_questions: 329<br>html_inline_markup: 134 |
| Quiz 1        | DBMS                                            | answer_input_questions: 130<br>html_inline_markup: 15  |
| Quiz 1        | DLGenAI                                         | answer_input_questions: 93                             |
| Quiz 1        | Introduction To Deep Learning And Generative Ai | answer_input_questions: 3                              |
| Quiz 1        | Java                                            | html_inline_markup: 22                                 |
| Quiz 1        | MLF                                             | answer_input_questions: 219                            |
| Quiz 1        | MLP                                             | answer_input_questions: 84<br>html_inline_markup: 14   |
| Quiz 1        | MLT                                             | answer_input_questions: 398                            |
| Quiz 1        | Modern Application Development I                | none                                                   |
| Quiz 1        | PDSA                                            | answer_input_questions: 171<br>html_inline_markup: 34  |
| Quiz 1        | System Commands                                 | answer_input_questions: 50<br>html_inline_markup: 9    |
| Quiz 2        | AppDev1                                         | answer_input_questions: 9<br>html_inline_markup: 18    |
| Quiz 2        | AppDev2                                         | none                                                   |
| Quiz 2        | BDM                                             | answer_input_questions: 46                             |
| Quiz 2        | Business Analytics                              | answer_input_questions: 609<br>html_inline_markup: 66  |
| Quiz 2        | DBMS                                            | answer_input_questions: 95<br>html_inline_markup: 18   |
| Quiz 2        | Java                                            | none                                                   |
| Quiz 2        | MLF                                             | answer_input_questions: 111<br>html_inline_markup: 12  |
| Quiz 2        | MLP                                             | answer_input_questions: 72                             |
| Quiz 2        | MLT                                             | answer_input_questions: 321<br>html_inline_markup: 12  |
| Quiz 2        | PDSA                                            | answer_input_questions: 138<br>html_inline_markup: 57  |
| Quiz 2        | System Commands                                 | answer_input_questions: 57                             |
| End Term Quiz | AppDev1                                         | answer_input_questions: 22<br>html_inline_markup: 54   |
| End Term Quiz | AppDev2                                         | answer_input_questions: 6<br>html_inline_markup: 22    |
| End Term Quiz | BDM                                             | answer_input_questions: 178<br>html_inline_markup: 8   |
| End Term Quiz | Business Analytics                              | answer_input_questions: 945<br>html_inline_markup: 218 |
| End Term Quiz | DBMS                                            | answer_input_questions: 209<br>html_inline_markup: 38  |
| End Term Quiz | Introduction To Deep Learning And Generative Ai | answer_input_questions: 7                              |
| End Term Quiz | Java                                            | none                                                   |
| End Term Quiz | MLF                                             | answer_input_questions: 332<br>html_inline_markup: 3   |
| End Term Quiz | MLP                                             | answer_input_questions: 256<br>html_inline_markup: 19  |
| End Term Quiz | MLT                                             | answer_input_questions: 660<br>html_inline_markup: 25  |
| End Term Quiz | Modern Application Development I                | none                                                   |
| End Term Quiz | Modern Application Development Ii               | none                                                   |
| End Term Quiz | PDSA                                            | answer_input_questions: 414<br>html_inline_markup: 57  |
| End Term Quiz | System Commands                                 | answer_input_questions: 133<br>html_inline_markup: 19  |
| End Term Quiz | TDS                                             | html_inline_markup: 85                                 |

## Issues

No parity issues found.

## Repeatable Command

```bash
AUDIT_SCOPE=diploma bun run scripts/audit-python-course.ts
```
