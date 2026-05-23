#!/bin/bash

# QuizPractice Scraper - Auto-restart Runner
# This script runs the scraper in a loop with auto-restart on timeout/crash
# To stop: touch .stop in the quiz-scraper directory

cd "$(dirname "$0")"

LOG_FILE="scraper.log"
STOP_FILE=".stop"
SUMMARY_FILE="../../data-new/scrape-run-summary.json"
MAX_ITERATIONS="${MAX_ITERATIONS:-25}"

echo "==================================="
echo "QuizPractice Scraper - Auto Runner"
echo "==================================="
echo "Log file: $LOG_FILE"
echo "To stop gracefully: touch $STOP_FILE"
echo ""

# Remove old stop file if exists
rm -f "$STOP_FILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to count scraped files
count_files() {
    find ../../data-new -type f -name "*.json" 2>/dev/null | wc -l
}

# Initial count
INITIAL_COUNT=$(count_files)
log "Starting scraper. Current file count: $INITIAL_COUNT"

ITERATION=1

while true; do
    # Check for stop signal
    if [ -f "$STOP_FILE" ]; then
        log "Stop signal detected. Exiting gracefully..."
        rm -f "$STOP_FILE"
        break
    fi

    log "=== Iteration $ITERATION ==="

    # Show progress
    CURRENT_COUNT=$(count_files)
    NEW_FILES=$((CURRENT_COUNT - INITIAL_COUNT))
    log "Progress: $CURRENT_COUNT files total (+$NEW_FILES since start)"

    # Run the scraper
    log "Starting scraper..."
    bun run scrape >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?

    COMPLETE=0
    if [ -f "$SUMMARY_FILE" ]; then
        if bun -e "const s=await Bun.file('$SUMMARY_FILE').json(); const actionable=(s.failures ?? []).filter(f => f.stage !== 'paper-quarantine'); process.exit(actionable.length === 0 ? 0 : 1)" >/dev/null 2>&1; then
            COMPLETE=1
        fi
    fi

    if [ $EXIT_CODE -eq 0 ] && [ $COMPLETE -eq 1 ]; then
        log "Scraper completed successfully with no recorded failures!"
        break
    else
        if [ $EXIT_CODE -eq 0 ]; then
            log "Scraper exited cleanly but is not complete yet. Restarting in 10 seconds..."
        else
            log "Scraper exited with code $EXIT_CODE. Restarting in 10 seconds..."
        fi
        if [ "$ITERATION" -ge "$MAX_ITERATIONS" ]; then
            log "Reached MAX_ITERATIONS=$MAX_ITERATIONS. Stop for manual inspection."
            break
        fi
        sleep 10
    fi

    ITERATION=$((ITERATION + 1))
done

# Final stats
FINAL_COUNT=$(count_files)
TOTAL_NEW=$((FINAL_COUNT - INITIAL_COUNT))
log "=== Scraping Complete ==="
log "Total files: $FINAL_COUNT"
log "New files scraped: $TOTAL_NEW"
log "Check ../../data-new/ directory for results"
