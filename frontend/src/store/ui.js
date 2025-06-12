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
    currentPage: "/",
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
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
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
  setCurrentPage,
} = uiSlice.actions;

export default uiSlice.reducer;
