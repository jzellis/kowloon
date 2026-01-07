# Kowloon Multi-Instance Setup

Run multiple Kowloon instances on shared infrastructure with automatic domain routing.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Traefik (Port 80/443)                │
│              Automatic domain-based routing              │
└─────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
    kwln.org          kwln.social        test.example.com
    ┌────────┐         ┌────────┐         ┌────────┐
    │Instance│         │Instance│         │Instance│
    │   1    │         │   2    │         │   3    │
    └────────┘         └────────┘         └────────┘
         │                  │                  │
         └──────────┬───────┴──────────────────┘
                    │
    ┌───────────────┴────────────────┐
    │   Shared Infrastructure        │
    ├────────────────────────────────┤
    │  MongoDB (Multiple databases)  │
    │  MinIO (Multiple buckets)      │
    └────────────────────────────────┘
```

### Benefits

✅ **Resource Efficient** - One database server, one storage server
✅ **No Port Conflicts** - Traefik handles all routing on ports 80/443
✅ **Clean Isolation** - Each instance has its own database and bucket
✅ **Easy to Scale** - Add new instances with one command
✅ **Production Ready** - Automatic HTTPS with Let's Encrypt

## Quick Start

### 1. Install Docker

Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 2. Start Infrastructure

```bash
./setup-infra.sh
```

This starts:
- **MongoDB** on port 27017 (internal only)
- **MinIO** on ports 9000 (API) and 9001 (console)
- **Traefik** on ports 80, 443, and 8080 (dashboard)

### 3. Create Your First Instance

```bash
./kowloon-instance.sh create kwln.org
```

You'll be prompted for:
- Site Title
- Admin Email
- Admin Password (auto-generated if left empty)

The script will:
- Generate a unique instance ID: `kwln-org_{8-char-uuid}`
- Create MongoDB database: `kowloon_kwln-org_{uuid}`
- Create MinIO bucket: `kowloon-kwln-org-{uuid}`
- Generate secure JWT_SECRET
- Configure Traefik routing for the domain

### 4. Add Domain to /etc/hosts (Local Development)

```bash
echo '127.0.0.1 kwln.org' | sudo tee -a /etc/hosts
```

### 5. Start the Instance

```bash
./kowloon-instance.sh start kwln.org
```

### 6. Access Your Instance

Open http://kwln.org in your browser!

## Command Reference

### Infrastructure Commands

```bash
# Start infrastructure
./setup-infra.sh
# or
make infra

# Stop infrastructure
docker compose down
# or
make infra-stop

# View infrastructure logs
docker compose logs -f mongodb minio traefik
```

### Instance Management

```bash
# Create instance
./kowloon-instance.sh create <domain>
make create DOMAIN=<domain>

# Start instance (or all)
./kowloon-instance.sh start [domain]
make start [DOMAIN=domain]

# Stop instance (or all)
./kowloon-instance.sh stop [domain]
make stop [DOMAIN=domain]

# Restart instance
./kowloon-instance.sh restart <domain>
make restart DOMAIN=<domain>

# List all instances
./kowloon-instance.sh list
make list

# Show instance details
./kowloon-instance.sh info <domain>
make info DOMAIN=<domain>

# View logs
./kowloon-instance.sh logs [domain]
make logs [DOMAIN=domain]

# Remove instance
./kowloon-instance.sh remove <domain>
make remove DOMAIN=<domain>
```

## Instance Naming Convention

Each instance gets a unique ID combining the domain slug and a UUID:

```
{domain-slug}_{8-char-uuid}
```

Examples:
- Domain: `kwln.org` → Instance: `kwln-org_a1b2c3d4`
- Domain: `test.example.com` → Instance: `test-example-com_e5f6g7h8`

This creates:
- **MongoDB database**: `kowloon_{instance-id}`
- **MinIO bucket**: `kowloon-{instance-id}` (underscores → hyphens)
- **Container name**: `kowloon-{instance-id}` (underscores → hyphens)

## File Structure

```
kowloon/
├── docker-compose.yml              # Infrastructure services
├── docker-compose.override.yml     # Auto-generated instances
├── Dockerfile                      # Kowloon application
├── kowloon-instance.sh            # Management script
├── setup-infra.sh                 # Infrastructure setup
├── .env                           # Shared credentials
└── instances/
    ├── instances.json             # Instance registry
    ├── kwln-org_a1b2c3d4/
    │   └── .env                   # Instance config
    └── kwln-social_e5f6g7h8/
        └── .env                   # Instance config
```

## Example: Testing Federation Locally

Create two instances to test federation:

```bash
# Create first instance
./kowloon-instance.sh create kwln.org

# Create second instance
./kowloon-instance.sh create kwln.social

# Add both to /etc/hosts
sudo tee -a /etc/hosts <<EOF
127.0.0.1 kwln.org
127.0.0.1 kwln.social
EOF

# Start both instances
./kowloon-instance.sh start

