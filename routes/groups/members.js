import Kowloon from "../../Kowloon.js";
import { Group } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let pageSize = req.query.num || 20;
  let sort = {};
  if (req.query.sort) {
    sort[req.query.sort] = -1;
  } else {
    sort.updatedAt = -1;
  }
  let query = {
    id: req.params.id,
  };

  let group = await Group.findOne(query)
    .select("id name members")
    .slice(
      "members",
      pageSize ? pageSize * (page - 1) : 0,
      pageSize ? pageSize : 0
    );
  let items = group.members || [];
  let totalItems = items.length;
  if (group) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${id ? "/" + id : ""}`,
      summary: `${Kowloon.settings.profile.name} | Groups | ${group.name}`,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      currentPage: parseInt(page) || 1,
      firstItem: pageSize * (page - 1) + 1,
      lastItem: pageSize * (page - 1) + items.length,
      count: items.length,
      items,
    };
    // response.activities = await Group.find(query);
  } else {
    response.error = "Group not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
