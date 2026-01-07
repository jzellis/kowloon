# Running Multiple Kowloon Instances

You can run multiple Kowloon instances on the same machine using Docker Compose's project feature. This is useful for:
- Testing federation between servers locally
- Running production and development environments side-by-side
- Testing different configurations

## Method 1: Using Different Ports (Simplest)

### Instance 1 (Default - Port 3000)
```bash
# Use default .env
docker compose up -d
```

### Instance 2 (Port 4000)
Create a second environment file `.env.instance2`:
```bash
# Copy from example
cp .env.example .env.instance2

# Edit with different ports and domain
# .env.instance2:
PORT=4000
DOMAIN=localhost
MONGO_HOST_PORT=27018
MINIO_API_PORT=9002
MINIO_CONSOLE_PORT=9003
S3_PUBLIC_URL=http://localhost:9002/kowloon
# ... other settings
```

Then run with a different project name:
```bash
docker compose --env-file .env.instance2 -p kowloon-instance2 up -d
```

### Instance 3 (Port 5000)
```bash
# Create .env.instance3 with:
PORT=5000
MONGO_HOST_PORT=27019
MINIO_API_PORT=9004
MINIO_CONSOLE_PORT=9005
# etc...

docker compose --env-file .env.instance3 -p kowloon-instance3 up -d
```

## Method 2: Using Separate Docker Compose Files

For more complex setups, you can create separate compose files:

### docker-compose.instance2.yml
```yaml
version: '3.8'

services:
  mongodb:
    # ... same as main, but different ports
    ports:
      - "27018:27017"
    volumes:
      - mongodb_data_instance2:/data/db

  minio:
    ports:
      - "9002:9000"
      - "9003:9001"
    volumes:
      - minio_data_instance2:/data

  kowloon:
    ports:
      - "4000:3000"
    environment:
      PORT: 3000  # Internal port stays same
      DOMAIN: localhost
      # ... other env vars

volumes:
  mongodb_data_instance2:
  minio_data_instance2:
```

Then run:
```bash
docker compose -f docker-compose.instance2.yml up -d
```

## Method 3: Testing Federation Locally

To test federation between two local instances:

### Server A (kwln.org)
`.env.server-a`:
```bash
DOMAIN=kwln.org
PORT=3000
MONGO_HOST_PORT=27017
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
S3_PUBLIC_URL=http://localhost:9000/kowloon
```

Run:
```bash
docker compose --env-file .env.server-a -p kowloon-a up -d
```

### Server B (kwln.social)
`.env.server-b`:
```bash
DOMAIN=kwln.social
PORT=4000
MONGO_HOST_PORT=27018
MINIO_API_PORT=9002
MINIO_CONSOLE_PORT=9003
S3_PUBLIC_URL=http://localhost:9002/kowloon
```

Run:
```bash
docker compose --env-file .env.server-b -p kowloon-b up -d
```

### Configure /etc/hosts
For local federation testing, add to `/etc/hosts`:
```
127.0.0.1 kwln.org
127.0.0.1 kwln.social
```

Now you can test federation between `http://kwln.org:3000` and `http://kwln.social:4000`!

## Helper Script

I've created a helper script `run-instance.sh` that makes this easier.

## Managing Multiple Instances

### List all running instances
```bash
docker ps --filter "name=kowloon"
```

### View logs for specific instance
```bash
# Instance 1 (default)
docker compose logs -f

# Instance 2
docker compose -p kowloon-instance2 logs -f
```

### Stop specific instance
```bash
# Default instance
docker compose down

# Named instance
docker compose -p kowloon-instance2 down
```

### Stop all instances
```bash
docker ps --filter "name=kowloon" -q | xargs docker stop
```

## Port Allocation Guide

Plan your ports to avoid conflicts:

| Instance | Kowloon | MongoDB | MinIO API | MinIO Console |
|----------|---------|---------|-----------|---------------|
| Default  | 3000    | 27017   | 9000      | 9001          |
| Instance 2| 4000   | 27018   | 9002      | 9003          |
| Instance 3| 5000   | 27019   | 9004      | 9005          |
| Instance 4| 6000   | 27020   | 9006      | 9007          |

## Resource Considerations

Each instance uses approximately:
- **Memory**: 500MB - 1GB total (all 3 containers)
- **Disk**: Depends on database and file storage usage

For 3-4 instances on a laptop:
- **Recommended**: 8GB+ RAM
- **Minimum**: 4GB RAM (may be slow)

Monitor resource usage:
```bash
docker stats
```

## Avoiding Brew MongoDB Conflicts

If you have MongoDB installed via Brew on port 27017:

**Option 1: Stop Brew MongoDB when using Docker**
```bash
brew services stop mongodb-community
```

**Option 2: Use different port for Docker**
Set `MONGO_HOST_PORT=27018` in your `.env` file

**Option 3: Stop only for Docker usage**
```bash
# Stop Brew MongoDB
brew services stop mongodb-community

# Use Docker
docker compose up -d

# When done, restart Brew MongoDB
brew services start mongodb-community
```

## Quick Reference

```bash
# Start instance with custom env file and project name
docker compose --env-file .env.custom -p my-instance up -d

# Stop specific instance
docker compose -p my-instance down

# View logs for instance
docker compose -p my-instance logs -f

# Restart instance
docker compose -p my-instance restart

# Remove instance completely (including data!)
docker compose -p my-instance down -v
```