# Access them
# http://kwln.org
# http://kwln.social
```

Now you can test ActivityPub federation between the two instances!

## Production Deployment

### 1. DNS Setup

Point your domains to your server's IP:

```
A    kwln.org          → 1.2.3.4
A    kwln.social       → 1.2.3.4
A    test.example.com  → 1.2.3.4
```

### 2. Enable HTTPS

Edit `docker-compose.yml` and uncomment the Let's Encrypt configuration:

```yaml
traefik:
  command:
    - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
    - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
```

Then in each instance's Traefik labels (in `docker-compose.override.yml`), uncomment:

```yaml
- "traefik.http.routers.{instance}-secure.rule=Host(`domain.com`)"
- "traefik.http.routers.{instance}-secure.entrypoints=websecure"
- "traefik.http.routers.{instance}-secure.tls.certresolver=letsencrypt"
```

Rebuild with: `./kowloon-instance.sh rebuild`

### 3. Update S3_PUBLIC_URL

For each instance, edit `instances/{instance-id}/.env`:

```bash
S3_PUBLIC_URL=https://yourdomain.com/files
```

### 4. Restart Instances

```bash
docker compose restart
```

## Monitoring

### Traefik Dashboard

Access at http://localhost:8080

Shows:
- All routers and routes
- Backend services
- Health checks
- TLS certificates

### View Instance Status

```bash
# List all instances
make list

# Check Docker status
docker compose ps

# View resource usage
docker stats
```

### View Logs

```bash
# All logs
docker compose logs -f

# Specific instance
./kowloon-instance.sh logs kwln.org

# Infrastructure only
docker compose logs -f mongodb minio traefik
```

## Troubleshooting

### Instance not accessible

1. Check if it's running:
   ```bash
   docker compose ps | grep kwln-org
   ```

2. Check Traefik routing:
   - Visit http://localhost:8080
   - Look for your domain in routers

3. Check /etc/hosts (local dev):
   ```bash
   cat /etc/hosts | grep kwln.org
   ```

4. View instance logs:
   ```bash
   ./kowloon-instance.sh logs kwln.org
   ```

### MinIO bucket not found

Buckets are created automatically, but if needed:

```bash
# Access MinIO container
docker exec -it kowloon-minio sh

# Create bucket manually
mc alias set local http://localhost:9000 $ACCESS_KEY $SECRET_KEY
mc mb local/kowloon-kwln-org-a1b2c3d4
mc anonymous set download local/kowloon-kwln-org-a1b2c3d4
```

### Database connection issues

Check MongoDB is healthy:

```bash
docker compose ps mongodb
docker compose logs mongodb
```

Connect to MongoDB:

```bash
docker exec -it kowloon-mongodb mongosh -u kowloon -p
```

### Port conflicts

If ports 80/443 are in use:

```bash
# Find what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services (e.g., Apache/Nginx)
sudo systemctl stop apache2
sudo systemctl stop nginx
```

### Reset everything

```bash
# WARNING: Deletes all data!
docker compose down -v
rm -rf instances/*/
echo '{}' > instances/instances.json
rm -f docker-compose.override.yml

# Start fresh
./setup-infra.sh
```

## Backups

### Backup All Databases

```bash
# Backup all MongoDB databases
docker exec kowloon-mongodb mongodump \
  --username=kowloon \
  --password=$MONGO_PASSWORD \
  --out=/tmp/backup

# Copy from container
docker cp kowloon-mongodb:/tmp/backup ./backups/mongodb-$(date +%Y%m%d)
```

### Backup MinIO Data

```bash
# Using Docker volume backup
docker run --rm \
  -v kowloon_minio_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /data .
```

### Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/kowloon && make backup
```

## Resource Requirements

### Minimum

- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB

### Recommended (for 3-5 instances)

- **CPU**: 4 cores
- **RAM**: 8GB
- **Disk**: 50GB+ (depends on usage)

### Per-Service Usage

- MongoDB: ~100-500MB RAM
- MinIO: ~50-100MB RAM
- Traefik: ~30-50MB RAM
- Per Kowloon instance: ~100-300MB RAM

## Advanced Configuration

### Custom Traefik Configuration

Create `traefik.yml` for advanced Traefik config.

### Database Connection Pooling

Edit instance `.env`:

```bash
MONGO_URI=mongodb://...?maxPoolSize=20&minPoolSize=5
```

### Custom Domains Per Instance

Each instance can have multiple domains by editing labels in `docker-compose.override.yml`:

```yaml
- "traefik.http.routers.{instance}.rule=Host(`domain1.com`) || Host(`domain2.com`)"
```

## Getting Help

- Documentation: [README.md](README.md)
- Docker guide: [DOCKER.md](DOCKER.md)
- Issue tracker: https://github.com/anthropics/kowloon/issues

## Quick Reference

```bash
# Setup
./setup-infra.sh              # First time setup

# Create & manage
./kowloon-instance.sh create kwln.org
./kowloon-instance.sh start kwln.org
./kowloon-instance.sh logs kwln.org
./kowloon-instance.sh stop kwln.org

# Or use Makefile
make create DOMAIN=kwln.org
make start DOMAIN=kwln.org
make logs DOMAIN=kwln.org
make list
```
