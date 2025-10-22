// /ActivitySchema/activity.schema.js
// ESM export of the JSON Schema used by AJV to validate Activity envelopes.

const idPart = "[^@\\s]+"; // a loose id fragment (uuid-ish) up to '@'
const domPart = "[a-z0-9.-]+"; // loose domain (accepts localhost + dev hosts)

// ---------- Common ID patterns ----------
const patterns = {
  actorId: `^@[^@\\s]+@${domPart}$`, // @user@domain
  serverHandle: `^@${domPart}$`, // @domain
  publicToken: "^@public$", // @public
  circleId: `^circle:${idPart}@${domPart}$`,
  groupId: `^group:${idPart}@${domPart}$`,
  eventId: `^event:${idPart}@${domPart}$`,
  postId: `^post:${idPart}@${domPart}$`,
  pageId: `^page:${idPart}@${domPart}$`,
  bookmarkId: `^bookmark:${idPart}@${domPart}$`,
  reactId: `^react:${idPart}@${domPart}$`,
  fileId: `^file:${idPart}@${domPart}$`,
  anyObjectId:
    `^(?:` +
    `post:${idPart}@${domPart}|` +
    `page:${idPart}@${domPart}|` +
    `bookmark:${idPart}@${domPart}|` +
    `event:${idPart}@${domPart}|` +
    `group:${idPart}@${domPart}|` +
    `react:${idPart}@${domPart}|` +
    `file:${idPart}@${domPart}` +
    `)$`,
};

// ---------- Reusable subschemas ----------
const defs = {
  actorId: { type: "string", pattern: patterns.actorId },
  serverHandle: { type: "string", pattern: patterns.serverHandle },
  userId: { type: "string", pattern: patterns.actorId },

  groupId: { type: "string", pattern: patterns.groupId },
  eventId: { type: "string", pattern: patterns.eventId },
  circleId: { type: "string", pattern: patterns.circleId },

  toRecipient: {
    anyOf: [
      { $ref: "#/$defs/publicToken" },
      { $ref: "#/$defs/serverHandle" },
      { $ref: "#/$defs/circleId" },
      { $ref: "#/$defs/groupId" },
      { $ref: "#/$defs/eventId" },
    ],
  },
  publicToken: { type: "string", pattern: patterns.publicToken },

  objectId: { type: "string", pattern: patterns.anyObjectId },
  postId: { type: "string", pattern: patterns.postId },
  pageId: { type: "string", pattern: patterns.pageId },
  bookmarkId: { type: "string", pattern: patterns.bookmarkId },
  reactId: { type: "string", pattern: patterns.reactId },
  fileId: { type: "string", pattern: patterns.fileId },

  // --- Object shapes ---

  // Post object: type is required; Reply requires inReplyTo; non-Reply must not include inReplyTo
  PostObject: {
    type: "object",
    additionalProperties: true,
    required: ["actorId", "type"],
    properties: {
      id: { $ref: "#/$defs/postId" },
      actorId: { $ref: "#/$defs/actorId" },
      type: { enum: ["Note", "Article", "Link", "Media", "Reply"] },
      inReplyTo: { $ref: "#/$defs/objectId" },
      canReply: {
        anyOf: [
          { $ref: "#/$defs/serverHandle" },
          { $ref: "#/$defs/circleId" },
          { $ref: "#/$defs/groupId" },
          { $ref: "#/$defs/eventId" },
        ],
      },
      canReact: {
        anyOf: [
          { $ref: "#/$defs/serverHandle" },
          { $ref: "#/$defs/circleId" },
          { $ref: "#/$defs/groupId" },
          { $ref: "#/$defs/eventId" },
        ],
      },
    },
    allOf: [
      {
        if: { properties: { type: { const: "Reply" } } },
        then: { required: ["inReplyTo"] },
      },
      {
        if: { properties: { type: { not: { const: "Reply" } } } },
        then: { not: { required: ["inReplyTo"] } },
      },
    ],
  },

  // Event object (minimal requireds — we validate deeper in model)
  EventObject: {
    type: "object",
    additionalProperties: true,
    required: ["actorId"],
    properties: {
      id: { $ref: "#/$defs/eventId" },
      actorId: { $ref: "#/$defs/actorId" },
      rsvpPolicy: { enum: ["invite_only", "open", "approval"] },
    },
  },

  // Group object (minimal)
  GroupObject: {
    type: "object",
    additionalProperties: true,
    required: ["actorId"],
    properties: {
      id: { $ref: "#/$defs/groupId" },
      actorId: { $ref: "#/$defs/actorId" },
      rsvpPolicy: { enum: ["invite_only", "open", "approval"] },
    },
  },

  // Bookmark/Page/User objects (minimal, permissive)
  BookmarkObject: {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { $ref: "#/$defs/bookmarkId" },
      actorId: { $ref: "#/$defs/actorId" },
    },
  },
  PageObject: {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { $ref: "#/$defs/pageId" },
      actorId: { $ref: "#/$defs/actorId" },
    },
  },
  UserObject: {
    type: "object",
    additionalProperties: true,
    // allow username-based creates; not forcing id here
    properties: {
      id: { $ref: "#/$defs/actorId" },
      actorId: { $ref: "#/$defs/actorId" },
      username: { type: "string" },
    },
  },

  // React object
  ReactObject: {
    type: "object",
    additionalProperties: true,
    required: ["react"],
    properties: {
      id: { $ref: "#/$defs/reactId" },
      react: { type: "string", minLength: 1 },
    },
  },

  // Flag object
  FlagObject: {
    type: "object",
    additionalProperties: true,
    required: ["reason"],
    properties: {
      reason: { type: "string", minLength: 1 },
      details: { type: "string" },
      evidence: { type: "array", items: { type: "string" } },
    },
  },

  // File object (for Upload)
  FileObject: {
    type: "object",
    additionalProperties: true,
    required: ["name", "mime", "size"],
    properties: {
      id: { $ref: "#/$defs/fileId" },
      name: { type: "string", minLength: 1 },
      mime: { type: "string", minLength: 3 },
      size: { type: "integer", minimum: 0 },
    },
  },
};

