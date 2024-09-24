import { User, Feed } from "../schema/index.js";
import FeedParser from "./FeedParser/index.js";
export default async function (actorId) {
  try {
    let user = await User.findOne({ id: actorId });
    let following = user.following;
    await Promise.all(
      following.map(async (f) => {
        if (FeedParser[f.type]) await FeedParser[f.type](f.url, actorId);
      })
    );
    return true;
  } catch (e) {
    return new Error(e);
  }
}
