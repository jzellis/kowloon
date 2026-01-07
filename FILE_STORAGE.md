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
    "mediaType": "image/jpeg",
    "extension": "jpg",
    "size": 123456,
    "actorId": "@user@kwln.org",
    "name": "My Photo",
    "summary": "A beautiful sunset",
    "server": "@kwln.org",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### Get File Metadata

```bash
GET /files/:id

Example: GET /files/file:abc123@kwln.org
```

## Using Files in Posts and Pages

Files are stored as a separate collection and referenced by ID in other schemas:

### Post/Page Attachments

```javascript
// When creating a post with attachments:
const post = new Post({
  actorId: "@user@kwln.org",
  source: { content: "Check out these photos!" },
  attachments: ["file:abc123@kwln.org", "file:def456@kwln.org"] // Array of File IDs
});

// To populate the full file objects:
const populatedPost = await Post.findOne({ id: "post:xyz@kwln.org" })
  .populate("attachmentFiles");
// Now populatedPost.attachmentFiles contains the full File objects
```

### User/Circle/Group/Event Icons

```javascript
// Setting an icon on a user:
const user = await User.findOne({ id: "@alice@kwln.org" });
user.profile.icon = "file:abc123@kwln.org"; // or a URL for backwards compatibility
await user.save();
```

## File Schema Fields

- `id` - Kowloon ID (e.g., "file:abc123@kwln.org")
- `actorId` - Owner of the file (e.g., "@user@kwln.org")
- `parentObject` - ID of the post/page/etc this file belongs to (optional)
- `originalFileName` - Original filename from upload
- `name` - Display title (optional)
- `summary` - Alt text/description (optional)
- `type` - Content type (Image, Video, Audio, Document)
- `mediaType` - MIME type (e.g., "image/jpeg")
- `extension` - File extension (e.g., "jpg")
- `url` - Public URL to access the file
- `server` - Server domain
- `size` - File size in bytes
- `width` - Image/video width in pixels (optional)
- `height` - Image/video height in pixels (optional)
- `blurhash` - BlurHash string for progressive loading (optional)
- `deletedAt` - Soft delete timestamp (optional)

## File Limits

Current upload limits:
- Max file size: 10MB (configurable in `/routes/files/index.js`)

## S3 Storage Adapter

The S3 adapter (`methods/files/StorageAdapter/adapters/s3.js`) implements:
- `upload(buffer, options)` - Upload a file and return metadata
- `delete(fileUrl)` - Delete a file (TODO)

The adapter uses the AWS SDK v3 (`@aws-sdk/client-s3`) which is compatible with any S3-compatible storage service.
