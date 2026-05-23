# Foundation Course Data Audit

Generated: 2026-05-23T01:05:46.964Z

## Verdict

Remaining foundation courses can be given a data clean chit for source/local parity. The remaining notes are render-risk categories already handled by the current Paper UI, not missing data.

## Scope

Compared remaining foundation-level course labels in Quiz 1, Quiz 2, and End Term Quiz against live QuizPractice source pages. Python is excluded because it already has its own clean audit.

The audit checks:

- source paper bundles vs local bundle API
- source paper UUIDs vs local paper UUIDs
- paper name, description, and group id
- included question count after applying our import filter
- question UUID/order/type/marks/hash/text/image/answer metadata
- option text/image/score/correctness/order
- render-risk categories for Python formatting

## Summary

| Exam          | Course            | Source papers | Local papers | Source groups | Local groups | Missing | Extra | Papers with issues | Clean |
| ------------- | ----------------- | ------------- | ------------ | ------------- | ------------ | ------- | ----- | ------------------ | ----- |
| Quiz 1        | CT                | 74            | 74           | 12            | 12           | 0       | 0     | 0                  | yes   |
| Quiz 1        | English1          | 52            | 52           | 10            | 10           | 0       | 0     | 0                  | yes   |
| Quiz 1        | English2          | 50            | 50           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Maths1            | 58            | 58           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Maths2            | 78            | 78           | 12            | 12           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Statistics1       | 70            | 70           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Statistics2       | 80            | 80           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 2        | CT                | 64            | 64           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 2        | English1          | 39            | 39           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | English2          | 34            | 34           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Maths1            | 59            | 59           | 10            | 10           | 0       | 0     | 0                  | yes   |
| Quiz 2        | Maths2            | 65            | 65           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 2        | Statistics1       | 53            | 53           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 2        | Statistics2       | 67            | 67           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Aptitude          | 5             | 5            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Basic Mathematics | 5             | 5            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | CT                | 51            | 51           | 10            | 10           | 0       | 0     | 0                  | yes   |
| End Term Quiz | English1          | 53            | 53           | 8             | 8            | 0       | 0     | 0                  | yes   |
| End Term Quiz | English2          | 34            | 34           | 10            | 10           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Mathematics       | 5             | 5            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Maths1            | 40            | 40           | 8             | 8            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Maths2            | 71            | 71           | 12            | 12           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Statistics        | 5             | 5            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Statistics1       | 54            | 54           | 10            | 10           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Statistics2       | 53            | 53           | 10            | 10           | 0       | 0     | 0                  | yes   |

## Render Risk Notes

| Exam          | Course            | Observed categories                                     |
| ------------- | ----------------- | ------------------------------------------------------- |
| Quiz 1        | CT                | answer_input_questions: 69<br>html_inline_markup: 114   |
| Quiz 1        | English1          | html_inline_markup: 60                                  |
| Quiz 1        | English2          | html_inline_markup: 16                                  |
| Quiz 1        | Maths1            | answer_input_questions: 357<br>empty_option_payloads: 2 |
| Quiz 1        | Maths2            | answer_input_questions: 659                             |
| Quiz 1        | Statistics1       | answer_input_questions: 446<br>html_inline_markup: 5    |
| Quiz 1        | Statistics2       | answer_input_questions: 755                             |
| Quiz 2        | CT                | answer_input_questions: 47<br>html_inline_markup: 117   |
| Quiz 2        | English1          | html_inline_markup: 5                                   |
| Quiz 2        | English2          | html_inline_markup: 6                                   |
| Quiz 2        | Maths1            | answer_input_questions: 437                             |
| Quiz 2        | Maths2            | answer_input_questions: 574                             |
| Quiz 2        | Statistics1       | answer_input_questions: 318<br>html_inline_markup: 6    |
| Quiz 2        | Statistics2       | answer_input_questions: 573                             |
| End Term Quiz | Aptitude          | answer_input_questions: 7<br>html_inline_markup: 4      |
| End Term Quiz | Basic Mathematics | answer_input_questions: 34<br>html_inline_markup: 1     |
| End Term Quiz | CT                | answer_input_questions: 118<br>html_inline_markup: 108  |
| End Term Quiz | English1          | answer_input_questions: 10<br>html_inline_markup: 41    |
| End Term Quiz | English2          | html_inline_markup: 20                                  |
| End Term Quiz | Mathematics       | answer_input_questions: 41<br>html_inline_markup: 1     |
| End Term Quiz | Maths1            | answer_input_questions: 316<br>html_inline_markup: 2    |
| End Term Quiz | Maths2            | answer_input_questions: 950                             |
| End Term Quiz | Statistics        | answer_input_questions: 25<br>html_inline_markup: 1     |
| End Term Quiz | Statistics1       | answer_input_questions: 431<br>html_inline_markup: 2    |
| End Term Quiz | Statistics2       | answer_input_questions: 410                             |

## Issues

No parity issues found.

## Repeatable Command

```bash
AUDIT_SCOPE=foundation bun run scripts/audit-python-course.ts
```
