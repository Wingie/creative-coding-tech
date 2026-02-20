#!/usr/bin/env bash
# Upload media files to Cloudflare R2 bucket: media
# Usage: ./upload.sh <local-file-or-dir> <r2-destination-path>
#
# Examples:
#   ./upload.sh ~/Photos/sunset.jpg photos/2026/sunset.jpg
#   ./upload.sh ~/Videos/demo.mp4 videos/projects/demo.mp4
#   ./upload.sh ~/Music/track.mp3 audio/tracks/track.mp3
#   ./upload.sh ~/Portfolio/photos/ photos/portfolio/    # Upload entire directory
#
# Prerequisites:
#   - Install wrangler: npm install -g wrangler
#   - Login: wrangler login

BUCKET="media"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <local-file-or-dir> <r2-destination-path>"
  echo ""
  echo "Examples:"
  echo "  $0 ~/Photos/sunset.jpg photos/2026/sunset.jpg"
  echo "  $0 ~/Videos/ videos/                          # Upload directory"
  exit 1
fi

SOURCE="$1"
DEST="$2"

if [ -d "$SOURCE" ]; then
  echo "Uploading directory: $SOURCE -> $BUCKET/$DEST"
  for file in "$SOURCE"/*; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      echo "  Uploading: $filename"
      wrangler r2 object put "$BUCKET/$DEST$filename" --file "$file"
    fi
  done
  echo "Directory upload complete."
elif [ -f "$SOURCE" ]; then
  echo "Uploading: $SOURCE -> $BUCKET/$DEST"
  wrangler r2 object put "$BUCKET/$DEST" --file "$SOURCE"
  echo "Upload complete: https://media.creativecodingtech.com/$DEST"
else
  echo "Error: $SOURCE does not exist"
  exit 1
fi
