import { createSlice } from "@reduxjs/toolkit";

export const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showPostEditor: false,
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
  setCurrentPage,
} = uiSlice.actions;

export default uiSlice.reducer;
