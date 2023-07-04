import { createSlice } from "@reduxjs/toolkit";

export const settingsSlice = createSlice({
  name: "settings",
  initialState: {},
  reducers: {
    setSettings: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      return { ...action.payload };
    },
    changeSetting: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      const payload = action.payload;
      state = { ...state, payload };
    },
  },
});

// Action creators are generated for each case reducer function
export const { setSettings, changeSetting } = settingsSlice.actions;

export default settingsSlice.reducer;
