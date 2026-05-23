# Praxis Raw Data Analysis

Generated: 2026-05-06T15:53:49.346Z

## Executive Summary

- Raw data contains 3,874 paper JSON files, but only 354 unique paper UUIDs. This confirms the same paper event is intentionally repeated across course folders.
- App-importable dataset contains 90,683 questions and 242,621 options after applying `shouldIncludeQuestion()`.
- 3,988 raw questions (4.2%) are excluded by the app filter, mostly zero-mark instructional prompts.
- Coverage is broad: 84 canonical courses across 4 exam types. OPPE is sparse with 1 paper variant(s) and 10 importable questions.
- The biggest data quality risks are duplicate question numbers within some paper variants, alias-heavy course folders, and answer-shape anomalies that need product decisions rather than blind cleanup.

## Inventory

| Metric                            | Count  |
| --------------------------------- | ------ |
| Exam folders / metadata files     | 4      |
| Course folders                    | 201    |
| Index files                       | 201    |
| Paper JSON files                  | 3874   |
| Unique exam UUIDs                 | 4      |
| Unique course UUIDs               | 122    |
| Raw course names                  | 122    |
| Canonical courses                 | 84     |
| Unique paper UUIDs                | 354    |
| Unique importable question UUIDs  | 90683  |
| Unique image filenames referenced | 124498 |

## Raw vs App-Importable

| Metric               | Count   | Share  |
| -------------------- | ------- | ------ |
| Raw questions        | 94,671  | 100.0% |
| Importable questions | 90,683  | 95.8%  |
| Excluded questions   | 3,988   | 4.2%   |
| Importable options   | 242,621 |        |
| Question image refs  | 45,815  |        |
| Option image refs    | 78,695  |        |

## By Exam

| Exam          | Paper files | Questions | Options |
| ------------- | ----------- | --------- | ------- |
| Quiz 1        | 1,784       | 35,979    | 91,799  |
| End Term Quiz | 1,606       | 46,071    | 127,655 |
| Quiz 2        | 483         | 8,623     | 23,167  |
| OPPE          | 1           | 10        | 0       |

## By Year

| Year | Paper files | Questions |
| ---- | ----------- | --------- |
| 2022 | 519         | 13,803    |
| 2023 | 719         | 17,106    |
| 2024 | 1,116       | 26,137    |
| 2025 | 1,520       | 33,637    |

## Top Courses By Questions

| Canonical course                            | Questions | Level                   |
| ------------------------------------------- | --------- | ----------------------- |
| Mathematics for Data Science II             | 5,154     | Foundation              |
| Statistics for Data Science II              | 4,234     | Foundation              |
| English I                                   | 3,977     | Foundation              |
| English II                                  | 3,849     | Foundation              |
| Machine Learning Techniques                 | 3,401     | Diploma in Data Science |
| Computational Thinking                      | 3,332     | Foundation              |
| Programming, Data Structures and Algorithms | 3,042     | Diploma in Programming  |
| Modern Application Development I            | 2,867     | Diploma in Programming  |
| Database Management Systems                 | 2,750     | Diploma in Programming  |
| Modern Application Development II           | 2,722     | Diploma in Programming  |
| Machine Learning Foundations                | 2,614     | Diploma in Data Science |
| Machine Learning Practice                   | 2,599     | Diploma in Data Science |
| Programming Concepts using Java             | 2,550     | Diploma in Programming  |
| Business Analytics                          | 2,461     | Diploma in Data Science |
| Statistics for Data Science I               | 2,295     | Foundation              |
| Programming in Python                       | 2,261     | Foundation              |
| AI: Search Methods for Problem Solving      | 2,248     | Degree                  |
| Tools in Data Science                       | 1,951     | Diploma in Data Science |
| Mathematics for Data Science I              | 1,849     | Foundation              |
| Deep Learning                               | 1,818     | Degree                  |
| Software Testing                            | 1,698     | Degree                  |
| Deep Learning for Computer Vision           | 1,584     | Degree                  |
| Managerial Economics                        | 1,578     | Degree                  |
| Programming in C                            | 1,510     | Degree                  |
| Market Research                             | 1,484     | Degree                  |
| System Commands                             | 1,462     | Diploma in Programming  |
| Business Data Management                    | 1,444     | Diploma in Data Science |
| Financial Forensics                         | 1,401     | Degree                  |
| Game Theory and Strategy                    | 1,307     | Degree                  |
| Electronics Elective                        | 1,250     | Other                   |

## Course Level Coverage

