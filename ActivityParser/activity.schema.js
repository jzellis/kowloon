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
  objectId: `^(circle|group|post|page|bookmark):${idPart}@[a-z0-9.-]+$`,
};

const toRecipient = {
  anyOf: [
    { type: "string", pattern: "^$" },
    { type: "string", pattern: patterns.publicToken },
    { type: "string", pattern: patterns.serverHandle },
    { type: "string", pattern: patterns.circleId },
    { type: "string", pattern: patterns.groupId },
    { type: "string", pattern: patterns.actorId }, // Allow user IDs (validated by handler to be self-addressed)
  ],
};

const replyReactRecipient = {
  anyOf: [
    { type: "string", pattern: "^$" },
    { type: "string", pattern: patterns.publicToken },
    { type: "string", pattern: patterns.serverHandle },
    { type: "string", pattern: patterns.circleId },
    { type: "string", pattern: patterns.groupId },
    { type: "string", pattern: patterns.actorId }, // Allow user IDs (validated by handler to be self-addressed)
    { type: "string", pattern: patterns.postId }, // Allow post IDs for Reply/React targets
    { type: "string", pattern: patterns.pageId }, // Allow page IDs for Reply/React targets
    { type: "string", pattern: patterns.bookmarkId }, // Allow bookmark IDs for Reply/React targets
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
        "Add",
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
        "Undo",
        "Unfollow",
        "Unmute",
        "Update",
      ],
    },
    actorId: { type: "string", pattern: patterns.actorId },
    objectType: {
      type: "string",
      enum: [
        "Bookmark",
        "Circle",
        "Group",
        "Page",
        "Post",
        "React",
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
            not: { required: ["id"] },
          },
        },
      },
    },
    {
      if: { properties: { type: { const: "Reply" } } },
      then: {
        required: ["objectType", "object", "to"],
        properties: {
          objectType: { const: "Post" },
          to: { type: "string", pattern: patterns.objectId }, // Reply 'to' field must be a post/page/bookmark ID
          object: {
            type: "object",
            required: ["type", "inReplyTo"],
            properties: {
              type: { const: "Reply" },
              inReplyTo: { type: "string", pattern: patterns.objectId },
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
