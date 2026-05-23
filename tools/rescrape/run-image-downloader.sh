#!/bin/bash

cd "$(dirname "$0")"

LOG_FILE="image-downloader.log"
STOP_FILE=".stop"
SUMMARY_FILE="../../images-new/image-download-summary.json"
MAX_ITERATIONS="${MAX_ITERATIONS:-500}"

rm -f "$STOP_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting image downloader" | tee -a "$LOG_FILE"

ITERATION=1

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running image downloader..." | tee -a "$LOG_FILE"

    bun run download-images 2>&1 | tee -a "$LOG_FILE"

    EXIT_CODE=$?

    if [ -f "$STOP_FILE" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stop signal detected. Exiting." | tee -a "$LOG_FILE"
        rm -f "$STOP_FILE"
        exit 0
    fi

    COMPLETE=0
    if [ -f "$SUMMARY_FILE" ]; then
        if bun -e "const s=await Bun.file('$SUMMARY_FILE').json(); const done=(s.downloaded ?? 0)+(s.copiedFromExisting ?? 0)+(s.skipped ?? 0)+(s.failed ?? 0); process.exit(done >= (s.total ?? Infinity) ? 0 : 1)" >/dev/null 2>&1; then
            COMPLETE=1
        fi
    fi

    if [ $EXIT_CODE -eq 0 ] && [ $COMPLETE -eq 1 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Image downloader completed successfully!" | tee -a "$LOG_FILE"
        exit 0
    fi

    if [ "$ITERATION" -ge "$MAX_ITERATIONS" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reached MAX_ITERATIONS=$MAX_ITERATIONS. Stop for manual inspection." | tee -a "$LOG_FILE"
        exit 1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Image downloader incomplete or crashed (exit code: $EXIT_CODE). Restarting in 10s..." | tee -a "$LOG_FILE"
    ITERATION=$((ITERATION + 1))
    sleep 10
done
