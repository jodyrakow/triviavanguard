#!/bin/bash

# Array of show IDs
SHOW_IDS=(
  "recUY2gjbw1Vlg9eE"
  "recJMyBT3zK4uD03U"
  "recw6sVMAd7d0KQJc"
  "recpQN986JNpoAsEj"
  "recOX2SuCvyQISe9a"
  "recDLNBpCiEmuemTB"
  "rec8YMRvwPh7S1wSC"
  "reczwxHSA7vdki1GS"
  "rec77iOrjAs4PTyAP"
  "recXTQTpA9ci5N8Gd"
  "recnDymnQAko2qQKT"
  "recIO1y5uPmNofrBf"
  "recJFUX8QFSZf62Ro"
  "recrMACfmWG7gqOBD"
  "recFZOmryydr7Z5Cg"
  "recQvSHw1j45D60uu"
  "recfCrRrk8n2sNnFs"
  "recG5PTnC30R8LNcr"
  "recDBH9a3oL0mFLpf"
  "recNDIB0Rt3oBOjPp"
  "rechoYY8jUZHHd172"
  "recL43xd7OXE3iGe6"
  "recbE4mTjJYIZIhAk"
  "recGhDR7ivfj5ArEY"
  "recynezay65GOYXqk"
  "rec9Lk7Oy2G0zKk5C"
)

OUTPUT_DIR="archived-shows-data"

echo "Fetching archived data for ${#SHOW_IDS[@]} shows..."
echo ""

for SHOW_ID in "${SHOW_IDS[@]}"; do
  echo "Fetching $SHOW_ID..."
  
  # Fetch the data
  curl -s "http://localhost:8888/.netlify/functions/supaGetArchivedData?showId=$SHOW_ID" \
    -o "$OUTPUT_DIR/${SHOW_ID}.json"
  
  # Check if the file was created and has content
  if [ -s "$OUTPUT_DIR/${SHOW_ID}.json" ]; then
    # Check if it's an error response
    if grep -q '"error"' "$OUTPUT_DIR/${SHOW_ID}.json"; then
      echo "  ❌ Error fetching $SHOW_ID"
      cat "$OUTPUT_DIR/${SHOW_ID}.json"
      echo ""
    else
      # Get the show name and date from the response
      SHOW_NAME=$(grep -o '"showName":"[^"]*"' "$OUTPUT_DIR/${SHOW_ID}.json" | head -1 | cut -d'"' -f4)
      SHOW_DATE=$(grep -o '"showDate":"[^"]*"' "$OUTPUT_DIR/${SHOW_ID}.json" | head -1 | cut -d'"' -f4)
      echo "  ✅ Saved: $SHOW_NAME ($SHOW_DATE)"
    fi
  else
    echo "  ❌ Failed to fetch $SHOW_ID"
  fi
done

echo ""
echo "Done! Archived data saved to $OUTPUT_DIR/"
