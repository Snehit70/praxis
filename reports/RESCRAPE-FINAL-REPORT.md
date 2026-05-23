# QuizPractice Rescrape Final Report

Generated after the May 2026 rescrape of QuizPractice data into `data-new/` and `images-new/`.

## Executive Summary

The rescrape is effectively complete.

- Paper JSONs available: `4,829`
- Paper JSONs newly added versus old `data/`: `992`
- Images available: `74,137`
- Images newly added versus old `images/`: `47,485`
- Remaining unavailable papers: `21`, all from `Quiz 2`, repeatedly returning upstream `HTTP 500`

The remaining `21` papers were retried after quarantine and still failed. Treat them as upstream-broken unless the source site fixes them later.

## Final Paper Counts

Comparison against old `data/`:

| Metric | Count |
| --- | ---: |
| Old paper JSONs | 3,877 |
| New paper JSONs | 4,829 |
| Overlap with old data | 3,837 |
| Newly added paper JSONs | 992 |

New paper JSONs by exam:

| Exam | Present in `data-new/` | Old overlap | Newly added |
| --- | ---: | ---: | ---: |
| Quiz 1 | 1,804 | 1,777 | 27 |
| Quiz 2 | 1,407 | 483 | 924 |
| End Term Quiz | 1,617 | 1,576 | 41 |
| OPPE | 1 | 1 | 0 |

## Index Completeness

The scraper saved `258` course indexes. These indexes reference `4,850` papers.

| Exam | Course indexes | Referenced papers | Present paper JSONs | Missing |
| --- | ---: | ---: | ---: | ---: |
| Quiz 1 | 93 | 1,804 | 1,804 | 0 |
| Quiz 2 | 69 | 1,428 | 1,407 | 21 |
| End Term Quiz | 95 | 1,617 | 1,617 | 0 |
| OPPE | 1 | 1 | 1 | 0 |
| Total | 258 | 4,850 | 4,829 | 21 |

## Missing Papers

All missing papers are in `Quiz 2`. Each was retried after quarantine and returned `HTTP 500 Internal Server Error` again. Their known failure count reached `4`.

| Course | Paper UUID | Paper name | Expected path |
| --- | --- | --- | --- |
| Statistics1 | `e058189d-f62` | IIT M FOUNDATION AN EXAM QDF4 01 Dec | `Quiz 2/Statistics1/e058189d-f62.json` |
| Statistics1 | `597be9f8-8e69-4aef-9053-21dc7f39060f` | 2024 Aug04: IIT M AN EXAM QDD4 | `Quiz 2/Statistics1/597be9f8-8e69-4aef-9053-21dc7f39060f.json` |
| Statistics1 | `8605cea2-db2e-4616-a5f6-600c78cd7369` | 2022 July: IIT M QUALIFIER EXAM QPA1 | `Quiz 2/Statistics1/8605cea2-db2e-4616-a5f6-600c78cd7369.json` |
| MLP | `4833544e-f906-4277-a483-3099d0d83ad0` | IIT M DIPLOMA QUIZ2 EXAM QPF1 10 July 2022 | `Quiz 2/MLP/4833544e-f906-4277-a483-3099d0d83ad0.json` |
| Business Analytics | `a46f30cd-eac` | IIT M DIPLOMA AN EXAM QDD3 03 Aug | `Quiz 2/Business Analytics/a46f30cd-eac.json` |
| Business Analytics | `53e26899-d4f` | IIT M DEGREE AN EXAM QDB3 03 Aug 2025 | `Quiz 2/Business Analytics/53e26899-d4f.json` |
| BDM | `818203bf-095` | IIT M DIPLOMA AN EXAM QDD3 16 Mar | `Quiz 2/BDM/818203bf-095.json` |
| English1 | `bdfd09d8-8674-423a-ad31-fdd9512c6032` | 2024 Aug04: IIT M AN EXAM QDF3 | `Quiz 2/English1/bdfd09d8-8674-423a-ad31-fdd9512c6032.json` |
| Sw Engg | `849f3878-723` | IIT M IMPROVEMENT AN EXAM QIA2 03 Aug | `Quiz 2/Sw Engg/849f3878-723.json` |
| Sw Engg | `e9927a83-ed5` | IIT M DEGREE AN EXAM QDB2 03 Aug 2025 | `Quiz 2/Sw Engg/e9927a83-ed5.json` |
| Sw Testing | `cc3d9568-934` | IIT M IMPROVEMENT AN EXAM QIO4 03 Aug | `Quiz 2/Sw Testing/cc3d9568-934.json` |
| Data Viz | `acfcc258-514f-45ae-8855-127b14e76934` | 2024 Aug04: IIT M AN EXAM QIM4 | `Quiz 2/Data Viz/acfcc258-514f-45ae-8855-127b14e76934.json` |
| DL(CV) | `32e31b4e-4dd` | IIT M IMPROVEMENT AN EXAM QIT3 03 Aug | `Quiz 2/DL(CV)/32e31b4e-4dd.json` |
| Advanced Algorithms | `0a5d8d17-174` | IIT M DEGREE AN EXAM QDB4 01 Dec 2024 | `Quiz 2/Advanced Algorithms/0a5d8d17-174.json` |
| Market Research | `53e26899-d4f` | IIT M DEGREE AN EXAM QDB3 03 Aug 2025 | `Quiz 2/Market Research/53e26899-d4f.json` |
| Design Thinking | `0a5d8d17-174` | IIT M DEGREE AN EXAM QDB4 01 Dec 2024 | `Quiz 2/Design Thinking/0a5d8d17-174.json` |
| Speech Technology | `eaf3c03b-705` | IIT M IMPROVEMENT AN EXAM QIP2 03 Aug | `Quiz 2/Speech Technology/eaf3c03b-705.json` |
| Corporate Finance | `2d98a0bf-27d` | IIT M DEGREE AN EXAM QDB3 16 Mar 2025 | `Quiz 2/Corporate Finance/2d98a0bf-27d.json` |
| Corporate Finance | `a63e849b-c7c` | IIT M IMPROVEMENT AN EXAM QIM2 01 Dec | `Quiz 2/Corporate Finance/a63e849b-c7c.json` |
| Algorithmic Thinking in Bio | `c807c0fa-3ff` | IIT M IMPROVEMENT AN EXAM QIA4 03 Aug | `Quiz 2/Algorithmic Thinking in Bio/c807c0fa-3ff.json` |
| Programming Concepts Indian Institute Of Technology, Madras - Bs In Data Science And Applications Using Java | `738b9700-bd4` | Programming Concepts Indian Institute Of Technology, Madras - Bs In Data Science And Applications Using Java 06 Apr 26 | `Quiz 2/Programming Concepts Indian Institute Of Technology, Madras - Bs In Data Science And Applications Using Java/738b9700-bd4.json` |

