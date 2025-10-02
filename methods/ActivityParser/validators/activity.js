const schema = {
  $id: "https://kowloon.dev/schemas/activity.json",
  // $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Kowloon Activity",
  type: "object",
  additionalProperties: false,

  properties: {
    actorId: { $ref: "#/$defs/ActorId" },
    type: { $ref: "#/$defs/ActivityType" },

    to: { type: "string", default: "" },
    replyTo: { type: "string", default: "" },
    reactTo: { type: "string", default: "" },

    target: { $ref: "#/$defs/KowloonId" },

    object: {
      oneOf: [
        { type: "string", $ref: "#/$defs/KowloonId" },
        { $ref: "#/$defs/ObjectEntity" },
      ],
    },

    objectType: {
      type: "string",
    } /* Only required/used when object is an object (see conditionals) */,
  },

  required: ["actorId", "type", "to", "replyTo", "reactTo"],

  allOf: [
    /* 1) OBJECT FORM REQUIREMENTS BY ACTIVITY TYPE */
    {
      if: {
        properties: {
          type: { enum: ["Create", "Update", "Reply", "React", "Flag"] },
        },
        required: ["type"],
      },
      then: {
        properties: {
          object: { $ref: "#/$defs/ObjectEntity" },
          objectType: { type: "string" },
        },
        required: ["object", "objectType"],
      },
    },

    /* 2) STRING FORM REQUIREMENTS BY ACTIVITY TYPE */
    {
      if: {
        properties: {
          type: {
            enum: [
              "Delete",
              "Follow",
              "Unfollow",
              "Block",
              "Mute",
              "Join",
              "Leave",
              "Invite",
              "Accept",
              "Reject",
              "Add",
              "Remove",
              "Undo",
            ],
          },
        },
        required: ["type"],
      },
      then: {
        properties: {
          object: { type: "string", $ref: "#/$defs/KowloonId" },
        },
        required: ["object"],
      },
    },

    /* 3) TARGET REQUIRED FOR MANY TYPES (EXCEPT Follow/Unfollow where it's optional) */
    {
      if: {
        properties: {
          type: {
            enum: [
              "Update",
              "Delete",
              "Reply",
              "React",
              "Block",
              "Mute",
              "Join",
              "Leave",
              "Invite",
              "Accept",
              "Reject",
              "Add",
              "Remove",
              "Flag",
              "Undo",
            ],
          },
        },
        required: ["type"],
      },
      then: { required: ["target"] },
    },

    /* 4) SPECIAL CASE: Create + (Bookmark|Reply) => target required */
    {
      if: {
        allOf: [
          { properties: { type: { const: "Create" } }, required: ["type"] },
          {
            properties: { objectType: { enum: ["Bookmark", "Reply"] } },
            required: ["objectType"],
          },
        ],
      },
      then: { required: ["target"] },
    },
  ],

  $defs: {
    ActivityType: {
      type: "string",
      enum: [
        "Create",
        "Update",
        "Delete",
        "Reply",
        "React",
        "Follow",
        "Unfollow",
        "Block",
        "Mute",
        "Join",
        "Leave",
        "Invite",
        "Accept",
        "Reject",
        "Add",
        "Remove",
        "Flag",
        "Undo",
      ],
    },

    /* A Kowloon ID is either:
         1) thinglike:   <lowercase-type>:<dbid>@<domain>
         2) user handle: @<username>@<domain>
       */
    KowloonId: {
      type: "string",
      anyOf: [
        { pattern: "^[a-z]+:[A-Za-z0-9_-]+@[a-z0-9.-]+$" },
        { pattern: "^@[A-Za-z0-9._-]+@[a-z0-9.-]+$" },
      ],
    },

    /* actorId is typically a user-like ID (handle), but allow full KowloonId to cover service actors */
    ActorId: {
      type: "string",
      anyOf: [
        { pattern: "^@[A-Za-z0-9._-]+@[a-z0-9.-]+$" },
        { pattern: "^[a-z]+:[A-Za-z0-9_-]+@[a-z0-9.-]+$" },
      ],
    },

    /* Object when embedded as an object (not a string ID) */
    ObjectEntity: {
      type: "object",
      additionalProperties: true,
      properties: {
        type: {
          type: "string",
          enum: [
            "Bookmark",
            "Event",
            "Article",
            "Group",
            "Page",
            "React",
            "Person",
          ],
          default: "Article",
        },
        objectType: { type: "string" },

        actorId: { $ref: "#/$defs/ActorId" },

        to: { type: "string", default: "" },
        replyTo: { type: "string", default: "" },
        reactTo: { type: "string", default: "" },
      },
      required: [],

      allOf: [
        /* If objectType is present but type is missing, we can't make a conditional default in pure JSON Schema.
             You can normalize in code using the mapping:
               Bookmarks->Bookmark, Event->Event, Post->Article, Group->Group, Page->Page, React->React, User->Person
          */
        {
          if: { required: ["objectType"] },
          then: { properties: { objectType: { type: "string" } } },
        },
      ],
    },
  },
};

export default schema;
