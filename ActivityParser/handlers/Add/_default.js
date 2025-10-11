// Add: add a user to a memberlist (admins/moderators/attending/etc.) on a Group/Event
// target = userId being added; object = memberlist key (e.g., "admins"); to = resource id
export default async function handleAdd(activity, ctx) {
  const userId = activity.target; // @alice@kwln.org
  const listKey = activity.object; // "admins" / "attending" / ...
  const resId = activity.to; // group:xxx@domain / event:xxx@domain

  if (!userId || !listKey || !resId)
    throw new Error(
      "Add requires target (user), object (list key), and to (resource id)"
    );

  // TODO: upsert membership for userId into listKey on resId
  return { sideEffects: ["add:member"] };
}
