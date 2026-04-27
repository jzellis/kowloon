// Federation test suite orchestrator.
//
// Usage:
//   node scripts/fed-test/index.js                  # wipe all servers, run all phases
//   node scripts/fed-test/index.js --no-wipe        # skip wipe, run all phases
//   node scripts/fed-test/index.js --checkpoint     # run phases 1+2, then snapshot DBs
//   node scripts/fed-test/index.js --restore        # restore latest snapshot, run phases 3+4
//   node scripts/fed-test/index.js --restore <name> # restore named snapshot
//   node scripts/fed-test/index.js --phase 2        # run only phase 2 (requires state.json)
//   node scripts/fed-test/index.js --from-phase 3   # run phases 3+ from existing state
//
// Flags:
//   --no-wipe           Don't wipe servers before starting
//   --checkpoint        After phase 2 completes, snapshot MongoDB + MinIO + state.json
//   --restore [name]    Restore from snapshot and skip to phase 3
//   --phase <n>         Run only phase N
//   --from-phase <n>    Start from phase N
//   --timeout <ms>      Federation delivery timeout (default: 15000)
//   --concurrency <n>   Parallel request limit (default: 20)

import { parseArgs } from 'util';
import { SERVERS, CONCURRENCY, FEDERATION_TIMEOUT_MS } from './config.js';
import { initState, loadState, state, saveState } from './state.js';
import { initClients, reAuthAll } from './client.js';
import { checkpoint, restore } from './db.js';
import { runPhase1 } from './phases/01-users.js';
import { runPhase2 } from './phases/02-local.js';
import { runPhase3 } from './phases/03-cross.js';
import { runPhase4 } from './phases/04-verify.js';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'no-wipe':     { type: 'boolean', default: false },
    checkpoint:    { type: 'boolean', default: false },
    restore:       { type: 'boolean', default: false },
    phase:         { type: 'string' },
    'from-phase':  { type: 'string' },
    timeout:       { type: 'string' },
    concurrency:   { type: 'string' },
  },
});

const snapshotName = positionals[0] || 'latest';
const timeout = parseInt(args.timeout || String(FEDERATION_TIMEOUT_MS));
const concurrency = parseInt(args.concurrency || String(CONCURRENCY));
const onlyPhase = args.phase ? parseInt(args.phase) : null;
const fromPhase = parseInt(args['from-phase'] || '1');

const should = (n) => (onlyPhase === null || onlyPhase === n) && n >= fromPhase;

async function wipeServers() {
  console.log('Wiping all servers...');
  await Promise.all(SERVERS.map(async (server) => {
    const res = await fetch(`${server.baseUrl}/__test/wipe`, { method: 'POST' });
    if (!res.ok) throw new Error(`Wipe failed on ${server.name}: ${res.status}`);
    console.log(`  [${server.name}] Wiped`);
  }));
}

async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('Kowloon federation test suite');
  console.log(`Servers: ${SERVERS.map(s => s.name).join(', ')}`);
  console.log('='.repeat(60));

  // ── Restore flow ───────────────────────────────────────────────────────────
  if (args.restore) {
    console.log(`\nRestoring from snapshot: ${snapshotName}`);
    const stateFile = await restore(snapshotName);
    loadState();
    initClients(SERVERS);
    await reAuthAll(state, { concurrency });
    if (should(3)) await runPhase3(state, { timeout, concurrency });
    if (should(4)) await runPhase4(state);
    printElapsed(startTime);
    return;
  }

  // ── Normal flow ────────────────────────────────────────────────────────────
  initClients(SERVERS);

  // Wipe unless --no-wipe or starting from a later phase
  let stateLoaded = false;
  if (!args['no-wipe'] && !onlyPhase && fromPhase <= 1) {
    await wipeServers();
    initState();
  } else {
    stateLoaded = loadState();
    if (!stateLoaded && fromPhase > 1) {
      console.error('No state.json found — cannot start from phase > 1 without existing state');
      process.exit(1);
    }
    if (!stateLoaded) initState();
  }

  if (should(1)) {
    // Phase 1 registers users and populates the client registry
    await runPhase1(state, { concurrency });
  } else if (stateLoaded) {
    // Phase 1 skipped but we have existing users — re-login to populate client registry
    console.log('\nRe-authenticating all users...');
    await reAuthAll(state, { concurrency });
  }

  if (should(2)) await runPhase2(state, { concurrency });

  if (args.checkpoint && (!onlyPhase || onlyPhase === 2)) {
    await checkpoint();
  }

  if (should(3)) await runPhase3(state, { timeout, concurrency });
  if (should(4)) await runPhase4(state);

  printElapsed(startTime);
}

function printElapsed(start) {
  const s = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nTotal time: ${s}s`);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
