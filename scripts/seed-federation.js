// scripts/seed-federation.js
// Sets up cross-server federation test data between two Kowloon instances.
//
// Run AFTER both servers have been seeded with seed-test.js.
// Assumes alice/bob/carol/dave exist on both servers with password "testpass".
//
// What this sets up:
//   - kwln1 users follow kwln2 users (adds to their Following circle on kwln1)
//   - kwln2's alice creates a "Federation Test Circle" and adds alice@kwln1 to it
//   - kwln2's alice creates: 1 public post, 1 circle-addressed post (to alice@kwln1)
//   - kwln2's bob creates: 1 public post
//   - kwln1's carol adds "@kwln2.local" (bare server) to her Following circle
//     (for testing server-level batch pulls)
//
// Usage:
//   KWLN1_URL=http://kwln1.local:8080 KWLN2_URL=http://kwln2.local:8080 \
//     node scripts/seed-federation.js

const KWLN1_URL = process.env.KWLN1_URL || "http://kwln1.local:8080";
const KWLN2_URL = process.env.KWLN2_URL || "http://kwln2.local:8080";
const PASSWORD = "testpass";

// Derive domains from URLs
const KWLN1_DOMAIN = new URL(KWLN1_URL).hostname;
const KWLN2_DOMAIN = new URL(KWLN2_URL).hostname;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function request(baseUrl, method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(
      `${method} ${baseUrl}${path} → ${res.status}: ${data.error || JSON.stringify(data)}`
    );
  }
  return data;
}

const api = (baseUrl) => ({
  post: (path, body, token) => request(baseUrl, "POST", path, body, token),
  get:  (path, token)       => request(baseUrl, "GET",  path, null, token),
});

