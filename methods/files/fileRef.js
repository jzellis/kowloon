// Resolve an attachment/image value to a canonical local file id.
//
// Attachments are stored inconsistently — sometimes as a "file:<id>@domain" id,
// sometimes as the app file-proxy URL (https://<domain>/files/<url-encoded file
// id>[?query]). Feed enrichment only looked up File records for the id form, so
// proxy-URL attachments got an empty mediaType and clients rendered them as
// audio (frontend #45). This normalizes both to the file id (or null for an
// external, non-file URL) so a single File lookup covers every case.
export function fileIdFromValue(v) {
  if (typeof v !== "string") return null;
  if (v.startsWith("file:")) return v;
  const m = v.match(/\/files\/([^/?#]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (decoded.startsWith("file:")) return decoded;
    } catch {
      // malformed percent-encoding — not a resolvable file reference
    }
  }
  return null;
}
