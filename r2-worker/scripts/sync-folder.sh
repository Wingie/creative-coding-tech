#!/usr/bin/env bash
# Sync an entire local folder to R2 with content-type detection
# Usage: ./sync-folder.sh <local-dir> <r2-prefix>
#
# Examples:
#   ./sync-folder.sh ~/portfolio/photos photos/
#   ./sync-folder.sh ~/portfolio/videos videos/
#   ./sync-folder.sh ~/portfolio/audio audio/

BUCKET="creative-coding-media"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <local-directory> <r2-prefix>"
  exit 1
fi

LOCAL_DIR="$1"
R2_PREFIX="$2"

if [ ! -d "$LOCAL_DIR" ]; then
  echo "Error: Directory $LOCAL_DIR does not exist"
  exit 1
fi

# Remove trailing slash from prefix for consistency
R2_PREFIX="${R2_PREFIX%/}"

echo "Syncing $LOCAL_DIR -> $BUCKET/$R2_PREFIX/"
echo "---"

count=0
find "$LOCAL_DIR" -type f | while read -r file; do
  # Get relative path from the local dir
  rel_path="${file#$LOCAL_DIR/}"
  r2_key="$R2_PREFIX/$rel_path"

  echo "Uploading: $rel_path -> $r2_key"
  wrangler r2 object put "$BUCKET/$r2_key" --file "$file"
  count=$((count + 1))
done

echo "---"
echo "Sync complete. Files uploaded to https://media.creativecodingtech.com/$R2_PREFIX/"
