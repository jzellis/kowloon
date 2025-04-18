import { Circle, Outbox } from "../schema/index.js";
import parseId from "./parseId.js";

export default async function (activity) {
  let response = [];
  let recipients = Array.from(
    new Set([
      ...activity.to,
      ...activity.cc,
      ...activity.bcc,
      ...activity.object?.to,
      ...activity.object?.cc,
      ...activity.object?.bcc,
    ])
  );

  let circles = recipients
    .filter((id) => !["@public", "@server"].includes(id)) // This removes public and server addresses from the recipient list
    .filter((id) => id.startsWith("circle"));
  await Promise.all(
    circles.map(async (id) => {
      let circle = await Circle.findOne({ id }).lean().select("members");
      recipients = Array.from(new Set([...recipients, ...circle.members]));
    })
  );

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        let outgoing = await Outbox.create({
          to: recipient,
          server: parseId(recipient).server,
          actorId: activity.actorId,
          item: activity.object,
        });
        response.push(outgoing);
      } catch (e) {
        response.push(e);
      }
    })
  );
  return response;
}
