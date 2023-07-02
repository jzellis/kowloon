import { configureStore } from "@reduxjs/toolkit";

import settingsReducer from "./settings";
import userReducer from "./user";
import uiReducer from "./ui";
export default configureStore({
  reducer: {
    settings: settingsReducer,
    user: userReducer,
    ui: uiReducer,
  },
});
