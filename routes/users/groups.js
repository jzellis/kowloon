// /routes/users/groups.js
import express from "express";
import { User, Group, Circle } from "#schema";

const router = express.Router({ mergeParams: true });

router.get("/:username/groups", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: "Not found" });

    const isSelf = req.user?.id === user.id || !!req.user?.isAdmin;
    if (!isSelf) {
      return res.json({
        type: "OrderedCollection",
        totalItems: 0,
        count: 0,
        items: [],
      });
    }

    const [owned, memberOf] = await Promise.all([
      Circle.find({ actorId: user.id }).select("id").lean(),
      Circle.find({ "members.id": user.id }).select("id").lean(),
    ]);
    const circleIds = new Set([...owned, ...memberOf].map((c) => c.id));
    if (!circleIds.size) {
      return res.json({
        type: "OrderedCollection",
        totalItems: 0,
        count: 0,
        items: [],
      });
    }

    const groups = await Group.find({
      $or: [
        { admins: { $in: [...circleIds] } },
        { moderators: { $in: [...circleIds] } },
        { members: { $in: [...circleIds] } },
        { invited: { $in: [...circleIds] } },
        { blocked: { $in: [...circleIds] } },
      ],
      deletedAt: null,
    }).lean();

    // Summaries only; no roster
    const items = groups.map((g) => ({
      id: g.id,
      type: "Group",
      name: g.name,
      summary: g.description,
      icon: g.icon,
      url: g.url,
      to: g.to,
      replyTo: g.replyTo,
      reactTo: g.reactTo,
      updatedAt: g.updatedAt,
    }));

    return res.json({
      type: "OrderedCollection",
      totalItems: items.length,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("GET /users/:username/groups error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
