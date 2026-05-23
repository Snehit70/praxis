# Degree Course Data Audit

Generated: 2026-05-23T02:32:06.430Z

## Verdict

Degree courses can be given a data clean chit for source/local parity. The remaining notes are render-risk categories already handled by the current Paper UI, not missing data.

## Scope

Compared local courses classified as Degree by `src/lib/courseMapping.ts` against live QuizPractice source pages.

The audit checks:

- source paper bundles vs local bundle API
- source paper UUIDs vs local paper UUIDs
- paper name, description, and group id
- included question count after applying our import filter
- question UUID/order/type/marks/hash/text/image/answer metadata
- option text/image/score/correctness/order
- render-risk categories for Python formatting

## Summary

| Exam          | Course                                    | Source papers | Local papers | Source groups | Local groups | Missing | Extra | Papers with issues | Clean |
| ------------- | ----------------------------------------- | ------------- | ------------ | ------------- | ------------ | ------- | ----- | ------------------ | ----- |
| Quiz 1        | Advanced Algorithms                       | 19            | 19           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | AI                                        | 48            | 48           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | Algorithmic Thinking                      | 4             | 4            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Algo Thinking                             | 3             | 3            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | BBN                                       | 3             | 3            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | BDBN                                      | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Computer Networks                         | 10            | 10           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Computer System Design                    | 21            | 21           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Computer System Designs                   | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Corporate Finance                         | 24            | 24           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 1        | CSD                                       | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Data Visualization                        | 4             | 4            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Data Viz                                  | 12            | 12           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Deep Learning                             | 50            | 50           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 1        | DL(CV)                                    | 30            | 30           | 6             | 6            | 0       | 0     | 0                  | yes   |
| Quiz 1        | DLP                                       | 28            | 28           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 1        | DVD                                       | 7             | 7            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Financial Forensics                       | 21            | 21           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Fin Forensics                             | 5             | 5            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Game Theory                               | 10            | 10           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Game Theory and Strategy                  | 19            | 19           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Industry 4.0                              | 29            | 29           | 7             | 7            | 0       | 0     | 0                  | yes   |
| Quiz 1        | i-NLP                                     | 10            | 10           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Introduction to C Programming             | 3             | 3            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Intro to C Programming                    | 5             | 5            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | LLM                                       | 38            | 38           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | LSM                                       | 13            | 13           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Managerial Economics                      | 24            | 24           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Market Research                           | 26            | 26           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Mathematical Foundations of Generative AI | 15            | 15           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Mathematical Thinking                     | 10            | 10           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 1        | OS                                        | 12            | 12           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Programming in C                          | 34            | 34           | 7             | 7            | 0       | 0     | 0                  | yes   |
| Quiz 1        | PSM                                       | 5             | 5            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | PSOSM                                     | 18            | 18           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 1        | RL                                        | 18            | 18           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Speech Tech                               | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Speech Technology                         | 4             | 4            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | SPG                                       | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Stat Computing                            | 3             | 3            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Statistical Computing                     | 14            | 14           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Sw Engg                                   | 5             | 5            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 1        | Sw Testing                                | 46            | 46           | 11            | 11           | 0       | 0     | 0                  | yes   |
| Quiz 2        | Advanced Algorithms                       | 16            | 16           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 2        | AI                                        | 43            | 43           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Algorithmic Thinking                      | 4             | 4            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Algo Thinking                             | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | BBN                                       | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | BDBN                                      | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Computer Networks                         | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Computer System Design                    | 9             | 9            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Computer System Designs                   | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Corporate Finance                         | 11            | 11           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 2        | CSD                                       | 5             | 5            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Data Visualization                        | 6             | 6            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Data Viz                                  | 9             | 9            | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Deep Learning                             | 48            | 48           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | DL(CV)                                    | 30            | 30           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 2        | DLP                                       | 22            | 22           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Financial Forensics                       | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Fin Forensics                             | 3             | 3            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Game Theory                               | 13            | 13           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Game Theory and Strategy                  | 20            | 20           | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Industry 4.0                              | 16            | 16           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 2        | i-NLP                                     | 13            | 13           | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | LLM                                       | 37            | 37           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | LSM                                       | 11            | 11           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Managerial Economics                      | 36            | 36           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Market Research                           | 34            | 34           | 5             | 5            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Mathematical Foundations of Generative AI | 12            | 12           | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Mathematical Thinking                     | 10            | 10           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 2        | OS                                        | 5             | 5            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | PSM                                       | 3             | 3            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | PSOSM                                     | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | RL                                        | 13            | 13           | 4             | 4            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Speech Tech                               | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Speech Technology                         | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| Quiz 2        | SPG                                       | 41            | 41           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Stat Computing                            | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Statistical Computing                     | 16            | 16           | 3             | 3            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Sw Engg                                   | 42            | 42           | 9             | 9            | 0       | 0     | 0                  | yes   |
| Quiz 2        | Sw Testing                                | 40            | 40           | 9             | 9            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Advanced Algorithms                       | 13            | 13           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | AI                                        | 34            | 34           | 8             | 8            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Algorithmic Thinking                      | 6             | 6            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Algo Thinking                             | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | BBN                                       | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | BDBN                                      | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Computer Networks                         | 2             | 2            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Computer System Design                    | 4             | 4            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Computer Systems Design                   | 3             | 3            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Corporate Finance                         | 14            | 14           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | CSD                                       | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Deep Learning                             | 35            | 35           | 9             | 9            | 0       | 0     | 0                  | yes   |
| End Term Quiz | DL(CV)                                    | 11            | 11           | 5             | 5            | 0       | 0     | 0                  | yes   |
| End Term Quiz | DLP                                       | 15            | 15           | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Financial Forensics                       | 10            | 10           | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Fin Forensics                             | 7             | 7            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Game Theory                               | 8             | 8            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Game Theory and Strategy                  | 6             | 6            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Industry 4.0                              | 17            | 17           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | i-NLP                                     | 6             | 6            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Intro to C Programming                    | 10            | 10           | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | LLM                                       | 15            | 15           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | LSM                                       | 10            | 10           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Managerial Economics                      | 23            | 23           | 5             | 5            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Market Research                           | 17            | 17           | 5             | 5            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Mathematical Foundations of Generative AI | 4             | 4            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Mathematical Thinking                     | 7             | 7            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | OS                                        | 6             | 6            | 3             | 3            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Programming in C                          | 23            | 23           | 6             | 6            | 0       | 0     | 0                  | yes   |
| End Term Quiz | PSM                                       | 3             | 3            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | PSOSM                                     | 4             | 4            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | RL                                        | 18            | 18           | 4             | 4            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Software Engineering                      | 1             | 1            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Speech Tech                               | 4             | 4            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | SPG                                       | 27            | 27           | 8             | 8            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Stat Computing                            | 2             | 2            | 1             | 1            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Statistical Computing                     | 4             | 4            | 2             | 2            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Sw Engg                                   | 25            | 25           | 7             | 7            | 0       | 0     | 0                  | yes   |
| End Term Quiz | Sw Testing                                | 32            | 32           | 9             | 9            | 0       | 0     | 0                  | yes   |

