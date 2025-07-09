import { createSlice } from "@reduxjs/toolkit";

export const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showPostEditor: false,
    showImageModal: false,
    currentMedia: {
      type: "image",
      src: "",
      description: "",
    },
    currentUrl: "/",
  },
  reducers: {
    togglePostEditor: (state) => {
      state.showPostEditor = !state.showPostEditor;
    },
    showPostEditor: (state) => {
      state.showPostEditor = true;
    },
    hidePostEditor: (state) => {
      state.showPostEditor = false;
    },

    toggleImageModal: (state) => {
      state.showImageModal = !state.showImageModal;
    },
    showImageModal: (state) => {
      state.showImageModal = true;
    },
    hideImageModal: (state) => {
      state.showImageModal = false;
      state.currentMedia = {};
    },
    setCurrentMedia: (state, action) => {
      let u = action.payload;
      state.currentMedia = { ...state.currentMedia, ...u };
    },
    setcurrentUrl: (state, action) => {
      state.currentUrl = action.payload;
    },
    setCurrentTimelinePage: (state, action) => {
      state.currentTimelinePage = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  togglePostEditor,
  showPostEditor,
  hidePostEditor,
  toggleImageModal,
  showImageModal,
  hideImageModal,
  setCurrentMedia,
  setcurrentUrl,
  setCurrentTimelinePage,
} = uiSlice.actions;

export default uiSlice.reducer;
