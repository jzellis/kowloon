// Leave: leave a Group or Event
export default async function handleLeave(activity, ctx) {
  const kind = activity.objectType;
  const resId = activity.target;
  if (!kind || !resId)
    throw new Error("Leave requires objectType (Group/Event) and target");

  // TODO: remove actorId from membership lists
  return { sideEffects: ["leave"] };
}
