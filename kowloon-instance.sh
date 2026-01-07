#!/bin/bash

# Kowloon Multi-Instance Manager
# Manages multiple Kowloon instances with shared infrastructure

set -e

INSTANCES_DIR="instances"
INSTANCES_JSON="$INSTANCES_DIR/instances.json"
OVERRIDE_FILE="docker-compose.override.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
error() { echo -e "${RED}❌ $1${NC}" >&2; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Slugify domain name
slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

# Generate short UUID (8 chars)
generate_uuid() {
    if command -v uuidgen &> /dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]' | cut -d'-' -f1
    else
        openssl rand -hex 4
    fi
}

# Initialize instances directory
init_instances_dir() {
    if [ ! -d "$INSTANCES_DIR" ]; then
        mkdir -p "$INSTANCES_DIR"
        echo '{}' > "$INSTANCES_JSON"
        success "Created instances directory"
    fi
}

# Get instance ID from domain or instance ID
resolve_instance() {
    local input=$1
    init_instances_dir

    # Check if input is already an instance ID
    if jq -e ".\"$input\"" "$INSTANCES_JSON" > /dev/null 2>&1; then
        echo "$input"
        return 0
    fi

    # Search by domain
    local instance_id=$(jq -r "to_entries[] | select(.value.domain == \"$input\") | .key" "$INSTANCES_JSON" | head -1)
    if [ -n "$instance_id" ]; then
        echo "$instance_id"
        return 0
    fi

    return 1
}

# Create new instance
create_instance() {
    local domain=$1

    if [ -z "$domain" ]; then
        error "Domain is required"
        echo "Usage: $0 create <domain>"
        exit 1
    fi

    init_instances_dir

    # Check if domain already exists
    if jq -e "to_entries[] | select(.value.domain == \"$domain\")" "$INSTANCES_JSON" > /dev/null 2>&1; then
        error "Instance for domain '$domain' already exists"
        exit 1
    fi

    # Generate instance ID
    local slug=$(slugify "$domain")
    local uuid=$(generate_uuid)
    local instance_id="${slug}_${uuid}"
    local db_name="kowloon_${slug}_${uuid}"
    local bucket_name="kowloon-${slug}-${uuid}"

    info "Creating instance: $instance_id"
    echo "  Domain: $domain"
    echo "  Database: $db_name"
    echo "  Bucket: $bucket_name"
    echo ""

    # Prompt for configuration
    read -p "Site Title [$domain]: " site_title
    site_title=${site_title:-$domain}

    read -p "Admin Email [admin@$domain]: " admin_email
    admin_email=${admin_email:-admin@$domain}

    read -s -p "Admin Password (leave empty to generate): " admin_password
    echo ""

    # Generate credentials
    if command -v openssl &> /dev/null; then
        local jwt_secret=$(openssl rand -base64 32)
        if [ -z "$admin_password" ]; then
            admin_password=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-20)
            info "Generated admin password: $admin_password"
        fi
    else
        error "openssl not found - cannot generate credentials"
        exit 1
    fi

    # Create instance directory
    local instance_dir="$INSTANCES_DIR/$instance_id"
    mkdir -p "$instance_dir"

    # Create .env file
    cat > "$instance_dir/.env" <<EOF
# Kowloon Instance: $instance_id
# Domain: $domain
# Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

INSTANCE_ID=$instance_id
DOMAIN=$domain
SITE_TITLE=$site_title
NODE_ENV=production

# Admin
ADMIN_EMAIL=$admin_email
ADMIN_PASSWORD=$admin_password

# Security
JWT_SECRET=$jwt_secret

# Database
MONGO_URI=mongodb://\${MONGO_USERNAME:-kowloon}:\${MONGO_PASSWORD:-kowloon_password}@mongodb:27017/$db_name?authSource=admin

# Storage
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=$bucket_name
S3_ACCESS_KEY=\${S3_ACCESS_KEY:-minioadmin}
S3_SECRET_KEY=\${S3_SECRET_KEY:-minioadmin}
S3_PUBLIC_URL=http://$domain/files

