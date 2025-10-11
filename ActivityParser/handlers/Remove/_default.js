// Remove: remove a user from a memberlist on a Group/Event
export default async function handleRemove(activity, ctx) {
  const userId = activity.target;
  const listKey = activity.object;
  const resId = activity.to;

  if (!userId || !listKey || !resId)
    throw new Error(
      "Remove requires target (user), object (list key), and to (resource id)"
    );

  // TODO: remove membership for userId from listKey on resId
  return { sideEffects: ["remove:member"] };
}
