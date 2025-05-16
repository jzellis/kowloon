import { createSlice } from "@reduxjs/toolkit";

export const userSlice = createSlice({
  name: "user",
  initialState: {
    user: {},
    circles: [],
    groups: [],
    timestamp: null,
    signature: "",
  },
  reducers: {
    setTimestamp: (state, action) => {
      state.timestamp = action.payload;
    },
    setSignature: (state, action) => {
      state.signature = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setCircles: (state, action) => {
      state.circles = action.payload;
    },
    setGroups: (state, action) => {
      state.groups = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setUser, setTimestamp, setSignature, setCircles, setGroups } =
  userSlice.actions;

export default userSlice.reducer;
