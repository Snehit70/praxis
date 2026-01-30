#!/bin/bash

# QuizPractice Scraper - Auto-restart Runner
# This script runs the scraper in a loop with auto-restart on timeout/crash
# To stop: touch .stop in the quiz-scraper directory

cd "$(dirname "$0")"

LOG_FILE="scraper.log"
STOP_FILE=".stop"

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
    find data -type f -name "*.json" 2>/dev/null | wc -l
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
    npm start >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        log "Scraper completed successfully!"
        break
    else
        log "Scraper exited with code $EXIT_CODE (likely timeout). Restarting in 5 seconds..."
        sleep 5
    fi
    
    ITERATION=$((ITERATION + 1))
done

# Final stats
FINAL_COUNT=$(count_files)
TOTAL_NEW=$((FINAL_COUNT - INITIAL_COUNT))
log "=== Scraping Complete ==="
log "Total files: $FINAL_COUNT"
log "New files scraped: $TOTAL_NEW"
log "Check data/ directory for results"
