// Follow: object = userId or serverId (e.g., "@alice@kwln.org" or "@kwln.org")
// target (optional) = circle id to add them to (else default "following" circle)
export default async function handleFollow(activity, ctx) {
  const subject = activity.object; // who/what to follow (@user@domain or @domain)
  const circleId = activity.target; // optional circle id

  if (!subject) throw new Error("Follow requires object (user/server id)");

  // TODO: normalize subject kind (User vs Server) for policy & storage
  // TODO: ensure follow edge exists; create if missing
  // TODO: if circleId given -> add subject to that circle; else add to default following circle

  return {
    sideEffects: [circleId ? "follow:add-to-circle" : "follow:add-to-default"],
  };
}
