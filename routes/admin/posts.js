// routes/admin/posts.js
import express from "express";
import route from "../utils/route.js";
import makeCollection from "../utils/makeCollection.js";
import { Post } from "#schema";

const router = express.Router({ mergeParams: true });

function sanitize(doc) {
  const { _id, __v, signature, ...rest } = doc;
  return rest;
}

router.get(
  "/",
  makeCollection({
    model: Post,
    buildQuery: (req, { query }) => {
      const filter = {};
      // Admin sees all public/server posts by default; pass ?visibility=all for circle posts too
      if (query.visibility !== "all") {
        filter.to = { $in: ["@public", "@server"] };
      }
      if (query.type) filter.type = query.type;
      if (query.actorId) filter.actorId = query.actorId;
      if (query.deleted === "true") {
        filter.deletedAt = { $ne: null };
      } else if (query.deleted !== "include") {
        filter.deletedAt = null;
      }
      return filter;
    },
    select: "-signature",
    sort: { createdAt: -1 },
    sanitize,
    routeOpts: { allowUnauth: false },
  })
);

// GET /admin/posts/:id
router.get(
  "/:id",
  route(
    async ({ params, set, setStatus }) => {
      const post = await Post.findOne({
        id: decodeURIComponent(params.id),
      })
        .select("-signature")
        .lean();

      if (!post) {
        setStatus(404);
        set("error", "Post not found");
        return;
      }
      set("post", sanitize(post));
    },
    { allowUnauth: false }
  )
);

// DELETE /admin/posts/:id — soft-delete
router.delete(
  "/:id",
  route(
    async ({ params, user: adminUser, set, setStatus }) => {
      const post = await Post.findOne({ id: decodeURIComponent(params.id) });

      if (!post) {
        setStatus(404);
        set("error", "Post not found");
        return;
      }

      if (post.deletedAt) {
        setStatus(409);
        set("error", "Post already deleted");
        return;
      }

      post.deletedAt = new Date();
      post.deletedBy = adminUser.id;
      await post.save();

      set("ok", true);
      set("post", sanitize(post.toObject()));
    },
    { allowUnauth: false }
  )
);

// POST /admin/posts/:id/restore
router.post(
  "/:id/restore",
  route(
    async ({ params, set, setStatus }) => {
      const post = await Post.findOne({ id: decodeURIComponent(params.id) });

      if (!post) {
        setStatus(404);
        set("error", "Post not found");
        return;
      }

      post.deletedAt = null;
      post.deletedBy = null;
      await post.save();

      set("ok", true);
      set("post", sanitize(post.toObject()));
    },
    { allowUnauth: false }
  )
);

export default router;