## Render Risk Notes

| Exam          | Course                                    | Observed categories                                    |
| ------------- | ----------------------------------------- | ------------------------------------------------------ |
| Quiz 1        | Advanced Algorithms                       | answer_input_questions: 74<br>html_inline_markup: 25   |
| Quiz 1        | AI                                        | answer_input_questions: 668<br>html_inline_markup: 208 |
| Quiz 1        | Algorithmic Thinking                      | answer_input_questions: 32                             |
| Quiz 1        | Algo Thinking                             | answer_input_questions: 3                              |
| Quiz 1        | BBN                                       | html_inline_markup: 12                                 |
| Quiz 1        | BDBN                                      | answer_input_questions: 33<br>html_inline_markup: 9    |
| Quiz 1        | Computer Networks                         | answer_input_questions: 91<br>html_inline_markup: 36   |
| Quiz 1        | Computer System Design                    | answer_input_questions: 117<br>html_inline_markup: 21  |
| Quiz 1        | Computer System Designs                   | answer_input_questions: 4                              |
| Quiz 1        | Corporate Finance                         | none                                                   |
| Quiz 1        | CSD                                       | answer_input_questions: 30<br>html_inline_markup: 3    |
| Quiz 1        | Data Visualization                        | html_inline_markup: 4                                  |
| Quiz 1        | Data Viz                                  | html_inline_markup: 6                                  |
| Quiz 1        | Deep Learning                             | answer_input_questions: 395<br>html_inline_markup: 13  |
| Quiz 1        | DL(CV)                                    | answer_input_questions: 452<br>html_inline_markup: 213 |
| Quiz 1        | DLP                                       | answer_input_questions: 105                            |
| Quiz 1        | DVD                                       | none                                                   |
| Quiz 1        | Financial Forensics                       | answer_input_questions: 203<br>html_inline_markup: 20  |
| Quiz 1        | Fin Forensics                             | answer_input_questions: 40<br>html_inline_markup: 40   |
| Quiz 1        | Game Theory                               | answer_input_questions: 24<br>html_inline_markup: 1    |
| Quiz 1        | Game Theory and Strategy                  | answer_input_questions: 67<br>html_inline_markup: 7    |
| Quiz 1        | Industry 4.0                              | answer_input_questions: 162                            |
| Quiz 1        | i-NLP                                     | answer_input_questions: 34                             |
| Quiz 1        | Introduction to C Programming             | answer_input_questions: 9                              |
| Quiz 1        | Intro to C Programming                    | answer_input_questions: 16<br>html_inline_markup: 21   |
| Quiz 1        | LLM                                       | answer_input_questions: 328<br>html_inline_markup: 16  |
| Quiz 1        | LSM                                       | none                                                   |
| Quiz 1        | Managerial Economics                      | answer_input_questions: 245<br>html_inline_markup: 18  |
| Quiz 1        | Market Research                           | answer_input_questions: 51                             |
| Quiz 1        | Mathematical Foundations of Generative AI | answer_input_questions: 51<br>html_inline_markup: 9    |
| Quiz 1        | Mathematical Thinking                     | none                                                   |
| Quiz 1        | OS                                        | answer_input_questions: 3<br>html_inline_markup: 36    |
| Quiz 1        | Programming in C                          | answer_input_questions: 134<br>html_inline_markup: 94  |
| Quiz 1        | PSM                                       | none                                                   |
| Quiz 1        | PSOSM                                     | none                                                   |
| Quiz 1        | RL                                        | answer_input_questions: 135<br>html_inline_markup: 28  |
| Quiz 1        | Speech Tech                               | none                                                   |
| Quiz 1        | Speech Technology                         | none                                                   |
| Quiz 1        | SPG                                       | answer_input_questions: 20                             |
| Quiz 1        | Stat Computing                            | answer_input_questions: 6                              |
| Quiz 1        | Statistical Computing                     | answer_input_questions: 60                             |
| Quiz 1        | Sw Engg                                   | none                                                   |
| Quiz 1        | Sw Testing                                | answer_input_questions: 52<br>html_inline_markup: 52   |
| Quiz 2        | Advanced Algorithms                       | answer_input_questions: 43<br>html_inline_markup: 1    |
| Quiz 2        | AI                                        | answer_input_questions: 617<br>html_inline_markup: 173 |
| Quiz 2        | Algorithmic Thinking                      | answer_input_questions: 16                             |
| Quiz 2        | Algo Thinking                             | answer_input_questions: 2<br>html_inline_markup: 3     |
| Quiz 2        | BBN                                       | answer_input_questions: 6<br>html_inline_markup: 2     |
| Quiz 2        | BDBN                                      | html_inline_markup: 4                                  |
| Quiz 2        | Computer Networks                         | answer_input_questions: 12                             |
| Quiz 2        | Computer System Design                    | answer_input_questions: 54                             |
| Quiz 2        | Computer System Designs                   | answer_input_questions: 4                              |
| Quiz 2        | Corporate Finance                         | html_inline_markup: 14                                 |
| Quiz 2        | CSD                                       | answer_input_questions: 28                             |
| Quiz 2        | Data Visualization                        | html_inline_markup: 6                                  |
| Quiz 2        | Data Viz                                  | html_inline_markup: 3                                  |
| Quiz 2        | Deep Learning                             | answer_input_questions: 373<br>html_inline_markup: 10  |
| Quiz 2        | DL(CV)                                    | answer_input_questions: 799<br>html_inline_markup: 124 |
| Quiz 2        | DLP                                       | answer_input_questions: 35                             |
| Quiz 2        | Financial Forensics                       | answer_input_questions: 14                             |
| Quiz 2        | Fin Forensics                             | none                                                   |
| Quiz 2        | Game Theory                               | answer_input_questions: 120                            |
| Quiz 2        | Game Theory and Strategy                  | answer_input_questions: 40                             |
| Quiz 2        | Industry 4.0                              | answer_input_questions: 87<br>html_inline_markup: 1    |
| Quiz 2        | i-NLP                                     | answer_input_questions: 66<br>html_inline_markup: 4    |
| Quiz 2        | LLM                                       | answer_input_questions: 216<br>html_inline_markup: 79  |
| Quiz 2        | LSM                                       | none                                                   |
| Quiz 2        | Managerial Economics                      | answer_input_questions: 445                            |
| Quiz 2        | Market Research                           | answer_input_questions: 97<br>html_inline_markup: 23   |
| Quiz 2        | Mathematical Foundations of Generative AI | answer_input_questions: 132                            |
| Quiz 2        | Mathematical Thinking                     | none                                                   |
| Quiz 2        | OS                                        | answer_input_questions: 20                             |
| Quiz 2        | PSM                                       | none                                                   |
| Quiz 2        | PSOSM                                     | none                                                   |
| Quiz 2        | RL                                        | answer_input_questions: 102                            |
| Quiz 2        | Speech Tech                               | none                                                   |
| Quiz 2        | Speech Technology                         | none                                                   |
| Quiz 2        | SPG                                       | answer_input_questions: 96                             |
| Quiz 2        | Stat Computing                            | none                                                   |
| Quiz 2        | Statistical Computing                     | none                                                   |
| Quiz 2        | Sw Engg                                   | html_inline_markup: 34                                 |
| Quiz 2        | Sw Testing                                | html_inline_markup: 16                                 |
| End Term Quiz | Advanced Algorithms                       | answer_input_questions: 67<br>html_inline_markup: 4    |
| End Term Quiz | AI                                        | answer_input_questions: 507<br>html_inline_markup: 370 |
| End Term Quiz | Algorithmic Thinking                      | answer_input_questions: 40                             |
| End Term Quiz | Algo Thinking                             | none                                                   |
| End Term Quiz | BBN                                       | none                                                   |
| End Term Quiz | BDBN                                      | answer_input_questions: 36<br>html_inline_markup: 24   |
| End Term Quiz | Computer Networks                         | answer_input_questions: 31                             |
| End Term Quiz | Computer System Design                    | answer_input_questions: 56                             |
| End Term Quiz | Computer Systems Design                   | answer_input_questions: 39                             |
| End Term Quiz | Corporate Finance                         | answer_input_questions: 30<br>html_inline_markup: 20   |
| End Term Quiz | CSD                                       | answer_input_questions: 72                             |
| End Term Quiz | Deep Learning                             | answer_input_questions: 414<br>html_inline_markup: 4   |
| End Term Quiz | DL(CV)                                    | answer_input_questions: 254                            |
| End Term Quiz | DLP                                       | answer_input_questions: 86<br>html_inline_markup: 44   |
| End Term Quiz | Financial Forensics                       | answer_input_questions: 94<br>html_inline_markup: 6    |
| End Term Quiz | Fin Forensics                             | answer_input_questions: 72                             |
| End Term Quiz | Game Theory                               | answer_input_questions: 134<br>html_inline_markup: 12  |
| End Term Quiz | Game Theory and Strategy                  | answer_input_questions: 138<br>html_inline_markup: 18  |
| End Term Quiz | Industry 4.0                              | answer_input_questions: 182<br>html_inline_markup: 21  |
| End Term Quiz | i-NLP                                     | answer_input_questions: 38<br>html_inline_markup: 8    |
| End Term Quiz | Intro to C Programming                    | answer_input_questions: 32<br>html_inline_markup: 11   |
| End Term Quiz | LLM                                       | answer_input_questions: 113<br>html_inline_markup: 13  |
| End Term Quiz | LSM                                       | none                                                   |
| End Term Quiz | Managerial Economics                      | answer_input_questions: 468<br>html_inline_markup: 26  |
| End Term Quiz | Market Research                           | answer_input_questions: 13                             |
| End Term Quiz | Mathematical Foundations of Generative AI | answer_input_questions: 8                              |
| End Term Quiz | Mathematical Thinking                     | none                                                   |
| End Term Quiz | OS                                        | answer_input_questions: 24                             |
| End Term Quiz | Programming in C                          | answer_input_questions: 78<br>html_inline_markup: 15   |
| End Term Quiz | PSM                                       | none                                                   |
| End Term Quiz | PSOSM                                     | answer_input_questions: 10                             |
| End Term Quiz | RL                                        | answer_input_questions: 108<br>html_inline_markup: 2   |
| End Term Quiz | Software Engineering                      | none                                                   |
| End Term Quiz | Speech Tech                               | none                                                   |
| End Term Quiz | SPG                                       | answer_input_questions: 70                             |
| End Term Quiz | Stat Computing                            | none                                                   |
| End Term Quiz | Statistical Computing                     | none                                                   |
| End Term Quiz | Sw Engg                                   | answer_input_questions: 4                              |
| End Term Quiz | Sw Testing                                | html_inline_markup: 6                                  |

## Issues

No parity issues found.

## Repeatable Command

```bash
AUDIT_SCOPE=degree bun run scripts/audit-python-course.ts
```
