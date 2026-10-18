import { generateHref } from "#methods/notifications/create.js";

process.env.DOMAIN = "kwln.org";

describe("notification links", () => {
  test("generates an HTTPS post URL", () => {
    expect(generateHref("react", "post:abc123@kwln.org", "Post")).toBe(
      "https://kwln.org/posts/abc123"
    );
  });

  test("generates an HTTPS URL for each supported object type", () => {
    expect(generateHref("join_request", "group:g1@kwln.org", "Group")).toBe(
      "https://kwln.org/groups/g1"
    );
    expect(generateHref("mention", "page:p1@kwln.org", "Page")).toBe(
      "https://kwln.org/pages/p1"
    );
  });

  test("returns the server URL when no object is attached", () => {
    expect(generateHref("follow", null, null)).toBe("https://kwln.org");
  });
});
