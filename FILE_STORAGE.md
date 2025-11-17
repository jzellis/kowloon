# File Storage Configuration

Kowloon uses S3-compatible object storage for file uploads. This works with:
- **Amazon S3**
- **MinIO** - Self-hosted S3-compatible storage (recommended for local development)
- **DigitalOcean Spaces**
- **Backblaze B2**
- Any other S3-compatible service

## MinIO Setup (Recommended for Development)

MinIO is a high-performance, S3-compatible object storage server that's perfect for self-hosted deployments.

### Environment Variables

Add these to your `.env` file:

```bash
# S3/MinIO Configuration
S3_ENDPOINT=http://localhost:9000          # MinIO server endpoint
S3_REGION=us-east-1                        # Region (can be any value for MinIO)
S3_BUCKET=kowloon                          # Bucket name for storing files
S3_ACCESS_KEY=minioadmin                   # MinIO access key
S3_SECRET_KEY=minioadmin                   # MinIO secret key
S3_PUBLIC_URL=http://localhost:9000/kowloon  # Public URL for accessing files
```

### Running MinIO with Docker

```bash
# Start MinIO server
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v ~/minio/data:/data \
  minio/minio server /data --console-address ":9001"

# Create the bucket
docker exec minio mc mb /data/kowloon

# Set bucket policy to public read (for file serving)
docker exec minio mc anonymous set download /data/kowloon
```

### MinIO Console

Access the MinIO web console at: `http://localhost:9001`
- Username: `minioadmin`
- Password: `minioadmin`

## API Endpoints

### Upload File

```bash
POST /files
Content-Type: multipart/form-data

Fields:
- file: (file) The file to upload
- actorId: (string, optional) Actor ID who owns the file
- title: (string, optional) File title
- summary: (string, optional) File description
```

Example:
```bash
curl -X POST http://localhost:3000/files \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "title=My Photo" \
  -F "summary=A beautiful sunset"
```

Response:
```json
{
  "file": {
    "id": "file:abc123@kwln.org",
    "url": "http://localhost:9000/kowloon/1234567890-xyz.jpg",
    "originalFileName": "image.jpg",
    "mimeType": "image/jpeg",
    "size": 123456,
    "actorId": "@user@kwln.org",
    "title": "My Photo",
    "summary": "A beautiful sunset"
  }
}
```

### Get File Metadata

```bash
GET /files/:id

Example: GET /files/file:abc123@kwln.org
```

## File Limits

Current upload limits:
- Max file size: 10MB (configurable in `/routes/files/index.js`)

## S3 Storage Adapter

The S3 adapter (`methods/files/StorageAdapter/adapters/s3.js`) implements:
- `upload(buffer, options)` - Upload a file and return metadata
- `delete(fileUrl)` - Delete a file (TODO)

The adapter uses the AWS SDK v3 (`@aws-sdk/client-s3`) which is compatible with any S3-compatible storage service.