# Debugging
# ROUTE_DEBUG=1
EOF

    success "Created instance configuration"

    # Update instances.json
    local temp_json=$(mktemp)
    jq ". + {\"$instance_id\": {
        \"domain\": \"$domain\",
        \"title\": \"$site_title\",
        \"created\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
        \"database\": \"$db_name\",
        \"bucket\": \"$bucket_name\",
        \"status\": \"stopped\",
        \"admin_email\": \"$admin_email\"
    }}" "$INSTANCES_JSON" > "$temp_json"
    mv "$temp_json" "$INSTANCES_JSON"

    # Rebuild override file
    rebuild_override

    # Create MinIO bucket
    info "Creating MinIO bucket..."
    if docker ps | grep -q kowloon-minio; then
        docker exec kowloon-minio mc alias set local http://localhost:9000 ${S3_ACCESS_KEY:-minioadmin} ${S3_SECRET_KEY:-minioadmin} 2>/dev/null || true
        docker exec kowloon-minio mc mb local/$bucket_name --ignore-existing 2>/dev/null || warn "Could not create bucket (will be created on first use)"
        docker exec kowloon-minio mc anonymous set download local/$bucket_name 2>/dev/null || true
    else
        warn "MinIO not running - bucket will be created when infrastructure starts"
    fi

    success "Instance created: $instance_id"
    echo ""
    info "To start this instance:"
    echo "  ./kowloon-instance.sh start $domain"
    echo ""
    info "Don't forget to add to /etc/hosts for local testing:"
    echo "  127.0.0.1 $domain"
}

# Rebuild docker-compose.override.yml
rebuild_override() {
    init_instances_dir

    cat > "$OVERRIDE_FILE" <<EOF
version: '3.8'

# Auto-generated - DO NOT EDIT MANUALLY
# Managed by kowloon-instance.sh

services:
EOF

    # Add each instance
    jq -r 'to_entries[] | @json' "$INSTANCES_JSON" | while read -r entry; do
        local instance_id=$(echo "$entry" | jq -r '.key')
        local domain=$(echo "$entry" | jq -r '.value.domain')
        local bucket=$(echo "$entry" | jq -r '.value.bucket')
        local database=$(echo "$entry" | jq -r '.value.database')

        # Convert underscores to hyphens for container name
        local container_name=$(echo "$instance_id" | tr '_' '-')

        cat >> "$OVERRIDE_FILE" <<EOF

  kowloon-$container_name:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: kowloon-$container_name
    restart: unless-stopped
    env_file:
      - .env
      - $INSTANCES_DIR/$instance_id/.env
    depends_on:
      mongodb:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - kowloon-network
    labels:
      - "traefik.enable=true"
      # Single service definition (used by both HTTP and HTTPS routers)
      - "traefik.http.services.$container_name.loadbalancer.server.port=3000"
      # HTTP router
      - "traefik.http.routers.$container_name.rule=Host(\`$domain\`)"
      - "traefik.http.routers.$container_name.entrypoints=web"
      - "traefik.http.routers.$container_name.service=$container_name"
      # HTTPS router (auto-enabled for local development with mkcert)
      - "traefik.http.routers.$container_name-secure.rule=Host(\`$domain\`)"
      - "traefik.http.routers.$container_name-secure.entrypoints=websecure"
      - "traefik.http.routers.$container_name-secure.tls=true"
      - "traefik.http.routers.$container_name-secure.service=$container_name"
      # Uncomment for Let's Encrypt (production)
      # - "traefik.http.routers.$container_name-secure.tls.certresolver=letsencrypt"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
    done

    # Add networks section
    cat >> "$OVERRIDE_FILE" <<EOF

networks:
  kowloon-network:
    name: kowloon_kowloon-network
    external: true
EOF

    success "Updated $OVERRIDE_FILE"
}

# Start instance(s)
start_instance() {
    local input=$1

    if [ -z "$input" ]; then
        # Start all instances
        info "Starting all instances..."
        docker compose up -d
    else
        # Start specific instance
        local instance_id=$(resolve_instance "$input")
        if [ -z "$instance_id" ]; then
            error "Instance not found: $input"
            exit 1
        fi

        local container_name=$(echo "$instance_id" | tr '_' '-')
        info "Starting instance: $instance_id"
        docker compose up -d kowloon-$container_name

        # Update status
        local temp_json=$(mktemp)
        jq ".\"$instance_id\".status = \"running\"" "$INSTANCES_JSON" > "$temp_json"
        mv "$temp_json" "$INSTANCES_JSON"
    fi

    success "Instance(s) started"
}

# Stop instance(s)
stop_instance() {
    local input=$1

    if [ -z "$input" ]; then
        # Stop all instances
        info "Stopping all instances..."
        docker compose stop
    else
        # Stop specific instance
        local instance_id=$(resolve_instance "$input")
        if [ -z "$instance_id" ]; then
            error "Instance not found: $input"
            exit 1
        fi

        local container_name=$(echo "$instance_id" | tr '_' '-')
        info "Stopping instance: $instance_id"
        docker compose stop kowloon-$container_name

        # Update status
        local temp_json=$(mktemp)
        jq ".\"$instance_id\".status = \"stopped\"" "$INSTANCES_JSON" > "$temp_json"
        mv "$temp_json" "$INSTANCES_JSON"
    fi

    success "Instance(s) stopped"
}

