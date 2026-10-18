// methods/utils/redactUri.js
// Strips credentials out of a connection-string-shaped URI before logging it.
// mongodb://user:pass@host:port/db -> mongodb://host:port/db

export default function redactUri(uri) {
  if (typeof uri !== 'string') return uri
  return uri.replace(/\/\/[^@/]+@/, '//')
}
