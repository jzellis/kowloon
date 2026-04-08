// routes/home/index.js
// GET / — Server info endpoint (public profile + public settings)

import express from "express";
import route from "../utils/route.js";
import getSettings from "#methods/settings/get.js";

const router = express.Router({ mergeParams: true });

// Settings that are safe to expose publicly
const PUBLIC_SETTINGS = [
  "likeEmojis",
  "registrationIsOpen",
  "maxUploadSize",
  "defaultPronouns",
  "flagOptions",
];

router.get(
  "/",
  route(async ({ set }) => {
    const settings = await getSettings();

    set("type", "Service");
    set("name", settings?.profile?.name || "Kowloon");
    set("subtitle", settings?.profile?.subtitle || undefined);
    set("description", settings?.profile?.description || undefined);
    set("domain", settings?.domain || undefined);
    set("icon", settings?.profile?.icon || undefined);
    set("registrationIsOpen", !!settings?.registrationIsOpen);
    set("endpoints", {
      users: `/users`,
      posts: `/posts`,
      groups: `/groups`,
      pages: `/pages`,
      outbox: `/outbox`,
      inbox: `/inbox`,
    });

    // Public server settings — clients use these for UI configuration
    const publicSettings = {};
    for (const key of PUBLIC_SETTINGS) {
      if (settings?.[key] !== undefined) publicSettings[key] = settings[key];
    }
    set("settings", publicSettings);
  })
);

export default router;
