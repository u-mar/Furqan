#!/bin/bash

# Download Quran data from api.quran.com and bundle it for offline use.
# Run this once to generate public/quran-data.json

set -e

PUBLIC_DIR="$(cd "$(dirname "$0")/../public" && pwd)"
OUTPUT_FILE="$PUBLIC_DIR/quran-data.json"
TEMP_DIR="$PUBLIC_DIR/temp-quran-data"

echo "Downloading Quran data from api.quran.com..."

# Create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Fetch all chapters
echo "Fetching chapters..."
curl -s "https://api.quran.com/api/v4/chapters" > "$TEMP_DIR/chapters.json"

# Get chapter count
CHAPTER_COUNT=$(jq '.chapters | length' "$TEMP_DIR/chapters.json")
echo "Found $CHAPTER_COUNT chapters"

# Process chapters
jq '.chapters | map({
  id: .id,
  name: (.name_arabic // .name_simple),
  englishName: (.english_name // .transliterated_name.name // .name_simple),
  versesCount: .verses_count
})' "$TEMP_DIR/chapters.json" > "$TEMP_DIR/chapters-min.json"

# Download verses for each chapter
for i in $(seq 1 $CHAPTER_COUNT); do
  CHAPTER_ID=$(jq -r ".chapters[$((i-1))].id" "$TEMP_DIR/chapters.json")
  CHAPTER_NAME=$(jq -r ".chapters[$((i-1))].name_simple" "$TEMP_DIR/chapters.json")

  echo "  Fetching Surah $CHAPTER_ID: $CHAPTER_NAME..."

  # Get total pages for this chapter
  PAGE_INFO=$(curl -s "https://api.quran.com/api/v4/verses/by_chapter/$CHAPTER_ID?fields=text_uthmani&words=true&word_fields=text_uthmani&per_page=50&page=1")
  TOTAL_PAGES=$(echo "$PAGE_INFO" | jq -r '.pagination.total_pages // 1')

  # Download all pages
  for page in $(seq 1 $TOTAL_PAGES); do
    curl -s "https://api.quran.com/api/v4/verses/by_chapter/$CHAPTER_ID?fields=text_uthmani&words=true&word_fields=text_uthmani&per_page=50&page=$page" > "$TEMP_DIR/chapter-$CHAPTER_ID-page-$page.json"
  done

  # Combine all pages for this chapter
  jq -s 'map(.verses[]) | select(. != null)' "$TEMP_DIR"/chapter-$CHAPTER_ID-page-*.json > "$TEMP_DIR/chapter-$CHAPTER_ID-verses.json"

  VERSE_COUNT=$(jq 'length' "$TEMP_DIR/chapter-$CHAPTER_ID-verses.json")
  echo "    Downloaded $VERSE_COUNT verses"
done

# Combine all verses by streaming through jq
echo "Combining all verses..."
echo '{"chapters": [], "verses": []}' > "$OUTPUT_FILE"

# Add chapters
jq --argjson chapters "$(cat "$TEMP_DIR/chapters-min.json")" '.chapters = $chapters' "$OUTPUT_FILE" > "$TEMP_DIR/output-with-chapters.json"

# Add verses by reading from stdin to avoid argument list issues
jq '.verses = input' "$TEMP_DIR/output-with-chapters.json" <(jq -s 'map(.[]) | select(. != null)' "$TEMP_DIR"/chapter-*-verses.json) > "$OUTPUT_FILE"

# Cleanup
rm -rf "$TEMP_DIR"

# Show stats
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
TOTAL_VERSES=$(jq '.verses | length' "$OUTPUT_FILE")

echo ""
echo "✓ Quran data saved to $OUTPUT_FILE"
echo "  File size: $FILE_SIZE"
echo "  $CHAPTER_COUNT chapters, $TOTAL_VERSES verses"
