// Create.js (refactored for singular addressing: to/canReply/canReact are strings)
import {
  Post,
  Page,
  Bookmark,
  Circle,
  Event,
  Group,
  File,
  User,
  Reply,
} from "#schema";
import indefinite from "indefinite";
import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import getObjectById from "#methods/get/objectById.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

let createMod = {};

const files = fs
  .readdirSync(__dirname + "/Create")
  .filter((f) => f.indexOf("index.js") === -1 && f.endsWith(".js"));

await Promise.all(
  files.map(async (f) => {
    let name = f.split(".")[0];
    try {
      let module = await import(`./Create/${f}`);
      createMod[name] = function (v) {
        return module.default(v);
      };
    } catch (e) {
      console.error(e);
    }
  })
);

/* ---------------------------- helpers ---------------------------- */

const asObject = (doc) =>
  doc?.toObject ? doc.toObject({ getters: true, virtuals: true }) : doc || null;

const sanitize = (obj, type) => {
  if (!obj) return obj;
  if (type === "User") {
    delete obj.password;
  }
  delete obj.__v;
  return obj;
};

const normalizeError = (e) => (e instanceof Error ? e : new Error(String(e)));

const actorFrom = (activity) => {
  const actor = activity?.actor || null;
  const actorId = actor?.id ?? activity?.actorId ?? null;
  return { actor, actorId };
};

const retrieveTarget = async (id) => {
  if (typeof id != "string") return false;
  const isLocal = id.split("@").pop() === process.env.DOMAIN;
  switch (true) {
    case id.startsWith("post:"):
      if (isLocal) return await Post.findOne({ id });
      break;
  }
};

const isGroupId = (id) => typeof id === "string" && id.startsWith("group");

const maybeFetchGroup = async (to) => {
  if (!isGroupId(to)) return null;
  return Group.findOne({ id: to }).select(
    "-approval -deletedAt -deletedBy -_id -__v -members -admins -pending -banned"
  );
};

const attachActorToObject = (activity) => {
  const { actor, actorId } = actorFrom(activity);
  if (!activity.object || !actorId) return;
  // embed both to be convenient for queries and denormalized displays
  activity.object.actorId = actorId;
  activity.object.actor = actor || { id: actorId };
};

const setResult = (activity, type, doc) => {
  const obj = sanitize(asObject(doc), type);
  activity.object = obj;
  activity.objectId = obj?.id ?? obj?._id?.toString?.();
};

const buildBaseSummary = (activity, createdType, opts = {}) => {
  const { actor, actorId } = actorFrom(activity);
  const actorName = actor?.profile?.name || "Someone";
  const actorIdent = actor?.id || actorId || "unknown actor";
  const noun =
    opts.noun || indefinite(activity.object?.type || createdType || "item");
  const title = opts.title;

  if (opts.context === "group" && opts.groupName) {
    const verb = createdType === "Post" ? "posted" : "created";
    return `${actorName} (${actorIdent}) ${verb} ${noun} in ${opts.groupName}${
      title ? `: "${title}"` : ""
    }`;
  }

  return `${actorName} (${actorIdent}) created ${noun}${
    title ? `: "${title}"` : ""
  }`;
};

/* ---------------------------- main ---------------------------- */

