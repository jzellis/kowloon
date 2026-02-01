// Schema definition for Mute activity type
// Mute activities hide content from specific users/groups

export default {
  mirror: 'Unmute',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor muting'
    },
    target: {
      required: true,
      type: 'string',
      description: 'User/content ID being muted'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Type being muted'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Optional mute metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Mute activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Mute activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Mute activities'
    }
  },

  federation: {
    // Mute activities never federate (local user preference only)
    checkRemote: false
  }
};
