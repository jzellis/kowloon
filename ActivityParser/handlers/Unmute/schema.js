// Schema definition for Unmute activity type
// Unmute activities remove users from the muted list

export default {
  mirror: 'Mute',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor unmuting'
    },
    target: {
      required: true,
      type: 'string',
      description: 'User ID being unmuted'
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
      description: 'Optional unmute metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Unmute activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Unmute activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Unmute activities'
    }
  },

  federation: {
    // Unmute activities never federate (local muting only)
    checkRemote: false
  }
};
