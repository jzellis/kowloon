# Docker Setup Guide

This guide will help you run Kowloon using Docker, even if you've never used Docker before.

## Prerequisites

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - For Mac: Download and install Docker Desktop for Mac
   - For Windows: Download and install Docker Desktop for Windows
   - For Linux: Install Docker Engine and Docker Compose

2. Verify Docker is running:
   ```bash
   docker --version
   docker compose version
   ```

## Quick Start

### 1. Configure Your Environment

First, create your `.env` file from the example:

```bash
cp .env.example .env
```

Then edit `.env` with your preferred text editor and customize these important settings:

```bash
# Your server's domain name
DOMAIN=localhost  # Change to your domain for production (e.g., kwln.org)

# Set a secure admin password
ADMIN_PASSWORD=your_secure_password_here

# Database password (change from default!)
MONGO_PASSWORD=your_secure_mongo_password

# MinIO credentials (change from default!)
S3_ACCESS_KEY=your_minio_access_key
S3_SECRET_KEY=your_minio_secret_key

# Public URL for file access
S3_PUBLIC_URL=http://localhost:9000/kowloon  # Change for production
```

**Important for Production:**
- Change `DOMAIN` to your actual domain name
- Use strong, unique passwords for `ADMIN_PASSWORD`, `MONGO_PASSWORD`, and MinIO credentials
- Update `S3_PUBLIC_URL` to match your production domain

### 2. Start Everything

Run this single command to start all services (Kowloon, MongoDB, and MinIO):

```bash
docker compose up -d
```

This will:
- Download the necessary Docker images (first time only)
- Build the Kowloon application
- Start MongoDB database
- Start MinIO file storage
- Start the Kowloon server

### 3. Verify It's Running

Check that all services are healthy:

```bash
docker compose ps
```

You should see 3 running services:
- `kowloon-server` - Your Kowloon application
- `kowloon-mongodb` - MongoDB database
- `kowloon-minio` - MinIO file storage

### 4. Access Your Services

- **Kowloon**: http://localhost:3000
- **MinIO Console**: http://localhost:9001
  - Username: Value of `S3_ACCESS_KEY` from your `.env` (default: minioadmin)
  - Password: Value of `S3_SECRET_KEY` from your `.env` (default: minioadmin)

## Common Commands

### View Logs

See logs from all services:
```bash
docker compose logs -f
```

See logs from just Kowloon:
```bash
docker compose logs -f kowloon
```

See logs from MongoDB:
```bash
docker compose logs -f mongodb
```

### Stop Everything

```bash
docker compose down
```

### Stop and Remove All Data

**Warning**: This deletes your database and uploaded files!

```bash
docker compose down -v
```

### Restart After Changes

If you modify code or configuration:

```bash
docker compose restart kowloon
```

If you modify the Dockerfile:

```bash
docker compose up -d --build
```

### Update to Latest Version

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build
```

## Production Deployment

### 1. Update Your `.env` File

```bash
NODE_ENV=production
DOMAIN=your-domain.com
PORT=3000

# Use strong passwords!
ADMIN_PASSWORD=very_secure_password
MONGO_PASSWORD=very_secure_mongo_password
S3_ACCESS_KEY=secure_access_key
S3_SECRET_KEY=secure_secret_key

# Update to your production URL
S3_PUBLIC_URL=https://your-domain.com/files
```

### 2. Set Up Reverse Proxy (Recommended)

Use a reverse proxy like Nginx or Caddy to:
- Handle HTTPS/SSL certificates
- Proxy requests to Kowloon and MinIO
- Serve files from MinIO at a clean URL

Example Nginx configuration:

```nginx
# Kowloon application
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # MinIO file storage
    location /files/ {
        proxy_pass http://localhost:9000/kowloon/;
        proxy_set_header Host $host;
    }
}
```

### 3. Backup Your Data

Important directories to backup:
- MongoDB data: Docker volume `kowloon_mongodb_data`
- MinIO files: Docker volume `kowloon_minio_data`

Backup command:
```bash
# Backup MongoDB
docker compose exec mongodb mongodump --out /data/backup

# Copy backup from container
docker cp kowloon-mongodb:/data/backup ./backup-$(date +%Y%m%d)

# Backup MinIO (copy entire volume)
docker run --rm -v kowloon_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## Troubleshooting

### Services won't start

Check logs for errors:
```bash
docker compose logs
```

### Can't connect to MongoDB

Make sure MongoDB is healthy:
```bash
docker compose ps mongodb
```

Restart MongoDB:
```bash
docker compose restart mongodb
```

### MinIO bucket not found

The bucket should be created automatically, but you can create it manually:
```bash
docker compose exec minio mc mb /data/kowloon
docker compose exec minio mc anonymous set download /data/kowloon
```

### Kowloon server keeps restarting

Check the logs:
```bash
docker compose logs -f kowloon
```

Common issues:
- Can't connect to MongoDB (wait for it to be healthy)
- Invalid environment variables
- Port 3000 already in use (change `PORT` in `.env`)

### Reset Everything

If things are really broken, start fresh:

```bash
# Stop everything and remove volumes
docker compose down -v

# Remove all Docker images
docker compose down --rmi all

# Start fresh
docker compose up -d
```

## Development Mode

For development with live code reloading:

1. Uncomment these lines in `docker-compose.yml` under the `kowloon` service:

```yaml
volumes:
  - .:/app
  - /app/node_modules
```

2. Restart:
```bash
docker compose up -d
```

Now your local code changes will be reflected immediately in the container.

## Resource Usage

Default resource usage:
- **Kowloon**: ~100-300MB RAM
- **MongoDB**: ~100-500MB RAM
- **MinIO**: ~50-100MB RAM

To limit resources, add to `docker-compose.yml` under each service:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
```

## Getting Help

- Check logs: `docker compose logs -f`
- Check service status: `docker compose ps`
- Verify environment: `docker compose config`
- See Kowloon documentation: [README.md](README.md)
