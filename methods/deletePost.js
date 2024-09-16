import { Post } from "../schema/index.js";

export default async function (id) {
  try {
    return await Post.findOneAndUpdate(
      { id },
      {
        $set: { deletedAt: new Date(), formerType: "$type", type: "Tombstone" },
      }
    );
  } catch (e) {
    return { error: e };
  }
}
