// Invite: invite one or more actors to Group/Event
// object = invited userId (or array if you support it); target = Group/Event id
export default async function handleInvite(activity, ctx) {
  const invitee = activity.object;
  const resId = activity.target;
  if (!invitee || !resId)
    throw new Error(
      "Invite requires object (invitee) and target (Group/Event)"
    );

  // TODO: create pending membership/invitation record(s)
  // TODO: notify invitee(s)
  return { sideEffects: ["invite"] };
}
