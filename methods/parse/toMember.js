export default function toMember(item) {
  if (!item) return null; // or return false if that's what callers expect

  return {
    // Circles usually store the member's id under `id`
    id: item.id || "",
    // Prefer item.name; else profile.name; else empty string
    name: item.name || item.profile?.name || "",
    // Keep your existing fallbacks
    icon: item.icon || item.profile?.icon || "",
    inbox: item.inbox || "",
    outbox: item.outbox || "",
    url: item.url || "",
    server: item.server || "",
  };
}
