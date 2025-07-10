const axios = require("axios");
const { BASE_URL, AUTH_TOKEN } = require("./config");

const testCases = [
  "/activities",
  "/posts",
  "/users",
  "/groups",
  "/bookmarks",
  "/circles",
  "/events",
];

function hasVisibilityFlags(item) {
  return (
    item.hasOwnProperty("canShare") &&
    item.hasOwnProperty("canReply") &&
    item.hasOwnProperty("canReact")
  );
}

describe("Kowloon API Endpoint Coverage Tests", () => {
  testCases.forEach((path) => {
    const fullUrl = `${BASE_URL}${path}`;

    test(`GET ${path} without auth returns valid response`, async () => {
      const res = await axios.get(fullUrl).catch((err) => err.response);
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
      expect(res.data).toHaveProperty("data");

      const items = res.data.data.items || [];
      expect(Array.isArray(items)).toBe(true);

      if (items.length > 0) {
        expect(items.every(hasVisibilityFlags)).toBe(true);
      }
    });

    test(`GET ${path} with auth returns valid response`, async () => {
      const res = await axios
        .get(fullUrl, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        })
        .catch((err) => err.response);

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
      expect(res.data).toHaveProperty("data");

      const items = res.data.data.items || [];
      expect(Array.isArray(items)).toBe(true);

      if (items.length > 0) {
        expect(items.every(hasVisibilityFlags)).toBe(true);
      }
    });
  });
});
