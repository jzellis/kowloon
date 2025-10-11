// Accept: accept a Follow, Invite, Join request, etc.
// target = the thing being accepted (request id or resource id+actor combo)
export default async function handleAccept(activity, ctx) {
  const target = activity.target || activity.object;
  if (!target) throw new Error("Accept requires target (or object)");

  // TODO: resolve context (follow vs invite vs join) and flip state → accepted
  return { sideEffects: ["accept"] };
}
