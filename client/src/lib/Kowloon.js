/* eslint-disable array-callback-return */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-anonymous-default-export */
import store from "../store";
import endpoints from "./endpoints";
import { setSettings } from "../store/settings";
import { setUser } from "../store/user";
import { openDB, deleteDB, wrap, unwrap } from "idb";
import { setPosts, resetPosts } from "../store/ui";

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
    store.dispatch(setUser(this.user));
  },

  login: async function (username, password) {
    this.user = await this.post(`${this.protocol}${this.domain}/login`, {
      username,
      password,
    });
    this.token = this.user.accessToken;
    store.dispatch(setUser(this.user));
  },

  logout: async function (username, password) {
    this.user = undefined;
    this.token = undefined;
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    store.dispatch(setUser(undefined));
  },

  getPublicTimeline: async function () {
    let url = `${this.protocol}${this.domain}/inbox?${
      this.state.ui.showRead ? "read=" + this.state.ui.showRead : ""
    }&type=${this.state.ui.showNotes ? "Note&" : ""}${
      this.state.ui.showArticles ? "type=Article&" : ""
    }${this.state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
      this.state.ui.showLinks ? "type=Link&" : ""
    }page=${this.state.ui.timelineCurrentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getUserPublicTimeline: async function (username) {
    let url = `${this.protocol}${this.domain}/@${username}/outbox?${
      this.state.ui.showRead ? "read=" + this.state.ui.showRead : ""
    }&type=${this.state.ui.showNotes ? "Note&" : ""}${
      this.state.ui.showArticles ? "type=Article&" : ""
    }${this.state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
      this.state.ui.showLinks ? "type=Link&" : ""
    }page=${this.state.ui.timelineCurrentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getUserTimeline: async function () {
    let url = `${this.protocol}${this.domain}/@${this.user.username}/inbox?${
      this.state.ui.showRead ? "read=" + this.state.ui.showRead : ""
    }&type=${this.state.ui.showNotes ? "Note&" : ""}${
      this.state.ui.showArticles ? "type=Article&" : ""
    }${this.state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
      this.state.ui.showLinks ? "type=Link&" : ""
    }page=${this.state.ui.timelineCurrentPage}`;
    store.dispatch(setPosts((await this.get(url)).items));
  },

  getActor: async function (id) {
    let url = `${this.protocol}${this.domain}/@${this.user.username}/actors?actor=${id}`;
    return (await this.get(url)).items[0];
  },

  getActors: async function (ids) {
    let idString = (typeof ids == "object" ? Object.keys(ids) : ids).join(
      "&actors="
    );
    let url = `${this.protocol}${this.domain}/@${this.user.username}/actors?actor=${idString}`;
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
};

await Kowloon.init();
export default Kowloon;
