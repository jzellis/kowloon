#!/bin/bash

# Helper script to run multiple Kowloon instances easily

print_help() {
    echo "Kowloon Multi-Instance Manager"
    echo "==============================="
    echo ""
    echo "Usage: ./run-instance.sh [command] [instance-name] [options]"
    echo ""
    echo "Commands:"
    echo "  start <name>    Start an instance"
    echo "  stop <name>     Stop an instance"
    echo "  restart <name>  Restart an instance"
    echo "  logs <name>     View logs for an instance"
    echo "  list            List all running instances"
    echo "  create <name>   Create a new instance config"
    echo "  clean <name>    Remove instance completely (including data!)"
    echo ""
    echo "Examples:"
    echo "  ./run-instance.sh create server2"
    echo "  ./run-instance.sh start server2"
    echo "  ./run-instance.sh logs server2"
    echo "  ./run-instance.sh stop server2"
    echo ""
}

create_instance_config() {
    local name=$1
    local env_file=".env.${name}"

    if [ -f "$env_file" ]; then
        echo "⚠️  Config file $env_file already exists!"
        read -p "Overwrite? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 0
        fi
    fi

    # Prompt for configuration
    echo "Creating configuration for instance: $name"
    echo ""

    read -p "Domain name (e.g., kwln.org): " domain
    read -p "Site title: " site_title
    read -p "Kowloon port (e.g., 4000): " port
    read -p "MongoDB port (e.g., 27018): " mongo_port
    read -p "MinIO API port (e.g., 9002): " minio_api_port
    read -p "MinIO Console port (e.g., 9003): " minio_console_port

    # Copy from example
    cp .env.example "$env_file"

    # Generate credentials
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32)
        MONGO_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
        S3_ACCESS_KEY=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-20)
        S3_SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-40)

        # macOS vs Linux sed
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|DOMAIN=localhost|DOMAIN=$domain|g" "$env_file"
            sed -i '' "s|SITE_TITLE=Kowloon|SITE_TITLE=$site_title|g" "$env_file"
            sed -i '' "s|PORT=3000|PORT=$port|g" "$env_file"
            sed -i '' "s|MONGO_HOST_PORT=27017|MONGO_HOST_PORT=$mongo_port|g" "$env_file"
            sed -i '' "s|MINIO_API_PORT=9000|MINIO_API_PORT=$minio_api_port|g" "$env_file"
            sed -i '' "s|MINIO_CONSOLE_PORT=9001|MINIO_CONSOLE_PORT=$minio_console_port|g" "$env_file"
            sed -i '' "s|S3_PUBLIC_URL=http://localhost:9000/kowloon|S3_PUBLIC_URL=http://localhost:$minio_api_port/kowloon|g" "$env_file"
            sed -i '' "s|JWT_SECRET=changeme_random_secret_key|JWT_SECRET=$JWT_SECRET|g" "$env_file"
            sed -i '' "s|MONGO_PASSWORD=kowloon_password|MONGO_PASSWORD=$MONGO_PASSWORD|g" "$env_file"
            sed -i '' "s|S3_ACCESS_KEY=minioadmin|S3_ACCESS_KEY=$S3_ACCESS_KEY|g" "$env_file"
            sed -i '' "s|S3_SECRET_KEY=minioadmin|S3_SECRET_KEY=$S3_SECRET_KEY|g" "$env_file"
        else
            sed -i "s|DOMAIN=localhost|DOMAIN=$domain|g" "$env_file"
            sed -i "s|SITE_TITLE=Kowloon|SITE_TITLE=$site_title|g" "$env_file"
            sed -i "s|PORT=3000|PORT=$port|g" "$env_file"
            sed -i "s|MONGO_HOST_PORT=27017|MONGO_HOST_PORT=$mongo_port|g" "$env_file"
            sed -i "s|MINIO_API_PORT=9000|MINIO_API_PORT=$minio_api_port|g" "$env_file"
            sed -i "s|MINIO_CONSOLE_PORT=9001|MINIO_CONSOLE_PORT=$minio_console_port|g" "$env_file"
            sed -i "s|S3_PUBLIC_URL=http://localhost:9000/kowloon|S3_PUBLIC_URL=http://localhost:$minio_api_port/kowloon|g" "$env_file"
            sed -i "s|JWT_SECRET=changeme_random_secret_key|JWT_SECRET=$JWT_SECRET|g" "$env_file"
            sed -i "s|MONGO_PASSWORD=kowloon_password|MONGO_PASSWORD=$MONGO_PASSWORD|g" "$env_file"
            sed -i "s|S3_ACCESS_KEY=minioadmin|S3_ACCESS_KEY=$S3_ACCESS_KEY|g" "$env_file"
            sed -i "s|S3_SECRET_KEY=minioadmin|S3_SECRET_KEY=$S3_SECRET_KEY|g" "$env_file"
        fi

        echo ""
        echo "✅ Created $env_file with secure credentials"
    else
        echo "⚠️  openssl not found - using default credentials"
    fi

    echo ""
    echo "Configuration created: $env_file"
    echo ""
    echo "Services will be available at:"
    echo "  🌐 Kowloon:       http://localhost:$port"
    echo "  🗄️  MongoDB:       localhost:$mongo_port"
    echo "  📦 MinIO API:     http://localhost:$minio_api_port"
    echo "  📦 MinIO Console: http://localhost:$minio_console_port"
    echo ""
    echo "To start this instance:"
    echo "  ./run-instance.sh start $name"
}

