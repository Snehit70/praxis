# Praxis Rescrape Tools

Recovered from git commit `11b6382` and isolated from the main app.

## Purpose

Fetch fresh QuizPractice data into a separate directory so it can be compared
against the current checked-in `data/` tree before anything is replaced.

## Defaults

- Scraped JSON output: `../../data-new/`
- Existing-paper cache source: `../../data/`
- Extracted image manifest: `../../data-new-image-urls.json`
- Downloaded images: `../../images-new/`
- Existing-image cache source: `../../images/`
- Rate limiter state: `scraper-state.json`
- Graceful stop file: `.stop`

## Setup

```bash
cd tools/rescrape
bun install
```

## Scrape JSON

```bash
cd tools/rescrape
bun run scrape
```

For the auto-restart wrapper:

```bash
cd tools/rescrape
./run-scraper.sh
```

Stop the wrapper gracefully:

```bash
touch tools/rescrape/.stop
```

## Discover Current Site Shape

This does not do a full scrape. It samples the current Inertia pages,
paper-list endpoint, one paper per exam, asset bundle names, and known
extra endpoint patterns.

```bash
cd tools/rescrape
bun run discover-site
```

Outputs:

- `../../reports/website-discovery.md`
- `../../reports/website-discovery.json`

## Probe Read-Only Endpoints

This uses a few real sampled question IDs and checks read-only endpoints for
response shape/status. It avoids admin, upload, payment, and mutation routes.

```bash
cd tools/rescrape
bun run probe-endpoints
```

Outputs:

- `../../reports/endpoint-probes/endpoint-probes.md`
- `../../reports/endpoint-probes/endpoint-probes.json`

## Extract Image References

```bash
cd tools/rescrape
bun run extract-images
```

## Download Images

```bash
cd tools/rescrape
bun run download-images
```

## Useful Overrides

```bash
SCRAPER_REQUEST_TIMEOUT_MS=45000 bun run scrape
SCRAPER_MAX_RETRIES=5 bun run scrape
SCRAPER_FORCE=1 bun run scrape
SCRAPER_USE_EXISTING_CACHE=0 bun run scrape
SCRAPER_REUSE_INDEX_CACHE=0 bun run scrape
SCRAPER_RESUME_FILE=/tmp/scrape-resume-state.json bun run scrape
SCRAPER_EXISTING_DATA_DIR=/tmp/old-data bun run scrape
SCRAPER_OUTPUT_DIR=/tmp/praxis-data-new bun run scrape
IMAGE_URLS_FILE=/tmp/image-urls.json bun run extract-images
IMAGE_OUTPUT_DIR=/tmp/images-new bun run download-images
IMAGE_USE_EXISTING_CACHE=0 bun run download-images
IMAGE_EXISTING_DIR=/tmp/old-images bun run download-images
IMAGE_CDN_BASE=https://example-cdn.test bun run download-images
```

## Safety Rule

Do not write directly into `../../data/`. Always scrape into `data-new/`,
generate a diff/report, and only then decide what to import.

By default, the scraper uses `../../data/` as a cache. It still fetches live
metadata and paper indexes, but if a discovered paper already exists locally at
the same `exam/course/paperUuid.json` path, it copies that file into
`data-new/` and skips the expensive paper fetch. Disable with
`SCRAPER_USE_EXISTING_CACHE=0`.

The scraper is also restart-aware. It writes
`data-new/scrape-resume-state.json` after each completed course and reuses
saved `metadata.json` and `index.json` files on the next run. That means a
restart can skip completed courses instead of starting network discovery from
Quiz 1 again. Disable saved index reuse with `SCRAPER_REUSE_INDEX_CACHE=0`, or
force a fully fresh pass with `SCRAPER_FORCE=1`.

The image downloader is also cache-aware. It never overwrites existing files in
`images-new/`; if an image is missing there but present in `images/`, it copies
the cached file and only downloads from the CDN when both are missing.
