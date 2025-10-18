import getSettings from "#methods/settings/get.js";
import { Circle } from "#schema";

export default async function isServerAdmin(actorId) {
  const settings = await getSettings();
  if (!settings?.adminCircle || !actorId) return false;
  return await Circle.exists({
    id: settings.adminCircle,
    "members.id": actorId,
  });
}
