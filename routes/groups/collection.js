// routes/groups/collection.js
// GET /groups — List groups visible to the viewer
//
// Visibility tiers (Group.to):
//   @public               — anyone, including unauthenticated
//   @<domain>             — local authenticated users
//   circle:<id>           — members of that circle (creator-owned)

import makeCollection from "../utils/makeCollection.js";
import { Group } from "#schema";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getViewerContext } from "#methods/visibility/context.js";

export default makeCollection({
  model: Group,
  buildQuery: async (req, { user }) => {
    const domain = getSetting("domain");
    const filter = { deletedAt: null };

    // Determine viewer locality
    let isLocal = false;
    if (user?.id) {
      const parsed = kowloonId(user.id);
      isLocal = parsed.domain && isLocalDomain(parsed.domain);
    }

    if (!user?.id || !isLocal) {
      // Unauthenticated or remote: only public groups
      filter.to = "@public";
    } else {
      // Local authenticated: public + server + any circles the viewer's in
      const ctx = await getViewerContext(user.id);
      const allowed = ["@public", `@${domain}`, ...(ctx?.circleIds || [])];
      filter.to = { $in: allowed };
    }

    return filter;
  },
  select:
    "id name description icon to rsvpPolicy memberCount url createdAt updatedAt",
  sanitize: (doc) => {
    const { _id, __v, ...rest } = doc;
    return rest;
  },
});