| Level                   | Questions | Share |
| ----------------------- | --------- | ----- |
| Foundation              | 26,951    | 29.7% |
| Degree                  | 25,985    | 28.7% |
| Diploma in Programming  | 15,393    | 17.0% |
| Diploma in Data Science | 14,695    | 16.2% |
| Other                   | 7,659     | 8.4%  |

## Question Types

| Type          | Questions | Share |
| ------------- | --------- | ----- |
| MCQ           | 49,205    | 54.3% |
| SA            | 19,627    | 21.6% |
| MSQ           | 12,642    | 13.9% |
| COMPREHENSION | 9,199     | 10.1% |
| OPPE          | 10        | 0.0%  |

## Marks Distribution

| Mark  | Questions | Share |
| ----- | --------- | ----- |
| 2.00  | 20,945    | 23.1% |
| 1.00  | 20,605    | 22.7% |
| 3.00  | 18,549    | 20.5% |
| 4.00  | 10,616    | 11.7% |
| 0.00  | 9,963     | 11.0% |
| 5.00  | 3,749     | 4.1%  |
| 6.00  | 1,734     | 1.9%  |
| 4.50  | 1,338     | 1.5%  |
| 1.50  | 758       | 0.8%  |
| 0.50  | 707       | 0.8%  |
| 7.00  | 697       | 0.8%  |
| 8.00  | 333       | 0.4%  |
| 2.50  | 219       | 0.2%  |
| 10.00 | 52        | 0.1%  |
| 30.00 | 38        | 0.0%  |
| 32.00 | 38        | 0.0%  |
| 15.00 | 36        | 0.0%  |
| 1.25  | 28        | 0.0%  |
| 16.00 | 28        | 0.0%  |
| 0.55  | 24        | 0.0%  |

## Answer Shape

| Metric                                  | Count  | Share |
| --------------------------------------- | ------ | ----- |
| Questions with zero options             | 28,837 | 31.8% |
| Questions with no correct option        | 28,837 | 31.8% |
| Questions with multiple correct options | 11,923 | 13.1% |
| MCQ with multiple correct options       | 0      | 0.0%  |
| MSQ with single correct option          | 719    | 5.7%  |
| SA with options                         | 0      | 0.0%  |
| Positive-score options                  | 76,849 | 31.7% |
| Negative-score options                  | 0      | 0.0%  |
| Null option_number                      | 82,499 | 34.0% |

## Options Per Question

| Options | Questions | Share |
| ------- | --------- | ----- |
| 0       | 28,837    | 31.8% |
| 2       | 5,397     | 6.0%  |
| 3       | 1,666     | 1.8%  |
| 4       | 48,948    | 54.0% |
| 5       | 4,736     | 5.2%  |
| 6       | 761       | 0.8%  |
| 7       | 140       | 0.2%  |
| 8       | 31        | 0.0%  |
| 9       | 137       | 0.2%  |
| 10      | 15        | 0.0%  |
| 12      | 15        | 0.0%  |

Option quantiles: min 0, p25 0, median 4, p75 4, p90 4, max 12, avg 2.68.

## Media Shape

| Metric                      | Count  | Share |
| --------------------------- | ------ | ----- |
| Text-only questions         | 45,791 | 50.5% |
| Image-only questions        | 33,473 | 36.9% |
| Text + image questions      | 11,409 | 12.6% |
| No text and no image        | 10     | 0.0%  |
| Whitespace-only text fields | 947    |       |
| Question image refs         | 45,815 |       |
| Option image refs           | 78,695 |       |

| Question image slot | Refs   |
| ------------------- | ------ |
| question_image_1    | 44,882 |
| question_image_2    | 738    |
| question_image_3    | 135    |
| question_image_4    | 44     |
| question_image_5    | 13     |
| question_image_7    | 3      |

## Paper Size Distribution

Importable questions per paper variant: min 0, p25 16, median 21, p75 26, p90 39, max 70, avg 23.41.

## Duplicate / Reuse Signals

| Metric                                 | Count |
| -------------------------------------- | ----- |
| Paper UUIDs used by multiple files     | 349   |
| Question UUIDs reused across contexts  | 0     |
| Question hashes reused across contexts | 6204  |
| Recorded issues                        | 6481  |
| Missing paper files                    | 6     |
| Unresolved courses                     | 0     |
| Duplicate question numbers             | 6437  |
| Duplicate option text instances        | 26    |

Top repeated paper UUIDs:

