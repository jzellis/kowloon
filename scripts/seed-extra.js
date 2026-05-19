// scripts/seed-extra.js
// Add 25 more users and ~100 varied posts (Note, Article, Media, Link, Event)
// for richer UX testing. Reads from the repo's sample-media folder for icons,
// featured images, and inline media. Link posts use a hand-curated list of
// real URLs with proper preview metadata.
//
// Idempotent-ish: skips registering a user that already exists. Re-running
// will create another batch of posts on top of whatever's there.
//
// Usage:
//   TEST_BASE_URL=http://kwln.org:3000 node scripts/seed-extra.js
//
// Optional env:
//   USER_COUNT=25  POST_COUNT=100  PASSWORD=testpass

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL    = process.env.TEST_BASE_URL || "http://kwln.org:3000";
const DOMAIN      = process.env.DOMAIN        || "kwln.org";
const PASSWORD    = process.env.PASSWORD      || "testpass";
const USER_COUNT  = parseInt(process.env.USER_COUNT || "25", 10);
const POST_COUNT  = parseInt(process.env.POST_COUNT || "100", 10);

// Where the static mount serves these — see server/index.js.
const SAMPLE_DIR  = path.resolve(__dirname, "..", "..", "sample-media");
const SAMPLE_BASE = `${BASE_URL}/sample-icons`;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, p, body, token, { retries = 4 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE_URL}${p}`, {
      method, headers, body: body != null ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < retries) {
      // Honor Retry-After if present, else exponential-ish backoff capped at 20s
      const ra = parseInt(res.headers.get("retry-after") || "", 10);
      const wait = Number.isFinite(ra) ? ra * 1000 : Math.min(20_000, 2000 * 2 ** attempt);
      console.log(`  ${method} ${p} → 429, sleeping ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(`${method} ${p} → ${res.status}: ${data.error || JSON.stringify(data).slice(0, 200)}`);
    }
    return data;
  }
  throw new Error(`${method} ${p}: rate-limited after ${retries} retries`);
}
const POST = (p, body, token) => http("POST", p, body, token);

// Register and return the JWT directly — saves a separate /auth/login round-trip
// and stays under the strictRateLimiter (20 req / 5 min on /register and /auth/login).
async function registerAndLogin(payload) {
  try {
    const r = await POST("/register", payload);
    return r.token ?? null;
  } catch (err) {
    if (!/already|exist|409|duplicate/i.test(err.message)) throw err;
    // User already exists — fall back to login (rare path; idempotent reseed).
    const r = await POST("/auth/login", { username: payload.username, password: PASSWORD });
    return r.token ?? null;
  }
}
const activity = (token, act) => POST("/outbox", act, token);

// ── Sample image pool ────────────────────────────────────────────────────────

