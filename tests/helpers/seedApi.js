import { TestClient } from "./client.mjs";

export async function seedAdminAndLogin() {
  const baseURL = global.__TEST_BASE_URL__;
  const client = new TestClient({ baseURL });

  // Create admin via direct model or via a bootstrap endpoint.
  // If you already have an init path that creates an admin, call login here:
  const username = "admin";
  const password = "adminpass";

  // Try login; if fails, create via outbox "Create Person"
  let loginOk = false;
  try {
    await client.login(username, password);
    loginOk = true;
  } catch (e) {
    /* fall through to create */
  }

  if (!loginOk) {
    // Create user via Activity (your ActivityParser should create the user)
    await client.postOutbox({
      type: "Create",
      objectType: "Person",
      object: {
        username,
        password,
        profile: { name: "Admin" },
      },
      to: "@kwln.org",
    });
    await client.login(username, password);
  }

  return client;
}

export async function createUser(
  client,
  { username, password = "pw", name = username }
) {
  const { status, json } = await client.postOutbox({
    type: "Create",
    objectType: "Person",
    object: { username, password, profile: { name } },
    to: "@kwln.org",
  });
  if (status !== 200 && status !== 201)
    throw new Error("createUser failed " + status + " " + JSON.stringify(json));
  return json;
}

export async function createGroup(client, { name, description }) {
  const { status, json } = await client.postOutbox({
    type: "Create",
    objectType: "Group",
    object: { name, description },
    to: "@public",
  });
  if (status !== 200 && status !== 201)
    throw new Error(
      "createGroup failed " + status + " " + JSON.stringify(json)
    );
  return json; // should include group id in activity/object
}

/** Ensure membership via Activity (member → then optional role) */
export async function addMemberToGroup(client, { userId, groupId }) {
  // Assuming your ActivityParser supports Add to the group's members circle.
  // If your outbox handler expects "target" to be the circle id, get it via /groups/:id first.
  const meta = await (
    await fetch(client.baseURL + `/groups/${encodeURIComponent(groupId)}`)
  ).json();
  // meta doesn't include circle ids (by design), so in tests you can allow a test-only flag
  // OR call a minimal internal endpoint. If not available, you can post a Join activity to the Group id:
  const res = await client.postOutbox({
    type: "Join",
    objectType: "Group",
    object: { id: groupId },
    actor: { id: userId },
    to: groupId, // group-gated
  });
  if (res.status >= 300)
    throw new Error(
      "addMember failed " + res.status + " " + JSON.stringify(res.json)
    );
}