## Image Counts

Comparison against old `images/`:

| Metric | Count |
| --- | ---: |
| Old images | 26,652 |
| New images | 74,137 |
| Overlap with old images | 26,652 |
| Newly added images | 47,485 |
| Newly added share | 64.05% |
| Failed image downloads | 0 |

The final image directory is `images-new/`.

## Scraper Improvements

The recovered rescrape tooling now includes:

- Bun-compatible cookie and XSRF handling
- Adaptive rate limiting with persisted delay state
- Existing JSON cache copy from `data/` to `data-new/`
- Known-failure quarantine for repeated upstream `5xx` paper pages
- Manual retry mode for quarantined papers
- Resume state so restarts skip completed courses
- Cached metadata and course index reuse
- Image downloader cache awareness
- Image downloader parallel worker support
- Atomic image writes with temporary `.part-*` files

Important files:

| File | Purpose |
| --- | --- |
| `data-new/scrape-run-summary.json` | Last scraper summary |
| `data-new/scrape-known-failures.json` | Persistent known `5xx` paper failures |
| `data-new/scrape-course-manifest.json` | Saved course/index manifest |
| `data-new/scrape-resume-state.json` | Completed-course resume state |
| `images-new/image-download-summary.json` | Final image download summary |
| `tools/rescrape/scraper.log` | JSON scraper log |
| `tools/rescrape/image-downloader.log` | Image downloader log |

## Useful Commands

Run the JSON scraper:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
./run-scraper.sh
```

Retry quarantined papers once:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
SCRAPER_RETRY_KNOWN_FAILURES=1 MAX_ITERATIONS=1 ./run-scraper.sh
```

Force a fully fresh scrape:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
SCRAPER_FORCE=1 ./run-scraper.sh
```

Disable cached index reuse:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
SCRAPER_REUSE_INDEX_CACHE=0 ./run-scraper.sh
```

Extract image URLs from `data-new/`:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
bun run extract-images
```

Download images with moderate parallelism:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
IMAGE_DOWNLOAD_CONCURRENCY=12 IMAGE_DOWNLOAD_DELAY_MS=25 ./run-image-downloader.sh
```

Download images aggressively:

```bash
cd /home/snehit/projects/praxis/tools/rescrape
IMAGE_DOWNLOAD_CONCURRENCY=24 IMAGE_DOWNLOAD_DELAY_MS=0 ./run-image-downloader.sh
```

## Related Reports

- `reports/website-discovery.md`
- `reports/QUIZPRACTICE-REVERSE-ENGINEERING.md`
- `reports/endpoint-probes/endpoint-probes.md`
- `reports/raw-data-analysis.md`

## Final Interpretation

The project now has a much more complete local QuizPractice dataset. The scraper recovered all currently available discovered papers except for `21` `Quiz 2` entries that the upstream application itself returns as `HTTP 500`.

Those missing entries should stay tracked in `scrape-known-failures.json`. A future retry is reasonable if the source site changes, but repeated immediate retries are not expected to help.
