// Schema definition for Reply activity type
// Reply is its own model (NOT a Post subtype) with a `target` field.

export default {
  mirror: 'Delete',

  fields: {
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor replying'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Must be "Reply"'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The reply object (content in object.content or object.source.content)'
    },
    to: {
      required: true,
      type: 'string',
      description: 'ID of the parent post being replied to'
    }
  },

  federation: {
    checkRemote: 'to'
  }
};
