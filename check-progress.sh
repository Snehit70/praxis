#!/bin/bash

# QuizPractice Scraper - Progress Monitor
# Shows current scraping progress

cd "$(dirname "$0")"

echo "==================================="
echo "QuizPractice Scraper - Progress"
echo "==================================="
echo ""

# Count files by exam
echo "Files by Exam:"
for exam_dir in data/*/; do
    if [ -d "$exam_dir" ]; then
        exam_name=$(basename "$exam_dir")
        file_count=$(find "$exam_dir" -type f -name "*.json" | wc -l)
        echo "  $exam_name: $file_count files"
    fi
done

echo ""

# Total count
total=$(find data -type f -name "*.json" 2>/dev/null | wc -l)
echo "Total files scraped: $total"

# Disk usage
size=$(du -sh data 2>/dev/null | cut -f1)
echo "Total size: $size"

echo ""

# Show last 10 log lines if log exists
if [ -f "scraper.log" ]; then
    echo "Last 10 log entries:"
    echo "-----------------------------------"
    tail -n 10 scraper.log
fi
