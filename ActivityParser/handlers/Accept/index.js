// /ActivityParser/handlers/Accept/index.js
// Handle incoming Accept activities from remote servers.
//
// The most common case: a remote actor sends Accept{Follow} after we followed
// them. We record this so clients can show "follow accepted" state, but there
// is no structural change needed — the member was already added to the circle
// when we sent the Follow.

import { Circle, Activity } from "#schema";
import logger from "#methods/utils/logger.js";

export function validate(activity) {
  if (!activity?.actorId) {
    return { valid: false, errors: ["Accept: missing actorId"] };
  }
  return { valid: true };
}

export default async function Accept(activity) {
  try {
    // The object of Accept is the original Follow activity (its ID or object)
    const followRef = activity.object;
    const acceptingActorId = activity.actorId; // the one who accepted (remote)

    if (!followRef) {
      // Nothing to look up — accept without error
      return { activity, result: { status: "accepted", note: "no object reference" } };
    }

    // Try to find the original Follow activity by its remoteId or id
    const followId = typeof followRef === "string" ? followRef : followRef?.id;
    let followActivity = null;
    if (followId) {
      followActivity = await Activity.findOne({
        $or: [{ id: followId }, { remoteId: followId }],
        type: "Follow",
      }).lean();
    }

    if (followActivity) {
      // Mark the follow as accepted
      await Activity.updateOne(
        { _id: followActivity._id },
        { $set: { "result.accepted": true, "result.acceptedAt": new Date(), "result.acceptedBy": acceptingActorId } }
      );
      logger.info("Accept: follow accepted", { followId, acceptingActorId });
    } else {
      logger.info("Accept: original Follow not found locally", { followId, acceptingActorId });
    }

    return {
      activity,
      result: {
        status: "accepted",
        followId,
        acceptingActorId,
      },
      federation: { shouldFederate: false },
    };
  } catch (err) {
    return { activity, error: `Accept: ${err.message}` };
  }
}
