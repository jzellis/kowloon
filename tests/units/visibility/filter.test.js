import { buildVisibilityQuery } from "#methods/visibility/filter.js";

describe("buildVisibilityQuery", () => {
  const ctxAnonymous = {
    isAuthenticated: false,
    viewerId: null,
    viewerDomain: null,
    circleIds: new Set(),
    groupIds: new Set(),
    blockedActorIds: new Set(),
  };

  const ctxAlice = {
    isAuthenticated: true,
    viewerId: "@alice@kwln.org",
    viewerDomain: "kwln.org",
    circleIds: new Set(["circle:c1@kwln.org", "circle:c2@kwln.org"]),
    groupIds: new Set(["group:g1@kwln.org"]),
    blockedActorIds: new Set(["@blocked@kwln.org", "@spammer@kwln.org"]),
  };

  const ctxBob = {
    isAuthenticated: true,
    viewerId: "@bob@kwln.social",
    viewerDomain: "kwln.social",
    circleIds: new Set(),
    groupIds: new Set(),
    blockedActorIds: new Set(),
  };

  describe("Anonymous user filter", () => {
    test("returns only @public filter", () => {
      const filter = buildVisibilityQuery(ctxAnonymous);

      expect(filter.deletedAt).toBe(null);
      expect(filter.to).toBe("@public");
      expect(filter.$or).toBeUndefined();
    });

    test("handles null context", () => {
      const filter = buildVisibilityQuery(null);

      expect(filter.deletedAt).toBe(null);
      expect(filter.to).toBe("@public");
    });

    test("handles undefined context", () => {
      const filter = buildVisibilityQuery(undefined);

      expect(filter.deletedAt).toBe(null);
      expect(filter.to).toBe("@public");
    });
  });

  describe("Authenticated user filter", () => {
    test("includes own content", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.$or).toBeDefined();
      expect(filter.$or).toContainEqual({ actorId: "@alice@kwln.org" });
    });

    test("includes @public content", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.$or).toContainEqual({ to: "@public" });
    });

    test("includes domain-scoped content", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.$or).toContainEqual({ to: "@kwln.org" });
    });

    test("includes circle-scoped content", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      const circleFilter = filter.$or.find(
        (clause) => clause.to?.$in && clause.to.$in.includes("circle:c1@kwln.org")
      );
      expect(circleFilter).toBeDefined();
      expect(circleFilter.to.$in).toContain("circle:c1@kwln.org");
      expect(circleFilter.to.$in).toContain("circle:c2@kwln.org");
    });

    test("includes group-scoped content", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      const groupFilter = filter.$or.find(
        (clause) => clause.to?.$in && clause.to.$in.includes("group:g1@kwln.org")
      );
      expect(groupFilter).toBeDefined();
      expect(groupFilter.to.$in).toContain("group:g1@kwln.org");
    });

    test("filters out blocked actors", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.actorId).toBeDefined();
      expect(filter.actorId.$nin).toBeDefined();
      expect(filter.actorId.$nin).toContain("@blocked@kwln.org");
      expect(filter.actorId.$nin).toContain("@spammer@kwln.org");
    });

    test("does not filter out own content from blocked list", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.actorId.$nin).not.toContain("@alice@kwln.org");
    });

    test("always includes deletedAt: null", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      expect(filter.deletedAt).toBe(null);
    });
  });

  describe("User with no circles/groups", () => {
    test("does not include circle filter when user has no circles", () => {
      const filter = buildVisibilityQuery(ctxBob);

      const circleFilter = filter.$or.find(
        (clause) => clause.to?.$in && clause.to.$in.some((id) => id.startsWith("circle:"))
      );
      expect(circleFilter).toBeUndefined();
    });

    test("does not include group filter when user has no groups", () => {
      const filter = buildVisibilityQuery(ctxBob);

      const groupFilter = filter.$or.find(
        (clause) => clause.to?.$in && clause.to.$in.some((id) => id.startsWith("group:"))
      );
      expect(groupFilter).toBeUndefined();
    });

    test("still includes own content, @public, and domain", () => {
      const filter = buildVisibilityQuery(ctxBob);

      expect(filter.$or).toContainEqual({ actorId: "@bob@kwln.social" });
      expect(filter.$or).toContainEqual({ to: "@public" });
      expect(filter.$or).toContainEqual({ to: "@kwln.social" });
    });
  });

  describe("User with no blocked actors", () => {
    test("does not include actorId filter when no blocked users", () => {
      const filter = buildVisibilityQuery(ctxBob);

      expect(filter.actorId).toBeUndefined();
    });
  });

  describe("Legacy @server support", () => {
    test("includes legacy @server pattern for backwards compatibility", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      const serverFilter = filter.$or.find(
        (clause) => clause.to === "@server"
      );
      expect(serverFilter).toBeDefined();
      expect(serverFilter.actorId).toBeDefined();
      expect(serverFilter.actorId.constructor.name).toBe("RegExp");
    });
  });

  describe("Filter structure", () => {
    test("creates valid MongoDB query structure", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      // Should have top-level fields
      expect(filter).toHaveProperty("deletedAt");
      expect(filter).toHaveProperty("$or");

      // $or should be an array
      expect(Array.isArray(filter.$or)).toBe(true);

      // $or should have multiple clauses
      expect(filter.$or.length).toBeGreaterThan(0);
    });

    test("all $or clauses are objects", () => {
      const filter = buildVisibilityQuery(ctxAlice);

      filter.$or.forEach((clause) => {
        expect(typeof clause).toBe("object");
        expect(clause).not.toBe(null);
      });
    });
  });

  describe("Edge cases", () => {
    test("handles user with empty blockedActorIds set", () => {
      const ctx = {
        ...ctxAlice,
        blockedActorIds: new Set(),
      };
      const filter = buildVisibilityQuery(ctx);

      expect(filter.actorId).toBeUndefined();
    });

    test("handles user with single circle", () => {
      const ctx = {
        ...ctxAlice,
        circleIds: new Set(["circle:solo@kwln.org"]),
      };
      const filter = buildVisibilityQuery(ctx);

      const circleFilter = filter.$or.find(
        (clause) => clause.to?.$in && clause.to.$in.includes("circle:solo@kwln.org")
      );
      expect(circleFilter).toBeDefined();
    });

    test("handles user blocking self (should be filtered from blocklist)", () => {
      const ctx = {
        ...ctxAlice,
        blockedActorIds: new Set(["@alice@kwln.org", "@other@kwln.org"]),
      };
      const filter = buildVisibilityQuery(ctx);

      // Self should be removed from blocklist
      expect(filter.actorId.$nin).not.toContain("@alice@kwln.org");
      expect(filter.actorId.$nin).toContain("@other@kwln.org");
    });
  });
});
