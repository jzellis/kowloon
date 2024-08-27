import { Inbox } from "../../schema/index.js";

export default async function (actorId, item) {
  try {
    return await Inbox.create({ actorId, item });
  } catch (e) {
    return { error: e };
  }
}
