// Phase 1: Register all users on all three servers (parallel across servers).
// Stores { id, username, token, profile, circles } per user in state.

import { SERVERS, SCALE, PASSWORD } from '../config.js';
import { addUser, saveState } from '../state.js';
import { registerUser, batch } from '../client.js';
import { generateUser } from '../fixtures/names.js';

export async function runPhase1(state, { concurrency } = {}) {
  console.log('\n=== Phase 1: Register users ===');

  await Promise.all(SERVERS.map((server, si) =>
    registerServerUsers(server, si, state, { concurrency })
  ));

  state.phase = Math.max(state.phase, 1);
  saveState();
  console.log('\nPhase 1 complete.');
}

async function registerServerUsers(server, serverIndex, state, { concurrency }) {
  const count = SCALE.usersPerServer;
  console.log(`\n[${server.name}] Registering ${count} users...`);

  const userDefs = Array.from({ length: count }, (_, i) =>
    generateUser(serverIndex + 1, i)
  );

  let registered = 0;
  await batch(userDefs, async (def) => {
    try {
      const { user, token } = await registerUser(server, {
        username: def.username,
        email: def.email,
        password: PASSWORD,
        profile: def.profile,
      });

      addUser(server.name, {
        id: user.id,
        username: def.username,
        password: PASSWORD,
        profile: def.profile,
        circles: {
          following: user.following || null,
          allFollowing: user.allFollowing || null,
          blocked: user.blocked || null,
          muted: user.muted || null,
          groups: null,
        },
        userCircles: [],
        bookmarkFolders: [],
      });

      registered++;
      if (registered % 20 === 0) {
        console.log(`  [${server.name}] ${registered}/${count} registered`);
        saveState();
      }
    } catch (e) {
      console.warn(`  [${server.name}] WARN: Failed to register ${def.username}: ${e.message}`);
    }
  }, { concurrency });

  saveState();
  console.log(`  [${server.name}] ${registered} users registered`);
}
