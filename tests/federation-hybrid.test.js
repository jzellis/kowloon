#!/usr/bin/env node
// tests/federation-hybrid.test.js
// Test hybrid federation (push + pull) between three isolated instances

import fetch from "node-fetch";
import https from "https";

// Allow self-signed certificates for local testing
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Configuration
const SERVERS = {
  kwln: "https://kwln.org",
  kowloon: "https://kowloon.net",
  kowlunatics: "https://kowlunatics.net",
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345";
const WIPE = process.env.WIPE === "1";

// Colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, msg) {
  log(`\n[${step}] ${msg}`, "cyan");
}

function logSuccess(msg) {
  log(`  ✓ ${msg}`, "green");
}

function logError(msg) {
  log(`  ✗ ${msg}`, "red");
}

function logInfo(msg) {
  log(`  • ${msg}`, "blue");
}

// Helper to make authenticated requests
async function request(server, path, options = {}) {
  const url = `${SERVERS[server]}${path}`;
  const headers = {
    "Content-Type": "application/activity+json",
    ...options.headers,
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    agent: httpsAgent,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

// Test 1: Setup - Create users on each server
async function test1_createUsers() {
  logStep(1, "Creating users on each server");

  const users = {};

  for (const [name, baseUrl] of Object.entries(SERVERS)) {
    if (WIPE) {
      logInfo(`Wiping database for ${name}...`);
      await request(name, "/__test/wipe", { method: "POST" });
    }

    logInfo(`Creating user alice@${name}...`);
    const { response, data } = await request(name, "/register", {
      method: "POST",
      body: JSON.stringify({
        username: "alice",
        password: ADMIN_PASSWORD,
        email: `alice@${name}.test`,
      }),
    });

    if (!response.ok) {
      logError(`Failed to create alice@${name}: ${JSON.stringify(data)}`);
      throw new Error(`Registration failed: ${response.status}`);
    }

    logSuccess(`Created alice@${name} (${data.user.id})`);
    users[name] = {
      id: data.user.id,
      username: "alice",
      token: data.token,
    };
  }

  return users;
}

// Test 2: Alice on kwln.org creates a public post
async function test2_createPost(users) {
  logStep(2, "Alice@kwln creates a public post");

  const { response, data } = await request("kwln", "/outbox", {
    method: "POST",
    token: users.kwln.token,
    body: JSON.stringify({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        content: "Hello from kwln.org! Testing federation.",
        to: "@public",
      },
    }),
  });

  if (!response.ok) {
    logError(`Failed to create post: ${JSON.stringify(data)}`);
    throw new Error(`Post creation failed: ${response.status}`);
  }

  logSuccess(`Created post: ${data.activity.objectId}`);
  return { postId: data.activity.objectId };
}

// Test 3: Alice on kowloon.net follows Alice on kwln.org
async function test3_follow(users) {
  logStep(3, "Alice@kowloon follows Alice@kwln");

  const { response, data } = await request("kowloon", "/outbox", {
    method: "POST",
    token: users.kowloon.token,
    body: JSON.stringify({
      type: "Follow",
      object: users.kwln.id,
    }),
  });

  if (!response.ok) {
    logError(`Failed to follow: ${JSON.stringify(data)}`);
    throw new Error(`Follow failed: ${response.status}`);
  }

  logSuccess(`Alice@kowloon is now following Alice@kwln`);
  return data;
}

// Test 4: Wait for federation pull worker to fetch the post
async function test4_waitForPull() {
  logStep(4, "Waiting for federation pull worker (60s poll interval)");

  logInfo("Sleeping 65 seconds for pull worker to run...");
  await new Promise((resolve) => setTimeout(resolve, 65000));

  logSuccess("Wait complete");
}

// Test 5: Check if post appears in Alice@kowloon's FeedItems (pulled)
async function test5_checkPulledPost(users, post) {
  logStep(5, "Checking if post was pulled to kowloon.net");

  const { response, data } = await request("kowloon", "/feed/timeline", {
    method: "GET",
    token: users.kowloon.token,
    headers: {
      Accept: "application/activity+json",
    },
  });

  if (!response.ok) {
    logError(`Failed to get timeline: ${JSON.stringify(data)}`);
    throw new Error(`Timeline fetch failed: ${response.status}`);
  }

  logInfo(`Timeline has ${data.totalItems} items`);

  const pulledPost = data.orderedItems?.find((item) => item.id === post.postId);
  if (pulledPost) {
    logSuccess(`Post found in timeline! (origin: ${pulledPost.origin})`);
    logInfo(`Content: "${pulledPost.object?.content}"`);
  } else {
    logError("Post NOT found in timeline (pull may have failed)");
    logInfo(
      "Available items: " + data.orderedItems?.map((i) => i.id).join(", ")
    );
  }

  return { found: !!pulledPost };
}

// Test 6: Alice@kowlunatics replies to the post (should PUSH to kwln.org)
async function test6_createReply(users, post) {
  logStep(6, "Alice@kowlunatics replies to the post (PUSH federation)");

  const { response, data } = await request("kowlunatics", "/outbox", {
    method: "POST",
    token: users.kowlunatics.token,
    body: JSON.stringify({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        content: "Nice post! Replying from kowlunatics.net",
        inReplyTo: post.postId,
      },
    }),
  });

  if (!response.ok) {
    logError(`Failed to create reply: ${JSON.stringify(data)}`);
    throw new Error(`Reply creation failed: ${response.status}`);
  }

  logSuccess(`Created reply: ${data.activity.objectId}`);
  logInfo("Outbox worker should push this to kwln.org inbox within 5 seconds");

  return { replyId: data.activity.objectId };
}

