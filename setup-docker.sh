#!/bin/bash

echo "🚀 Kowloon Docker Setup"
echo "======================="
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
    echo "📝 Creating .env file from template..."
    cp .env.example .env

    # Generate secure random values if openssl is available
    if command -v openssl &> /dev/null; then
        echo "🔐 Generating secure credentials..."

        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 32)

        # Generate MongoDB password (alphanumeric, 32 chars)
        MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)

        # Generate MinIO credentials (alphanumeric, 20 chars)
        S3_ACCESS_KEY=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-20)
        S3_SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-40)

        # Use different sed syntax for macOS vs Linux
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|JWT_SECRET=changeme_random_secret_key|JWT_SECRET=$JWT_SECRET|g" .env
            sed -i '' "s|MONGO_PASSWORD=kowloon_password|MONGO_PASSWORD=$MONGO_PASSWORD|g" .env
            sed -i '' "s|S3_ACCESS_KEY=minioadmin|S3_ACCESS_KEY=$S3_ACCESS_KEY|g" .env
            sed -i '' "s|S3_SECRET_KEY=minioadmin|S3_SECRET_KEY=$S3_SECRET_KEY|g" .env
        else
            sed -i "s|JWT_SECRET=changeme_random_secret_key|JWT_SECRET=$JWT_SECRET|g" .env
            sed -i "s|MONGO_PASSWORD=kowloon_password|MONGO_PASSWORD=$MONGO_PASSWORD|g" .env
            sed -i "s|S3_ACCESS_KEY=minioadmin|S3_ACCESS_KEY=$S3_ACCESS_KEY|g" .env
            sed -i "s|S3_SECRET_KEY=minioadmin|S3_SECRET_KEY=$S3_SECRET_KEY|g" .env
        fi

        echo "✅ Generated secure random credentials:"
        echo "   - JWT_SECRET (authentication)"
        echo "   - MONGO_PASSWORD (database)"
        echo "   - S3_ACCESS_KEY and S3_SECRET_KEY (file storage)"
        echo ""
        echo "📝 These credentials have been saved to your .env file"
    else
        echo "⚠️  openssl not found - using default credentials"
        echo "   Please update passwords manually for production!"
    fi

    echo ""
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and set these values:"
    echo "   - DOMAIN (your server's domain name)"
    echo "   - SITE_TITLE (your server's display name)"
    echo "   - ADMIN_EMAIL (admin email address)"
    echo "   - ADMIN_PASSWORD (choose a secure password)"
    echo ""
    read -p "Press Enter to edit .env now, or Ctrl+C to exit and edit manually..."
    ${EDITOR:-nano} .env
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🏗️  Building and starting services..."
echo ""

# Build and start services
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✨ Setup complete!"
echo ""
echo "Your services are available at:"
echo "  🌐 Kowloon:       http://localhost:3000"
echo "  📦 MinIO Console: http://localhost:9001"
echo ""
echo "Useful commands:"
echo "  📋 View logs:     docker compose logs -f"
echo "  🔄 Restart:       docker compose restart"
echo "  🛑 Stop:          docker compose down"
echo ""
echo "See DOCKER.md for more information."
