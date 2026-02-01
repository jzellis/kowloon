// Schema definition for Unfollow activity type
// Unfollow activities remove following relationships

export default {
  mirror: 'Follow',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor unfollowing'
    },
    target: {
      required: true,
      type: 'string',
      description: 'User/group ID being unfollowed'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Optional type information'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Optional unfollow metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Unfollow activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Unfollow activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Unfollow activities'
    }
  },

  federation: {
    // Unfollow activities never federate (local relationship tracking only)
    checkRemote: false
  }
};
