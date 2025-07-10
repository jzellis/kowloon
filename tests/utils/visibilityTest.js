const axios = require("axios");
const { BASE_URL, AUTH_TOKEN } = require("../config");

async function getJson(path, auth = false) {
  try {
    const res = await axios.get(`${BASE_URL}${path}`, {
      headers: auth ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {},
    });
    return res.data;
  } catch (err) {
    return { error: err.response?.status || 500 };
  }
}

function visibilityTest({
  path,
  label,
  getItems = (data) => data?.data?.items || [],
}) {
  describe(`Transformed visibility test for ${label || path}`, () => {
    let unauthItems = [],
      authItems = [];

    beforeAll(async () => {
      const unauthData = await getJson(path, false);
      const authData = await getJson(path, true);

      unauthItems = getItems(unauthData);
      authItems = getItems(authData);
    });

    test("unauth and auth requests both return valid item arrays", () => {
      expect(Array.isArray(unauthItems)).toBe(true);
      expect(Array.isArray(authItems)).toBe(true);
    });

    test("authenticated response includes more or same number of items", () => {
      expect(authItems.length).toBeGreaterThanOrEqual(unauthItems.length);
    });

    test("all items include canShare, canReply, and canReact fields", () => {
      const hasFlags = (item) =>
        item.hasOwnProperty("canShare") &&
        item.hasOwnProperty("canReply") &&
        item.hasOwnProperty("canReact");

      expect(unauthItems.every(hasFlags)).toBe(true);
      expect(authItems.every(hasFlags)).toBe(true);
    });

    test("authenticated response contains at least one item not visible unauthenticated", () => {
      const unauthIds = new Set(unauthItems.map((i) => i.id));
      const extra = authItems.find((i) => !unauthIds.has(i.id));
      expect(extra).toBeDefined();
    });
  });
}

module.exports = { visibilityTest };
