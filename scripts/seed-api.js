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

async function downloadFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  return { buffer, contentType, filename };
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
        content: `Just finished reading *The Stars My Destination* for the third time. Still the best science fiction novel ever written, no notes.

Bester understood something most SF writers don't: **plot is character**. Gully Foyle doesn't have an arc — he *is* the arc. Every explosion, every betrayal, every transformation is just him becoming more fully himself.

> "He was one hundred and seventy days dying and not yet dead."

First sentence. Instant hook. That's how you do it.`,
        to: 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis article (public)',
      post: {
        type: 'Article',
        title: 'On the Aesthetics of Midcentury Design',
        content: `Reid Miles understood that negative space *is* content. Every Blue Note cover from 1956 to 1967 is a masterclass in what to leave out.

## The Constraint is the Point

The thing people miss about that era of graphic design is how constrained it was — two or three colours, hand-set type, physical paste-up. The constraints weren't obstacles. They were the whole point.

When you can only use **two colours**, every colour decision is load-bearing. When type has to be set by hand, you stop throwing words at the page. You choose. You cut. You leave silence.

## What We Lost

Modern design tools have made everything possible, which means nothing is *necessary*. You can use 47 fonts. You can have 12 colours. You can animate everything.

> The enemy of design is infinite choice without a forcing function.

Miles didn't have infinite choice. He had a brief, a budget, a deadline, and a genius for reduction. We have Figma and a blank canvas. That's a harder problem, not an easier one.

---

The irony is that the designers who best understand this — who impose their own constraints deliberately — produce work that looks most like that era. Not because they're copying it, but because they've understood *why* it worked.`,
        to: 'public',
      },
    },
    {
      session: design,
      label: 'designthink article (public)',
      post: {
        type: 'Article',
        title: 'Grid Systems and the Myth of Neutrality',
        content: `Müller-Brockmann's grid is not neutral. It encodes a worldview: rationalist, orderly, European. That's not a criticism — it's an observation. Every design system encodes values. The question is whether you're conscious of which ones.

## The Grid as Ideology

The International Typographic Style emerged from a specific moment: postwar Europe, the Frankfurt School, a particular faith in rationalism as an antidote to the chaos of fascism. The grid was *political* before it was aesthetic.

When we reach for a 12-column grid today, we're not choosing a neutral tool. We're inheriting an argument about what design is *for*.

### Three things the grid assumes:

1. Information has a natural hierarchy
2. Readers scan before they read
3. Consistency is a form of respect

These aren't wrong. But they're not universal truths either.

## What a Non-Neutral Grid Looks Like

> "The grid system is an aid, not a guarantee. It permits a number of possible uses and each designer can look for a solution appropriate to his personal style." — Müller-Brockmann himself

Even he knew it was a tool, not a doctrine. The designers who use it best are the ones who know when to break it — and *why* they're breaking it, not just for effect, but because the content demands it.

---

A grid that serves the content is invisible. A grid that serves the system is a cage.`,
        to: 'public',
      },
    },
    {
      session: hacker,
      label: 'cityhacker article (public)',
      post: {
        type: 'Article',
        title: 'ActivityPub Is Not Enough (But It\'s a Start)',
        content: `ActivityPub is the closest thing we have to a universal protocol for federated social networks. It's imperfect, underspecified in places, and the reference implementations vary wildly. It's also the best shot we've had in twenty years at actually building the open social web.

## What It Gets Right

The core model is sound: **actors** send **activities** to **inboxes**. A Follow is an activity. A Create is an activity. Everything is an activity, and activities flow between servers via HTTP. Simple, auditable, extensible.

The use of JSON-LD for the vocabulary is smart even if it's annoying. It means the protocol is self-describing, and you can extend it without breaking existing implementations.

## What It Gets Wrong

### Discovery is a mess

There's no standard way to find people across servers. Webfinger works, sort of, most of the time. But searching for \`@user@instance.social\` from a different server is still a manual, unreliable process.

### The security model is bolted on

HTTP Signatures are the de facto auth mechanism, but they're not in the spec. Every implementation rolls its own, and interop is fragile. We need something better — IETF's HTTP Message Signatures (\`draft-ietf-httpbis-message-signatures\`) is the right direction.

### No standard for client-to-server

ActivityPub defines server-to-server federation well. Client-to-server is underspecified and mostly ignored. Every Mastodon client uses Mastodon's proprietary API. This is a problem.

## Where We Go From Here

\`\`\`
Client → (ActivityPub C2S) → Your Server → (ActivityPub S2S) → Their Server
\`\`\`

This should be the stack. It isn't yet, but it could be. The pieces exist. What's missing is the will to implement them consistently.

---

I'm not optimistic on a five-year horizon. I'm very optimistic on a twenty-year horizon. The open web is slow. It always has been. That's fine.`,
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
        featuredImage: 'https://picsum.photos/seed/bluenote/800/500',
        content: `An absolutely essential resource. Every cover, every session date, every pressing.

What gets me every time is how *consistent* the quality is. Not just the music — the documentation. Every session listed, every personnel change, every reissue. Someone cared deeply about this.

The **1500 series** alone — Monk, Rollins, Silver, Blakey — is one of the great artistic runs in recorded music. If you've never gone through it chronologically, start with *A Night at Birdland* (1954) and just keep going.`,
        to: 'public',
      },
    },
    {
      session: records,
      label: 'recordhead note to jazz circle',
      post: {
        type: 'Note',
        content: `Anyone catch **Empirical** at Ronnie's last night? That set in the second half was something else entirely.

Shabaka was doing things with the tenor in the upper register I genuinely didn't think were possible live. The drummer (can't remember his name, sorry) was holding the whole thing together with this incredibly light touch — never overplaying, always *listening*.

This is why I keep coming back. You can't get this from a recording.`,
        to: jazzCircleId ?? 'public',
      },
    },
    {
      session: records,
      label: 'recordhead event (jazz group)',
      post: {
        type: 'Event',
        title: 'Ronnie Scott\'s Anniversary Night',
        content: `Tickets are up — grab them before they go. **Empirical** are headlining the late set.

This is the club's anniversary, so they're pulling out all the stops. Two sets, late bar, and apparently there's a surprise guest for the midnight slot that I've been sworn to secrecy about.

> "Ronnie Scott's is not just a club. It's an argument that jazz is still alive." — someone wise

Dress code is smart casual. Doors at 7, first set at 8:30.`,
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        to: jazzGroupId ?? 'public',
      },
    },
    {
      session: design,
      label: 'designthink note (design group)',
      post: {
        type: 'Note',
        content: `Just found a near-mint copy of Müller-Brockmann's *Grid Systems in Graphic Design* at a market stall. **Genuinely shaking.**

£4. *Four pounds.* The man behind me had no idea what he was looking at. I wasn't going to tell him.

For the uninitiated: this book is basically the Torah of Swiss graphic design. First published 1961, still in print, still the clearest articulation of why grids work that anyone has ever written. The diagrams alone are worth more than most design degrees.`,
        to: designGroupId ?? 'public',
      },
    },
    {
      session: hacker,
      label: 'cityhacker note (indieweb group)',
      post: {
        type: 'Note',
        content: `Anyone working on **ActivityPub** implementations? Would love to compare notes at the next meetup.

Specifically struggling with:
- HTTP Signatures verification across different server implementations
- Handling \`Delete\` activities for objects you've already cached
- The \`attributedTo\` vs \`actor\` inconsistency in the wild

Happy to share what we've figured out on the Kowloon side if others are running into the same walls.`,
        to: indiewebGroupId ?? 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis note (scifi group)',
      post: {
        type: 'Note',
        content: `Next month we're doing *A Fire Upon the Deep* by Vernor Vinge. Full novel, so **start early**.

A few things to keep in mind as you read:

1. The "Zones of Thought" concept pays off slowly — trust it
2. The Tines chapters are uncomfortable at first and then *brilliant*
3. The Usenet-style messages in the book were written in 1992 and are eerily prescient about online culture

> "The Net of a Million Lies" — Vinge's name for the galactic internet. He wasn't wrong.

See you in four weeks. Bring opinions.`,
        to: scifiGroupId ?? 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis link (public)',
      post: {
        type: 'Link',
        title: 'The IndieWeb Principles',
        href: 'https://indieweb.org/principles',
        featuredImage: 'https://picsum.photos/seed/indieweb/800/500',
        content: `Still the clearest articulation of what the open web should be. Worth re-reading every year.

The principle I keep coming back to: **"Make what you need"**. Not what you think other people need. Not what will scale to a million users. What *you* need, right now, for yourself. The rest follows — or it doesn't, and that's also fine.

This is the direct opposite of how most software gets built. That's why IndieWeb projects feel different to use.`,
        to: 'public',
      },
    },
    {
      session: josh,
      label: 'jzellis article (server-only)',
      post: {
        type: 'Article',
        title: 'Notes on Running a Small Server',
        content: `A few things I've learned after six months of running Kowloon for a small group of people.

## Scale Changes Everything (Even at Small Scale)

Going from 1 user (me, testing) to 10 users (real people with real expectations) is a bigger jump than going from 10 to 1000. At 10, every rough edge is someone's *actual* problem. At 1000, rough edges get averaged out.

This is good. It forces you to fix things you'd otherwise defer.

## Moderation Is a Product Feature

I didn't think much about moderation when I started. It seemed like a future problem. It wasn't.

Even in a small, trusted group:
- People post things they later want deleted
- Spam accounts will find you
- Someone will test the edges of what's acceptable

**You need a moderation policy before you need a moderation incident.** Write it down. Make it public. Refer to it.

## The Boring Infrastructure Is the Important Infrastructure

Backups. Monitoring. Alerting. Not glamorous. Absolutely critical.

\`\`\`bash
# The command I run every morning
restic -r s3:backup-bucket/kowloon snapshots | tail -5
\`\`\`

If that command ever returns nothing, something is very wrong.

---

More notes as I accumulate them. Running infrastructure is humbling in the best way.`,
        to: 'server',
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

  // ── 9. Upload files and create Media posts ────────────────────────────────
  console.log('\n9. Creating Media posts…');

  // Use picsum.photos (CC0) for seed images — stable, deterministic, fast CDN
  const mediaSpecs = [
    {
      session: josh,
      label: 'jzellis media (midcentury)',
      images: [
        { url: 'https://picsum.photos/seed/midcentury1/1200/800', filename: 'midcentury-1.jpg', title: 'Midcentury interior', alt: 'A midcentury modern interior with geometric furniture' },
        { url: 'https://picsum.photos/seed/midcentury2/1200/800', filename: 'midcentury-2.jpg', title: 'Bauhaus geometry', alt: 'Geometric Bauhaus-inspired composition' },
      ],
      post: {
        type: 'Media',
        title: 'Midcentury Reference Shots',
        content: `Some reference images from a recent architecture walk. The integration of geometric form and natural materials in these buildings is something I keep coming back to.

What strikes me most is the **consistency of scale** — everything is proportioned for human beings, not for photographs. These spaces *feel* right before they look right.`,
        to: 'public',
      },
    },
    {
      session: design,
      label: 'designthink media (typography)',
      images: [
        { url: 'https://picsum.photos/seed/typo1/1200/900', filename: 'typography-study.jpg', title: 'Typography study', alt: 'Close-up of letterpress type' },
      ],
      post: {
        type: 'Media',
        title: 'Letterpress Study',
        content: `Spent the afternoon at a letterpress studio. There is no substitute for understanding type through your hands.

The physicality of it changes how you think about spacing. *Leading* is a literal thing — strips of lead. *Kerning* is a physical act. Every decision has weight.`,
        to: 'public',
      },
    },
    {
      session: records,
      label: 'recordhead media (vinyl)',
      images: [
        { url: 'https://picsum.photos/seed/vinyl1/1200/1200', filename: 'vinyl-haul.jpg', title: 'Record haul', alt: 'Stack of vinyl records' },
      ],
      post: {
        type: 'Media',
        title: 'Saturday Market Haul',
        content: `Portobello this morning. Four hours, aching feet, and this lot to show for it.

Highlights: an original Blue Note pressing of *Song for My Father* (minor sleeve wear, vinyl is perfect), a Dutch pressing of *Kind of Blue* I didn't know existed, and a 1971 ECM release I've never seen before.

The ECM alone was worth the trip.`,
        to: 'public',
      },
    },
  ];

  for (const spec of mediaSpecs) {
    if (!spec.session) { fail(spec.label, new Error('session missing')); continue; }
    try {
      // Download and upload each image
      const uploaded = [];
      for (const img of spec.images) {
        const { buffer, contentType } = await downloadFile(img.url, img.filename);
        const uploadRes = await spec.session.client.files.upload({
          file: new Blob([buffer], { type: contentType }),
          filename: img.filename,
          contentType,
          title: img.title,
          summary: img.alt,
          to: spec.post.to,
        });
        uploaded.push({ fileId: uploadRes?.file?.id, title: img.title, alt: img.alt });
        ok(`  upload ${img.filename}`, uploadRes?.file?.id);
      }

      await spec.session.client.activities.createPost({
        ...spec.post,
        attachments: uploaded,
        featuredImage: uploaded[0]?.fileId,
      });
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
