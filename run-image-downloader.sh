#!/bin/bash

LOG_FILE="image-downloader.log"
STOP_FILE=".stop"

rm -f "$STOP_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting image downloader" | tee -a "$LOG_FILE"

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running image downloader..." | tee -a "$LOG_FILE"
    
    npx tsx src/download-images.ts 2>&1 | tee -a "$LOG_FILE"
    
    EXIT_CODE=$?
    
    if [ -f "$STOP_FILE" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stop signal detected. Exiting." | tee -a "$LOG_FILE"
        rm -f "$STOP_FILE"
        exit 0
    fi
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Image downloader completed successfully!" | tee -a "$LOG_FILE"
        exit 0
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Image downloader crashed (exit code: $EXIT_CODE). Restarting in 10s..." | tee -a "$LOG_FILE"
    sleep 10
done
