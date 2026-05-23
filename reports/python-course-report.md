# Python Course Data Audit

Generated: 2026-05-23T00:45:11.495Z

## Verdict

Python can be given a data clean chit for source/local parity. The remaining notes are render-risk categories already handled by the current Paper UI, not missing data.

## Scope

Compared Python-labelled courses in Quiz 1, End Term Quiz, and OPPE against live QuizPractice source pages.

The audit checks:

- source paper bundles vs local bundle API
- source paper UUIDs vs local paper UUIDs
- paper name, description, and group id
- included question count after applying our import filter
- question UUID/order/type/marks/hash/text/image/answer metadata
- option text/image/score/correctness/order
- render-risk categories for Python formatting

## Summary

| Exam          | Course                 | Source papers | Local papers | Source groups | Local groups | Missing | Extra | Papers with issues | Clean |
| ------------- | ---------------------- | ------------- | ------------ | ------------- | ------------ | ------- | ----- | ------------------ | ----- |
| Quiz 1        | Intro to python        | 61            | 61           | 10            | 10           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Python programming -ES | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Intro to python        | 53            | 53           | 11            | 11           | 0       | 0     | 0                  | yes   |
| End Term Quiz | Programming in Python  | 6             | 6            | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Python programming -ES | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| OPPE          | Intro to python        | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |

## Render Risk Notes

| Exam          | Course                 | Observed categories                                                                                           |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Quiz 1        | Intro to python        | answer_input_questions: 270<br>empty_option_payloads: 1<br>html_inline_markup: 25<br>markdown_code_fences: 25 |
| Quiz 1        | Python programming -ES | answer_input_questions: 33<br>html_inline_markup: 6<br>markdown_code_fences: 1                                |
| End Term Quiz | Intro to python        | answer_input_questions: 300<br>html_inline_markup: 53<br>markdown_code_fences: 1                              |
| End Term Quiz | Programming in Python  | answer_input_questions: 27<br>html_inline_markup: 1                                                           |
| End Term Quiz | Python programming -ES | answer_input_questions: 40<br>html_inline_markup: 2                                                           |
| OPPE          | Intro to python        | markdown_code_fences: 9                                                                                       |

## Issues

No parity issues found.

## Repeatable Command

```bash
bun run scripts/audit-python-course.ts
```
