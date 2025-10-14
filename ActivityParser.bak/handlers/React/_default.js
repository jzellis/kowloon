// React: objectType = target's type (Post/Reply/...), target = target id, object = reaction payload
export default async function handleReact(activity, ctx) {
  const targetType = activity.objectType; // e.g., "Post"
  const targetId = activity.target; // e.g., post:xxxx@kwln.org
  const reaction = activity.object; // e.g., { name:"👍" } or { type:"Reaction", name:"❤️" }

  if (!targetType || !targetId || !reaction)
    throw new Error("React requires objectType, target, and object");

  // TODO: validate target exists (or ingest stub)
  // TODO: upsert reaction keyed by (actorId, targetId, reaction.name) for idempotency
  // const saved = await ctx.db.reactions.upsert({ actor: activity.actorId, targetId, reaction });

  return {
    createdObjects: [
      /* saved */
    ],
    sideEffects: ["react"],
  };
}
