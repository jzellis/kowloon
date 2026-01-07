#!/bin/bash

echo "🚀 Kowloon Multi-Instance Infrastructure Setup"
echo "=============================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is installed and running"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file for shared infrastructure..."

    # Generate credentials
    if command -v openssl &> /dev/null; then
        echo "🔐 Generating secure credentials..."

        MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
        S3_ACCESS_KEY=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-20)
        S3_SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-40)

        cat > .env <<EOF
# Kowloon Multi-Instance Infrastructure Configuration
# This file contains credentials for shared services

# MongoDB (shared database server)
MONGO_USERNAME=kowloon
MONGO_PASSWORD=$MONGO_PASSWORD

# MinIO (shared file storage)
S3_ACCESS_KEY=$S3_ACCESS_KEY
S3_SECRET_KEY=$S3_SECRET_KEY
S3_REGION=us-east-1

# Port mappings
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# Let's Encrypt (for production HTTPS)
# ACME_EMAIL=admin@yourdomain.com
EOF

        echo "✅ Generated secure credentials for infrastructure"
    else
        echo "⚠️  openssl not found - using default credentials"
        cat > .env <<EOF
# Kowloon Multi-Instance Infrastructure Configuration
MONGO_USERNAME=kowloon
MONGO_PASSWORD=kowloon_password
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
EOF
    fi

    echo ""
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🏗️  Starting infrastructure services..."
echo ""

# Create Docker network if it doesn't exist
if ! docker network inspect kowloon-network >/dev/null 2>&1; then
    docker network create kowloon-network
    echo "✅ Created Docker network: kowloon-network"
fi

# Start infrastructure
docker compose up -d mongodb minio traefik

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✨ Infrastructure setup complete!"
echo ""
echo "Services available at:"
echo "  🗄️  MongoDB:        mongodb://localhost:27017"
echo "  📦 MinIO Console:  http://localhost:9001"
echo "  🔀 Traefik Dashboard: http://localhost:8080"
echo ""
echo "Next steps:"
echo "  1. Create your first instance:"
echo "     ./kowloon-instance.sh create kwln.org"
echo ""
echo "  2. Add domain to /etc/hosts (for local testing):"
echo "     echo '127.0.0.1 kwln.org' | sudo tee -a /etc/hosts"
echo ""
echo "  3. Access your instance:"
echo "     http://kwln.org"
echo ""
echo "For more commands: make help"
