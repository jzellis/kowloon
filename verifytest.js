import Kowloon from "./Kowloon.js";
import crypto from "crypto";
import { User } from "./schema/index.js";

let actorId = "@admin@kowloon.social";
let user = await User.findOne({ id: actorId });
let hash = crypto.createHash("sha256").update(user.keys.public).digest("hex");
let publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqEdM7WHHNY4AgPPVij8g
5tblWS88NTSZZVkFgz4ft3G04lCjJe9Uq8WB9SD28ZgyKrk/FWRldzXWLOk9xG1R
HZwedc0SiwZ97ehQowp9giyW7BqaTDLgjxAmsw4CwjusmNLD4GONe84ZmeeaePrT
hJIMjbMn9IwhQ4Gjhz29+uTCqWxxmZMGLPVbkJb0ismWX/Q8JSEgfdYHKmeQc6+N
WL5nR7lJsuKtd0cJsdV5exD3fLIE0KU0cfdqd6FNaV19TBS6br4oob4HljBVZvea
bAvbAOsVigz26gxhqlysKqkYwL3OXFjGEeKlmI6IwrifauswyvOX4pI6ESgj9F6j
5QIDAQAB
-----END PUBLIC KEY-----
`;
// let key = publicKey.split("\n").slice(1, -2).join("\n");
console.log(await Kowloon.verifyUser("@admin@kowloon.social", publicKey));

process.exit();
