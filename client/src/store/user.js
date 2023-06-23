import { createSlice } from "@reduxjs/toolkit";

export const userSlice = createSlice({
  name: "user",
  initialState: {
    user: {},
    token: "",
    actors: {},
  },
  reducers: {
    setToken: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.token = action.payload;
      localStorage.setItem("token", state.token);
    },
    setUser: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.user = action.payload;
      localStorage.setItem("user", JSON.stringify(state.user));
    },
    changeUser: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      const payload = action.payload;
      state.user = { ...state.user, payload };
      localStorage.setItem("user", JSON.stringify(state.user));
    },
    addActor: (state, action) => {
      if (state.actors) state.actors[action.payload.id] = action.payload;
    },
    addActors: (state, action) => {
      if (state.actors) state.actors = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setToken, setUser, changeUser, addActor, addActors } =
  userSlice.actions;

export default userSlice.reducer;
