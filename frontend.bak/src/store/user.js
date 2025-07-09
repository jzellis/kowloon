import { createSlice } from "@reduxjs/toolkit";

export const userSlice = createSlice({
  name: "user",
  initialState: {
    user: {},
    token: "",
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    clearUser: (state) => {
      state.user = {};
      state.token = "";
    },
    updateUser: (state, action) => {
      const updatedUser = { ...state.user, ...action.payload };
      state.user = updatedUser;
    },
    resetUser: (state) => {
      state.user = {};
      state.token = "";
    },
  },
});

// Action creators are generated for each case reducer function
export const { setUser, setToken, clearUser, updateUser, resetUser } =
  userSlice.actions;

export default userSlice.reducer;
