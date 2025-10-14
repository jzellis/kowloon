// Undo: reverse a previous action (Like, Follow, Announce, etc.)
export default async function handleUndo(activity, ctx) {
  const target = activity.object; // usually the prior activity or its id
  const targetType = typeof target === "object" ? target.type : null;

  // TODO: if targetType known, route to specific reversal (e.g., remove Like, cancel Follow)
  // TODO: otherwise attempt lookup by id and infer
  // TODO: ensure actor owns the target action being undone

  return {
    sideEffects: ["undo:default"],
  };
}
