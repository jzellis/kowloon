// Schema definition for Upload activity type
// Upload activities handle file uploads

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor uploading'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Type of object being uploaded'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The uploaded file/media object'
    },

    // Optional fields
    target: {
      required: false,
      type: 'string',
      description: 'Optional target collection/location'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Upload activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Upload activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Upload activities'
    }
  },

  federation: {
    // Upload activities never federate (local file storage only)
    checkRemote: false
  }
};
