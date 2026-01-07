#!/bin/bash

# Setup local HTTPS with mkcert for Kowloon instances
# This script generates locally-trusted SSL certificates for development

set -e

echo "🔒 Setting up local HTTPS for Kowloon instances"
echo "==============================================="
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed!"
    echo ""
    echo "Install with Homebrew:"
    echo "  brew install mkcert"
    echo ""
    echo "Then install the local CA:"
    echo "  mkcert -install"
    echo ""
    exit 1
fi

# Check if local CA is installed
if [ ! -f "$(mkcert -CAROOT)/rootCA.pem" ]; then
    echo "⚠️  Local CA not found. Installing..."
    mkcert -install
    echo ""
fi

echo "✅ mkcert is installed and configured"
echo ""

# Create certificates directory
CERTS_DIR="./certs"
mkdir -p "$CERTS_DIR"

# Get all domains from instances.json
INSTANCES_JSON="instances/instances.json"
if [ ! -f "$INSTANCES_JSON" ]; then
    echo "❌ instances/instances.json not found!"
    exit 1
fi

# Extract all domains
DOMAINS=$(jq -r 'to_entries[].value.domain' "$INSTANCES_JSON" | tr '\n' ' ')

if [ -z "$DOMAINS" ]; then
    echo "❌ No instances found in instances.json"
    exit 1
fi

echo "📜 Generating certificates for:"
for domain in $DOMAINS; do
    echo "  - $domain"
done
echo ""

# Generate wildcard certificate for all domains
cd "$CERTS_DIR"
mkcert $DOMAINS
cd ..

# Find the generated certificate files
CERT_FILE=$(ls -t "$CERTS_DIR"/*.pem | head -1)
KEY_FILE=$(ls -t "$CERTS_DIR"/*-key.pem | head -1)

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo "❌ Failed to generate certificates"
    exit 1
fi

echo "✅ Certificates generated:"
echo "  Certificate: $CERT_FILE"
echo "  Key:         $KEY_FILE"
echo ""

# Create Traefik dynamic configuration
TRAEFIK_DIR="./traefik"
mkdir -p "$TRAEFIK_DIR"

cat > "$TRAEFIK_DIR/tls.yml" <<EOF
tls:
  certificates:
    - certFile: /certs/$(basename "$CERT_FILE")
      keyFile: /certs/$(basename "$KEY_FILE")
EOF

echo "✅ Created Traefik TLS configuration: $TRAEFIK_DIR/tls.yml"
echo ""

# Update docker-compose.yml with TLS configuration
echo "📝 Next steps:"
echo ""
echo "1. Update docker-compose.yml to mount certificates:"
echo "   Add to traefik service volumes:"
echo "     - ./certs:/certs:ro"
echo "     - ./traefik:/traefik-config:ro"
echo ""
echo "2. Add to traefik command:"
echo "     - \"--providers.file.directory=/traefik-config\""
echo "     - \"--providers.file.watch=true\""
echo ""
echo "3. Restart infrastructure:"
echo "   docker compose restart traefik"
echo ""
echo "4. Update instance .env files to use HTTPS:"
echo "   S3_PUBLIC_URL=https://\${DOMAIN}/files"
echo ""
echo "5. Test with: https://kowloon.net"
echo ""
echo "🎉 Your browser will now trust these certificates!"
