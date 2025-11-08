#!/usr/bin/env node
// Test: Remote users follow @admin@kwln.org and create posts to their Following circle
import "dotenv/config";

const servers = [
  { domain: "kwln.social", username: "admin", password: "12345" },
  { domain: "kowloon.network", username: "admin", password: "12345" },
];

const TARGET_USER = "@admin@kwln.org";

async function loginAndGetToken(domain, username, password) {
  const url = `https://${domain}/auth/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return { token: data.token, user: data.user };
}

async function followUser(domain, token, targetUserId) {
  const url = `https://${domain}/outbox`;
  const activity = {
    type: "Follow",
    object: targetUserId,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Follow failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function createPost(domain, token, followingCircleId) {
  const url = `https://${domain}/outbox`;
  const activity = {
    type: "Create",
    objectType: "Post",
    object: {
      type: "Note",
      content: `Hello from ${domain}! This is a test post to my Following circle. The time is ${new Date().toISOString()}`,
      to: followingCircleId,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create post failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function test() {
  console.log(`🎯 Target user: ${TARGET_USER}\n`);

  for (const server of servers) {
    try {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📡 Server: ${server.domain}`);
      console.log("=".repeat(60));

      // Login
      console.log(`\n1️⃣  Logging in as ${server.username}...`);
      const { token, user } = await loginAndGetToken(
        server.domain,
        server.username,
        server.password
      );
      console.log(`   ✅ Logged in: ${user.id}`);
      console.log(`   Following circle: ${user.following}`);

      // Follow target user
      console.log(`\n2️⃣  Following ${TARGET_USER}...`);
      try {
        const followResult = await followUser(server.domain, token, TARGET_USER);
        console.log(`   ✅ Follow successful`);
      } catch (err) {
        if (err.message.includes("already")) {
          console.log(`   ⏭️  Already following`);
        } else {
          throw err;
        }
      }

      // Create post to Following circle
      console.log(`\n3️⃣  Creating post to Following circle...`);
      const postResult = await createPost(
        server.domain,
        token,
        user.following
      );
      console.log(`   ✅ Post created`);
      if (postResult.id) {
        console.log(`   Post ID: ${postResult.id}`);
      }
    } catch (err) {
      console.error(`   ❌ Error on ${server.domain}:`, err.message);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Test complete!");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("1. Run federation pull from kwln.org");
  console.log("2. Check if posts are visible in @admin@kwln.org's feed");
}

test().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
