import { Inbox } from "../../schema/index.js";

export default async function (
  actorId,
  options = {
    read: false,
  }
) {
  query = { to: actorId };
  if (options.read == true) query.read = true;

  return await Inbox.find(query).sort({ createdAt: -1 });
}
