import { fileURLToPath } from 'url';
import path from 'path';

export const SERVERS = [
  { name: 'kwln1', baseUrl: 'http://kwln1.local:8080', domain: 'kwln1.local', mongoDb: 'kowloon1', minioBucket: 'kwln1' },
  { name: 'kwln2', baseUrl: 'http://kwln2.local:8080', domain: 'kwln2.local', mongoDb: 'kowloon2', minioBucket: 'kwln2' },
  { name: 'kwln3', baseUrl: 'http://kwln3.local:8080', domain: 'kwln3.local', mongoDb: 'kowloon3', minioBucket: 'kwln3' },
];

export const SCALE = {
  usersPerServer: 100,
  postsPerUser: { min: 10, max: 20 },
  circlesPerUser: { min: 2, max: 5 },
  bookmarkFoldersPerUser: { min: 2, max: 3 },
  bookmarksPerUser: { min: 5, max: 10 },
  groupsPerServer: 25,
  groupMembersMin: 10,
  groupMembersMax: 50,
  mediaPoolPerServer: 50,
  // For Phase 3 federation
  followPairsPerDirection: 30,   // 30 kwln1→kwln2, 30 kwln2→kwln3, 30 kwln3→kwln1
  crossGroupJoinsPerServer: 5,   // groups on remote server that local users join
  crossGroupUsersPerGroup: 8,    // local users that join each remote group
};

export const PASSWORD = 'fedtest123';
export const CONCURRENCY = 20;
export const FEDERATION_TIMEOUT_MS = 60000;
export const FEDERATION_POLL_MS = 500;

export const MONGO_HOST = 'localhost';
export const MONGO_PORT = 27018;

export const MINIO_URL = 'http://minio:9000';
export const MINIO_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
export const MINIO_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');
export const STATE_FILE = path.join(__dirname, 'state.json');
export const SAMPLE_MEDIA_DIR = path.join(__dirname, '../../../sample-media');
