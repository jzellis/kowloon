import { User } from "../schema/index.js";

export default async function (token) {
  // return await User.findOne({ accessToken: token }).select(
  //   "-password -keys.private"
  // );

  let query = { "keys.public": `${token.replaceAll("\\r\\n", "\n")}` };

  return await User.findOne(query).select("-password -keys.private");
}