| Paper UUID                           | File count |
| ------------------------------------ | ---------- |
| 00966090-429                         | 15         |
| 01b0b21d-9353-47a8-93ad-399d53e8c1a2 | 15         |
| 01d756b7-062                         | 15         |
| 04e274ff-ef4                         | 15         |
| 05793a78-1ab7-43ce-9e7d-41f23fef4713 | 15         |
| 05c6aa14-22c                         | 15         |
| 09439147-c19                         | 15         |
| 0af4d6f8-509                         | 15         |
| 0cdb4de2-601f-41ab-8c8a-5e3495019629 | 15         |
| 10b10ecc-2a7d-48dd-96ff-c58d2cecceef | 15         |
| 130805f1-2ac9-4ce9-95fe-5ccdca0615b3 | 15         |
| 131b37b0-670a-4928-81c4-c53f3cf14c8b | 15         |
| 1418cd52-e91                         | 15         |
| 152e6be3-dfb                         | 15         |
| 15c0d3b1-c93                         | 15         |
| 174ccd12-474                         | 15         |
| 181df55f-f84                         | 15         |
| 18fd243b-dc89-454b-835a-c6c945aacae4 | 15         |
| 1b643684-c4a5-4dc1-93c4-515890d5e028 | 15         |
| 1b763c4a-a83                         | 15         |

## Course Alias Clusters

| Canonical course                          | Observed aliases / folders                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Algorithmic Thinking                      | Algo Thinking, Algorithmic Thinking                                                          |
| Big Data and Biological Networks          | BBN, BDBN                                                                                    |
| Business Analytics                        | BA, Business Analytics                                                                       |
| Computer Systems Design                   | CSD, Computer System Design, Computer System Designs, Computer Systems Design                |
| Data Visualization Design                 | DVD, Data Visualization, Data Viz                                                            |
| Electronics Elective                      | EEC, EFTL, EPD, ESTC, ETM, SDVL                                                              |
| English I                                 | ES English1, English 1, English1                                                             |
| English II                                | ES English2, English II, English2                                                            |
| Financial Forensics                       | Fin Forensics, Financial Forensics                                                           |
| Game Theory and Strategy                  | Game Theory, Game Theory and Strategy                                                        |
| Introduction to Linux                     | Intro to Linux, Intro to the Linux Shell                                                     |
| Mathematics for Data Science I            | Maths 1, Maths1                                                                              |
| Modern Application Development I          | App dev1, AppDev1                                                                            |
| Modern Application Development II         | App dev2, AppDev2                                                                            |
| Privacy & Security in Online Social Media | PSM, PSOSM                                                                                   |
| Programming in C                          | Intro C programming, Intro to C Programming, Introduction to C Programming, Programming in C |
| Programming in Python                     | Intro to python, Programming in Python                                                       |
| Sensors and Applications                  | Sensors and Application, Sensors and Applications                                            |
| Speech Technology                         | Speech Tech, Speech Technology                                                               |
| Statistical Computing                     | Stat Computing, Statistical Computing                                                        |
| Statistics for Data Science I             | Statistics1, Stats-1, Stats1                                                                 |
| Statistics for Data Science II            | Statistics2, Stats2                                                                          |

## Critical Data Issues

1. Course aliases are substantial. The app needs canonical course names for display and aggregation, but source paths should remain available for traceability.
2. OPPE is genuinely sparse in the current raw tree compared with other exams.
3. Duplicate question numbers exist inside some paper variants and should be handled by sorting on `question_num_long` as a secondary key.
4. SA questions often have no options, so answer validation needs a separate path from MCQ/MSQ.
5. Some MCQ/MSQ correctness patterns do not match simple assumptions; the UI should trust `question_type` plus option scores/correctness carefully.
6. Paper UUID alone is not a safe primary key for app display. Use exam + course + paper UUID, matching the current Postgres import.

## Recommended Fixes

P0:
- Keep `paper_variants.id = examUuid:courseUuid:paperUuid`; do not collapse by paper UUID.
- Add an import validation step that emits this report and fails only on true blockers: missing files, unresolved courses, invalid required fields.
- Use canonical course names in navigation/search, but preserve raw course labels and source paths.

P1:
- Add regression tests for `shouldIncludeQuestion()`, especially hall-ticket prompts, zero-mark non-instructional questions, and COMPREHENSION rows.
- Add a data quality page or generated JSON consumed by the app for coverage stats.
- Add explicit handling for SA/OPPE answer rendering instead of treating every answer as option-based.

P2:
- Add duplicate-hash exploration for related-question/practice recommendations.
- Normalize aliases in metadata/import and expose alternate names in search.
- Add media existence checks against the R2 object list if a bucket manifest is available.

## Engineer Handoff

The raw data is usable and much richer than the unique paper UUID count suggests. The central rule is that paper UUIDs repeat by design across course folders; the app should work with paper variants, not global papers. The current import model is directionally correct, but it needs a reproducible validation/reporting step and better product handling for aliases, sparse OPPE coverage, SA questions, and duplicate/reused question signals.
