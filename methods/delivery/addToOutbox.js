import { Outbox } from "../../schema/index.js";

export default async function (actorId, item) {
  try {
    return await Outbox.create({ actorId, item });
  } catch (e) {
    return { error: e };
  }
}
