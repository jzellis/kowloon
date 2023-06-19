"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.uiSlice = exports.togglePostEditor = exports.showNotification = exports.setPosts = exports.setActors = exports.hideNotification = exports["default"] = void 0;
var _toolkit = require("@reduxjs/toolkit");
var uiSlice = (0, _toolkit.createSlice)({
  name: "ui",
  initialState: {
    postEditorOpen: false,
    notificationVisible: false,
    notificationType: "success",
    notificationMessage: "",
    posts: [],
    actors: []
  },
  reducers: {
    togglePostEditor: function togglePostEditor(state) {
      state.postEditorOpen = !state.postEditorOpen;
    },
    showNotification: function showNotification(state, action) {
      state.notificationVisible = true;
      if (action.payload.type) state.notificationType = action.payload.type;
      if (action.payload.message) state.notificationMessage = action.payload.message;
    },
    hideNotification: function hideNotification(state) {
      state.notificationVisible = false;
      state.notificationType = "success";
      state.notificationMessage = "";
    },
    setPosts: function setPosts(state, action) {
      state.posts = action.payload;
    },
    setActors: function setActors(state, action) {
      state.actors = action.payload;
    }
  }
});

// Action creators are generated for each case reducer function
exports.uiSlice = uiSlice;
var _uiSlice$actions = uiSlice.actions,
  togglePostEditor = _uiSlice$actions.togglePostEditor,
  showNotification = _uiSlice$actions.showNotification,
  hideNotification = _uiSlice$actions.hideNotification,
  setPosts = _uiSlice$actions.setPosts,
  setActors = _uiSlice$actions.setActors;
exports.setActors = setActors;
exports.setPosts = setPosts;
exports.hideNotification = hideNotification;
exports.showNotification = showNotification;
exports.togglePostEditor = togglePostEditor;
var _default = uiSlice.reducer;
exports["default"] = _default;