if (!fs.existsSync(SAMPLE_DIR)) {
  console.error(`sample-media folder not found at ${SAMPLE_DIR}`);
  process.exit(1);
}
const sampleFiles = fs.readdirSync(SAMPLE_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
if (sampleFiles.length === 0) {
  console.error("No sample images found.");
  process.exit(1);
}
const pickImage   = () => `${SAMPLE_BASE}/${sampleFiles[Math.floor(Math.random() * sampleFiles.length)]}`;
const pickN       = (arr, n) => Array.from({ length: n }, () => arr[Math.floor(Math.random() * arr.length)]);
const pickOne     = (arr)    => arr[Math.floor(Math.random() * arr.length)];
const choice      = (...arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ── Content corpus ───────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Mira", "Theo", "Lena", "Kazuo", "Imani", "Soren", "Priya", "Felix", "Naima", "Caleb",
  "Yuki", "Aditi", "Lior", "Ines", "Hugo", "Saoirse", "Diego", "Anya", "Tomás", "Esme",
  "Rashid", "Junie", "Nico", "Wren", "Idris",
];
const LAST_NAMES = [
  "Park", "Okafor", "Vasquez", "Tanaka", "Ngata", "Hall", "Bauer", "Romano", "Winters", "Sólo",
  "Doyle", "Iyer", "Klein", "Mendes", "Atherton", "Quinn", "Reyes", "Volkov", "Aristov", "Lin",
  "Sato", "Brand", "Hassan", "Mira", "Cole",
];

const BIOS = [
  "Building tools that disappear when you don't need them.",
  "Slow web. Long form. Real coffee.",
  "Field recordings, bookbinding, and very small gardens.",
  "Probably reading. Probably wrong. Always curious.",
  "Print designer transitioning into the post-screen era.",
  "I make playlists for nobody and books for everybody.",
  "Working on something that won't be done for a while.",
  "Letterforms, cities, and the spaces between sentences.",
  null, null, null, // some users have no bio
];

const NOTES = [
  "Coffee at the corner spot is back to being good. They fired the new manager.",
  "I keep wanting to write a long essay about commuter trains but I think it's actually just a vibe.",
  "Just heard a song from 2007 in a grocery store and now I'm someone else for an hour.",
  "Ran into someone I went to high school with and we both pretended not to know each other. Civilized.",
  "Remembered the password. The password was 'password'. I am not safe.",
  "The library by my house has a section called 'Maritime Adventures' and I refuse to go anywhere else.",
  "Made soup. The soup is fine.",
  "If you put rosemary on toast it tastes expensive.",
  "Have decided that 11pm is the new 3pm.",
  "Watching a thunderstorm. 10/10.",
  "Lost my keys exactly seven minutes before I needed to leave. Found them inside the fridge. Don't ask.",
  "The bookstore down the street has a cat named Walter and he is the entire point.",
  "Today I learned that you can sharpen scissors by cutting through aluminum foil. The internet remains useful.",
  "Brain feels like a tab I've left open for three days.",
  "Note to self: do not fall asleep on the train if you are trying to get to a specific place.",
];

const ARTICLE_SAMPLES = [
  {
    title: "On Long Walks and Short Pages",
    body: `There's a particular kind of writing that only happens after you've walked for an hour without a phone.\n\nIt's not better writing, exactly. It's just writing that knows what it wants to say. The hour is the editor.\n\nI've been trying to do this twice a week — leave the apartment with a small notebook, walk until the next sentence appears, write it down on a bench. The benches in this neighborhood are bad. The sentences are mostly fine.\n\nSome of them I keep. Most of them I don't. The ones I keep tend to be observations rather than arguments — arguments are what I do when I'm sitting still and trying to be clever.\n\nThe walks are not for the writing. The writing is just what falls out.`,
  },
  {
    title: "Why I Stopped Reading Reviews",
    body: `For about two years I read reviews before I watched anything. The result was that I knew the shape of every film before I saw it, and I never got to be surprised — I was always just confirming or correcting whatever the review had told me to expect.\n\nI think this happens a lot. The thing that gets in the way of taste is reading other people's taste first.\n\nI don't read reviews now. I sometimes hear a friend say "this was good" and that's enough. I miss things, sure. But the things I do see, I see for the first time, which it turns out is the only way I actually remember them.`,
  },
  {
    title: "A Field Guide to the Living Room",
    body: `The couch is the most important piece of furniture in the house and most people pick it last. By the time you're shopping for a couch, you've already spent your money on a TV and a coffee table that you'll regret. The couch is what's left over.\n\nA good couch is a piece of architecture. It's where you do most of your sitting, your napping, your reading, your watching, your bickering, your sulking. If you spent a tenth of the time on the couch that you spend at your desk you'd already be ahead.\n\nMine is too soft. I knew it was too soft when I bought it and I bought it anyway. This is the kind of mistake you make once.`,
  },
  {
    title: "The Smallest Useful Garden",
    body: `Three pots. That's the smallest useful garden.\n\nOne for something you eat — a tomato plant, or basil, or a single defiant chili. One for something that smells good when you brush past it — rosemary works, mint if you're brave, lavender if your light is good. One for something purely decorative, because gardens are also for looking at, and looking at things you don't need is the entire trick.\n\nFour pots is a hobby. Two pots is an apology. Three pots is exactly enough.`,
  },
  {
    title: "Notes Toward a Less Loud Internet",
    body: `I've been thinking about the difference between writing in public and broadcasting in public, and I think it comes down to whether you assume the reader is the same person twice.\n\nBroadcasting assumes a feed — a stream of strangers, each glancing for a second. The grammar is the headline. Everything has to land in one read.\n\nWriting assumes a reader who came back. They saw the last thing. They'll see the next one. You can build something across pieces. You don't have to introduce yourself every time.\n\nMost of what's online is broadcasting. Most of what I want to read is writing. I think the answer isn't to leave — it's to write like the reader is the same person twice, and trust that some of them will be.`,
  },
  {
    title: "The Map Is the Wrong Size",
    body: `I bought a paper map of my city last year. I knew the city. I'd lived there for nine years. I bought the map because I wanted to see it.\n\nWhat I learned is that the city is much smaller than I thought. The route I take to get groceries is about an inch and a half. The walk to my favorite bar is barely a thumb. The radius of my actual life — places I've been in the last month — fit inside a square the size of a Post-it.\n\nPhones make cities feel bigger. The map made mine feel honest.`,
  },
];

const MEDIA_CAPTIONS = [
  "Morning at the corner. Same coffee, different light.",
  "Three from this weekend.",
  "Studio cleanup, finally got to the back wall.",
  "Found these at the flea market. The whole roll for $2.",
  "Walked twenty miles for one of these. Worth it.",
  "Sketches before I forget.",
  "End of the long shoot. Last frames before sunset.",
  "Some test prints from the new paper.",
  "Bookstore window, Tuesday.",
  "Trying out the new lens. Verdict: bokeh too aggressive, will sell.",
];

const EVENT_TITLES = [
  { title: "Open Studio Night",                 location: "The Print Shop, 18th & Mason" },
  { title: "Reading Group: Le Guin",            location: "Glass Window Books" },
  { title: "Saturday Long Walk",                location: "North Park Gate" },
  { title: "Letterpress Workshop",              location: "Inkpress Co-op" },
  { title: "Field Recording Listening Party",   location: "The Annex Bar (back room)" },
  { title: "Zine Swap",                         location: "Common Ground Café" },
  { title: "Talk: Cities Without Cars",         location: "Halsey Library, Room 2" },
  { title: "Beach Cleanup + Coffee",            location: "Marker 4, Sunset Ave" },
  { title: "Late-Night Writing Hours",          location: "Slow Club, members only" },
  { title: "Pop-up Repair Café",                location: "St. Anne's Hall" },
];

const EVENT_DESCRIPTIONS = [
  "Doors at 7. Bring a friend or don't. There will be coffee, snacks, and a record on by the door.",
  "We meet, we talk for an hour, we leave. No homework. New folks always welcome.",
  "Easy pace, ~5 miles, ends near a bakery. Bring water and a stupid hat.",
  "Hands-on, you leave with prints. Materials provided. RSVP closes 48hr before.",
  "Come listen to forty-five minutes of cassette tapes recorded in places you've been near.",
  "Bring 5-10 zines, take 5-10 zines. No money changes hands. Coffee available.",
  "Q&A after. Free, but seating's tight — get there early.",
  "Three hours of cleanup, one hour of coffee. Gloves and bags provided.",
  "Quiet hours, 9pm-12am. Bring a project you're stuck on. Snacks shared.",
  "Bring something broken — clothing, electronics, ceramics. We'll try to fix it.",
];

// Hand-curated link posts with stable URLs, real metadata, and a sample image.
const LINKS = [
  { href: "https://en.wikipedia.org/wiki/Kowloon_Walled_City", title: "Kowloon Walled City — Wikipedia",
    summary: "An ungoverned and densely-populated de jure Chinese enclave within British Hong Kong. By 1990 it had a population of 50,000 in 0.026 km²." },
  { href: "https://en.wikipedia.org/wiki/Stewart_Brand", title: "Stewart Brand — Wikipedia",
    summary: "American writer, best known as editor of the Whole Earth Catalog and co-founder of The WELL, the Long Now Foundation, and the Global Business Network." },
  { href: "https://longnow.org/", title: "The Long Now Foundation",
    summary: "Long Now fosters long-term thinking through projects like the 10,000-Year Clock, the Rosetta Project, and Long Now Talks." },
  { href: "https://archive.org/", title: "Internet Archive",
    summary: "A non-profit library of millions of free books, movies, software, music, websites, and more." },
  { href: "https://www.gutenberg.org/", title: "Project Gutenberg",
    summary: "Free eBooks. Project Gutenberg offers over 70,000 free eBooks. Choose among free epub and Kindle eBooks, download them or read them online." },
  { href: "https://en.wikipedia.org/wiki/Blue_Note_Records", title: "Blue Note Records — Wikipedia",
    summary: "An American jazz record label, established in 1939 by Alfred Lion. Iconic for its hard-bop catalog and Reid Miles's cover designs." },
  { href: "https://www.metmuseum.org/art/collection/search/436532", title: "Vermeer — Young Woman with a Water Pitcher (The Met)",
    summary: "Johannes Vermeer, ca. 1662. Oil on canvas. Robert Lehman Collection, Metropolitan Museum of Art." },
  { href: "https://en.wikipedia.org/wiki/Mid-century_modern", title: "Mid-Century Modern — Wikipedia",
    summary: "A movement in interior, product, and graphic design that generally describes mid-20th-century developments in modern design, architecture, and urban development." },
  { href: "https://standardebooks.org/", title: "Standard Ebooks",
    summary: "Liberated, beautifully-formatted public domain ebooks. Carefully produced from sources at Project Gutenberg and elsewhere, completely free." },
  { href: "https://en.wikipedia.org/wiki/Le_Corbusier", title: "Le Corbusier — Wikipedia",
    summary: "Charles-Édouard Jeanneret. Swiss-French architect, designer, painter, urban planner, writer. A pioneer of what is now called modern architecture." },
  { href: "https://en.wikipedia.org/wiki/Saul_Bass", title: "Saul Bass — Wikipedia",
    summary: "American graphic designer and filmmaker, best known for his title sequences for Hitchcock, Preminger, and Scorsese, and for his iconic corporate logos." },
  { href: "https://en.wikipedia.org/wiki/ActivityPub", title: "ActivityPub — Wikipedia",
    summary: "A protocol and open standard for decentralized social networking. Provides client-to-server and server-to-server APIs based on ActivityStreams 2.0." },
];

// ── Per-type post builders ──────────────────────────────────────────────────

function makeNote(content) {
  return {
    type: "Note",
    source: { content, mediaType: "text/markdown" },
    tags: pickN(["life", "tea", "weather", "books", "music", "thought"], randomInt(0, 2)),
  };
}

function makeArticle(article) {
  return {
    type: "Article",
    title: article.title,
    source: { content: article.body, mediaType: "text/markdown" },
    summary: article.body.split("\n\n")[0].slice(0, 240),
    image: Math.random() < 0.7 ? pickImage() : undefined, // ~70% have a featured image
    tags: pickN(["essay", "design", "city", "writing", "long-form"], randomInt(1, 3)),
  };
}

function makeMedia(caption) {
  // Embed 1-3 images via markdown so they render inline in the post body.
  const imgs = Array.from({ length: randomInt(1, 3) }, pickImage);
  const body = `${caption}\n\n${imgs.map((u) => `![](${u})`).join("\n\n")}`;
  return {
    type: "Media",
    source: { content: body, mediaType: "text/markdown" },
    image: imgs[0], // first image is also the featured/preview
    tags: pickN(["photo", "studio", "sketch", "darkroom", "film"], randomInt(0, 2)),
  };
}

function makeLink(link) {
  return {
    type: "Link",
    title: link.title,
    href:  link.href,
    target: link.href,
    summary: link.summary,
    image: pickImage(), // stand-in OG image from the sample pool
    source: { content: `> ${link.summary}\n\n— [${link.title}](${link.href})`, mediaType: "text/markdown" },
    tags: pickN(["link", "reading", "share"], randomInt(0, 2)),
  };
}

function makeEvent(evt, description) {
  // Random start within the next 1-90 days, 1-3hr duration.
  const startMs = Date.now() + randomInt(1, 90) * 24 * 3600_000 + randomInt(17, 21) * 3600_000;
  const start = new Date(startMs);
  const end   = new Date(startMs + randomInt(1, 3) * 3600_000);
  return {
    type: "Event",
    title: evt.title,
    source: { content: description, mediaType: "text/markdown" },
    summary: description.slice(0, 240),
    image: pickImage(),
    location: evt.location, // server normalizes string → GeoPoint with name
    startTime: start.toISOString(),
    endTime:   end.toISOString(),
    tags: pickN(["event", "meet", "workshop", "irl"], randomInt(1, 3)),
  };
}

const TYPE_POOL  = ["Note", "Note", "Note", "Article", "Article", "Media", "Media", "Link", "Link", "Event"];
const VIS_POOL   = [
  { to: "@public",      label: "public" },
  { to: "@public",      label: "public" },
  { to: "@public",      label: "public" },
  { to: `@${DOMAIN}`,   label: "server" },
];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`→ Seeding ${USER_COUNT} users + ${POST_COUNT} posts at ${BASE_URL}`);
  console.log(`  Sample image pool: ${sampleFiles.length} files`);

  // Fetch current server rules so registrations can auto-acknowledge them.
  // The /register handler rejects with 400 if any rule id isn't acknowledged.
  let ruleIds = [];
  try {
    const info = await fetch(`${BASE_URL}/`).then((r) => r.json());
    const rules = Array.isArray(info?.settings?.rules) ? info.settings.rules : [];
    ruleIds = rules.map((r) => r.id).filter(Boolean);
    if (ruleIds.length) console.log(`  Auto-acknowledging ${ruleIds.length} server rule(s)`);
  } catch (err) {
    console.warn(`  Could not fetch server rules: ${err.message}`);
  }

  // 1. Register users (with random profile.icon and bio)
  const users = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last  = LAST_NAMES[i % LAST_NAMES.length];
    const username = `${first.toLowerCase()}${last.toLowerCase().replace(/[^a-z]/g, "")}`.slice(0, 20);
    const display  = `${first} ${last}`;
    const bio      = pickOne(BIOS);
    const icon     = pickImage();

    try {
      const token = await registerAndLogin({
        username,
        email: `${username}@example.com`,
        password: PASSWORD,
        profile: { name: display, description: bio, icon },
        to: "@public",
        acknowledgedRules: ruleIds,
      });
      if (token) users.push({ username, display, token });
      else       console.warn(`  skip ${username}: no token returned`);
    } catch (err) {
      console.warn(`  skip ${username}: ${err.message.slice(0, 140)}`);
    }
  }
  console.log(`  Registered/logged in: ${users.length} users`);

  if (users.length === 0) {
    console.error("No users available — aborting.");
    process.exit(1);
  }

  // 2. Create POST_COUNT posts, distributed roughly evenly across users + types.
  let created = 0;
  let typeStats = { Note: 0, Article: 0, Media: 0, Link: 0, Event: 0 };

  for (let i = 0; i < POST_COUNT; i++) {
    const user = users[i % users.length];
    const type = pickOne(TYPE_POOL);
    const vis  = pickOne(VIS_POOL);

    let object;
    switch (type) {
      case "Article": object = makeArticle(pickOne(ARTICLE_SAMPLES));                                 break;
      case "Media":   object = makeMedia(pickOne(MEDIA_CAPTIONS));                                    break;
      case "Link":    object = makeLink(pickOne(LINKS));                                              break;
      case "Event":   object = makeEvent(pickOne(EVENT_TITLES), pickOne(EVENT_DESCRIPTIONS));         break;
      case "Note":
      default:        object = makeNote(pickOne(NOTES));                                              break;
    }

    try {
      await activity(user.token, {
        type: "Create", objectType: "Post",
        to: vis.to, canReply: "@public", canReact: "@public",
        object,
      });
      typeStats[type]++;
      created++;
    } catch (err) {
      console.warn(`  post ${i} (${type}, ${user.username}): ${err.message.slice(0, 120)}`);
    }
  }

  console.log(`\n✓ Created ${created}/${POST_COUNT} posts`);
  console.table(typeStats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
