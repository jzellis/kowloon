#!/usr/bin/env bash
# Kowloon backup — exports MongoDB + MinIO files to a portable .tar.gz archive.
#
# Run from the directory containing docker-compose.yml and .env:
#   bash scripts/backup.sh [output-directory]
#
# The archive is self-contained and can be restored with scripts/restore.sh
# on any Kowloon installation running the same or newer version.

set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────

info()  { echo "  [backup] $*"; }
ok()    { echo "  [backup] ✓ $*"; }
die()   { echo "  [backup] ERROR: $*" >&2; exit 1; }

# ── Locate compose directory ──────────────────────────────────────────────────

COMPOSE_DIR="${COMPOSE_DIR:-$PWD}"
ENV_FILE="$COMPOSE_DIR/.env"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

[[ -f "$COMPOSE_FILE" ]] || die "docker-compose.yml not found in $COMPOSE_DIR — run this script from your Kowloon install directory."
[[ -f "$ENV_FILE" ]]     || die ".env not found in $COMPOSE_DIR"

# ── Read credentials from .env ────────────────────────────────────────────────

# Source only the vars we need — avoid polluting the environment with everything.
S3_ACCESS_KEY=$(grep -E '^S3_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
S3_SECRET_KEY=$(grep -E '^S3_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
S3_BUCKET=$(grep -E '^S3_BUCKET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
MONGO_URI=$(grep -E '^MONGO_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

[[ -n "$S3_ACCESS_KEY" ]] || die "S3_ACCESS_KEY not found in .env"
[[ -n "$S3_SECRET_KEY" ]] || die "S3_SECRET_KEY not found in .env"
[[ -n "$S3_BUCKET" ]]     || die "S3_BUCKET not found in .env"
[[ -n "$MONGO_URI" ]]     || die "MONGO_URI not found in .env"

# Extract database name from URI (last path segment, before any query string)
DB_NAME=$(echo "$MONGO_URI" | sed 's|.*/||' | cut -d'?' -f1)
[[ -n "$DB_NAME" ]] || die "Could not parse database name from MONGO_URI"

# ── Output location ───────────────────────────────────────────────────────────

OUTPUT_DIR="${1:-$COMPOSE_DIR}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
ARCHIVE_NAME="kowloon-backup-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$OUTPUT_DIR/$ARCHIVE_NAME"

mkdir -p "$OUTPUT_DIR"

# Temp workspace — cleaned up on exit
TMPDIR_WORK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_WORK"' EXIT

info "Starting backup of database '$DB_NAME' and bucket '$S3_BUCKET'"
info "Archive will be written to: $ARCHIVE_PATH"
echo

# ── Step 1: MongoDB dump ──────────────────────────────────────────────────────

info "Dumping MongoDB..."

# Run from the compose dir so docker compose finds the right project
(cd "$COMPOSE_DIR" && docker compose exec -T mongo \
  mongodump \
    --db="$DB_NAME" \
    --archive \
    --gzip \
    --quiet \
) > "$TMPDIR_WORK/db.archive"

DB_SIZE=$(du -sh "$TMPDIR_WORK/db.archive" | cut -f1)
ok "Database dumped ($DB_SIZE)"

# ── Step 2: MinIO file mirror ─────────────────────────────────────────────────

info "Mirroring MinIO bucket '$S3_BUCKET'..."

mkdir -p "$TMPDIR_WORK/files"

# Find the network the minio container is attached to so mc can reach it.
MINIO_CONTAINER=$(cd "$COMPOSE_DIR" && docker compose ps -q minio 2>/dev/null | head -1)
[[ -n "$MINIO_CONTAINER" ]] || die "minio container is not running — start it with 'docker compose up -d minio' first."

MC_NETWORK=$(docker inspect "$MINIO_CONTAINER" \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
  | tr ' ' '\n' | grep -v '^$' | head -1)

[[ -n "$MC_NETWORK" ]] || die "Could not detect minio container network."

# Run mc in the same network as minio so it can reach the 'minio' hostname.
docker run --rm \
  --network "$MC_NETWORK" \
  --volume "$TMPDIR_WORK/files:/export" \
  --entrypoint /bin/sh \
  minio/mc:latest -c "
    mc alias set src http://minio:9000 '$S3_ACCESS_KEY' '$S3_SECRET_KEY' --api S3v4 >/dev/null 2>&1 &&
    mc mirror --preserve src/'$S3_BUCKET' /export/
  "

FILE_COUNT=$(find "$TMPDIR_WORK/files" -type f | wc -l | tr -d ' ')
ok "Mirrored $FILE_COUNT files from bucket"

# ── Step 3: Package archive ───────────────────────────────────────────────────

info "Packaging archive..."

# Write a manifest so restore.sh can sanity-check the archive.
cat > "$TMPDIR_WORK/manifest.json" <<EOF
{
  "version": 1,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "$DB_NAME",
  "bucket": "$S3_BUCKET",
  "fileCount": $FILE_COUNT
}
EOF

tar -czf "$ARCHIVE_PATH" -C "$TMPDIR_WORK" manifest.json db.archive files/

ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
ok "Archive created: $ARCHIVE_SIZE"

echo
echo "  Backup complete: $ARCHIVE_PATH"
echo "  To restore: bash scripts/restore.sh $ARCHIVE_PATH"
