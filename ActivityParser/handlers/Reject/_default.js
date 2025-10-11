export default async function handleReject(activity, ctx) {
  const target = activity.target || activity.object;
  if (!target) throw new Error("Reject requires target (or object)");

  // TODO: resolve context and flip state → rejected / remove pending
  return { sideEffects: ["reject"] };
}
