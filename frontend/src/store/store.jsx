import { configureStore } from "@reduxjs/toolkit";

import globalReducer from "./global";
import userReducer from "./user";
import postsReducer from "./posts";

const store = configureStore({
    reducer: {
        global: globalReducer,
        user: userReducer,
        posts: postsReducer
    }
});

export default store;