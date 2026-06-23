// methods/media/index.js
// Returns the configured media processor adapter.
// Reads mediaProcessor setting on each call so runtime config changes take effect.

import { getSetting } from '#methods/settings/cache.js'
import { LocalProcessor } from './processors/local.js'

export function getMediaProcessor() {
  const type = getSetting('mediaProcessor') ?? 'local'

  switch (type) {
    case 'local':
      return new LocalProcessor()

    // Stubs for post-alpha adapters — each will be a separate file in processors/
    // case 'remote':  return new RemoteProcessor()
    // case 'mux':     return new MuxProcessor()

    default:
      console.warn(`[media] Unknown processor "${type}", falling back to local`)
      return new LocalProcessor()
  }
}
