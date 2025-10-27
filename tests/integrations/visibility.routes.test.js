import { TestClient } from "../helpers/client.js";
import {
  seedAdminAndLogin,
  createUser,
  createGroup,
} from "../helpers/seedApi.js";

let admin, alice, bob, carol;

beforeAll(async () => {
  admin = await seedAdminAndLogin();

  // Create test users
  await createUser(admin, { username: "alice", password: "pw", name: "Alice" });
  await createUser(admin, { username: "bob", password: "pw", name: "Bob" });
  await createUser(admin, {
    username: "carol",
    password: "pw",
    name: "Carol",
  });

  alice = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
  await alice.login("alice", "pw");

  bob = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
  await bob.login("bob", "pw");

  carol = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
  await carol.login("carol", "pw");
});

describe("Posts Collection Visibility", () => {
  let publicPostId, domainPostId, circlePostId;

  beforeAll(async () => {
    // Alice creates a public post
    const publicPost = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Public Post",
        content: "Everyone can see this",
      },
      to: "@public",
    });
    publicPostId =
      publicPost.json?.object?.id ||
      publicPost.json?.item?.id ||
      publicPost.json?.id;

    // Alice creates a domain-scoped post
    const domainPost = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Domain Post",
        content: "Only kwln.org users can see this",
      },
      to: "@kwln.org",
    });
    domainPostId =
      domainPost.json?.object?.id ||
      domainPost.json?.item?.id ||
      domainPost.json?.id;

    // Alice creates a circle to share with Bob
    const circleCreate = await alice.postOutbox({
      type: "Create",
      objectType: "Circle",
      object: {
        name: "Friends",
        members: [{ id: "@alice@kwln.org" }, { id: "@bob@kwln.org" }],
      },
      to: "@alice@kwln.org",
    });
    const circleId =
      circleCreate.json?.object?.id ||
      circleCreate.json?.item?.id ||
      circleCreate.json?.id;

    // Alice creates a circle-scoped post
    const circlePost = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Circle Post",
        content: "Only circle members can see this",
      },
      to: circleId,
    });
    circlePostId =
      circlePost.json?.object?.id ||
      circlePost.json?.item?.id ||
      circlePost.json?.id;
  });

  test("Anonymous user sees only public posts", async () => {
    const anon = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    const { status, json } = await anon.request("/posts");

    expect(status).toBe(200);
    expect(json.items).toBeDefined();

    // Should see public post
    const publicPost = json.items.find((p) => p.id === publicPostId);
    expect(publicPost).toBeDefined();
    expect(publicPost.title).toBe("Public Post");

    // Should NOT see domain-scoped post
    const domainPost = json.items.find((p) => p.id === domainPostId);
    expect(domainPost).toBeUndefined();

    // Should NOT see circle-scoped post
    const circlePost = json.items.find((p) => p.id === circlePostId);
    expect(circlePost).toBeUndefined();
  });

  test("Authenticated user (Bob) sees public and domain posts", async () => {
    const { status, json } = await bob.request("/posts");

    expect(status).toBe(200);

    // Should see public post
    const publicPost = json.items.find((p) => p.id === publicPostId);
    expect(publicPost).toBeDefined();

    // Should see domain-scoped post (same domain)
    const domainPost = json.items.find((p) => p.id === domainPostId);
    expect(domainPost).toBeDefined();
    expect(domainPost.title).toBe("Domain Post");
  });

  test("Circle member (Bob) sees circle-scoped posts", async () => {
    const { status, json } = await bob.request("/posts");

    expect(status).toBe(200);

    // Should see circle-scoped post (Bob is in Alice's Friends circle)
    const circlePost = json.items.find((p) => p.id === circlePostId);
    expect(circlePost).toBeDefined();
    expect(circlePost.title).toBe("Circle Post");
  });

  test("Non-circle member (Carol) does NOT see circle-scoped posts", async () => {
    const { status, json } = await carol.request("/posts");

    expect(status).toBe(200);

    // Should see public post
    const publicPost = json.items.find((p) => p.id === publicPostId);
    expect(publicPost).toBeDefined();

    // Should see domain post
    const domainPost = json.items.find((p) => p.id === domainPostId);
    expect(domainPost).toBeDefined();

    // Should NOT see circle post (Carol is not in the circle)
    const circlePost = json.items.find((p) => p.id === circlePostId);
    expect(circlePost).toBeUndefined();
  });
});