async function login(baseUrl, username) {
  const r = await request(baseUrl, "POST", "/auth", { username, password: PASSWORD });
  return { token: r.token, user: r.user };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`kwln1: ${KWLN1_URL} (${KWLN1_DOMAIN})`);
  console.log(`kwln2: ${KWLN2_URL} (${KWLN2_DOMAIN})`);
  console.log();

  const k1 = api(KWLN1_URL);
  const k2 = api(KWLN2_URL);

  // ── Step 0: Wipe + seed both servers ──────────────────────────────────────

  console.log("→ Wiping and re-seeding both servers...");
  await Promise.all([
    request(KWLN1_URL, "POST", "/__test/wipe", {}),
    request(KWLN2_URL, "POST", "/__test/wipe", {}),
  ]);
  console.log("  Wiped both servers.");

  const { execSync } = await import("child_process");
  const seedScript = new URL("./seed-test.js", import.meta.url).pathname;

  console.log("  Seeding kwln1...");
  execSync(`TEST_BASE_URL=${KWLN1_URL} DOMAIN=${KWLN1_DOMAIN} node ${seedScript}`, {
    stdio: "inherit",
    env: { ...process.env, TEST_BASE_URL: KWLN1_URL, DOMAIN: KWLN1_DOMAIN },
  });

  console.log("  Seeding kwln2...");
  execSync(`TEST_BASE_URL=${KWLN2_URL} DOMAIN=${KWLN2_DOMAIN} node ${seedScript}`, {
    stdio: "inherit",
    env: { ...process.env, TEST_BASE_URL: KWLN2_URL, DOMAIN: KWLN2_DOMAIN },
  });

  console.log("  Both servers seeded.\n");

  // ── Step 1: Login to both servers ─────────────────────────────────────────

  console.log("→ Logging in to both servers...");

  const [k1Alice, k1Bob, k1Carol, k1Dave] = await Promise.all([
    login(KWLN1_URL, "alice"),
    login(KWLN1_URL, "bob"),
    login(KWLN1_URL, "carol"),
    login(KWLN1_URL, "dave"),
  ]);

  const [k2Alice, k2Bob] = await Promise.all([
    login(KWLN2_URL, "alice"),
    login(KWLN2_URL, "bob"),
  ]);

  // Shorthand: T1.alice = kwln1 alice token, T2.alice = kwln2 alice token
  const T1 = { alice: k1Alice.token, bob: k1Bob.token, carol: k1Carol.token, dave: k1Dave.token };
  const T2 = { alice: k2Alice.token, bob: k2Bob.token };

  const U1 = { alice: k1Alice.user, bob: k1Bob.user, carol: k1Carol.user, dave: k1Dave.user };
  const U2 = { alice: k2Alice.user, bob: k2Bob.user };

  console.log(`  kwln1 — alice: ${U1.alice.id}, bob: ${U1.bob.id}, carol: ${U1.carol.id}, dave: ${U1.dave.id}`);
  console.log(`  kwln2 — alice: ${U2.alice.id}, bob: ${U2.bob.id}`);

  // ── Step 2: kwln1 users follow kwln2 users ────────────────────────────────
  // Follow adds the followed user to the follower's system Following circle.
  // kwln1's alice and carol follow kwln2's alice.
  // kwln1's bob follows kwln2's bob.

  console.log("\n→ kwln1 users following kwln2 users...");

  const k2AliceId = `@alice@${KWLN2_DOMAIN}`;
  const k2BobId   = `@bob@${KWLN2_DOMAIN}`;

  await Promise.all([
    k1.post("/outbox", { type: "Follow", object: k2AliceId }, T1.alice),
    k1.post("/outbox", { type: "Follow", object: k2AliceId }, T1.carol),
    k1.post("/outbox", { type: "Follow", object: k2BobId },   T1.bob),
  ]);

  console.log(`  alice@${KWLN1_DOMAIN} → following alice@${KWLN2_DOMAIN}`);
  console.log(`  carol@${KWLN1_DOMAIN} → following alice@${KWLN2_DOMAIN}`);
  console.log(`  bob@${KWLN1_DOMAIN}   → following bob@${KWLN2_DOMAIN}`);

  // ── Step 3: kwln2's alice creates a circle with kwln1 users ───────────────
  // This is the circle she'll address private-ish posts to.
  // kwln2 uses this to determine recipients for circle-addressed content.

  console.log("\n→ kwln2/alice creating Federation Test Circle with kwln1 users...");

  const circleRes = await k2.post("/outbox", {
    type: "Create",
    objectType: "Circle",
    to: "@public",
    object: {
      type: "Circle",
      name: "Federation Test Circle",
      to: "@public",
    },
  }, T2.alice);

  const fedCircle = circleRes.result;
  console.log(`  Created circle: ${fedCircle.id}`);

  const k1AliceId = `@alice@${KWLN1_DOMAIN}`;
  const k1CarolId = `@carol@${KWLN1_DOMAIN}`;

  // Add alice@kwln1 and carol@kwln1 to kwln2/alice's federation test circle
  await Promise.all([
    k2.post("/outbox", { type: "Add", object: k1AliceId, target: fedCircle.id }, T2.alice),
    k2.post("/outbox", { type: "Add", object: k1CarolId, target: fedCircle.id }, T2.alice),
  ]);

  console.log(`  Added alice@${KWLN1_DOMAIN} and carol@${KWLN1_DOMAIN} to circle.`);

  // ── Step 4: kwln2 creates federation test posts ───────────────────────────

  console.log("\n→ Creating federation test posts on kwln2...");

  // alice@kwln2: public post
  const k2AlicePublicPost = await k2.post("/outbox", {
    type: "Create",
    objectType: "Post",
    to: "@public",
    canReply: "@public",
    canReact: "@public",
    object: {
      type: "Note",
      content: `[FEDERATION TEST] Public post by alice@${KWLN2_DOMAIN}. Should reach all kwln1 followers.`,
      tags: ["federation", "public"],
    },
  }, T2.alice);

  console.log(`  alice@${KWLN2_DOMAIN} public post: ${k2AlicePublicPost.result.id}`);

  // alice@kwln2: circle-addressed post (to the Federation Test Circle)
  const k2AliceCirclePost = await k2.post("/outbox", {
    type: "Create",
    objectType: "Post",
    to: fedCircle.id,
    canReply: fedCircle.id,
    canReact: fedCircle.id,
    object: {
      type: "Note",
      content: `[FEDERATION TEST] Circle post by alice@${KWLN2_DOMAIN}. Should reach alice@${KWLN1_DOMAIN} and carol@${KWLN1_DOMAIN} only.`,
      tags: ["federation", "circle"],
    },
  }, T2.alice);

  console.log(`  alice@${KWLN2_DOMAIN} circle post: ${k2AliceCirclePost.result.id}`);

  // bob@kwln2: public post
  const k2BobPublicPost = await k2.post("/outbox", {
    type: "Create",
    objectType: "Post",
    to: "@public",
    canReply: "@public",
    canReact: "@public",
    object: {
      type: "Note",
      content: `[FEDERATION TEST] Public post by bob@${KWLN2_DOMAIN}. Should reach bob@${KWLN1_DOMAIN}.`,
      tags: ["federation", "public"],
    },
  }, T2.bob);

  console.log(`  bob@${KWLN2_DOMAIN} public post: ${k2BobPublicPost.result.id}`);

  // ── Step 5: kwln1/carol adds bare server entry to her Following circle ────
  // This tests the server-level from entry (@kwln2.local) in the batch-pull.

  console.log(`\n→ carol@${KWLN1_DOMAIN} adding @${KWLN2_DOMAIN} (server) to Following circle...`);

  await k1.post("/outbox", {
    type: "Add",
    object: `@${KWLN2_DOMAIN}`,
    target: U1.carol.following,
  }, T1.carol);

  console.log(`  Added @${KWLN2_DOMAIN} to carol's Following circle (${U1.carol.following}).`);

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("\n=== Federation Seed Complete ===\n");

  console.log("Test the batch-pull outbox endpoint manually:\n");

  console.log("# Pull alice@kwln2 posts for alice@kwln1 + carol@kwln1:");
  console.log(`curl -s "${KWLN2_URL}/outbox?from=${encodeURIComponent(k2AliceId)}&to=${encodeURIComponent(k1AliceId)}&to=${encodeURIComponent(k1CarolId)}" | jq '{totalItems, itemCount: (.items|length), recipients}'`);

  console.log("\n# Pull bob@kwln2 posts for bob@kwln1:");
  const k1BobId = `@bob@${KWLN1_DOMAIN}`;
  console.log(`curl -s "${KWLN2_URL}/outbox?from=${encodeURIComponent(k2BobId)}&to=${encodeURIComponent(k1BobId)}" | jq '{totalItems, itemCount: (.items|length), recipients}'`);

  console.log("\n# Pull all kwln2 public posts for carol@kwln1 (server-level from):");
  console.log(`curl -s "${KWLN2_URL}/outbox?from=${encodeURIComponent(`@${KWLN2_DOMAIN}`)}&to=${encodeURIComponent(k1CarolId)}" | jq '{totalItems, itemCount: (.items|length), recipients}'`);

  console.log("\nExpected results:");
  console.log(`  alice pull: 2 items (1 public + 1 circle), recipients show alice+carol for public, alice+carol for circle`);
  console.log(`  bob pull:   1 item (public), recipients show bob@${KWLN1_DOMAIN}`);
  console.log(`  server pull: all kwln2 public posts, recipients all = [carol@${KWLN1_DOMAIN}]`);
}

main().catch((err) => {
  console.error("\nFederation seed failed:", err.message);
  process.exit(1);
});
