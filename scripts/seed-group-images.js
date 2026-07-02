// scripts/seed-group-images.js
// Gives every group that still has the default placeholder a real profile icon
// and a hero banner image. Uses picsum.photos (CC0, seeded by group name so
// images are deterministic across runs).
//
// After the first run the script skips groups that already have a custom icon.
// Re-run with --force to overwrite everything.
//
// Usage:
//   node scripts/seed-group-images.js \
//     [--server=https://kwln.social] \
//     [--username=jzellis] \
//     [--password=xxx]          # or env: KOWLOON_PASSWORD
//   KOWLOON_PASSWORD=xxx node scripts/seed-group-images.js --server=https://kwln.social

import { KowloonClient } from '../../client/src/index.js';

const arg  = (flag, fallback) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1] ?? fallback;

const SERVER   = arg('server',   `http://localhost:${process.env.PORT ?? 3000}`);
const PASSWORD = arg('password', process.env.KOWLOON_PASSWORD ?? '');
const FORCE    = process.argv.includes('--force');

if (!PASSWORD) {
  console.error('Provide a password: --password=xxx or KOWLOON_PASSWORD env var');
  process.exit(1);
}

// Cache of logged-in clients keyed by username so we only log in once per user.
const clientCache = {};

async function clientFor(username) {
  if (clientCache[username]) return clientCache[username];
  const c = new KowloonClient({ baseUrl: SERVER });
  await c.init();
  await c.auth.login({ username, password: PASSWORD });
  clientCache[username] = c;
  return c;
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isDefaultIcon(icon) {
  if (!icon) return true;
  return /\/(images|icons)\/(user|circle|group)\.(png|svg)$/i.test(icon);
}

async function downloadFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
  return { buffer, contentType, filename };
}

async function uploadImage(client, buffer, contentType, filename) {
  const blob = new Blob([buffer], { type: contentType });
  const res  = await client.files.upload({
    file:     blob,
    filename,
    to:       '@public',
    generateThumbnail: true,
    thumbnailSizes:    [200, 400],
  });
  if (!res?.file?.url) throw new Error(`Upload returned no URL for ${filename}`);
  return res.file.url;
}

async function run() {
  console.log(`Server: ${SERVER}\n`);

  // Use an anonymous client just for listing groups
  const anon = new KowloonClient({ baseUrl: SERVER });
  await anon.init();

  // Fetch all groups (paginate if needed)
  let groups = [];
  let page = 1;
  while (true) {
    const res = await anon.feeds.http.get('/groups', { params: { limit: 50, page } });
    const items = res?.orderedItems ?? [];
    groups = groups.concat(items);
    if (items.length < 50) break;
    page++;
  }

  if (!groups.length) {
    console.log('No groups found — nothing to do.');
    return;
  }

  console.log(`Found ${groups.length} group(s)\n`);

  for (const group of groups) {
    const name = group.name ?? group.id;
    const id   = group.id;

    if (!FORCE && !isDefaultIcon(group.icon)) {
      console.log(`  skip  ${name} (already has a custom icon)`);
      continue;
    }

    // Fetch full group detail to get the owner's username
    let ownerUsername;
    try {
      const detail = await anon.feeds.getGroup({ groupId: id });
      const actorId = detail?.item?.actorId ?? detail?.actorId ?? '';
      // actorId is "@username@domain" — extract username
      ownerUsername = actorId.replace(/^@/, '').split('@')[0];
    } catch (err) {
      console.error(`  ERROR fetching detail for ${name}: ${err.message}`);
      continue;
    }

    if (!ownerUsername) {
      console.error(`  skip  ${name} (could not determine owner)`);
      continue;
    }

    console.log(`  → ${name} (owner: ${ownerUsername})`);
    const seed = slug(name);

    try {
      const client = await clientFor(ownerUsername);

      // Download icon (square) and banner (3:1)
      const [iconFile, bannerFile] = await Promise.all([
        downloadFile(`https://picsum.photos/seed/${seed}/400/400`, `${seed}-icon.jpg`),
        downloadFile(`https://picsum.photos/seed/${seed}-banner/1200/400`, `${seed}-banner.jpg`),
      ]);

      // Upload both as the group owner
      const [iconUrl, bannerUrl] = await Promise.all([
        uploadImage(client, iconFile.buffer, iconFile.contentType, iconFile.filename),
        uploadImage(client, bannerFile.buffer, bannerFile.contentType, bannerFile.filename),
      ]);

      // Update the group
      await client.activities.updateGroup({
        groupId:          id,
        icon:             iconUrl,
        image:            bannerUrl,  // requires new server schema — silently ignored on old code
        membershipPolicy: group.rsvpPolicy,
      });

      console.log(`    icon:   ${iconUrl}`);
      console.log(`    banner: ${bannerUrl}`);
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
