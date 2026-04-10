// routes/home/index.js
// GET / — Server info endpoint (public profile + public settings)

import express from "express";
import route from "../utils/route.js";
import getSettings from "#methods/settings/get.js";
import { Settings } from "#schema";

const router = express.Router({ mergeParams: true });

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

    // Public server settings — any setting with to: "@public" (excluding redacted UI types)
    const publicDocs = await Settings.find({
      to: "@public",
      "ui.type": { $ne: "redacted" },
      deletedAt: null,
    }).lean();
    const publicSettings = {};
    for (const doc of publicDocs) {
      publicSettings[doc.name] = doc.value;
    }
    set("settings", publicSettings);
  })
);

export default router;
