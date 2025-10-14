#!/usr/bin/env bash
# generate-verbs.sh
# Usage: ./generate-verbs.sh /path/to/handlers

set -e

TARGET_DIR="${1:-.}"  # default to current directory if no arg given

verbs=(
  "Create"
  "Update"
  "Delete"
  "Reply"
  "React"
  "Follow"
  "Unfollow"
  "Block"
  "Mute"
  "Join"
  "Leave"
  "Invite"
  "Accept"
  "Reject"
  "Add"
  "Remove"
  "Upload"
  "Undo"
  "Flag"
)

mkdir -p "$TARGET_DIR"

for verb in "${verbs[@]}"; do
  subdir="$TARGET_DIR/$verb"
  mkdir -p "$subdir"
  index="$subdir/index.js"
  if [ ! -f "$index" ]; then
    cat > "$index" <<EOF
// ${verb}/index.js
// Handler for the "${verb}" Activity type.

export default async function ${verb}(activity) {
  // TODO: implement "${verb}" logic
  return { activity };
}
EOF
    echo "Created $index"
  else
    echo "Skipped $index (already exists)"
  fi
done

echo "✅ Done generating handler subdirectories in $TARGET_DIR"