// scripts/checkWellKnown.js
// import fetch from "node-fetch";

const domain = process.env.DOMAIN || "localhost:3000";
const base = `http://${domain}`; // use https:// if you've got SSL running

// List of expected endpoints and content types
const endpoints = [
  {
    path: "/.well-known/webfinger?resource=acct:test@" + domain,
    type: "application/jrd+json",
  },
  { path: "/.well-known/host-meta", type: "application/xrd+xml" },
  { path: "/.well-known/nodeinfo", type: "application/json" },
  { path: "/nodeinfo/2.0", type: "application/json" },
  { path: "/.well-known/jwks.json", type: "application/json" },
  { path: "/.well-known/public.pem", type: "application/x-pem-file" },
  { path: "/.well-known/actor", type: "application/activity+json" },
];

console.log(`🔍 Checking Kowloon well-known endpoints at ${base}\n`);

let passCount = 0;

for (const { path, type } of endpoints) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = res.ok || res.status === 302;
    const contentType = res.headers.get("content-type") || "";

    if (!ok) {
      console.log(`❌ ${path} → HTTP ${res.status}`);
      continue;
    }

    if (contentType.includes(type.split(";")[0])) {
      console.log(`✅ ${path} → ${res.status} (${contentType})`);
      passCount++;
    } else {
      console.log(`⚠️  ${path} → wrong content-type (${contentType})`);
    }
  } catch (err) {
    console.log(`💥 ${path} → ${err.message}`);
  }
}

console.log(
  `\n✨ ${passCount}/${endpoints.length} endpoints responding correctly`
);
