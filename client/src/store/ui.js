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
    showRead: true,
    showNotes: true,
    showArticles: true,
    showMedia: true,
    showLinks: true,

    currentPage: 1,
    theme: "retro",
    themeOptions: ["light", "dark", "retro", "bumblebee"],
  },
  reducers: {
    toggleShowRead: (state) => {
      state.showRead = !state.showRead;
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
    resetPosts: (state) => {
      state.posts = [];
    },
    setActors: (state, action) => {
      state.actors = action.payload;
    },
    incrementCurrentPage: (state) => {
      state.currentPage = state.currentPage + 1;
      console.log(state.currentPage);
    },
    resetcurrentPage: (state) => {
      state.currentPage = 1;
    },
    changeTheme: (state, action) => {
      state.theme = action.payload;
      document.querySelector("html").setAttribute("data-theme", action.payload);
    },
    loadUI: (state, action) => {
      return { ...action.payload };
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
  changeTheme,
  loadUI,
} = uiSlice.actions;

export default uiSlice.reducer;