describe("Individual Post Visibility", () => {
  let publicPostId, circlePostId;

  beforeAll(async () => {
    // Alice creates a public post
    const publicPost = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: { type: "Note", title: "Public", content: "Public content" },
      to: "@public",
    });
    publicPostId =
      publicPost.json?.object?.id ||
      publicPost.json?.item?.id ||
      publicPost.json?.id;

    // Alice creates a circle
    const circleCreate = await alice.postOutbox({
      type: "Create",
      objectType: "Circle",
      object: {
        name: "Private Circle",
        members: [{ id: "@alice@kwln.org" }],
      },
      to: "@alice@kwln.org",
    });
    const circleId =
      circleCreate.json?.object?.id ||
      circleCreate.json?.item?.id ||
      circleCreate.json?.id;

    // Alice creates a circle-scoped post
    const circlePost = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Private",
        content: "Private content",
      },
      to: circleId,
    });
    circlePostId =
      circlePost.json?.object?.id ||
      circlePost.json?.item?.id ||
      circlePost.json?.id;
  });

  test("Anonymous user can fetch public post by ID", async () => {
    const anon = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    const { status, json } = await anon.request(
      `/posts/${encodeURIComponent(publicPostId)}`
    );

    expect(status).toBe(200);
    expect(json.item).toBeDefined();
    expect(json.item.title).toBe("Public");
  });

  test("Anonymous user cannot fetch circle-scoped post by ID", async () => {
    const anon = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    const { status, json } = await anon.request(
      `/posts/${encodeURIComponent(circlePostId)}`
    );

    expect([403, 404]).toContain(status);
  });

  test("Circle member can fetch circle-scoped post by ID", async () => {
    const { status, json } = await alice.request(
      `/posts/${encodeURIComponent(circlePostId)}`
    );

    expect(status).toBe(200);
    expect(json.item).toBeDefined();
    expect(json.item.title).toBe("Private");
  });

  test("Non-circle member cannot fetch circle-scoped post by ID", async () => {
    const { status } = await bob.request(
      `/posts/${encodeURIComponent(circlePostId)}`
    );

    expect([403, 404]).toContain(status);
  });
});

describe("Groups Collection Visibility", () => {
  let publicGroupId, domainGroupId, circleGroupId;

  beforeAll(async () => {
    // Alice creates a public group
    const publicGroup = await alice.postOutbox({
      type: "Create",
      objectType: "Group",
      object: { name: "Public Group", description: "Everyone can see" },
      to: "@public",
    });
    publicGroupId =
      publicGroup.json?.object?.id ||
      publicGroup.json?.item?.id ||
      publicGroup.json?.id;

    // Alice creates a domain-scoped group
    const domainGroup = await alice.postOutbox({
      type: "Create",
      objectType: "Group",
      object: {
        name: "Domain Group",
        description: "Only kwln.org users",
      },
      to: "@kwln.org",
    });
    domainGroupId =
      domainGroup.json?.object?.id ||
      domainGroup.json?.item?.id ||
      domainGroup.json?.id;

    // Alice creates a circle
    const circleCreate = await alice.postOutbox({
      type: "Create",
      objectType: "Circle",
      object: {
        name: "Admin Circle",
        members: [{ id: "@alice@kwln.org" }],
      },
      to: "@alice@kwln.org",
    });
    const circleId =
      circleCreate.json?.object?.id ||
      circleCreate.json?.item?.id ||
      circleCreate.json?.id;

    // Alice creates a circle-scoped group
    const circleGroup = await alice.postOutbox({
      type: "Create",
      objectType: "Group",
      object: { name: "Secret Group", description: "Circle members only" },
      to: circleId,
    });
    circleGroupId =
      circleGroup.json?.object?.id ||
      circleGroup.json?.item?.id ||
      circleGroup.json?.id;
  });

  test("Anonymous user sees only public groups", async () => {
    const anon = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    const { status, json } = await anon.request("/groups");

    expect(status).toBe(200);

    // Should see public group
    const publicGroup = json.items.find((g) => g.id === publicGroupId);
    expect(publicGroup).toBeDefined();

    // Should NOT see domain-scoped group
    const domainGroup = json.items.find((g) => g.id === domainGroupId);
    expect(domainGroup).toBeUndefined();

    // Should NOT see circle-scoped group
    const circleGroup = json.items.find((g) => g.id === circleGroupId);
    expect(circleGroup).toBeUndefined();
  });

  test("Authenticated user sees public and domain groups", async () => {
    const { status, json } = await bob.request("/groups");

    expect(status).toBe(200);

    // Should see public group
    const publicGroup = json.items.find((g) => g.id === publicGroupId);
    expect(publicGroup).toBeDefined();

    // Should see domain group
    const domainGroup = json.items.find((g) => g.id === domainGroupId);
    expect(domainGroup).toBeDefined();

    // Should NOT see circle group (Bob not in circle)
    const circleGroup = json.items.find((g) => g.id === circleGroupId);
    expect(circleGroup).toBeUndefined();
  });

  test("Circle member sees circle-scoped groups", async () => {
    const { status, json } = await alice.request("/groups");

    expect(status).toBe(200);

    // Alice should see all groups including the circle-scoped one
    const circleGroup = json.items.find((g) => g.id === circleGroupId);
    expect(circleGroup).toBeDefined();
  });
});

