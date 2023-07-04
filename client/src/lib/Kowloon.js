/* eslint-disable no-unused-vars */
import store from "../store";
import { setSettings } from "../store/settings";
import { setUser } from "../store/user";
import { setPosts, resetPosts, setActors, loadUI } from "../store/ui";

/** @type {*} */
const Kowloon = {
  state: store.getState(),
  protocol: "http://",
  domain: "localhost:3001",
  settings: null,
  user: null,
  token: null,
  get: async function (url) {
    let options = {
      method: "GET",
      headers: {
        Accept: "application/activity+json",
      },
    };
    if (this.token) options.headers.Authorization = `Bearer ${this.token}`;
    return await (await fetch(url, options)).json();
  },
  post: async function (url, body) {
    let options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/activity+json",
      },
      body: JSON.stringify(body),
    };
    if (this.token) options.headers.Authorization = `Bearer ${this.token}`;
    return await (await fetch(url, options)).json();
  },
  init: async function () {
    this.settings =
      JSON.parse(localStorage.getItem("settings")) ||
      (await this.get(`${this.protocol}${this.domain}/`));
    localStorage.setItem("settings", JSON.stringify(this.settings));
    store.dispatch(setSettings(this.settings));
    this.user = JSON.parse(localStorage.getItem("user"));
    if (this.user) this.token = this.user.accessToken;
    store.dispatch(setUser(this.user));
    if (this.user) await this.cacheActors();
  },

  login: async function (username, password) {
    this.user = await this.post(`${this.protocol}${this.domain}/login`, {
      username,
      password,
    });
    this.token = this.user.accessToken;
    store.dispatch(setUser(this.user));
    localStorage.setItem("user", JSON.stringify(this.user));
  },

  logout: async function (username, password) {
    this.user = undefined;
    this.token = undefined;
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    store.dispatch(setUser(undefined));
    window.location.href = "/";
  },

  getPublicTimeline: async function () {
    let state = store.getState();
    let url = `${this.protocol}${this.domain}/outbox?read=${
      state.ui.showRead
    }&type=${state.ui.showNotes ? "Note&" : ""}${
      state.ui.showArticles ? "type=Article&" : ""
    }${state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
      state.ui.showLinks ? "type=Link&" : ""
    }page=${state.ui.currentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getUserPublicTimeline: async function (username) {
    let state = store.getState();

    let url = `${this.protocol}${this.domain}/@${username}/outbox?read=${
      state.ui.showRead
    }&type=${state.ui.showNotes ? "Note&" : ""}${
      state.ui.showArticles ? "type=Article&" : ""
    }${state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
      state.ui.showLinks ? "type=Link&" : ""
    }page=${state.ui.currentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getUserTimeline: async function () {
    let state = store.getState();

    let url = `${this.protocol}${this.domain}/@${
      this.user.username
    }/inbox?read=${state.ui.showRead}&type=${
      state.ui.showNotes ? "Note&" : ""
    }${state.ui.showArticles ? "type=Article&" : ""}${
      state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""
    }${state.ui.showLinks ? "type=Link&" : ""}page=${state.ui.currentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getActor: async function (id) {
    let url = `${this.protocol}${this.domain}/actors?actor=${id}`;
    return (await this.get(url)).items[0];
  },

  getActors: async function (ids) {
    let idString = ids.join("&actors=");
    let url = `${this.protocol}${this.domain}/actors?actor=${idString}`;
    return (await this.get(url)).items;
  },

  getActivity: async function (id) {
    return await this.get(id);
  },

  createActivity: async function (activity) {
    activity.type = activity.type || "Create";
    activity.actor = this.user.actor.id;
    return await this.post(this.user.actor.outbox, activity);
  },

  createReply: async function (inReplyTo, reply) {
    const replyActivity = {
      ...reply,
      type: "Create",
      actor: this.user.actor.id,
      inReplyTo,
    };
    return await this.post(this.user.actor.outbox, replyActivity);
  },
  markActivityAsRead: async function (id) {
    let readActivity = {
      type: "Read",
      actor: this.user.actor.id,
      target: id,
    };
    return await this.post(this.user.actor.outbox, readActivity);
  },
  likeActivity: async function (activity) {
    const likeActivity = {
      type: "Like",
      actor: this.user.actor.id,
      target: activity.object.id,
    };
    return await this.post(this.user.actor.outbox, likeActivity);
  },
  unlikeActivity: async function (id) {
    const unlikeActivity = {
      type: "Undo",
      actor: this.user.actor.id,
      target: id,
    };
    return await this.post(this.user.actor.outbox, unlikeActivity);
  },
  deleteActivity: async function (id) {
    const deleteActivity = {
      type: "Delete",
      actor: this.user.actor.id,
      object: id,
    };
    return await this.post(this.user.actor.outbox, deleteActivity);
  },
  followActor: async function (id) {
    const followActivity = {
      type: "Follow",
      actor: this.user.actor.id,
      target: id,
    };
    return await this.post(this.user.actor.outbox, followActivity);
  },
  unfollowActor: async function (id) {
    const followActivity = {
      type: "Unfollow",
      actor: this.user.actor.id,
      target: id,
    };
    return await this.post(this.user.actor.outbox, followActivity);
  },
  createCircle: async function (name) {
    const followActivity = {
      type: "Create",
      actor: this.user.actor.id,
      object: {
        type: "Circle",
        name,
      },
    };
    return await this.post(this.user.actor.outbox, followActivity);
  },
  addActorToCircle: async function (circleId, actorId) {
    const followActivity = {
      type: "Add",
      actor: this.user.actor.id,
      object: actorId,
      target: circleId,
    };
    return await this.post(this.user.actor.outbox, followActivity);
  },

  cacheActors: async function (actors) {
    let allActors = Array.from(
      new Set([
        ...this.user.actor.following.items,
        ...this.user.actor.followers.items,
      ])
    );
    let following = await this.getActors(allActors);
    store.dispatch(setActors(following));
  },
};

await Kowloon.init();
export default Kowloon;
