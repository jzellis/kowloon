# Kowloon

A federated social networking server built with Node.js, MongoDB, and Express. Kowloon is an ActivityPub-compatible platform for building decentralized social communities.

## 🚀 Quick Start with Docker

### Prerequisites
- **Docker Desktop** installed and running
- **Docker Compose** (included with Docker Desktop)
- **Git** (to clone the repository)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jzellis/kowloon.git
   cd kowloon
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

   This will start three containers:
   - `kowloon-app` - The Node.js application (port 3000)
   - `kowloon-mongo` - MongoDB database (port 27017)
   - `kowloon-minio` - MinIO S3-compatible storage (ports 9000, 9001)

3. **Access the setup wizard:**

   Open your browser and navigate to **http://localhost:3000**

   You'll be automatically redirected to the setup page where you can configure:
   - **Site Name** - The name of your Kowloon instance
   - **Admin Username** - Your administrator username
   - **Admin Email** - Your email address
   - **Admin Password** - Choose a secure password
   - **Database URI** - Pre-filled with `mongodb://kowloon:changeme@mongo:27017/kowloon?authSource=admin`
   - **Storage Backend** - Select MinIO (S3-compatible)
   - **Storage Settings** - Pre-configured for the Docker setup

4. **Complete setup:**

   Fill in the form and click "Submit". The server will create your admin account and initialize the database.

5. **Start using Kowloon:**

   After setup, you'll be redirected to the home page where you can log in with your admin credentials.

### 📋 Default Configuration

The `.env` file contains default settings for Docker:

```env
DOMAIN=localhost
SITE_TITLE=Kowloon
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=changeme
MONGO_USER=kowloon
MONGO_PASSWORD=changeme
MONGO_DB=kowloon
MINIO_ROOT_USER=kowloon
MINIO_ROOT_PASSWORD=changeme123
MINIO_BUCKET=kowloon
APP_PORT=3000
```

**⚠️ Important:** Change these default passwords before deploying to production!

### 🔧 Useful Commands

**View application logs:**
```bash
docker-compose logs -f app
```

**View all container logs:**
```bash
docker-compose logs -f
```

**Restart the application:**
```bash
docker-compose restart app
```

**Rebuild after code changes:**
```bash
docker-compose up -d --build app
```

**Stop all services:**
```bash
docker-compose down
```

**Stop and remove all data (⚠️ destructive):**
```bash
docker-compose down -v
```

**Access the app container shell:**
```bash
docker exec -it kowloon-app sh
```

**Access MongoDB shell:**
```bash
docker exec -it kowloon-mongo mongosh -u kowloon -p changeme --authenticationDatabase admin
```

**View running containers:**
```bash
docker-compose ps
```

### 🌐 Access Points

Once running, you can access:

- **Kowloon Application:** http://localhost:3000
- **MinIO Console:** http://localhost:9001
  - Username: `kowloon`
  - Password: `changeme123`
- **MongoDB:** localhost:27017
  - Username: `kowloon`
  - Password: `changeme`
  - Database: `kowloon`

### 🛠️ Troubleshooting

**"Cannot GET /" error:**
- The server hasn't been configured yet
- Navigate to http://localhost:3000/setup to complete setup
- Check logs: `docker-compose logs app`

**App won't start:**
- Ensure Docker Desktop is running
- Check if ports 3000, 9000, 9001, or 27017 are already in use
- View logs: `docker-compose logs app`
- Verify `.env` file exists

**Database connection errors:**
- Ensure MongoDB container is running: `docker-compose ps mongo`
- Check MongoDB logs: `docker-compose logs mongo`
- Verify `MONGO_URI` in `.env` is correct

**Port already in use:**
- Change `APP_PORT` in `.env` to a different port (e.g., `3001`)
- Restart: `docker-compose down && docker-compose up -d`

**MinIO not accessible:**
- Check MinIO logs: `docker-compose logs minio`
- Verify MinIO is healthy: `docker-compose ps minio`

### 🏗️ Architecture

```
┌─────────────────────┐
│   Kowloon App       │  Port 3000
│   (Node.js 20)      │  Express + Mongoose
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────┐
│MongoDB │   │ MinIO  │
│  7.x   │   │  S3    │
│ :27017 │   │ :9000  │
└────────┘   └────────┘
```

### 💻 Development

The application stack:
- **Node.js 20** (Alpine Linux) - Runtime environment
- **Express.js** - Web framework
- **MongoDB 7** - Document database
- **Mongoose** - MongoDB ODM
- **MinIO** - S3-compatible object storage
- **ActivityPub** - Federation protocol

**Tech Stack:**
- ES6 Modules (`type: "module"`)
- JWT authentication
- bcrypt password hashing
- Multer for file uploads
- Winston for logging

### 🔒 Production Deployment

**Before deploying to production:**

1. **Update all passwords:**
   - Change `MONGO_PASSWORD` in `.env`
   - Change `MINIO_ROOT_PASSWORD` in `.env`
   - Set a strong `ADMIN_PASSWORD`

2. **Configure your domain:**
   - Set `DOMAIN` to your actual domain (e.g., `social.example.com`)
   - Update `ADMIN_EMAIL` to a real email address

3. **Set up SSL/TLS:**
   - Use a reverse proxy (nginx, Caddy, Traefik)
   - Configure Let's Encrypt certificates
   - Enable HTTPS

4. **Environment:**
   - Set `NODE_ENV=production`
   - Disable TLS rejection in production (remove from code)

5. **Backups:**
   - Configure regular backups for MongoDB data
   - Back up MinIO volumes
   - Store backups off-site

6. **Security:**
   - Use Docker secrets for sensitive data
   - Enable firewall rules
   - Keep dependencies updated
   - Monitor logs for suspicious activity

### 📝 License

ISC - See package.json for details

### 👤 Author

Joshua Ellis

### 🤝 Contributing

Contributions, issues, and feature requests are welcome!

### 📧 Support

For issues and questions, please open an issue on GitHub.