export default async function create(activity) {
  if (!activity?.object) throw new Error("No object provided");
  if (!activity?.objectType) throw new Error("No object type provided");

  // default summary; cases override as needed
  activity.summary = buildBaseSummary(activity, activity.objectType);

  // // Fetch group context if addressed to a group (singular `to`)
  let group = null;
  try {
    group = await maybeFetchGroup(activity.to);
  } catch {
    // non-fatal; proceed without group context
  }

  // // For non-User creates, attach actor and actorId on the object
  // if (activity.objectType !== "User") {
  //   attachActorToObject(activity);
  // }

  // try {
  //   switch (activity.objectType) {
  //     /* ----------------------------- Post ----------------------------- */
  //     case "Post": {
  //       // If addressed to a group, attach the group snapshot to the object
  //       if (group) activity.object.group = group;

  //       // Title-aware summary; prefer group context if present
  //       const noun = indefinite(activity.object.type || "post");
  //       const title = activity.object.title
  //         ? String(activity.object.title)
  //         : "";
  //       activity.summary = buildBaseSummary(activity, "Post", {
  //         noun,
  //         title,
  //         context: group ? "group" : undefined,
  //         groupName: group?.name,
  //       });

  //       const post = await Post.create(activity.object);
  //       setResult(activity, "Post", post);
  //       break;
  //     }

  //     /* ---------------------------- Circle ---------------------------- */
  //     case "Circle": {
  //       activity.summary = buildBaseSummary(activity, "Circle", {
  //         noun: indefinite("Circle"),
  //         title: activity.object?.name,
  //       });
  //       const circle = await Circle.create(activity.object);
  //       setResult(activity, "Circle", circle);
  //       break;
  //     }

  //     /* ----------------------------- Group ---------------------------- */
  //     case "Group": {
  //       activity.summary = buildBaseSummary(activity, "Group", {
  //         noun: indefinite("Group"),
  //         title: activity.object?.name,
  //       });
  //       const createdGroup = await Group.create(activity.object);
  //       setResult(activity, "Group", createdGroup);
  //       break;
  //     }

  //     /* --------------------------- Bookmark --------------------------- */
  //     case "Bookmark": {
  //       const title = activity.object?.title || "";
  //       activity.summary = `${activity.actor?.profile?.name || "Someone"} (${
  //         activity.actor?.id || activity.actorId || "unknown actor"
  //       }) bookmarked${title ? ` "${title}"` : ""}`;

  //       if (activity.object.parent) {
  //         const parent = await Bookmark.findOne({ id: activity.object.parent })
  //           .select("title id")
  //           .lean();
  //         if (parent?.title) activity.summary += ` in ${parent.title}`;
  //       }

  //       const bookmark = await Bookmark.create(activity.object);
  //       setResult(activity, "Bookmark", bookmark);
  //       break;
  //     }

  //     /* ----------------------------- Event ---------------------------- */
  //     case "Event": {
  //       const event = await Event.create(activity.object);
  //       setResult(activity, "Event", event);
  //       break;
  //     }

  //     /* ------------------------------ Page ---------------------------- */
  //     case "Page": {
  //       // Only admins can create pages
  //       const author = await User.findOne({ id: activity.actorId }).lean();
  //       if (!author?.isAdmin) {
  //         throw new Error("Only admins can create pages");
  //       }
  //       const page = await Page.create(activity.object);
  //       setResult(activity, "Page", page);
  //       break;
  //     }

  //     /* ------------------------------ File ---------------------------- */
  //     case "File": {
  //       const file = await File.create(activity.object);
  //       setResult(activity, "File", file);
  //       break;
  //     }

  //     /* ------------------------------ User ---------------------------- */
  //     case "User": {
  //       // normalize case on login fields
  //       if (activity.object.username)
  //         activity.object.username = activity.object.username
  //           .toLowerCase()
  //           .trim();
  //       if (activity.object.email)
  //         activity.object.email = activity.object.email.toLowerCase().trim();

  //       const actor = await User.create(activity.object);
  //       const actorPlain = sanitize(asObject(actor), "User");
  //       activity.object = actorPlain;
  //       activity.objectId = actorPlain?.id ?? actorPlain?._id?.toString?.();
  //       activity.summary = `${
  //         actorPlain?.profile?.name || actorPlain?.username || "A new user"
  //       } (${actorPlain?.id}) joined the server`;
  //       break;
  //     }

  //     /* ----------------------------- Reply ---------------------------- */
  //     case "Reply": {
  //       // Prefer explicit object.target; fall back to legacy canReply
  //       const targetId = activity.object?.target || activity.canReply;
  //       if (!targetId || typeof targetId !== "string") {
  //         throw new Error(
  //           "Reply requires a target (string) in object.target or canReply"
  //         );
  //       }

  //       // Attach actor to the reply like other non-User creates
  //       if (activity.actorId) {
  //         activity.object.actorId = activity.actorId;
  //       }
  //       if (activity.actor) {
  //         activity.object.actor = activity.actor;
  //       }

  //       // Attempt to infer targetActorId from the parent (Post or Reply)
  //       let inferredTargetActorId = null;
  //       try {
  //         const parentPost = await Post.findOne({ id: targetId })
  //           .select("actorId")
  //           .lean();
  //         if (parentPost?.actorId) inferredTargetActorId = parentPost.actorId;
  //         if (!inferredTargetActorId) {
  //           const parentReply = await Reply.findOne({ id: targetId })
  //             .select("actorId")
  //             .lean();
  //           if (parentReply?.actorId)
  //             inferredTargetActorId = parentReply.actorId;
  //         }
  //       } catch {
  //         /* non-fatal; handled below */
  //       }

  //       // Satisfy required field from schema: target & targetActorId
  //       activity.object.target = targetId;
  //       activity.object.targetActorId =
  //         activity.object?.targetActorId || inferredTargetActorId;

  //       if (!activity.object.targetActorId) {
  //         throw new Error(
  //           "Reply requires targetActorId (unable to infer from parent)"
  //         );
  //       }

  //       // Let the schema's pre-save render HTML from source.content.
  //       // If caller gave plain body but no source.content, promote it.
  //       if (
  //         !activity.object.source ||
  //         typeof activity.object.source !== "object"
  //       ) {
  //         activity.object.source = {};
  //       }
  //       if (!activity.object.source.content && activity.object.body) {
  //         activity.object.source.content = activity.object.body;
  //         // mediaType default will be set in pre-save, but we can hint here:
  //         activity.object.source.mediaType =
  //           activity.object.source.mediaType || "text/html";
  //         delete activity.object.body; // pre-save will compute body from source
  //       }

  //       // Create the Reply
  //       const reply = await Reply.create(activity.object);

  //       // Result & summary
  //       activity.objectId = reply.id;
  //       activity.object = reply;
  //       const replierName = activity.actor?.profile?.name || "Someone";
  //       const replierIdent =
  //         activity.actor?.id || activity.actorId || "unknown actor";
  //       // If we inferred a parent author, mention them; otherwise reference the target id
  //       const parentRef = activity.object.targetActorId || targetId;
  //       activity.summary = `${replierName} (${replierIdent}) replied to ${parentRef}`;

  //       break;
  //     }
  //     default:
  //       throw new Error(`Unsupported objectType: ${activity.objectType}`);
  //   }
  // } catch (err) {
  //   activity.error = normalizeError(err);
  // }

  // return activity;
  let createdActivity = await createMod[activity.objectType](activity);

  return createdActivity;
}