# List instances
list_instances() {
    init_instances_dir

    echo "Kowloon Instances"
    echo "================="
    echo ""

    if [ "$(jq 'length' "$INSTANCES_JSON")" -eq 0 ]; then
        info "No instances created yet"
        echo ""
        echo "Create one with: ./kowloon-instance.sh create <domain>"
        return
    fi

    printf "%-30s %-30s %-15s\n" "INSTANCE ID" "DOMAIN" "STATUS"
    printf "%-30s %-30s %-15s\n" "----------" "------" "------"

    jq -r 'to_entries[] | "\(.key)\t\(.value.domain)\t\(.value.status // "unknown")"' "$INSTANCES_JSON" | \
    while IFS=$'\t' read -r id domain status; do
        printf "%-30s %-30s %-15s\n" "$id" "$domain" "$status"
    done
}

# Show instance info
show_info() {
    local input=$1

    if [ -z "$input" ]; then
        error "Instance identifier required"
        exit 1
    fi

    local instance_id=$(resolve_instance "$input")
    if [ -z "$instance_id" ]; then
        error "Instance not found: $input"
        exit 1
    fi

    local info=$(jq ".\"$instance_id\"" "$INSTANCES_JSON")

    echo "Instance: $instance_id"
    echo "======================"
    echo "$info" | jq -r 'to_entries[] | "\(.key): \(.value)"'
}

# View logs
show_logs() {
    local input=$1

    if [ -z "$input" ]; then
        docker compose logs -f
    else
        local instance_id=$(resolve_instance "$input")
        if [ -z "$instance_id" ]; then
            error "Instance not found: $input"
            exit 1
        fi

        local container_name=$(echo "$instance_id" | tr '_' '-')
        docker compose logs -f kowloon-$container_name
    fi
}

# Remove instance
remove_instance() {
    local input=$1

    if [ -z "$input" ]; then
        error "Instance identifier required"
        exit 1
    fi

    local instance_id=$(resolve_instance "$input")
    if [ -z "$instance_id" ]; then
        error "Instance not found: $input"
        exit 1
    fi

    local domain=$(jq -r ".\"$instance_id\".domain" "$INSTANCES_JSON")
    local database=$(jq -r ".\"$instance_id\".database" "$INSTANCES_JSON")
    local bucket=$(jq -r ".\"$instance_id\".bucket" "$INSTANCES_JSON")

    warn "This will remove instance: $instance_id"
    echo "  Domain: $domain"
    echo "  Database: $database (will be deleted!)"
    echo "  Bucket: $bucket (will be deleted!)"
    echo ""
    read -p "Type 'DELETE' to confirm: " confirm

    if [ "$confirm" != "DELETE" ]; then
        error "Cancelled"
        exit 0
    fi

    # Stop and remove container
    local container_name=$(echo "$instance_id" | tr '_' '-')
    docker compose stop kowloon-$container_name 2>/dev/null || true
    docker compose rm -f kowloon-$container_name 2>/dev/null || true

    # Remove from instances.json
    local temp_json=$(mktemp)
    jq "del(.\"$instance_id\")" "$INSTANCES_JSON" > "$temp_json"
    mv "$temp_json" "$INSTANCES_JSON"

    # Remove instance directory
    rm -rf "$INSTANCES_DIR/$instance_id"

    # Rebuild override
    rebuild_override

    # TODO: Drop MongoDB database
    # TODO: Delete MinIO bucket

    success "Instance removed: $instance_id"
    warn "Note: Database and bucket still exist on infrastructure"
    warn "Manually clean up if needed"
}

# Show help
show_help() {
    cat <<EOF
Kowloon Multi-Instance Manager

Usage: $0 <command> [options]

Commands:
  create <domain>         Create a new instance for the given domain
  start [instance]        Start instance(s) - all if no instance specified
  stop [instance]         Stop instance(s) - all if no instance specified
  restart [instance]      Restart instance(s)
  list                    List all instances
  info <instance>         Show detailed info for an instance
  logs [instance]         Show logs for instance(s)
  remove <instance>       Remove an instance
  rebuild                 Rebuild docker-compose.override.yml
  help                    Show this help message

Instance can be specified by domain or instance ID.

Examples:
  $0 create kwln.org
  $0 start kwln.org
  $0 logs kwln-org_a1b2c3d4
  $0 info kwln.org
  $0 stop kwln.org
  $0 remove kwln.org

EOF
}

# Main command dispatcher
case "${1:-help}" in
    create)
        create_instance "$2"
        ;;
    start)
        start_instance "$2"
        ;;
    stop)
        stop_instance "$2"
        ;;
    restart)
        stop_instance "$2"
        start_instance "$2"
        ;;
    list)
        list_instances
        ;;
    info)
        show_info "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    remove)
        remove_instance "$2"
        ;;
    rebuild)
        rebuild_override
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
