import Kowloon from "../../Kowloon.js";
import { Bookmark, Post, User, Reply } from "../../schema/index.js";
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

  // Let's create this query

  if (!req.user?.id || req.user?.id != req.params.id) {
    response.error = "Unauthorized";
    status = 401;
  } else {
    let user = await User.findOne({ id: req.user.id });
    // Let's create this query

    let query = {
      $or: [
        { actorId: user.id },
        {
          to: {
            $in: Array.from(
              new Set([user.id, ...(await user.getMemberships())])
            ),
          },
        },
      ],
      actorId: {
        $nin: [...(await user.getBlocked()), ...(await user.getMuted())],
      },
      deletedAt: null,
    };

    let bookmarks = await Bookmark.find({ ...query, type: "Bookmark" })
      .select(
        "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 });

    let posts = await Post.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 });

    let replyQuery = {
      targetActorId: user.id,
      actorId: {
        $nin: [...(await user.getBlocked()), ...(await user.getMuted())],
      },
      deletedAt: null,
    };

    let replies = await Reply.find(query)
      .select(
        "-flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy -_id -__v -source"
      )
      .limit(pageSize ? pageSize : 0)
      .skip(pageSize ? pageSize * (page - 1) : 0)
      .sort({ sort: -1 });

    let totalItems = bookmarks.length + posts.length + replies.length;
    let items = [...bookmarks, ...posts, ...replies].sort((a, b) =>
      req.query.sort
        ? b[req.query.sort] - a[req.query.sort]
        : b.updatedAt - a.updatedAt
    );

    response = {
      "@context": "https://www.w3.org/ns/bookmarkstreams",
      type: "OrderedCollection",
      // id: `https//${settings.domain}${id ? "/" + id : ""}`,
      summary: `${Kowloon.settings.profile.name} | Timeline`,
      totalItems,
      items: items,
      time: Date.now() - qStart,
    };
  }

  res.status(status).json(response);
}
