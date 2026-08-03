import KowloonClient from "../../client/src/index.js";
const K1 = "http://kwln1.local:8080", K2 = "http://kwln2.local:8080";
const PW = "cb123", S = Date.now().toString(36);
const fm = (o, re) => (JSON.stringify(o).match(re) || [])[0] || null;
const ids = (r) => (r?.orderedItems || r?.items || []).map((c) => c.id);
async function reg(base, u) {
  const c = new KowloonClient({ baseUrl: base, timeout: 30000 });
  const r = await c.auth.register({ username: u, password: PW, email: `${u}@e.com`, acknowledgedRules: true });
  return { c, id: r.user.id };
}

const B = await reg(K2, `cbb${S}`);
const cr = await B.c.activities.createCircle({ name: `rem${S}`, to: "@public" });
const cremId = fm(cr, /circle:[^"@]+@kwln2\.local/);
const A = await reg(K1, `cba${S}`);
const cl = await A.c.activities.createCircle({ name: `loc${S}`, to: "@public" });
const clocId = fm(cl, /circle:[^"@]+@kwln1\.local/);
await new Promise((r) => setTimeout(r, 600));

let cached = false;
try { const r = await A.c.feeds.lookup({ id: cremId }); cached = JSON.stringify(r).includes(cremId); } catch {}
await new Promise((r) => setTimeout(r, 400));

const disc = ids(await A.c.feeds.getCircles({}));
const hasLocal = disc.includes(clocId);
const excludesRemote = !disc.includes(cremId);

let browseGone = false;
try { await A.c.http.get("/circles/browse"); } catch (e) { browseGone = (e?.statusCode === 404 || /404/.test(e?.message || "")); }

console.log("remote circle cached via /lookup:", cached ? "✅" : "❌");
console.log("/circles shows local circle:     ", hasLocal ? "✅" : "❌");
console.log("/circles EXCLUDES cached remote: ", excludesRemote ? "✅" : "❌");
console.log("/circles/browse removed (404):   ", browseGone ? "✅" : "❌");
const pass = cached && hasLocal && excludesRemote && browseGone;
console.log(`\nRESULT: ${pass ? "PASS ✅" : "FAIL ❌"}`);
process.exit(pass ? 0 : 1);
