// Delete: tombstone an object or actor
export default async function handleDelete(activity, ctx) {
  const targetId =
    typeof activity.object === "string" ? activity.object : activity.object?.id;

  // TODO: authorize delete (actor owns target or admin rule)
  // TODO: mark as tombstoned; cascade to timelines if local
  // TODO: optionally keep a lightweight tombstone object

  return {
    sideEffects: ["delete:default"],
  };
}
