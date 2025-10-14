// Build a Member subdocument using your exact schema shape.
export function toMember(input) {
  if (!input) return undefined;
  // Accept either a bare id string or a partial object
  if (typeof input === "string") return { id: input };
  const { id, name, inbox, outbox, icon, url, server } = input;
  if (!id) return undefined;
  return { id, name, inbox, outbox, icon, url, server };
}
