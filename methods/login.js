// Login function, just takes a username or ID and password
import getSettings from "./getSettings.js";
import { Circle, User } from "../schema/index.js";
import generateToken from "./generateToken.js";

export default async function (username, password = "") {
  let settings = await getSettings();
  let user = await User.findOne({
    $or: [{ username: username }, { id: username }],
  }).select("id username password profile following blocked muted");

  if (!user) return { error: "User not found" };
  if (!(await user.verifyPassword(password))) {
    console.log("Incorrect password");
    return { error: "Incorrect password" };
  }
  user.lastLogin = new Date();
  await user.save();
  const token = await generateToken(user.id);

  return token;
}