const schema = {
  $id: "https://kwln.org/schemas/activity.v1.json",
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
        "Upload",
      ],
    },
    objectType: { type: "string" },
    actorId: defs.actorId,
    to: defs.toRecipient,
    target: { type: "string" },
    summary: { type: "string" },
    object: {}, // verb-specific below
  },

  $defs: defs,

  allOf: [
    // ---------- Accept ----------
    {
      if: { properties: { type: { const: "Accept" } } },
      then: {
        required: ["target"],
        properties: {
          target: {
            anyOf: [{ $ref: "#/$defs/groupId" }, { $ref: "#/$defs/eventId" }],
          },
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { type: "null" },
              { type: "string", maxLength: 0 },
            ],
          },
        },
      },
    },

    // ---------- Add ----------
    {
      if: { properties: { type: { const: "Add" } } },
      then: {
        required: ["target", "object"],
        properties: {
          target: { $ref: "#/$defs/circleId" },
          object: { $ref: "#/$defs/userId" },
        },
      },
    },

    // ---------- Block ----------
    {
      if: { properties: { type: { const: "Block" } } },
      then: {
        required: ["object"],
        properties: {
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { $ref: "#/$defs/serverHandle" },
              { $ref: "#/$defs/groupId" },
            ],
          },
        },
      },
    },

    // ---------- Create ----------
    {
      if: { properties: { type: { const: "Create" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
          to: { $ref: "#/$defs/toRecipient" },
          objectType: {
            enum: ["Bookmark", "Event", "Group", "Page", "Post", "User"],
          },
          object: {
            anyOf: [
              { $ref: "#/$defs/BookmarkObject" },
              { $ref: "#/$defs/EventObject" },
              { $ref: "#/$defs/GroupObject" },
              { $ref: "#/$defs/PageObject" },
              { $ref: "#/$defs/PostObject" },
              { $ref: "#/$defs/UserObject" },
            ],
          },
        },
      },
    },

    // ---------- Delete ----------
    {
      if: { properties: { type: { const: "Delete" } } },
      then: {
        required: ["object"],
        properties: {
          object: { $ref: "#/$defs/objectId" },
        },
      },
    },

    // ---------- Flag ----------
    {
      if: { properties: { type: { const: "Flag" } } },
      then: {
        required: ["objectType", "object", "target"],
        properties: {
          objectType: { const: "Flag" },
          object: { $ref: "#/$defs/FlagObject" },
          target: {
            anyOf: [
              { $ref: "#/$defs/postId" },
              { $ref: "#/$defs/pageId" },
              { $ref: "#/$defs/bookmarkId" },
              { $ref: "#/$defs/reactId" },
              { $ref: "#/$defs/userId" },
              { $ref: "#/$defs/eventId" },
              { $ref: "#/$defs/groupId" },
            ],
          },
        },
      },
    },

    // ---------- Follow ----------
    {
      if: { properties: { type: { const: "Follow" } } },
      then: {
        required: ["object"],
        properties: {
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { $ref: "#/$defs/serverHandle" },
              { $ref: "#/$defs/groupId" },
            ],
          },
          target: {
            anyOf: [
              { $ref: "#/$defs/circleId" },
              { type: "null" },
              { type: "string", maxLength: 0 },
            ],
          },
        },
      },
    },

    // ---------- Invite ----------
    {
      if: { properties: { type: { const: "Invite" } } },
      then: {
        required: ["target", "object"],
        properties: {
          target: {
            anyOf: [{ $ref: "#/$defs/eventId" }, { $ref: "#/$defs/groupId" }],
          },
          object: { $ref: "#/$defs/userId" },
        },
      },
    },

    // ---------- Join ----------
    {
      if: { properties: { type: { const: "Join" } } },
      then: {
        required: ["target"],
        properties: {
          target: {
            anyOf: [{ $ref: "#/$defs/eventId" }, { $ref: "#/$defs/groupId" }],
          },
          object: {
            anyOf: [{ type: "null" }, { type: "string", maxLength: 0 }],
          },
        },
      },
    },

    // ---------- Leave ----------
    {
      if: { properties: { type: { const: "Leave" } } },
      then: {
        required: ["target"],
        properties: {
          target: {
            anyOf: [{ $ref: "#/$defs/eventId" }, { $ref: "#/$defs/groupId" }],
          },
        },
      },
    },

    // ---------- Mute ----------
    {
      if: { properties: { type: { const: "Mute" } } },
      then: {
        required: ["object"],
        properties: {
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { $ref: "#/$defs/serverHandle" },
            ],
          },
        },
      },
    },

    // ---------- React ----------
    {
      if: { properties: { type: { const: "React" } } },
      then: {
        required: ["objectType", "object", "target"],
        properties: {
          objectType: { const: "React" },
          object: { $ref: "#/$defs/ReactObject" },
          target: { $ref: "#/$defs/objectId" },
        },
      },
    },

    // ---------- Reject ----------
    {
      if: { properties: { type: { const: "Reject" } } },
      then: {
        required: ["target"],
        properties: {
          target: {
            anyOf: [{ $ref: "#/$defs/eventId" }, { $ref: "#/$defs/groupId" }],
          },
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { type: "null" },
              { type: "string", maxLength: 0 },
            ],
          },
        },
      },
    },

    // ---------- Remove ----------
    {
      if: { properties: { type: { const: "Remove" } } },
      then: {
        required: ["target", "object"],
        properties: {
          target: { $ref: "#/$defs/circleId" },
          object: { $ref: "#/$defs/userId" },
        },
      },
    },

    // ---------- Reply (alias of Create→Post with object.type=Reply) ----------
    {
      if: { properties: { type: { const: "Reply" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
          to: { $ref: "#/$defs/toRecipient" },
          objectType: { const: "Post" },
          object: {
            allOf: [
              { $ref: "#/$defs/PostObject" },
              {
                properties: { type: { const: "Reply" } },
                required: ["type", "inReplyTo"],
              },
            ],
          },
        },
      },
    },

    // ---------- Undo ----------
    {
      if: { properties: { type: { const: "Undo" } } },
      then: {
        required: ["object"],
        properties: {
          object: {
            anyOf: [
              { $ref: "#/$defs/objectId" },
              { type: "string", pattern: "^activity:" },
            ],
          },
        },
      },
    },

    // ---------- Unfollow ----------
    {
      if: { properties: { type: { const: "Unfollow" } } },
      then: {
        required: ["object"],
        properties: {
          object: {
            anyOf: [
              { $ref: "#/$defs/userId" },
              { $ref: "#/$defs/serverHandle" },
              { $ref: "#/$defs/groupId" },
            ],
          },
          target: {
            anyOf: [
              { $ref: "#/$defs/circleId" },
              { type: "null" },
              { type: "string", maxLength: 0 },
            ],
          },
        },
      },
    },

    // ---------- Update ----------
    {
      if: { properties: { type: { const: "Update" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
          objectType: {
            enum: ["Bookmark", "Event", "Group", "Page", "Post", "User"],
          },
          object: {
            anyOf: [
              // We only *require* id for update; shapes can carry additional props
              { allOf: [{ $ref: "#/$defs/PostObject" }, { required: ["id"] }] },
              {
                allOf: [{ $ref: "#/$defs/EventObject" }, { required: ["id"] }],
              },
              {
                allOf: [{ $ref: "#/$defs/GroupObject" }, { required: ["id"] }],
              },
              { allOf: [{ $ref: "#/$defs/PageObject" }, { required: ["id"] }] },
              {
                allOf: [
                  { $ref: "#/$defs/BookmarkObject" },
                  { required: ["id"] },
                ],
              },
              { allOf: [{ $ref: "#/$defs/UserObject" }, { required: ["id"] }] },
            ],
          },
        },
      },
    },

    // ---------- Upload (planned) ----------
    {
      if: { properties: { type: { const: "Upload" } } },
      then: {
        required: ["objectType", "object"],
        properties: {
          objectType: { const: "File" },
          object: { $ref: "#/$defs/FileObject" },
          target: {
            anyOf: [
              { $ref: "#/$defs/postId" },
              { type: "null" },
              { type: "string", maxLength: 0 },
            ],
          },
        },
      },
    },
  ],
};

export default schema;
