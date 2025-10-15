import { TestClient } from "../helpers/client.mjs";
import {
  seedAdminAndLogin,
  createUser,
  createGroup,
  addMemberToGroup,
} from "../helpers/seedApi.mjs";

let admin;

beforeAll(async () => {
  admin = await seedAdminAndLogin();
});

test("members-only roster is enforced", async () => {
  // Create a user and a group
  await createUser(admin, { username: "alice", password: "pw", name: "Alice" });
  await createUser(admin, { username: "bob", password: "pw", name: "Bob" });

  const groupCreate = await createGroup(admin, {
    name: "Test Group",
    description: "hello",
  });

  // Extract the group id (from your Create response)
  // If your outbox returns the created object, adapt accordingly:
  const groupId =
    groupCreate?.object?.id || groupCreate?.item?.id || groupCreate?.id;

  // Login as Alice
  const alice = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
  await alice.login("alice", "pw");

  // Alice is NOT yet a member; members list should be forbidden
  {
    const { status } = await alice.request(
      `/groups/${encodeURIComponent(groupId)}/members`
    );
    expect([403, 404]).toContain(status); // 403 if group visible, 404 if not
  }

  // Add Alice as a member via Activity
  await addMemberToGroup(admin, { userId: "@alice@kwln.org", groupId });

  // Now Alice can view members
  {
    const { status, json } = await alice.request(
      `/groups/${encodeURIComponent(groupId)}/members`
    );
    expect(status).toBe(200);
    expect(json.items?.some((m) => m.id === "@alice@kwln.org")).toBe(true);
  }

  // Bob (non-member) still forbidden
  const bob = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
  await bob.login("bob", "pw");
  {
    const { status } = await bob.request(
      `/groups/${encodeURIComponent(groupId)}/members`
    );
    expect([403, 404]).toContain(status);
  }
});