start_instance() {
    local name=$1
    local env_file=".env.${name}"

    if [ ! -f "$env_file" ]; then
        echo "❌ Config file $env_file not found!"
        echo "Create it first with: ./run-instance.sh create $name"
        exit 1
    fi

    echo "🚀 Starting instance: $name"
    docker compose --env-file "$env_file" -p "kowloon-$name" up -d --build

    echo ""
    echo "✅ Instance '$name' started"
    echo ""
    echo "View logs: ./run-instance.sh logs $name"
    echo "Stop:      ./run-instance.sh stop $name"
}

stop_instance() {
    local name=$1
    echo "🛑 Stopping instance: $name"
    docker compose -p "kowloon-$name" down
    echo "✅ Instance '$name' stopped"
}

restart_instance() {
    local name=$1
    echo "🔄 Restarting instance: $name"
    docker compose -p "kowloon-$name" restart
    echo "✅ Instance '$name' restarted"
}

show_logs() {
    local name=$1
    echo "📋 Showing logs for: $name"
    echo "Press Ctrl+C to exit"
    echo ""
    docker compose -p "kowloon-$name" logs -f
}

list_instances() {
    echo "Running Kowloon Instances"
    echo "========================="
    echo ""
    docker ps --filter "name=kowloon" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

clean_instance() {
    local name=$1
    echo "⚠️  WARNING: This will remove ALL data for instance '$name'"
    echo "This includes the database and uploaded files!"
    echo ""
    read -p "Are you sure? Type 'yes' to confirm: " confirm

    if [ "$confirm" = "yes" ]; then
        echo "🗑️  Removing instance: $name"
        docker compose -p "kowloon-$name" down -v
        echo "✅ Instance '$name' removed completely"
    else
        echo "❌ Cancelled"
    fi
}

# Main script
case "${1:-help}" in
    start)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            echo "Usage: ./run-instance.sh start <name>"
            exit 1
        fi
        start_instance "$2"
        ;;
    stop)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            exit 1
        fi
        stop_instance "$2"
        ;;
    restart)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            exit 1
        fi
        restart_instance "$2"
        ;;
    logs)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            exit 1
        fi
        show_logs "$2"
        ;;
    list)
        list_instances
        ;;
    create)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            exit 1
        fi
        create_instance_config "$2"
        ;;
    clean)
        if [ -z "$2" ]; then
            echo "❌ Please specify instance name"
            exit 1
        fi
        clean_instance "$2"
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        print_help
        exit 1
        ;;
esac
