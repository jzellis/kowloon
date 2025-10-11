// Update: apply allowed field patches to an existing object (by object.id)
export default async function handleUpdate(activity, ctx) {
  const targetId =
    typeof activity.object === "string" ? activity.object : activity.object?.id;

  // TODO: fetch current object by targetId
  // TODO: authorize: activity.actorId is allowed to update the target
  // TODO: compute allowed patch set; write changes; bump updated timestamp/etag

  return {
    createdObjects: [
      /* updated object snapshot (optional) */
    ],
    sideEffects: ["update:default"],
  };
}
