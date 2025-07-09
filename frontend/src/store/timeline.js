import { createSlice } from "@reduxjs/toolkit";
import { set } from "mongoose";

export const timelineSlice = createSlice({
  name: "timeline",
  initialState: {
    name: "",
    notes: true,
    articles: true,
    links: true,
    media: true,
    circle: null,
    showTimelineControls: false,
    page: 1,
    posts: [],
    timelineView: "getServerOutbox",
  },
  reducers: {
    showNotes: (state) => {
      state.notes = true;
    },
    hideNotes: (state) => {
      state.notes = false;
    },
    toggleNotes: (state) => {
      state.notes = !state.notes;
    },
    showArticles: (state) => {
      state.articles = true;
    },
    hideArticles: (state) => {
      state.articles = false;
    },
    toggleArticles: (state) => {
      state.articles = !state.articles;
    },
    showLinks: (state) => {
      state.links = true;
    },
    hideLinks: (state) => {
      state.links = false;
    },
    toggleLinks: (state) => {
      state.links = !state.links;
    },
    showMedia: (state) => {
      state.media = true;
    },
    hideMedia: (state) => {
      state.media = false;
    },
    toggleMedia: (state) => {
      state.media = !state.media;
    },
    toggleTimelineControls: (state) => {
      state.showTimelineControls = !state.showTimelineControls;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    incrementPage: (state) => {
      state.page += 1;
    },
    decrementPage: (state) => {
      state.page -= 1;
    },
    setPosts: (state, action) => {
      state.posts = action.payload;
    },
    setCircle: (state, action) => {
      state.circle = action.payload;
    },
    setTimelineView: (state, action) => {
      state.timelineView = action.payload;
    },
    reset: (state) => {
      state.notes = true;
      state.articles = true;
      state.links = true;
      state.media = true;
      state.circle = null;
      state.page = 1;
      state.posts = [];
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  showNotes,
  hideNotes,
  toggleNotes,
  showArticles,
  hideArticles,
  toggleArticles,
  showLinks,
  hideLinks,
  toggleLinks,
  showMedia,
  hideMedia,
  toggleMedia,
  toggleTimelineControls,
  setPage,
  incrementPage,
  decrementPage,
  setPosts,
  setCircle,
  setTimelineView,
  reset,
} = timelineSlice.actions;

export default timelineSlice.reducer;
