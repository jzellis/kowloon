# Docker Quick Start

Run Kowloon with Docker in 3 easy steps - no Docker experience required!

## Step 1: Install Docker

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/):
- **Mac**: Download Docker Desktop for Mac
- **Windows**: Download Docker Desktop for Windows
- **Linux**: Install Docker Engine

After installation, start Docker Desktop.

## Step 2: Configure Your Server

Run the setup script:

```bash
./setup-docker.sh
```

This will:
1. Check if Docker is installed and running
2. Create a `.env` configuration file
3. Prompt you to customize important settings

**At minimum, change these in your `.env` file:**
- `DOMAIN` - Your server's domain name (or `localhost` for testing)
- `ADMIN_PASSWORD` - Choose a secure admin password
- `MONGO_PASSWORD` - Choose a secure database password

## Step 3: Start Your Server

If you used the setup script, you're already running! Otherwise:

```bash
docker compose up -d
```

That's it! Your server is now running at:
- **Kowloon**: http://localhost:3000
- **MinIO Console**: http://localhost:9001

## What Just Happened?

Docker just set up 3 services for you:
1. **Kowloon Server** - Your ActivityPub server
2. **MongoDB** - Your database
3. **MinIO** - Your file storage server

All three run in isolated containers and talk to each other automatically.

## Common Tasks

### View Logs
```bash
docker compose logs -f
```

### Stop Everything
```bash
docker compose down
```

### Restart After Config Changes
```bash
docker compose restart
```

### Start Fresh (Deletes All Data!)
```bash
docker compose down -v
docker compose up -d
```

## Need Help?

See [DOCKER.md](DOCKER.md) for the complete guide with troubleshooting, production deployment, backups, and more.

## What is Docker?

Think of Docker like a shipping container for software:
- **Container**: A lightweight box that holds your app and everything it needs
- **Image**: A blueprint for creating containers
- **Docker Compose**: A tool that runs multiple containers together

Benefits:
- ✅ Consistent environment everywhere (works the same on your laptop and server)
- ✅ Easy setup - no need to install Node.js, MongoDB, MinIO separately
- ✅ Isolated - won't conflict with other software on your machine
- ✅ Easy updates - just rebuild the container

## File Locations

Your data is stored in Docker volumes (not in the project folder):
- **Database**: `kowloon_mongodb_data` volume
- **Files**: `kowloon_minio_data` volume
- **Logs**: `kowloon_logs` volume

To see your volumes:
```bash
docker volume ls
```

## Next Steps

1. Access your server at http://localhost:3000
2. Configure your admin account
3. See [FILE_STORAGE.md](FILE_STORAGE.md) for file upload documentation
4. Read [DOCKER.md](DOCKER.md) for production deployment
