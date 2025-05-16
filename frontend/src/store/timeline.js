import { createSlice } from "@reduxjs/toolkit";

export const timelineSlice = createSlice({
  name: "timeline",
  initialState: {
    name: "",
    notes: true,
    articles: true,
    links: true,
    media: true,
    filteredByCircle: false,
    showTimelineControls: false,
    page: 1,
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
    setFilteredByCircle: (state, action) => {
      state.filteredByCircle = action.payload;
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
    reset: (state) => {
      state.notes = true;
      state.articles = true;
      state.links = true;
      state.media = true;
      state.filteredByCircle = false;
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
  setFilteredByCircle,
  toggleTimelineControls,
  setPage,
  incrementPage,
  decrementPage,
  reset,
} = timelineSlice.actions;

export default timelineSlice.reducer;
