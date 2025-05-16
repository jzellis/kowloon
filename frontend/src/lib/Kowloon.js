const validateActivity = function (activity, schema = activitySchema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = activity[field];

    // Handle optional fields
    if (value === undefined || value === null) {
      if (!rules.optional) {
        errors.push(`${field} is missing`);
      }
      continue;
    }

    // If nested schema
    if (rules.type === "object" && rules.schema) {
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${field} should be an object`);
      } else {
        const nestedResult = validateActivity(value, rules.schema);
        nestedResult.errors.forEach((err) => {
          errors.push(`${field}.${err}`);
        });
      }
      continue;
    }

    // Handle arrays
    if (rules.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`${field} should be an array`);
      }
      continue;
    }

    // Handle fields that can be either string OR object
    if (rules.type === "objectOrString") {
      if (
        !(
          (typeof value === "object" && !Array.isArray(value)) ||
          typeof value === "string"
        )
      ) {
        errors.push(`${field} should be either an object or a string`);
      }
      continue;
    }

    // Basic type checking
    if (typeof value !== rules.type) {
      errors.push(`${field} should be a ${rules.type}`);
      continue;
    }

    // Custom validator function (optional)
    if (rules.validate && !rules.validate(value)) {
      errors.push(`${field} failed custom validation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const activitySchema = {
  type: { type: "string" },
  actorId: { type: "string" },
  objectType: { type: "string" },
  object: {
    type: "objectOrString",
  },
  target: { type: "string", optional: true },
  to: { type: "string", optional: true },
  replyTo: { type: "string", optional: true },
  reactTo: { type: "string", optional: true },
  summary: { type: "string", optional: true },
};

class KowloonClient {
  constructor(config = {}) {
    this.server = config.server || "https://kowloon.social";
    this.settings = config.settings || {};
    if (config.user) localStorage.setItem("user", JSON.stringify(config.user));
    if (config.timestamp) localStorage.setItem("timestamp", config.timestamp);
    if (config.signature) localStorage.setItem("signature"), signature;
    this.user = config.user || JSON.parse(localStorage.getItem("user")) || null;
    this.timestamp =
      config.timestamp ||
      localStorage.getItem("timestamp") ||
      new Date().toISOString();
    this.signature =
      config.signature || localStorage.getItem("signature") || null;
    this.pages =
      config.pages || JSON.parse(localStorage.getItem("pages")) || null;
  }

  retrieve = async function (endpoint, { method = "GET", params, body }) {
    let url = new URL(this.server + endpoint);
    if (params && method === "GET") {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (this.timestamp) options.headers["Kowloon-Timestamp"] = this.timestamp;
    if (this.signature) options.headers["Kowloon-Signature"] = this.signature;
    if (this.user) options.headers["Kowloon-Id"] = this.user.id;
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  };

  login = async function (username, password) {
    let loginReq = await this.retrieve(`/login`, {
      method: "POST",
      body: {
        username,
        password,
      },
    });
    this.user = loginReq.user || null;
    this.timestamp = loginReq.timestamp || null;
    this.signature = loginReq.signature || null;
    localStorage.setItem("user", JSON.stringify(this.user));
    localStorage.setItem("timestamp", this.timestamp);
    localStorage.setItem("signature", this.signature);
    return loginReq;
  };

  logout = async function () {
    this.user = null;
    this.timestamp = null;
    this.signature = null;
    localStorage.removeItem("user");
    localStorage.removeItem("timestamp");
    localStorage.removeItem("signature");
  };

  getServer = async function (url) {
    let res = await this.retrieve("", { method: "GET" });
    localStorage.setItem("pages", JSON.stringify(res.pages));
    localStorage.setItem("server", res.server);

    return res;
  };

  createActivity = async function (activity) {
    let createdActivity = activity;
    createdActivity.actorId = this.user.id;
    // if (typeof createdActivity.object === "object") {
    //   createdActivity.object.actorId =
    //     createdActivity.object.actorId || this.user.id;
    // }
    let isValid = validateActivity(createdActivity);
    if (isValid.valid) {
      let created = await this.retrieve("/outbox", {
        method: "POST",
        body: { activity: createdActivity },
      });
      console.log(created);
    } else {
      return { errors: isValid.errors };
    }
  };
  getActivities = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve("/activities", { params: page, sort });
  };
  getActivity = async function (id) {
    if (id) return await this.retrieve(`/activities/${id}`, {});
  };
  getBookmarks = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve("/bookmarks", { params: page, sort });
  };
  getBookmark = async function (id) {
    return await this.retrieve(`/bookmarks/${id}`, {});
  };
  getCircles = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve(`/circles`, { params: page, sort });
  };
  getCircle = async function (id) {
    return await this.retrieve(`/circles/${id}`, {});
  };
  getCircleMembers = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/circles/${id}/members`, {
      params: page,
      sort,
    });
  };
  getFiles = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve("/files", { params: page, sort });
  };
  getFile = async function (id) {
    return await this.retrieve(`/files/${id}`);
  };
  getGroups = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve("/groups", { params: page, sort });
  };
  getGroup = async function (id) {
    return await this.retrieve(`/groups/${id}`, {});
  };
  getGroupPosts = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/groups/${id}/posts`, { params: page, sort });
  };
  getGroupBookmarks = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/groups/${id}/bookmarks`, {
      params: page,
      sort,
    });
  };

  getGroupMembers = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/groups/${id}/members`, { params: page, sort });
  };

  getGroupPosts = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/groups/${id}/posts`, { params: page, sort });
  };

  getPage = async function (id) {
    return await this.retrieve(`/pages/${id}`, {});
  };
  getPosts = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve(`/posts/`, { params: page, sort });
  };
  getPost = async function (id) {
    return await this.retrieve(`/posts/${id}`, {});
  };
  getPostReplies = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/posts/${id}/replies`, { params: page, sort });
  };
  getPostReacts = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/posts/${id}/reacts`, { params: page, sort });
  };
  getReact = async function (id) {
    return await this.retrieve(`/reacts/${id}`);
  };
  getReply = async function (id) {
    return await this.retrieve(`/replies/${id}`);
  };
  getUsers = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve(`/users/`, { params: page, sort });
  };
  getUser = async function (id) {
    return await this.retrieve(`/users/${id}`, {});
  };
  getUserActivities = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/activities`, {
      params: page,
      sort,
    });
  };
  getUserBookmarks = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/bookmarks`, {
      params: page,
      sort,
    });
  };
  getUserCircles = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/circles`, { params: page, sort });
  };
  getUserPosts = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/posts`, { params: page, sort });
  };
  getUserInbox = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/inbox`, { params: page, sort });
  };
  getUserOutbox = async function (
    id,
    filter = {},
    page = 1,
    sort = "createdAt"
  ) {
    return await this.retrieve(`/users/${id}/outbox`, { params: page, sort });
  };
  getCommunityFeed = async function ({
    filter = {},
    page = 1,
    sort = "createdAt",
  }) {
    return await this.retrieve(`/outbox`, { params: page, sort });
  };

  getTimeline = async function (filter = {}, page = 1, sort = "createdAt") {
    return await this.retrieve(`/users/${this.user.id}/timeline`, {
      params: page,
      sort,
    });
  };

  getLinkPreview = async function (url) {
    return await this.retrieve(`/utils/preview?url=${url}`, {});
  };
}

const defaultClient = new KowloonClient();

export { KowloonClient };
export default defaultClient;
