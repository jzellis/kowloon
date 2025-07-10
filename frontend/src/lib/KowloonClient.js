import server from "../server.json";

class KowloonClient {
  #get = async (endpoint, params = {}) => {
    if (!this.server) return { error: "No server configured" };
    let headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    endpoint = endpoint.startsWith("http")
      ? endpoint
      : `https://${this.server.domain}${
          endpoint.startsWith("/") ? endpoint : "/" + endpoint
        }?${new URLSearchParams(params)}`;

    try {
      return await (await fetch(endpoint, { method: "GET", headers })).json();
    } catch (e) {
      throw new Error(e.message);
    }
  };

  #post = async (endpoint, body) => {
    if (!this.server) return { error: "No server configured" };
    let headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    endpoint = `https://${this.server.domain}${
      endpoint.startsWith("/") ? endpoint : "/" + endpoint
    }`;

    try {
      return await (
        await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
      ).json();
    } catch (e) {
      throw new Error(e.message);
    }
  };

  constructor(config = {}) {
    if (config.user) localStorage.setItem("user", JSON.stringify(config.user));
    if (config.token) localStorage.setItem("token", config.token);
    this.server =
      config.server ||
      JSON.parse(localStorage.getItem("server")) ||
      server ||
      null;
    this.settings =
      config.settings || JSON.parse(localStorage.getItem("settings")) || null;
    this.user = config.user || JSON.parse(localStorage.getItem("user")) || null;
    this.token = config.token || localStorage.getItem("token") || null;
  }

  login = async (username, password) => {
    let body = { username, password };
    try {
      let request = await fetch(`https://${this.server.domain}/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return await request.json();
    } catch (e) {
      console.error(e);
      return { error: e.message };
    }
  };

  createActivity = async (activity) => {
    if (!this.user) return { error: "User not logged in" };
    activity.actorId = activity.actorId || this.user.id;
    activity.actor = activity.actor || {
      id: this.user.id,
      username: this.user.username,
      profile: this.user.profile,
      type: this.user.type || "Person",
      url: this.user.url,
      inbox: this.user.inbox,
      outbox: this.user.outbox,
      publicKey: this.user.publicKey,
    };
    return await this.#post("/activity", { activity });
  };

  getServer = async (params = {}) => {
    return await this.#get("", params);
  };

  getServerOutbox = async (params = {}) => {
    return await this.#get(this.server.outbox, params);
  };

  getUserInbox = async (params = {}) => {
    return await this.#get(this.user.inbox, params);
  };

  getActivities = async (params = {}) => {
    return await this.#get("/activities", params);
  };

  getActivity = async (id) => {
    return await this.#get(`/activities/${id}`);
  };

  getBookmark = async (arg) => {
    if (typeof arg === "object") return await this.#get("/bookmarks", arg);
    return await this.#get(`/bookmarks/${arg}`);
  };

  getCircles = async (params = {}) => {
    return await this.#get("/circles", params);
  };

  getCircle = async (id) => {
    return await this.#get(`/circles/${id}`);
  };

  getCircleMembers = async (id) => {
    return await this.#get(`/circles/${id}/members`);
  };

  getEvents = async (params = {}) => {
    return await this.#get("/events", params);
  };

  getEvent = async (id) => {
    return await this.#get(`/events/${id}`);
  };

  getEventMembers = async (id) => {
    return await this.#get(`/events/${id}/members`);
  };

  getGroups = async (params = {}) => {
    return await this.#get("/groups", params);
  };

  getGroup = async (id) => {
    return await this.#get(`/groups/${id}`);
  };

  getGroupMembers = async (id) => {
    return await this.#get(`/groups/${id}/members`);
  };

  getGroupPosts = async (id, params = {}) => {
    return await this.#get(`/groups/${id}/posts`, params);
  };

  getGroupEvents = async (id, params = {}) => {
    return await this.#get(`/groups/${id}/events`, params);
  };

  getPages = async (params = {}) => {
    return await this.#get("/pages", params);
  };

  getPage = async (id) => {
    return await this.#get(`/pages/${id}`);
  };

  getPosts = async (params = {}) => {
    return await this.#get("/posts", params);
  };

  getPost = async (id) => {
    return await this.#get(`/posts/${id}`);
  };

  getPostReacts = async (id, params = {}) => {
    return await this.#get(`/posts/${id}/reacts`, params);
  };

  getPostReplies = async (id, params = {}) => {
    return await this.#get(`/posts/${id}/replies`, params);
  };

  getUsers = async (params = {}) => {
    return await this.#get("/users", params);
  };

  getUser = async (id) => {
    return await this.#get(`/users/${id}`);
  };

  getUserCircles = async (id) => {
    return await this.#get(`/users/${id}/circles`);
  };

  getUserPosts = async (id, params = {}) => {
    return await this.#get(`/users/${id}/outbox`, params);
  };

  getUserEvents = async (id, params = {}) => {
    return await this.#get(`/users/${id}/events`, params);
  };
}

const Kowloon = new KowloonClient();
export default Kowloon;
export { Kowloon, KowloonClient };
