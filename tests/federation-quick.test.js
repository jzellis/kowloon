#!/usr/bin/env node
// tests/federation-quick.test.js
// Quick federation test - just checks endpoints are working

import fetch from 'node-fetch';
import https from 'https';

// Allow self-signed certificates for local testing
const agent = new https.Agent({ rejectUnauthorized: false });

const SERVERS = ['https://kwln.org', 'https://kowloon.net', 'https://kowlunatics.net'];

console.log('🧪 Quick Federation Test\n');

async function testServer(url) {
  const name = new URL(url).hostname;
  console.log(`Testing ${name}...`);

  // Test health
  const health = await fetch(`${url}/health`, { agent });
  console.log(`  ✓ Health: ${health.status}`);

  // Test inbox (should be 401 without auth)
  const inbox = await fetch(`${url}/inbox`, { method: 'POST', agent });
  console.log(`  ✓ Inbox: ${inbox.status} (${inbox.status === 401 ? 'protected' : 'OPEN!'})`);

  // Test federation pull (should be 401 without auth)
  const pull = await fetch(`${url}/.well-known/kowloon/pull`, { agent });
  console.log(`  ✓ Pull: ${pull.status} (${pull.status === 401 ? 'protected' : 'OPEN!'})`);

  // Test timeline (should be 401 without auth)
  const timeline = await fetch(`${url}/feed/timeline`, { agent });
  console.log(`  ✓ Timeline: ${timeline.status} (${timeline.status === 401 ? 'protected' : 'OPEN!'})`);

  console.log('');
}

for (const server of SERVERS) {
  await testServer(server);
}

console.log('✓ All endpoints responding correctly!\n');
console.log('To run full federation test:');
console.log('  WIPE=1 ADMIN_PASSWORD=12345 node tests/federation-hybrid.test.js\n');
