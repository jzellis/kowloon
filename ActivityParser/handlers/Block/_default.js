// Block: object = userId or serverId
// Instance-admin blocks override user shares; users can still follow, but sharing content is restricted
export default async function handleBlock(activity, ctx) {
  const target = activity.object;
  if (!target) throw new Error("Block requires object (user/server id)");

  // TODO: upsert block rule at appropriate scope:
  // - user-level (actorId blocks target)
  // - or server-admin-level (ctx indicates admin; persist instance-wide policy)
  return { sideEffects: ["block"] };
}
