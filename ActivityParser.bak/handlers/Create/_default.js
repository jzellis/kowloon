// Create: generic fallback for when there isn't a subtype (Post/Reply/…)
export default async function handleCreate(activity, ctx) {
  // activity.object may be URL or embedded object
  const obj = activity.object;

  // TODO: validate presence of object
  // TODO: if embedded and localizable, mint/assign object.id and persist
  // TODO: minimal ingest for remote objects if only a URL is provided

  // Example (no-op): return without creating objects
  return {
    // activity: (optional) provide a canonicalized activity; pipeline will persist otherwise
    createdObjects: [], // e.g., saved Post/Note/etc.
    sideEffects: ["create:default"], // optional breadcrumbs for logs
  };
}
