// /ActivityParser/activity.schema.js
const idPart = "[^@\\s]+";
const patterns = {
  actorId: `^@[^@\\s]+@[a-z0-9.-]+$`,
  serverHandle: "^@[a-z0-9.-]+$",
  publicToken: "^@public$",
  circleId: `^circle:${idPart}@[a-z0-9.-]+$`,
  groupId: `^group:${idPart}@[a-z0-9.-]+$`,
  postId: `^post:${idPart}@[a-z0-9.-]+$`,
  pageId: `^page:${idPart}@[a-z0-9.-]+$`,
  bookmarkId: `^bookmark:${idPart}@[a-z0-9.-]+$`,
  objectId: `^(circle|group|post|page|bookmark|reply):${idPart}@[a-z0-9.-]+$`,
};

const toRecipient = {
  anyOf: [
    { type: "string", pattern: "^$" },
    { type: "string", pattern: patterns.publicToken },
    { type: "string", enum: ["audience", "public", "server", "followers"] }, // coarse values
    { type: "string", pattern: patterns.serverHandle },
    { type: "string", pattern: patterns.circleId },
    { type: "string", pattern: patterns.groupId },
    { type: "string", pattern: patterns.actorId },  // Allow user IDs
    { type: "string", pattern: "^https?://" },       // AP URL format (federated)
  ],
};

const replyReactRecipient = {
  anyOf: [
    { type: "string", pattern: "^$" },
    { type: "string", pattern: patterns.publicToken },
    { type: "string", enum: ["audience", "public", "server", "followers", "none"] },
    { type: "string", pattern: patterns.serverHandle },
    { type: "string", pattern: patterns.circleId },
    { type: "string", pattern: patterns.groupId },
    { type: "string", pattern: patterns.actorId },
    { type: "string", pattern: patterns.postId },
    { type: "string", pattern: patterns.pageId },
    { type: "string", pattern: patterns.bookmarkId },
    { type: "string", pattern: `^reply:${idPart}@[a-z0-9.-]+$` },
    { type: "string", pattern: "^https?://" },       // AP URL format (federated)
  ],
};

const schema = {
  $id: "https://kwln.org/activity.schema.json",
  type: "object",
  additionalProperties: true,
  required: ["type", "actorId"],
  properties: {
    id: { type: "string" },
    type: {
      enum: [
        "Accept",    // AP: Accept{Follow}
        "Add",
        "Announce",  // AP: Boost/share
        "Block",
        "Create",
        "Delete",
        "Flag",
        "Follow",
        "Join",
        "Leave",
        "Mute",
        "React",
        "Remove",
        "Reply",
        "Unblock",
        "Undo",      // AP: Undo{Follow}, Undo{Like}, etc.
        "Unfollow",
        "Unmute",
        "Update",
      ],
    },
    // actorId can be our @user@domain format OR a URL for remote AP actors
    actorId: {
      type: "string",
      anyOf: [
        { pattern: patterns.actorId },         // @user@domain
        { pattern: patterns.serverHandle },    // @domain
        { pattern: "^https?://" },             // URL (remote AP actors)
      ],
    },
    objectType: {
      type: "string",
      enum: [
        "Announce",
        "Bookmark",
        "Circle",
        "Delete",
        "Group",
        "Page",
        "Post",
        "React",
        "Reply",
        "User",
      ],
    },
    object: {},
    target: { type: "string" },
    summary: { type: "string" },
    to: replyReactRecipient, // Allow both addressing patterns and object IDs (for Reply/React)
    canReply: replyReactRecipient,
    canReact: replyReactRecipient,
  },
  allOf: [
    {
      if: { properties: { type: { const: "Create" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
          to: toRecipient, // Create activities use standard addressing (not object IDs)
          object: {
            type: "object",
            required: ["type"],
            // Note: federated (AP) Create activities include object.id — we allow it
            // and strip it during normalization for locally-created objects only.
          },
        },
      },
    },
    {
      if: { properties: { type: { const: "Reply" } } },
      then: {
        required: ["objectType", "object", "to"],
        properties: {
          objectType: { const: "Reply" },
          to: { type: "string", pattern: patterns.objectId }, // Reply 'to' = parent post ID
          object: {
            type: "object",
            required: ["type"],
            properties: {
              type: { const: "Reply" },
            },
          },
        },
      },
    },
    {
      if: { properties: { type: { const: "React" } } },
      then: {
        required: ["objectType", "object", "to"],
        properties: {
          objectType: { const: "React" },
          to: { type: "string", pattern: patterns.objectId }, // React 'to' field must be a post/page/bookmark ID
          object: {
            type: "object",
            required: ["type"],
            properties: {
              type: { const: "React" },
            },
          },
        },
      },
    },
  ],
};

export default schema;
