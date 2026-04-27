// Per-user KowloonClient registry for the federation test suite.
// Each user gets their own KowloonClient instance (isolated auth state).
// Module-level registry persists across phase imports.

import KowloonClient from '../../../client/src/index.js';
import { PASSWORD } from './config.js';

// serverName -> Map(userId -> KowloonClient)
const registry = new Map();

// serverName -> KowloonClient (unauthenticated, for read-only verification)
const anonRegistry = new Map();

export function initClients(servers) {
  for (const server of servers) {
    registry.set(server.name, new Map());
    anonRegistry.set(server.name, new KowloonClient({ baseUrl: server.baseUrl, timeout: 30000 }));
  }
}

/** Register a new user, store their client, return { user, token, client } */
export async function registerUser(server, credentials) {
  const client = new KowloonClient({ baseUrl: server.baseUrl, timeout: 30000 });
  const result = await client.auth.register(credentials);
  registry.get(server.name).set(result.user.id, client);
  return { ...result, client };
}

/** Login an existing user (e.g. after --restore), store their client */
export async function loginUser(server, username) {
  const client = new KowloonClient({ baseUrl: server.baseUrl, timeout: 30000 });
  const result = await client.auth.login({ username, password: PASSWORD });
  registry.get(server.name).set(result.user.id, client);
  return { ...result, client };
}

/** Get the authenticated client for a specific user */
export function clientFor(serverName, userId) {
  const client = registry.get(serverName)?.get(userId);
  if (!client) throw new Error(`No client found for ${userId} on ${serverName}`);
  return client;
}

/** Unauthenticated client for a server (public reads, verification) */
export function anonClient(serverName) {
  return anonRegistry.get(serverName);
}

/** Re-authenticate all users from state (used after --restore) */
export async function reAuthAll(state, { concurrency = 20 } = {}) {
  for (const [serverName, serverState] of Object.entries(state.servers)) {
    const server = { name: serverName, baseUrl: serverState.baseUrl };
    const users = serverState.users;
    console.log(`  Re-authenticating ${users.length} users on ${serverName}...`);
    await batch(users, async (user) => {
      try {
        await loginUser(server, user.username);
      } catch (e) {
        console.warn(`    WARN: Could not re-auth ${user.username}@${serverName}: ${e.message}`);
      }
    }, { concurrency });
  }
}

/** Run fn over items with bounded concurrency */
export async function batch(items, fn, { concurrency = 20 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    for (const r of chunkResults) {
      if (r.status === 'rejected') {
        console.warn(`  batch error: ${r.reason?.message || r.reason}`);
        results.push(null);
      } else {
        results.push(r.value);
      }
    }
  }
  return results.filter(Boolean);
}
