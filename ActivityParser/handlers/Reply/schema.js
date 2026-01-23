// Schema definition for Reply activity type
// Reply activities create reply posts to existing objects

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor replying'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Type must be "Post" for replies'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The reply post object'
    },
    to: {
      required: true,
      type: 'string',
      description: 'ID of the object being replied to'
    },

    // Optional fields
    canReply: {
      required: false,
      type: 'string',
      description: 'Who can reply to this reply (defaults to "to")'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Who can react to this reply (defaults to "to")'
    },
    target: {
      required: false,
      type: 'string',
      description: 'Not used in Reply activities'
    }
  },

  federation: {
    // Federate if the object being replied to is on a remote server
    checkRemote: 'to'
  }
};
