import { createSlice } from "@reduxjs/toolkit";

export const uiSlice = createSlice({
  name: "ui",
  initialState: {
    postEditorOpen: false,
    profileEditorOpen: false,
    notificationVisible: false,
    notificationType: "success",
    notificationMessage: "",
    posts: [],
    showRead: undefined,
    showNotes: true,
    showArticles: true,
    showMedia: true,
    showLinks: true,
    currentPage: 1,
  },
  reducers: {
    toggleShowRead: (state) => {
      state.showRead = state.showRead === undefined ? true : !state.showRead;
    },
    toggleShowNotes: (state) => {
      state.showNotes = !state.showNotes;
    },
    toggleShowArticles: (state) => {
      state.showArticles = !state.showArticles;
    },
    toggleShowMedia: (state) => {
      state.showMedia = !state.showMedia;
    },
    toggleShowLinks: (state) => {
      state.showLinks = !state.showLinks;
    },

    togglePostEditor: (state) => {
      state.postEditorOpen = !state.postEditorOpen;
    },
    toggleProfileEditor: (state) => {
      state.profileEditorOpen = !state.profileEditorOpen;
    },
    showNotification: (state, action) => {
      state.notificationVisible = true;
      if (action.payload.type) state.notificationType = action.payload.type;
      if (action.payload.message)
        state.notificationMessage = action.payload.message;
    },
    hideNotification: (state) => {
      state.notificationVisible = false;
      state.notificationType = "success";
      state.notificationMessage = "";
    },
    setPosts: (state, action) => {
      state.posts = Array.from(new Set([...state.posts, ...action.payload]));
    },
    resetPosts: (state, action) => {
      state.posts = [];
    },
    setActors: (state, action) => {
      state.actors = action.payload;
    },
    incrementCurrentPage: (state, action) => {
      state.currentPage = state.currentPage + 1;
    },
    resetcurrentPage: (state, action) => {
      state.currentPage = 1;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  toggleShowRead,
  toggleShowNotes,
  toggleShowArticles,
  toggleShowMedia,
  toggleShowLinks,
  togglePostEditor,
  toggleProfileEditor,
  showNotification,
  hideNotification,
  setPosts,
  setActors,
  incrementCurrentPage,
  resetcurrentPage,
  resetPosts,
} = uiSlice.actions;

export default uiSlice.reducer;
