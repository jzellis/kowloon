// scripts/seed-api.js
// Seeds the database entirely through the Kowloon HTTP API using @kowloon/client.
// Run AFTER wiping the DB and restarting the server.
// Any failures are logged and filed as GitHub issues (if gh is available).
//
// Usage: node scripts/seed-api.js [--server=https://kwln.org]

import { KowloonClient } from '../../kowloon-client/src/index.js';

const SERVER = process.argv.find((a) => a.startsWith('--server='))?.split('=')[1]
  ?? `http://localhost:${process.env.PORT ?? 3000}`;

const PASS = '12345';

const failures = [];

function fail(label, err) {
  const msg = err?.message ?? String(err);
  console.error(`  ✗ ${label}: ${msg}`);
  failures.push({ label, error: msg });
}

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

function client() {
  return new KowloonClient({ baseUrl: SERVER });
}

// ── Cast of characters ────────────────────────────────────────────────────────

const USERS = [
  {
    username: 'jzellis',
    password: PASS,
    email: 'josh@kwln.org',
    profile: {
      name: 'Joshua Ellis',
      bio: 'Writer, musician, technologist. Making things on the open web.',
      location: { name: 'London, UK', type: 'Point', coordinates: [-0.1276, 51.5074] },
      urls: ['https://joshuaellis.net'],
    },
  },
  {
    username: 'designthink',
    password: PASS,
    email: 'design@kwln.org',
    profile: {
      name: 'Design Thinking',
      bio: 'Mid-century modern aesthetics. Reid Miles understood that negative space is content.',
      location: { name: 'Berlin, DE', type: 'Point', coordinates: [13.4050, 52.5200] },
    },
  },
  {
    username: 'recordhead',
    password: PASS,
    email: 'records@kwln.org',
    profile: {
      name: 'Record Head',
      bio: 'Jazz, improvised music, vinyl. Ronnie\'s on Fridays.',
      location: { name: 'London, UK', type: 'Point', coordinates: [-0.1276, 51.5074] },
    },
  },
  {
    username: 'cityhacker',
    password: PASS,
    email: 'city@kwln.org',
    profile: {
      name: 'City Hacker',
      bio: 'IndieWeb, ActivityPub, open protocols. Building the web we deserve.',
      location: { name: 'London, UK', type: 'Point', coordinates: [-0.1276, 51.5074] },
    },
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nKowloon API Seed — ${SERVER}\n`);

  // ── 1. Register users ──────────────────────────────────────────────────────
  console.log('1. Registering users…');

  const sessions = {}; // username -> { client, user }

  for (const u of USERS) {
    const c = client();
    try {
      const res = await c.auth.register(u);
      await c.init(); // restore session from stored token
      sessions[u.username] = { client: c, user: res.user ?? res };
      ok(`register ${u.username}`, sessions[u.username].user?.id);
    } catch (err) {
      // User may already exist from a partial run — try logging in instead
      try {
        const res = await c.auth.login({ username: u.username, password: u.password });
        await c.init();
        sessions[u.username] = { client: c, user: res.user ?? res };
        ok(`login (existing) ${u.username}`, sessions[u.username].user?.id);
      } catch (loginErr) {
        fail(`register/login ${u.username}`, loginErr);
      }
    }
  }

  const josh    = sessions['jzellis'];
  const design  = sessions['designthink'];
  const records = sessions['recordhead'];
  const hacker  = sessions['cityhacker'];

  // ── 2. Check Following circles ────────────────────────────────────────────
  console.log('\n2. Checking Following circles…');
  for (const [name, s] of Object.entries(sessions)) {
    if (!s) continue;
    if (s.user?.following) {
      ok(`${name}.following`, s.user.following);
    } else {
      fail(`${name}.following`, new Error('user.following is null — Following circle not auto-created'));
    }
  }

  // ── 3. Follow each other ──────────────────────────────────────────────────
  console.log('\n3. Following users…');

  const followPairs = [
    [josh,    records, 'jzellis → recordhead'],
    [josh,    design,  'jzellis → designthink'],
    [josh,    hacker,  'jzellis → cityhacker'],
    [records, josh,    'recordhead → jzellis'],
    [records, design,  'recordhead → designthink'],
    [design,  josh,    'designthink → jzellis'],
    [design,  records, 'designthink → recordhead'],
    [hacker,  josh,    'cityhacker → jzellis'],
  ];

  for (const [from, to, label] of followPairs) {
    if (!from || !to) { fail(label, new Error('session missing')); continue; }
    try {
      await from.client.activities.follow({ userId: to.user.id });
      ok(label);
    } catch (err) {
      fail(label, err);
    }
  }

  // ── 4. Create circles ─────────────────────────────────────────────────────
  console.log('\n4. Creating circles…');

  const circles = {};

  const circleSpecs = [
    { session: josh,    key: 'friends',   name: 'Friends',              summary: 'Close friends only.',             to: 'server' },
    { session: josh,    key: 'music',     name: 'Music Folks',          summary: 'People who talk about music.',    to: 'public' },
    { session: josh,    key: 'tech',      name: 'Tech & Programming',   summary: 'Dev stuff.',                      to: 'server' },
    { session: records, key: 'jazz',      name: 'Jazz & Improvised Music', summary: 'The real stuff.',              to: 'public' },
    { session: design,  key: 'design',    name: 'Design & Art',         summary: 'Midcentury and beyond.',          to: 'public' },
    { session: hacker,  key: 'indieweb',  name: 'IndieWeb',             summary: 'Open web protocols and tools.',   to: 'server' },
  ];

  for (const spec of circleSpecs) {
    if (!spec.session) { fail(`circle:${spec.key}`, new Error('session missing')); continue; }
    try {
      const res = await spec.session.client.activities.createCircle({
        name: spec.name,
        summary: spec.summary,
        to: spec.to,
      });
      circles[spec.key] = res;
      ok(`circle:${spec.key}`, res?.createdId ?? res?.result?.id);
    } catch (err) {
      fail(`circle:${spec.key}`, err);
    }
  }

  // ── 5. Add members to circles ─────────────────────────────────────────────
  console.log('\n5. Adding circle members…');

  const memberSpecs = [
    { session: josh,    circleKey: 'friends', userId: records?.user?.id, label: 'friends ← recordhead' },
    { session: josh,    circleKey: 'friends', userId: design?.user?.id,  label: 'friends ← designthink' },
    { session: josh,    circleKey: 'music',   userId: records?.user?.id, label: 'music ← recordhead' },
    { session: josh,    circleKey: 'music',   userId: design?.user?.id,  label: 'music ← designthink' },
    { session: josh,    circleKey: 'tech',    userId: hacker?.user?.id,  label: 'tech ← cityhacker' },
    { session: records, circleKey: 'jazz',    userId: josh?.user?.id,    label: 'jazz ← jzellis' },
    { session: records, circleKey: 'jazz',    userId: design?.user?.id,  label: 'jazz ← designthink' },
    { session: design,  circleKey: 'design',  userId: josh?.user?.id,    label: 'design ← jzellis' },
    { session: design,  circleKey: 'design',  userId: records?.user?.id, label: 'design ← recordhead' },
    { session: hacker,  circleKey: 'indieweb',userId: josh?.user?.id,    label: 'indieweb ← jzellis' },
  ];

  for (const spec of memberSpecs) {
    if (!spec.session || !spec.userId || !circles[spec.circleKey]) {
      fail(spec.label, new Error('session, userId, or circle missing'));
      continue;
    }
    const circleId = circles[spec.circleKey]?.createdId ?? circles[spec.circleKey]?.result?.id;
    if (!circleId) { fail(spec.label, new Error('circle has no id')); continue; }
    try {
      await spec.session.client.activities.addToCircle({ circleId, userId: spec.userId });
      ok(spec.label);
    } catch (err) {
      fail(spec.label, err);
    }
  }

  // ── 6. Create groups ──────────────────────────────────────────────────────
  console.log('\n6. Creating groups…');

  const groups = {};

  const groupSpecs = [
    {
      session: records,
      key: 'jazz',
      name: 'London Jazz Society',
      description: 'For fans of jazz and improvised music in and around London.',
      to: 'public',
    },
    {
      session: hacker,
      key: 'indieweb',
      name: 'Indie Web London',
      description: 'ActivityPub, IndieWeb, open protocols. Building the web we deserve.',
      to: 'public',
    },
    {
      session: design,
      key: 'design',
      name: 'Midcentury Design Collective',
      description: 'A group for lovers of midcentury modern design, typography, and print.',
      to: 'public',
    },
    {
      session: josh,
      key: 'scifi',
      name: 'Science Fiction Reading Group',
      description: 'Monthly reads. Currently: A Fire Upon the Deep.',
      to: 'public',
    },
  ];

  for (const spec of groupSpecs) {
    if (!spec.session) { fail(`group:${spec.key}`, new Error('session missing')); continue; }
    try {
      const res = await spec.session.client.activities.createGroup({
        name: spec.name,
        description: spec.description,
        to: spec.to,
      });
      groups[spec.key] = res;
      ok(`group:${spec.key}`, res?.createdId ?? res?.result?.id);
    } catch (err) {
      fail(`group:${spec.key}`, err);
    }
  }

  // ── 7. Join groups ────────────────────────────────────────────────────────
  console.log('\n7. Joining groups…');

  const joinSpecs = [
    { session: josh,    groupKey: 'jazz',    label: 'jzellis → jazz' },
    { session: josh,    groupKey: 'indieweb',label: 'jzellis → indieweb' },
    { session: josh,    groupKey: 'design',  label: 'jzellis → design' },
    { session: design,  groupKey: 'jazz',    label: 'designthink → jazz' },
    { session: records, groupKey: 'design',  label: 'recordhead → design' },
    { session: hacker,  groupKey: 'scifi',   label: 'cityhacker → scifi' },
    { session: hacker,  groupKey: 'jazz',    label: 'cityhacker → jazz' },
  ];

  for (const spec of joinSpecs) {
    if (!spec.session || !groups[spec.groupKey]) {
      fail(spec.label, new Error('session or group missing'));
      continue;
    }
    const groupId = groups[spec.groupKey]?.createdId ?? groups[spec.groupKey]?.result?.id;
    if (!groupId) { fail(spec.label, new Error('group has no id')); continue; }
    try {
      await spec.session.client.activities.joinGroup({ groupId });
      ok(spec.label);
    } catch (err) {
      fail(spec.label, err);
    }
  }

  // ── 8. Create posts ───────────────────────────────────────────────────────
  console.log('\n8. Creating posts…');

  const jazzGroupId     = groups['jazz']?.createdId     ?? groups['jazz']?.result?.id;
  const designGroupId   = groups['design']?.createdId   ?? groups['design']?.result?.id;
  const scifiGroupId    = groups['scifi']?.createdId    ?? groups['scifi']?.result?.id;
  const indiewebGroupId = groups['indieweb']?.createdId ?? groups['indieweb']?.result?.id;
  const jazzCircleId    = circles['jazz']?.createdId    ?? circles['jazz']?.result?.id;

  const postSpecs = [
    {
      session: josh,
      label: 'jzellis note (public)',
      post: {
        type: 'Note',
        content: 'Just finished reading *The Stars My Destination* for the third time. Still the best science fiction novel ever written, no notes.',
        to: 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis article (public)',
      post: {
        type: 'Article',
        title: 'On the Aesthetics of Midcentury Design',
        content: 'Reid Miles understood that negative space *is* content. Every Blue Note cover from 1956 to 1967 is a masterclass in what to leave out.\n\nThe thing people miss about that era of graphic design is how constrained it was — two or three colours, hand-set type, physical paste-up. The constraints weren\'t obstacles. They were the whole point.',
        to: 'public',
      },
    },
    {
      session: design,
      label: 'designthink article (public)',
      post: {
        type: 'Article',
        title: 'Grid Systems and the Myth of Neutrality',
        content: 'Müller-Brockmann\'s grid is not neutral. It encodes a worldview: rationalist, orderly, European. That\'s not a criticism — it\'s an observation. Every design system encodes values. The question is whether you\'re conscious of which ones.',
        to: 'public',
      },
    },
    {
      session: records,
      label: 'recordhead link (public)',
      post: {
        type: 'Link',
        title: 'Blue Note Records: The Complete Discography',
        href: 'https://www.discogs.com/label/3073-Blue-Note-Records',
        content: 'An absolutely essential resource. Every cover, every session date, every pressing.',
        to: 'public',
      },
    },
    {
      session: records,
      label: 'recordhead note to jazz circle',
      post: {
        type: 'Note',
        content: 'Anyone catch Empirical at Ronnie\'s last night? That set in the second half was something else entirely.',
        to: jazzCircleId ?? 'public',
      },
    },
    {
      session: records,
      label: 'recordhead event (jazz group)',
      post: {
        type: 'Event',
        title: 'Ronnie Scott\'s Anniversary Night',
        content: 'Tickets are up — grab them before they go. Empirical are headlining the late set.',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        to: jazzGroupId ?? 'public',
      },
    },
    {
      session: design,
      label: 'designthink note (public)',
      post: {
        type: 'Note',
        content: 'Just found a near-mint copy of Müller-Brockmann\'s *Grid Systems* at a market stall. Genuinely shaking.',
        to: designGroupId ?? 'public',
      },
    },
    {
      session: hacker,
      label: 'cityhacker note (indieweb group)',
      post: {
        type: 'Note',
        content: 'Anyone working on ActivityPub implementations? Would love to compare notes at the next meetup.',
        to: indiewebGroupId ?? 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis note (scifi group)',
      post: {
        type: 'Note',
        content: 'Next month we\'re doing *A Fire Upon the Deep*. Full novel, so start early.',
        to: scifiGroupId ?? 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis link (public)',
      post: {
        type: 'Link',
        title: 'The IndieWeb\'s Longest-Running Experiment',
        href: 'https://indieweb.org',
        content: 'Still the best argument for owning your own content on the web.',
        to: 'public',
      },
    },
  ];

  for (const spec of postSpecs) {
    if (!spec.session) { fail(spec.label, new Error('session missing')); continue; }
    try {
      await spec.session.client.activities.createPost(spec.post);
      ok(spec.label);
    } catch (err) {
      fail(spec.label, err);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  if (failures.length === 0) {
    console.log('✅ All steps passed. API is fully functional.\n');
  } else {
    console.log(`⚠️  ${failures.length} failure(s):\n`);
    for (const f of failures) {
      console.log(`  • ${f.label}: ${f.error}`);
    }
    console.log('\nAdd these to the GitHub issue tracker or KNOWN_ISSUES.md.');
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ Seed script crashed:', err);
  process.exit(1);
});
