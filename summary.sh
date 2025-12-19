#!/bin/bash

echo "=== RETRIEVAL SUMMARY ===="
echo ""
echo "✅ Successfully retrieved (20 shows):"
echo ""
for file in archived-shows-data/*.json; do
  if [ $(stat -f%z "$file") -gt 100 ]; then
    SHOW_ID=$(basename "$file" .json)
    SHOW_DATE=$(grep -o '"showDate":"[^"]*"' "$file" | cut -d'"' -f4)
    SIZE=$(ls -lh "$file" | awk '{print $5}')
    echo "  $SHOW_ID - $SHOW_DATE ($SIZE)"
  fi
done | sort -t'-' -k2

echo ""
echo "❌ Not found in archive (6 shows):"
echo ""
for file in archived-shows-data/*.json; do
  if [ $(stat -f%z "$file") -lt 100 ]; then
    SHOW_ID=$(basename "$file" .json)
    echo "  $SHOW_ID"
  fi
done | sort
