import { configureStore } from "@reduxjs/toolkit";

import globalReducer from "./global";
import userReducer from "./user";

const store = configureStore({
    reducer: {
        global: globalReducer,
        user: userReducer
    }
});

export default store;