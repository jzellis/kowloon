import {
  canSeeObject,
  sanitizeAudience,
  canInteract,
} from "#methods/visibility/helpers.js";

const ctxKwln = {
  isAuthenticated: true,
  viewerId: "@alice@kwln.org",
  viewerDomain: "kwln.org",
  circleIds: new Set(["circle:c1@kwln.org"]),
  groupIds: new Set(["group:g1@kwln.org"]),
};

test("canSeeObject: @public", () => {
  expect(canSeeObject({ to: "@public" }, null)).toBe(true);
});

test("canSeeObject: domain token", () => {
  expect(canSeeObject({ to: "@kwln.org" }, ctxKwln)).toBe(true);
  expect(canSeeObject({ to: "@kwln.social" }, ctxKwln)).toBe(false);
});

test("canSeeObject: circle/group", () => {
  expect(canSeeObject({ to: "circle:c1@kwln.org" }, ctxKwln)).toBe(true);
  expect(canSeeObject({ to: "group:g1@kwln.org" }, ctxKwln)).toBe(true);
  expect(canSeeObject({ to: "circle:other@kwln.org" }, ctxKwln)).toBe(false);
});

test("sanitizeAudience masks circle ids", () => {
  const out = sanitizeAudience(
    { to: "circle:c1@kwln.org", actorId: "@bob@kwln.org" },
    ctxKwln
  );
  expect(out.to).toBe("@private");
  expect(out.visibility).toBe("circle");
});

test("canInteract: domain token replaces @server", () => {
  expect(canInteract("@kwln.org", "@bob@kwln.org", ctxKwln)).toBe(true);
  expect(canInteract("@kwln.social", "@bob@kwln.social", ctxKwln)).toBe(false);
});
