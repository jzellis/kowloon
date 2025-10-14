#!/usr/bin/env bash
# zip-kowloon.sh - works reliably on macOS and Linux
set -e
cd "$(dirname "$0")"

find . \
  -type d \( \
      -name node_modules -o \
      -name .git -o \
      -name dist -o \
      -name build -o \
      -name coverage -o \
      -name .cache -o \
      -name .vscode -o \
      -name .idea -o \
      -name tmp \
    \) -prune -o \
  -type f \( \
      ! -name ".DS_Store" -a \
      ! -name "*.log" -a \
      ! -name ".env" \
    \) -print \
| zip -q -@ kowloon.zip

echo "✅ Created kowloon.zip (excluding node_modules, .git, dist, build, logs, etc.)"