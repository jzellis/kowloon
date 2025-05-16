import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./user";
import serverReducer from "./server";
import timelineReducer from "./timeline";
import uiReducer from "./ui";
export default configureStore({
  reducer: {
    user: userReducer,
    server: serverReducer,
    timeline: timelineReducer,
    ui: uiReducer,
  },
});
