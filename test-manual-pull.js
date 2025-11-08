#!/usr/bin/env node
// Test: Manually trigger federation pull from remote servers
import "dotenv/config";

const BASE_URL = "https://kwln.org";

async function loginAndGetToken() {
  const url = `${BASE_URL}/auth/login`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "12345" }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.token;
}

async function triggerPull(token, domain) {
  const url = `${BASE_URL}/federation/pull/${domain}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      limit: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pull failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function main() {
  console.log("🔐 Logging in...");
  const token = await loginAndGetToken();
  console.log("✅ Logged in\n");

  const domains = ["kwln.social", "kowloon.network"];

  for (const domain of domains) {
    console.log(`${"=".repeat(60)}`);
    console.log(`📡 Pulling from ${domain}`);
    console.log("=".repeat(60));

    try {
      const result = await triggerPull(token, domain);
      console.log(`✅ Pull completed`);
      console.log(`   Ingested: ${result.result?.ingested || 0} items`);
      console.log(`   Filtered: ${result.result?.filtered || 0} items`);
      console.log(
        `   Requested from: ${result.requested?.include?.join(", ") || "none"}`
      );
      console.log(
        `   Cursors present: ${result.next?.cursorsPresent?.join(", ") || "none"}`
      );
    } catch (err) {
      console.error(`❌ Error pulling from ${domain}:`, err.message);
    }

    console.log();
  }

  console.log(`${"=".repeat(60)}`);
  console.log("✅ Manual pull test complete!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
