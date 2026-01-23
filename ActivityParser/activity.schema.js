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
  ],
};

const replyReactRecipient = {
  anyOf: [
    { type: "string", pattern: "^$" },
    { type: "string", pattern: patterns.publicToken },
    { type: "string", pattern: patterns.serverHandle },
    { type: "string", pattern: patterns.circleId },
    { type: "string", pattern: patterns.groupId },
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
        "Accept",
        "Add",
        "Block",
        "Create",
        "Delete",
        "Flag",
        "Follow",
        "Invite",
        "Join",
        "Leave",
        "Mute",
        "React",
        "Reject",
        "Remove",
        "Reply",
        "Undo",
        "Unfollow",
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
    to: toRecipient,
    canReply: replyReactRecipient,
    canReact: replyReactRecipient,
  },
  allOf: [
    {
      if: { properties: { type: { const: "Create" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
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
        required: ["objectType", "object"],
        properties: {
          objectType: { const: "Post" },
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
  ],
};

export default schema;
