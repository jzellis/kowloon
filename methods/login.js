// Login function, just takes a username or ID and password

import { Circle, User } from "../schema/index.js";
import createUserSignature from "./createUserSignature.js";
export default async function (username, password = "") {
  let user = await User.findOne({
    $or: [{ username: username }, { id: username }],
  }).select("id username password profile prefs keys");

  if (!user) return { error: "User not found" };
  if (!(await user.verifyPassword(password)))
    return { error: "Incorrect password" };
  user.lastLogin = new Date();
  await user.save();
  let circles = await Circle.find({ actorId: user.id }).select(
    "-_id id name icon summary"
  );
  let { id, timestamp, signature } = await createUserSignature(
    user.id,
    user.lastLogin.toString()
  );

  return {
    user: {
      ...user._doc,
      _id: undefined,
      password: undefined,
      keys: undefined,
    },
    circles,
    timestamp: user.lastLogin.toString(),
    signature: signature,
  };
}
