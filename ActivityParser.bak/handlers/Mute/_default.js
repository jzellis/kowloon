// Mute: object = userId or serverId (local, per-user visibility filter)
export default async function handleMute(activity, ctx) {
  const target = activity.object;
  if (!target) throw new Error("Mute requires object (user/server id)");

  // TODO: upsert mute preference for actorId → target
  return { sideEffects: ["mute"] };
}
