// Schema definition for Invite activity type
// Invite activities invite users to groups

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor sending the invitation'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Group ID where user is being invited'
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
      description: 'Optional - may contain user ID being invited'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Invite activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Invite activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Invite activities'
    }
  },

  federation: {
    // Federate if the target group is on a remote server
    checkRemote: 'target'
  }
};
