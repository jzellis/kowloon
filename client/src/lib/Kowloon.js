/* eslint-disable array-callback-return */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-anonymous-default-export */
import store from "../store";
import endpoints from "./endpoints";
import { setSettings } from "../store/settings";
import { addActors, setUser, setToken } from "../store/user";
import { openDB, deleteDB, wrap, unwrap } from "idb";
import { setPosts, resetPosts } from "../store/ui";

const kowloon = {
  db: null,
  actors: null,
  init: async function () {
    // this.db = await openDB("kowloon", 1, {
    //   upgrade(db) {},
    // });
  },
  get: async (url, options) => {
    const state = store.getState();
    options = options || null;
    return await (
      await fetch(url, {
        headers: {
          Authorization: state.user.token
            ? `Bearer ${state.user.token}`
            : undefined,
          Accept: "application/activity+json",
        },
      })
    ).json();
  },

  post: async ({ url, body }) => {
    const state = store.getState();
    let token = state.user.token;
    try {
      let response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          "Content-Type": "application/json",
          Accept: "application/activity+json",
        },
        body: JSON.stringify(body),
      });

      return await response.json();
    } catch (e) {
      console.log("Error: ", e);
    }
  },

  loadSettings: async function () {
    const settings = await this.get(endpoints.root, { token: null });
    store.dispatch(setSettings(settings));
  },

  login: async function (login) {
    return await this.post({ url: endpoints.login, body: login });
  },

  loadUser: async function () {
    const user = JSON.parse(localStorage.getItem("user")) || null;
    if (user) store.dispatch(setUser(user));
    const token = localStorage.getItem("token") || null;
    if (token) store.dispatch(setToken(token));
  },

  loadActors: async function (actors) {
    const state = store.getState();
    let retrievedActors = (await this.get(endpoints.actors(actors))).items;
    store.dispatch(addActors(retrievedActors));
  },
  getActors: async function () {
    let actors = {};
    (await this.db.getAll("actors")).map((a) => {
      actors[a.id] = a;
      return true;
    });
    return actors;
  },

  getUserTimeline: async function (page) {
    console.log("Getting timeline...");
    page = page || 1;
    let state = store.getState();
    let user = state.user.user;
    if (user.actor) {
      let url = `${endpoints.inbox(user.actor.id)}?${
        state.ui.showRead ? "read=" + state.ui.showRead : ""
      }&type=${state.ui.showNotes ? "Note&" : ""}${
        state.ui.showArticles ? "type=Article&" : ""
      }${state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
        state.ui.showLinks ? "type=Link&" : ""
      }page=${state.ui.timelineCurrentPage}`;
      try {
        let timeline = await this.get(url);
        if (timeline && timeline.items) {
          store.dispatch(setPosts(timeline.items));
        }
      } catch (e) {
        console.log(e);
      }
    }
    return true;
  },
};

const Kowloon = kowloon;
await Kowloon.init();
export default Kowloon;
