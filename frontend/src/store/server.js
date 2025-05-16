import { createSlice } from "@reduxjs/toolkit";

export const serverSlice = createSlice({
  name: "server",
  initialState: {
    server: {},
    circles: [],
    timestamp: null,
    signature: "",
    pages: [],
  },
  reducers: {
    setServer: (state, action) => {
      state.server = action.payload;
    },
    setServerCircles: (state, action) => {
      state.circles = action.payload;
    },
    setTimestamp: (state, action) => {
      state.timestamp = action.payload;
    },
    setSignature: (state, action) => {
      state.signature = action.payload;
    },
    setPages: (state, action) => {
      state.pages = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setServer,
  setServerCircles,
  setTimestamp,
  setSignature,
  setPages,
} = serverSlice.actions;

export default serverSlice.reducer;
