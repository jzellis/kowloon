import { Activity } from "../schema/index.js";
import sanitize from "./sanitize.js";

export default async function (query = {}, options) {
  options = {
    sanitized: true,
    page: 1,
    pageLength: 20,
    deleted: false,
    ordered: false,
    summary: "Activities",
    id: "//" + this.settings.domain,
    populateActor: false,
    ...options,
  };
  let result = await Activity.find(
    (options.deleted = false ? { ...query, deletedAt: null } : { ...query })
  )
    .limit(options.pageLength)
    .skip((options.page - 1) * options.pageLength)
    .populate(
      options.populateActor
        ? {
            path: "actor",
            select: "username email profile keys.public",
          }
        : ""
    )
    .sort({ createdAt: -1 });
  // if (Array.isArray(result) && result.length === 1) result = result[0];
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    type: options.ordered ? "OrderedCollection" : "Collection",
    id: options.id,
    summary: `${this.settings.title} | ${options.summary}`,
    totalItems: result.length,
    page: options.page,
    items: options.sanitized === true ? sanitize(result) : result,
    queryTime: 0,
  };
}
