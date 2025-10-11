// Unfollow: object = userId or serverId
// target (optional) = circle id; if provided, remove only from that circle; else remove from ALL circles
export default async function handleUnfollow(activity, ctx) {
  const subject = activity.object;
  const circleId = activity.target;

  if (!subject) throw new Error("Unfollow requires object (user/server id)");

  // TODO: if circleId -> remove subject from that specific circle
  // TODO: else -> remove subject from all circles
  // TODO: optionally drop follow edge entirely if no circles remain

  return {
    sideEffects: [
      circleId ? "unfollow:remove-from-circle" : "unfollow:remove-from-all",
    ],
  };
}
