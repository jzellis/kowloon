#!/bin/bash
# Generate a self-signed TLS cert covering both local federation domains.
# Run once before 'docker compose up'.
set -e

DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$DIR/local.key" \
  -out    "$DIR/local.crt" \
  -subj   "/CN=kowloon-local" \
  -addext "subjectAltName=DNS:kwln1.local,DNS:kwln2.local" \
  2>/dev/null

echo "Self-signed cert created in docker/certs/ (valid 10 years)"
echo "Covers: kwln1.local, kwln2.local"
