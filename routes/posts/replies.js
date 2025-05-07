import Kowloon from "../../Kowloon.js";
import { Post, Reply } from "../../schema/index.js";
import generateQuery from "../../methods/generateQuery.js";
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

  let postQuery = await generateQuery(req.user?.id);
  let post = await Post.findOne(postQuery);
  if (post) {
    let query = {
      target: req.params.id,
    };
    let items = await Reply.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 });
    let totalItems = await Reply.countDocuments(query);

    response = {
      "@context": "https://www.w3.org/ns/acivitystreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${id ? "/" + id : ""}`,
      summary: `${Kowloon.settings.profile.name} | Replies`,
      totalItems,
      totalPages: Math.ceil(totalItems / (page * pageSize ? pageSize : 20)),
      currentPage: parseInt(page) || 1,
      firstItem: pageSize * (page - 1) + 1,
      lastItem: pageSize * (page - 1) + items.length,
      count: items.length,
      items,
    };
    // response.activities = await React.find(query);
    response.query = query;
    response.queryTime = Date.now() - qStart;
  } else {
    response.error =
      "Original post doesn't exist or you are not authorized to view it";
  }
  res.status(status).json(response);
}
