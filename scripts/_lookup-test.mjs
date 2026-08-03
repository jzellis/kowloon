import KowloonClient from "../../client/src/index.js";
const K1 = "http://kwln1.local:8080", K2 = "http://kwln2.local:8080";
const PW = "lk123", S = Date.now().toString(36);
const fm = (o, re) => (JSON.stringify(o).match(re) || [])[0] || null;
async function reg(base, u) {
  const c = new KowloonClient({ baseUrl: base, timeout: 30000 });
  const r = await c.auth.register({ username: u, password: PW, email: `${u}@ex.com`, acknowledgedRules: true });
  return { c, id: r.user.id };
}

const B = await reg(K2, `lb${S}`);
const bpost = await B.c.activities.createPost({ type: "Note", content: `hi-${S}`, to: "@public" });
const bpostId = fm(bpost, /post:[^"@]+@kwln2\.local/);
const A = await reg(K1, `la${S}`);
await new Promise((r) => setTimeout(r, 700));

let gotUser = false;
try { const u = await A.c.feeds.lookup({ id: B.id }); gotUser = JSON.stringify(u).includes(B.id); }
catch (e) { console.log("  user lookup err:", (e.message || "").split("\n")[0].slice(0, 100)); }

let gotPost = false;
try { const p = await A.c.feeds.lookup({ id: bpostId }); gotPost = JSON.stringify(p).includes(`hi-${S}`); } catch {}

const u2 = await A.c.feeds.lookupUser({ id: B.id });
const aliasOk = JSON.stringify(u2).includes(B.id);

let usersLookupGone = false;
try { const r = await A.c.http.get("/users/lookup", { params: { id: B.id } }); usersLookupGone = !JSON.stringify(r).includes(B.id); }
catch { usersLookupGone = true; }

console.log("lookup remote user:      ", gotUser ? "✅" : "❌");
console.log("lookup remote post (any):", gotPost ? "✅" : "❌");
console.log("lookupUser alias:        ", aliasOk ? "✅" : "❌");
console.log("/users/lookup retired:   ", usersLookupGone ? "✅" : "❌");
const pass = gotUser && gotPost && aliasOk && usersLookupGone;
console.log(`\nRESULT: ${pass ? "PASS ✅" : "FAIL ❌"}`);
process.exit(pass ? 0 : 1);
