// Checkpoint and restore for fed-test.
// Checkpoint: mongodump each server DB + mirror MinIO buckets + copy state.json
// Restore: mongorestore + mirror MinIO + load state.json + restart app containers

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { SERVERS, SNAPSHOTS_DIR, STATE_FILE, MONGO_HOST, MONGO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } from './config.js';

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function latestSnapshot() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return null;
  const entries = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => fs.statSync(path.join(SNAPSHOTS_DIR, f)).isDirectory())
    .sort()
    .reverse();
  return entries[0] || null;
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

export async function checkpoint() {
  const name = ts();
  const dir = path.join(SNAPSHOTS_DIR, name);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`\nCheckpointing to snapshots/${name}/`);

  // MongoDB dump — one per server DB via docker exec (mongodump runs inside the mongodb container)
  for (const server of SERVERS) {
    const outDir = path.join(dir, 'mongo', server.name);
    fs.mkdirSync(outDir, { recursive: true });
    // Run mongodump inside the MongoDB container (port is internal 27017, not the host-exposed 27018)
    run(
      `docker compose exec -T mongodb mongodump --port 27017 --db ${server.mongoDb} --archive` +
      ` | cat > "${path.join(outDir, `${server.mongoDb}.archive`)}"`,
      { shell: true }
    );
    console.log(`  [${server.name}] MongoDB dumped`);
  }

  // MinIO mirror via docker run
  const minioDir = path.join(dir, 'minio');
  fs.mkdirSync(minioDir, { recursive: true });
  run(
    `docker run --rm ` +
    `--network kowloon-federation_kowloon-net ` +
    `-v "${minioDir}:/backup" ` +
    `minio/mc:latest sh -c ` +
    `"mc alias set local http://minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} && ` +
    `mc mirror local/ /backup/ --overwrite --quiet"`
  );
  console.log(`  MinIO buckets mirrored`);

  // state.json
  fs.copyFileSync(STATE_FILE, path.join(dir, 'state.json'));
  console.log(`  state.json saved`);

  // Write a symlink "latest" → this snapshot
  const latestLink = path.join(SNAPSHOTS_DIR, 'latest');
  if (fs.existsSync(latestLink)) fs.unlinkSync(latestLink);
  fs.symlinkSync(name, latestLink);

  console.log(`Checkpoint complete: snapshots/${name}/`);
  return name;
}

export async function restore(snapshotName = 'latest') {
  const resolvedName = snapshotName === 'latest' ? latestSnapshot() : snapshotName;
  if (!resolvedName) throw new Error('No snapshot found to restore from');

  const dir = path.join(SNAPSHOTS_DIR, resolvedName);
  if (!fs.existsSync(dir)) throw new Error(`Snapshot not found: ${resolvedName}`);

  console.log(`\nRestoring from snapshots/${resolvedName}/`);

  // MongoDB restore via docker exec
  for (const server of SERVERS) {
    const archivePath = path.join(dir, 'mongo', server.name, `${server.mongoDb}.archive`);
    if (!fs.existsSync(archivePath)) {
      console.warn(`  [${server.name}] No dump found, skipping`);
      continue;
    }
    run(
      `cat "${archivePath}" | docker compose exec -T mongodb mongorestore --port 27017` +
      ` --db ${server.mongoDb} --drop --archive`,
      { shell: true }
    );
    console.log(`  [${server.name}] MongoDB restored`);
  }

  // MinIO restore
  const minioDir = path.join(dir, 'minio');
  if (fs.existsSync(minioDir)) {
    run(
      `docker run --rm ` +
      `--network kowloon-federation_kowloon-net ` +
      `-v "${minioDir}:/backup" ` +
      `minio/mc:latest sh -c ` +
      `"mc alias set local http://minio:9000 ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} && ` +
      `mc mirror /backup/ local/ --overwrite --quiet"`
    );
    console.log(`  MinIO restored`);
  }

  // Restart app containers so caches are cleared
  console.log(`  Restarting app containers...`);
  run(`docker compose restart kowloon1 kowloon2 kowloon3 worker1 worker2 worker3`);
  // Give them a moment to come back up
  await new Promise(r => setTimeout(r, 5000));
  console.log(`  Containers restarted`);

  console.log(`Restore complete from snapshots/${resolvedName}/`);
  return path.join(dir, 'state.json');
}
