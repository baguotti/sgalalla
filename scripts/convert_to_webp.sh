#!/bin/bash

# Check if path is provided
if [ -z "$1" ]; then
  echo "Usage: ./convert_to_webp.sh <image_path>"
  exit 1
fi

INPUT_PATH="$1"
# Get directory, filename without extension, and extension.
DIR=$(dirname "$INPUT_PATH")
FILENAME=$(basename -- "$INPUT_PATH")
EXTENSION="${FILENAME##*.}"
FILENAME_NO_EXT="${FILENAME%.*}"

# Construct output path
OUTPUT_PATH="${DIR}/${FILENAME_NO_EXT}_webP.webp"

# Check if cwebp is installed
if ! command -v cwebp &> /dev/null; then
  echo "Error: cwebp is not installed. Please install it (e.g., brew install webp)."
  exit 1
fi

# Run cwebp with high quality (-q 80) and original resolution
# -q 80 is a good balance for high quality and smaller size.
cwebp -q 80 "$INPUT_PATH" -o "$OUTPUT_PATH"

if [ $? -eq 0 ]; then
  echo "Success! Converted to: $OUTPUT_PATH"
  # Show size comparison
  ls -lh "$INPUT_PATH" "$OUTPUT_PATH"
else
  echo "Error: Conversion failed."
  exit 1
fi
