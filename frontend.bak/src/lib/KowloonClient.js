import { en } from "@faker-js/faker";
import publicKey from "../../../routes/well-known/publicKey";

class KowloonClient {
  constructor(config = {}) {
    if (config.user) localStorage.setItem("user", JSON.stringify(config.user));
    if (config.token) localStorage.setItem("token", config.token);

    this.server =
      config.server || JSON.parse(localStorage.getItem("server")) || null;
    this.settings =
      config.settings || JSON.parse(localStorage.getItem("settings")) || null;
    this.user = config.user || JSON.parse(localStorage.getItem("user")) || null;
    this.token = config.token || localStorage.getItem("token") || null;
  }

  get = async function (endpoint, { params }) {
    if (!endpoint) return { error: "Endpoint is required" };
    if (!this.server) return { error: "No server configured" };
    let headers = {
      Accepts: "application/json",
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

  post = async function (endpoint, { body }) {
    if (!endpoint) return { error: "Endpoint is required" };

    if (!body) return { error: "No body provided" };
    if (!this.server) return { error: "No server configured" };
    let headers = {
      Accepts: "application/json",
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

  login = async function (username, password) {
    let body = { username, password };
    try {
      let response = await fetch(`https://${this.server.domain}/login`, {
        method: "POST",
        headers: { Accepts: "application/json" },
        body: JSON.stringify(body),
      });
      let { user, token } = await response.json();
      localStorage.setItem("user", JSON.stringify(config.user));
      localStorage.setItem("token", token);
      this.user = user;
      this.token = token;
      return { user, token };
    } catch (e) {
      throw new Error(e.message);
    }
  };

  createActivity = async function (activity) {
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
    try {
      let response = await this.post("/activity", { body: { activity } });
      if (response.error) {
        return { error: response.error };
      }
    } catch (e) {
      return { error: e.message };
    }
  };

  getServerOutbox = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = this.server.outbox;
    return await this.get(url, { params });
  };

  getUserInbox = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    if (!this.user) return { error: "User not logged in" };
    let url = this.user.inbox;
    return await this.get(url, { params });
  };

  getUserInbox = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    if (!this.user) return { error: "User not logged in" };
    let url = this.user.inbox;
    return await this.get(url, { params });
  };

  getActivities = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/activities";
    return await this.get(url, { params });
  };

  getActivity = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/activities/${id}`;
    return await this.get(url);
  };

  getBookmark = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/bookmarks";
    return await this.get(url, { params });
  };

  getBookmark = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/bookmarks/${id}`;
    return await this.get(url);
  };

  getCircles = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/circles";
    return await this.get(url, { params });
  };

  getCircle = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/circles/${id}`;
    return await this.get(url);
  };

  getCircleMembers = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/circles/${id}/members`;
    return await this.get(url);
  };

  getEvents = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/events";
    return await this.get(url, { params });
  };

  getEvent = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/events/${id}`;
    return await this.get(url);
  };

  getEventMembers = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/events/${id}/members`;
    return await this.get(url);
  };

  getGroups = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/groups";
    return await this.get(url, { params });
  };

  getGroup = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/groups/${id}`;
    return await this.get(url);
  };

  getGroupMembers = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/groups/${id}/members`;
    return await this.get(url);
  };

  getGroupPosts = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/groups/${id}/posts`;
    return await this.get(url, { params });
  };

  getGroupEvents = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/groups/${id}/events`;
    return await this.get(url, { params });
  };
  getPages = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/pages";
    return await this.get(url, { params });
  };

  getPage = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/pages/${id}`;
    return await this.get(url);
  };

  getPosts = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/posts";
    return await this.get(url, { params });
  };

  getPost = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/posts/${id}`;
    return await this.get(url);
  };

  getPostReacts = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/posts/${id}/reacts`;
    return await this.get(url, { params });
  };

  getPostReplies = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/posts/${id}/reacts`;
    return await this.get(url, { params });
  };

  getUsers = async function (params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = "/users";
    return await this.get(url, { params });
  };

  getUser = async function (id) {
    if (!this.server) return { error: "No server configured" };
    let url = `/users/${id}`;
    return await this.get(url);
  };

  getUserPosts = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/users/${id}/outbox`;
    return await this.get(url, { params });
  };

  getUserEvents = async function (id, params = {}) {
    if (!this.server) return { error: "No server configured" };
    let url = `/users/${id}/events`;
    return await this.get(url, { params });
  };
}

const defaultClient = new KowloonClient();

export { KowloonClient };
export default defaultClient;
