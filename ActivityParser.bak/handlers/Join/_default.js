// Join: join a Group or Event (NOT circles)
// objectType should be "Group" or "Event"
// target = resource id (group:xxx@domain / event:xxx@domain)
export default async function handleJoin(activity, ctx) {
  const kind = activity.objectType; // Group/Event
  const resId = activity.target;
  if (!kind || !resId)
    throw new Error("Join requires objectType (Group/Event) and target");

  // TODO: add actorId to pending/approved memberlist per resource policy (maybe requires Accept)
  return { sideEffects: ["join"] };
}
