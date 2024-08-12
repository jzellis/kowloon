import { User } from "../schema/index.js";
import sanitize from "./sanitize.js";

export default async function (query = {}, options) {
  options = {
    sanitized: true,
    page: 1,
    pageLength: 20,
    deleted: false,
    ordered: false,
    summary: "Users",
    id: "//" + this.settings.domain,
    ...options,
  };
  let qStart = Date.now();

  let result = await User.find(
    (options.deleted = false ? { ...query, deletedAt: null } : { ...query })
  )
    .limit(options.pageLength)
    .skip((options.page - 1) * options.pageLength)
    .select(options.sanitized ? "username profile keys.public" : "")
    .sort({ createdAt: -1 });
  // if (Array.isArray(result) && result.length === 1) result = result[0];
  let qEnd = Date.now();
  return {
    "@context": "https://www.w3.org/ns/Userstreams",
    type: options.ordered ? "OrderedCollection" : "Collection",
    id: options.id,
    summary: `${this.settings.title} | ${options.summary}`,
    totalItems: result.length,
    page: options.page,
    items: options.sanitized === true ? sanitize(result) : result,
    queryTime: qEnd - qStart,
  };
}
