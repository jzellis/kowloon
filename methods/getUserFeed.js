import { Circle, User } from "../schema/index.js";
import createUserSignature from "./createUserSignature.js";
import crypto from "crypto";
export default async function (actorId) {
  let user = await User.findOne({ id: actorId });
  let circles = await Circle.find({ actorId }).select(
    "members  -members.createdAt -members.updatedAt"
  );
  let allFollowed = [];
  circles.map((c) => {
    allFollowed.push(...c.members);
  });
  allFollowed = Array.from(new Set(allFollowed)); // OK, now we've got all unique followed IDs by this user

  await Promise.all(
    allFollowed.map(async (f) => {
      let credentials = await createUserSignature(actorId);

      let request = {
        headers: {
          "kowloon-id": actorId,
          "kowloon-timestamp": credentials.timestamp,
          "Kowloon-Signature": credentials.signature,
          Accept: "application/json",
        },
      };
      let response = await fetch(f.outbox, request);
      response =
        f.type != "rss" ? await response.json() : await response.text();
    })
  );
}
