import Kowloon from "../Kowloon.js";
import { User } from "../schema/index.js";
import crypto from "crypto";
let user = await User.findOne({ id: "@admin@kowloon.social" });
let key = "12345678901234567890123456789012";
console.log(await Kowloon.verifyRemoteUser(user.id, user.keys.public));

process.exit(0);
