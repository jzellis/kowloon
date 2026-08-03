import KowloonClient from "../../client/src/index.js";
const KWLN1 = "http://kwln1.local:8080";
const PW = "circ123";
const S = Date.now().toString(36);
const fm = (o, re) => (JSON.stringify(o).match(re) || [])[0] || null;
const ids = (res) => (res?.orderedItems || res?.items || []).map((c) => c.id);

async function reg(u) {
  const c = new KowloonClient({ baseUrl: KWLN1, timeout: 30000 });
  const r = await c.auth.register({ username: u, password: PW, email: `${u}@ex.com`, acknowledgedRules: true });
  return { c, id: r.user.id };
}

const A = await reg(`ca${S}`);
const cpub = await A.c.activities.createCircle({ name: `pub${S}`, to: "@public" });
const cpriv = await A.c.activities.createCircle({ name: `priv${S}`, to: A.id });
const cpubId = fm(cpub, /circle:[^"@]+@kwln1\.local/);
const cprivId = fm(cpriv, /circle:[^"@]+@kwln1\.local/);
console.log("public:", cpubId, " private:", cprivId);
await new Promise((r) => setTimeout(r, 800));

const discovery = ids(await A.c.feeds.getCircles({}));           // GET /circles
const browseAlias = ids(await A.c.http.get("/circles/browse"));  // alias
const mine = ids(await A.c.feeds.getUserCircles({ userId: A.id })); // GET /users/:id/circles

console.log("GET /circles (discovery):", discovery.includes(cpubId) ? "has public" : "NO public", discovery.includes(cprivId) ? "!!has private" : "no private");
console.log("GET /circles/browse alias:", browseAlias.includes(cpubId) ? "has public" : "NO public");
console.log("GET /users/:id/circles (owner):", mine.includes(cpubId) && mine.includes(cprivId) ? "has both" : "MISSING");

let outboxGone = false;
try { await A.c.http.get(`/outbox/${encodeURIComponent(cpubId)}`); }
catch (e) { outboxGone = (e?.statusCode === 404 || /404|not found/i.test(e?.message || "")); }
console.log("GET /outbox/:id removed (404):", outboxGone ? "yes" : "NO (still there)");

const pass =
  discovery.includes(cpubId) && !discovery.includes(cprivId) &&
  browseAlias.includes(cpubId) &&
  mine.includes(cpubId) && mine.includes(cprivId) &&
  outboxGone;
console.log(`\nRESULT: ${pass ? "PASS ✅" : "FAIL ❌"}`);
process.exit(pass ? 0 : 1);
