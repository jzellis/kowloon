import { FEDERATION_TIMEOUT_MS, FEDERATION_POLL_MS } from './config.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Poll assertionFn until it returns truthy or timeout elapses.
 * Returns { ok, ms, result } — never throws.
 */
export async function waitFor(assertionFn, {
  timeout = FEDERATION_TIMEOUT_MS,
  interval = FEDERATION_POLL_MS,
  label = '',
} = {}) {
  const start = Date.now();
  const deadline = start + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const result = await assertionFn();
      if (result !== null && result !== undefined && result !== false) {
        return { ok: true, ms: Date.now() - start, result };
      }
    } catch (e) {
      lastError = e;
    }
    await sleep(interval);
  }

  return {
    ok: false,
    ms: timeout,
    error: lastError?.message || `timeout after ${timeout}ms`,
    label,
  };
}

export { sleep };
