/* eslint-disable array-callback-return */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-anonymous-default-export */
import store from "../store";
import endpoints from "./endpoints";
import { setSettings } from "../store/settings";
import { addActors, setUser } from "../store/user";
import { openDB, deleteDB, wrap, unwrap } from "idb";
import { setPosts } from "../store/ui";

const kowloon = {
  db: null,
  actors: null,
  init: async function () {
    this.db = await openDB("kowloon", 1, {
      upgrade(db) {},
    });
  },
  get: async (url, options) => {
    options = options || null;
    return await (
      await fetch(url, {
        headers: {
          Authorization:
            options && options.token ? `Bearer ${options.token}` : undefined,
          Accept: "application/activity+json",
        },
      })
    ).json();
  },

  post: async ({ url, token, body }) => {
    console.log("URL ", url);
    console.log("Body ", body);
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
    page = page || 1;
    let state = store.getState();
    if (state.user.user.actor) {
      let url = `${endpoints.inbox(state.user.user.actor.id)}?${
        state.ui.showRead ? "read=" + state.ui.showRead : ""
      }&type=${state.ui.showNotes ? "Note&" : ""}${
        state.ui.showArticles ? "type=Article&" : ""
      }${state.ui.showMedia ? "type=Image&type=Audio&type=Video&" : ""}${
        state.ui.showLinks ? "type=Link&" : ""
      }&page=${state.ui.timelineCurrentPage}`;
      console.log(url);
      try {
        let timeline = await this.get(url, {
          token: localStorage.getItem("token"),
        });
        if (timeline && timeline.items) {
          store.dispatch(setPosts(timeline.items));
        }
      } catch (e) {
        console.log(e);
      }
    }
  },
};

const Kowloon = kowloon;
await Kowloon.init();
export default Kowloon;
