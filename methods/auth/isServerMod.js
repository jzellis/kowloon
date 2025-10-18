import getSettings from "#methods/settings/get.js";
import { Circle } from "#schema";

export default async function isServermod(actorId) {
  const settings = await getSettings();
  if (!settings?.modCircle || !actorId) return false;
  return await Circle.exists({
    id: settings.modCircle,
    "members.id": actorId,
  });
}