describe("Activities Collection Visibility", () => {
  let publicActivityId, domainActivityId;

  beforeAll(async () => {
    // Alice creates a public activity
    const publicActivity = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Public Activity",
        content: "Public",
      },
      to: "@public",
    });
    publicActivityId = publicActivity.json?.id || publicActivity.json?.activity?.id;

    // Alice creates a domain-scoped activity
    const domainActivity = await alice.postOutbox({
      type: "Create",
      objectType: "Post",
      object: {
        type: "Note",
        title: "Domain Activity",
        content: "Domain",
      },
      to: "@kwln.org",
    });
    domainActivityId = domainActivity.json?.id || domainActivity.json?.activity?.id;
  });

  test("Anonymous user sees only public activities", async () => {
    const anon = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    const { status, json } = await anon.request("/activities");

    expect(status).toBe(200);

    if (publicActivityId) {
      const publicActivity = json.items.find((a) => a.id === publicActivityId);
      expect(publicActivity).toBeDefined();
    }

    if (domainActivityId) {
      const domainActivity = json.items.find((a) => a.id === domainActivityId);
      expect(domainActivity).toBeUndefined();
    }
  });

  test("Authenticated user sees public and domain activities", async () => {
    const { status, json } = await bob.request("/activities");

    expect(status).toBe(200);

    if (publicActivityId) {
      const publicActivity = json.items.find((a) => a.id === publicActivityId);
      expect(publicActivity).toBeDefined();
    }

    if (domainActivityId) {
      const domainActivity = json.items.find((a) => a.id === domainActivityId);
      expect(domainActivity).toBeDefined();
    }
  });
});

describe("Blocked Users Filtering", () => {
  let blockedUserId, blockedPostId;

  beforeAll(async () => {
    // Create a user that Alice will block
    await createUser(admin, {
      username: "spammer",
      password: "pw",
      name: "Spammer",
    });
    blockedUserId = "@spammer@kwln.org";

    const spammer = new TestClient({ baseURL: global.__TEST_BASE_URL__ });
    await spammer.login("spammer", "pw");

    // Spammer creates a public post
    const spamPost = await spammer.postOutbox({
      type: "Create",
      objectType: "Post",
      object: { type: "Note", title: "Spam", content: "Buy now!" },
      to: "@public",
    });
    blockedPostId =
      spamPost.json?.object?.id ||
      spamPost.json?.item?.id ||
      spamPost.json?.id;

    // Alice blocks the spammer
    await alice.postOutbox({
      type: "Block",
      object: blockedUserId,
      to: "@alice@kwln.org",
    });
  });

  test("Blocked user's posts are filtered from Alice's feed", async () => {
    const { status, json } = await alice.request("/posts");

    expect(status).toBe(200);

    // Alice should NOT see the spammer's post
    const blockedPost = json.items.find((p) => p.id === blockedPostId);
    expect(blockedPost).toBeUndefined();
  });

  test("Other users can still see blocked user's posts", async () => {
    const { status, json } = await bob.request("/posts");

    expect(status).toBe(200);

    // Bob can still see the spammer's post
    const spamPost = json.items.find((p) => p.id === blockedPostId);
    expect(spamPost).toBeDefined();
  });
});
