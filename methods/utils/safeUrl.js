// Shared SSRF guard. Resolves a hostname to an IP and rejects anything in
// loopback / private / link-local ranges, plus localhost variants and
// non-http(s) schemes. Used wherever the server fetches a user-supplied URL
// (link previews, og:image proxying, etc.).

import dns from 'dns';
import net from 'net';

export function isPrivateIp(ip) {
  // Unwrap IPv4-mapped IPv6 (::ffff:192.168.1.1)
  const addr = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number);
    return (
      a === 0                                     || // 0.0.0.0/8
      a === 10                                    || // 10.0.0.0/8
      a === 127                                   || // 127.0.0.0/8 loopback
      (a === 169 && b === 254)                    || // 169.254.0.0/16 link-local (AWS metadata)
      (a === 172 && b >= 16 && b <= 31)           || // 172.16.0.0/12 private
      (a === 192 && b === 168)                       // 192.168.0.0/16 private
    );
  }

  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    return (
      lower === '::1'            || // loopback
      lower === '::'             || // unspecified
      lower.startsWith('fc')    || // fc00::/7 unique local
      lower.startsWith('fd')    || // fd00::/8 unique local
      lower.startsWith('fe80')  || // fe80::/10 link-local
      lower.startsWith('::ffff:') // IPv4-mapped — already handled above but belt+suspenders
    );
  }

  return true; // Unknown format — reject
}

export async function isSafeUrl(urlStr) {
  let parsed;
  try { parsed = new URL(urlStr); } catch { return false; }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname;

  // Reject localhost variants before DNS lookup
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;

  // If the hostname is already an IP, check it directly
  if (net.isIP(hostname)) return !isPrivateIp(hostname);

  // Resolve to IP and check — rejects unresolvable hostnames too
  try {
    const { address } = await dns.promises.lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}
