import store from "../store/store";
import { setUser } from "../store/user";
import {
  setPostType,
  setPostAudience,
  setPostReplyAudience,
  setSettings,
} from "../store/global";

import { generate } from "random-words";

const Kowloon = {
  baseUrl: "http://localhost:3000/api",
  user: JSON.parse(localStorage.getItem("user")) || {},
  request: null,
  postsStore: null,
  settings: {},
  pronouns: {
    male: {
      subject: "he",
      object: "him",
      possAdj: "his",
      possPro: "his",
      reflexive: "himself",
    },
    female: {
      subject: "she",
      object: "her",
      possAdj: "her",
      possPro: "hers",
      reflexive: "herself",
    },
    nonbinary: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
  },
  init: async function () {
    this.settings =
      JSON.parse(localStorage.getItem("settings")) ||
      (await this.getSettings());
    this.user = JSON.parse(localStorage.getItem("user"));
    store.dispatch(setUser(this.user));
    store.dispatch(setPostType(this.user?.prefs?.defaultPostType));
    store.dispatch(setPostAudience(this.user?.prefs?.defaultPostAudience));
    store.dispatch(
      setPostReplyAudience(this.user?.prefs?.defaultPostReplyAudience)
    );
    store.dispatch(setSettings(this.settings));
  },

  get: async function (url) {
    try {
      let res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: this.user
            ? "Basic " + this.user?.keys?.public.replaceAll("\n", "\\r\\n")
            : "",
        },
      });
      let json = await res.json();
      return json;
    } catch (e) {
      return new Error(e);
    }
  },

  post: async function (url, body = {}) {
    try {
      let res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: this.user?.id
            ? "Basic " + this.user?.keys?.public.replaceAll("\n", "\\r\\n")
            : "",
        },
        body: JSON.stringify(body),
      });
      let json = await res.json();
      return json;
    } catch (e) {
      return new Error(e);
    }
  },

  login: async function (username, password) {
    let res = await this.post(`${this.baseUrl}/login`, {
      username,
      password,
    });
    localStorage.setItem("user", JSON.stringify(res.user));
    store.dispatch(setUser(res.user));
    store.dispatch(setPostType(res.user?.prefs?.defaultPostType));
    return res.user;
  },

  getSettings: async function () {
    let settings = (await this.get(`${this.baseUrl}/settings`)).settings;
    localStorage.setItem("settings", JSON.stringify(settings));
    return settings;
  },
  getUser: async function (id) {
    return await this.get(`${this.baseUrl}/users/${id}`);
  },
  getUserPosts: async function (id, options = {}) {
    return await this.get(
      `${this.baseUrl}/users/${id}/posts${
        options.page ? `?page=${options.page}` : ""
      }`
    );
  },
  getPublicPosts: async function (options = {}) {
    let posts = await this.get(
      `${this.baseUrl}/posts${options.page ? `?page=${options.page}` : ""}`
    );

    return posts;
  },
  getUrlPreview: async function (url) {
    try {
      return await this.get(`${this.baseUrl}/preview?url=${url}`);
    } catch (e) {
      console.error(e);
      return new Error(e);
    }
  },
  uploadImage: async function (file, title = "", description = "") {
    try {
      let formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("image", file);
      return await (
        await fetch(`${this.baseUrl}/upload`, {
          method: "POST",
          headers: {
            // Accept: "application/json",
            Authorization: this.user?.id
              ? "Basic " + this.user?.keys?.public.replaceAll("\n", "\\r\\n")
              : "",
          },
          body: formData,
        })
      ).json();
    } catch (e) {
      console.error(e);
      return new Error(e);
    }
  },
  createActivity: async function (activity) {
    try {
      return await this.post(`${this.baseUrl}/outbox`, activity);
    } catch (e) {
      console.error(e);
      return new Error(e);
    }
  },
  generateRandomPassword: function () {
    let words = generate({ exactly: 2 });
    let number = Math.floor(Math.random() * 10000);
    let punctuation = "!@#$%&*_+?=";
    let suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += punctuation.charAt(
        Math.floor(Math.random() * punctuation.length)
      );
    }
    return `${words[0].charAt(0).toUpperCase() + words[0].slice(1)}${
      words[1].charAt(0).toUpperCase() + words[1].slice(1)
    }${number}${suffix}`;
  },
};

export default Kowloon;
