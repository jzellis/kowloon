// /ActivityParser/handlers/utils/getFederationTargets.js
/**
 * Common helper for determining federation targets based on addressing
 * @param {Object} activity - The activity envelope
 * @param {Object} created - The created object (optional)
 * @returns {Promise<FederationRequirements>}
 */
export default async function getFederationTargets(activity, created) {
  // Prefer 'to' from created object, fall back to activity
  const to = created?.to || activity?.to;
  const actorId = created?.actorId || activity?.actorId;

  // Determine if federation is needed based on addressing
  if (to === "@public") {
    // Public posts go to all followers of the actor
    return {
      shouldFederate: true,
      scope: "followers",
      actorId,
    };
  }

  if (to?.startsWith("@") && to !== "@public") {
    // Domain-scoped: only send to that domain
    const domain = to.slice(1);
    return {
      shouldFederate: true,
      scope: "domain",
      domains: [domain],
    };
  }

  if (to?.startsWith("circle:")) {
    // Circle: send to all members of the circle
    return {
      shouldFederate: true,
      scope: "circle",
      circleId: to,
    };
  }

  if (to?.startsWith("group:")) {
    // Group: send to all members of the group
    return {
      shouldFederate: true,
      scope: "group",
      groupId: to,
    };
  }

  if (to?.startsWith("event:")) {
    // Event: send to all attendees of the event
    return {
      shouldFederate: true,
      scope: "event",
      eventId: to,
    };
  }

  // Default: no federation
  return {
    shouldFederate: false,
  };
}