// Test 7: Wait for outbox worker to push the reply
async function test7_waitForPush() {
  logStep(7, "Waiting for outbox push worker (5s poll interval)");

  logInfo("Sleeping 10 seconds for push worker to deliver...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  logSuccess("Wait complete");
}

// Test 8: Check if reply appears on kwln.org (pushed)
async function test8_checkPushedReply(users, reply) {
  logStep(8, "Checking if reply was pushed to kwln.org");

  const { response, data } = await request("kwln", `/posts/${reply.replyId}`, {
    method: "GET",
    token: users.kwln.token,
  });

  if (response.ok) {
    logSuccess(`Reply found on kwln.org! (origin: ${data.origin})`);
    logInfo(`Content: "${data.content}"`);
    return { found: true };
  } else if (response.status === 404) {
    logError("Reply NOT found on kwln.org (push may have failed)");
    return { found: false };
  } else {
    logError(`Unexpected response: ${response.status} ${JSON.stringify(data)}`);
    return { found: false };
  }
}

// Test 9: Check outbox status for delivery tracking
async function test9_checkOutbox(users) {
  logStep(9, "Checking outbox delivery status");

  // Note: You'd need an endpoint to query outbox jobs
  // For now, we'll check MongoDB directly via the API if available

  logInfo("Would check Outbox collection for delivery status here");
  logInfo("Could add GET /outbox endpoint to query delivery status");
  logSuccess("Skipped (requires outbox query endpoint)");
}

// Test 10: Test /.well-known/kowloon/pull endpoint directly
async function test10_testPullEndpoint(users) {
  logStep(10, "Testing /.well-known/kowloon/pull endpoint");

  // This would require HTTP Signature authentication
  // For now, test that it returns 401 without auth
  const { response } = await request("kwln", "/.well-known/kowloon/pull", {
    method: "GET",
  });

  if (response.status === 401) {
    logSuccess("Pull endpoint requires authentication (correct)");
  } else {
    logError(`Expected 401, got ${response.status}`);
  }
}

// Test 11: Test POST /inbox endpoint directly
async function test11_testInboxEndpoint() {
  logStep(11, "Testing POST /inbox endpoint");

  // This would require HTTP Signature authentication
  // For now, test that it returns 401 without auth
  const { response } = await request("kwln", "/inbox", {
    method: "POST",
    body: JSON.stringify({
      type: "Create",
      object: { type: "Note", content: "Test" },
    }),
  });

  if (response.status === 401) {
    logSuccess("Inbox endpoint requires authentication (correct)");
  } else {
    logError(`Expected 401, got ${response.status}`);
  }
}

// Main test runner
async function runTests() {
  log("\n=== Hybrid Federation Test Suite ===\n", "yellow");
  log(`Testing federation between:`, "yellow");
  log(`  • kwln.org`, "yellow");
  log(`  • kowloon.net`, "yellow");
  log(`  • kowlunatics.net\n`, "yellow");

  try {
    const users = await test1_createUsers();
    const post = await test2_createPost(users);
    await test3_follow(users);
    await test4_waitForPull();
    const pullResult = await test5_checkPulledPost(users, post);
    const reply = await test6_createReply(users, post);
    await test7_waitForPush();
    const pushResult = await test8_checkPushedReply(users, reply);
    await test9_checkOutbox(users);
    await test10_testPullEndpoint(users);
    await test11_testInboxEndpoint();

    log("\n=== Test Results ===\n", "yellow");
    log(
      `Pull Federation: ${pullResult.found ? "✓ PASSED" : "✗ FAILED"}`,
      pullResult.found ? "green" : "red"
    );
    log(
      `Push Federation: ${pushResult.found ? "✓ PASSED" : "✗ FAILED"}`,
      pushResult.found ? "green" : "red"
    );

    if (pullResult.found && pushResult.found) {
      log("\n✓ All federation tests PASSED!", "green");
      process.exit(0);
    } else {
      log("\n✗ Some tests FAILED", "red");
      process.exit(1);
    }
  } catch (error) {
    logError(`\nTest suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
