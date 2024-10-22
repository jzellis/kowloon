import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    user: {}
};

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.user = action.payload;
        },
        
        logout: (state) => {
            state.user = {};
            state.key = "";
            localStorage.removeItem("user");
            localStorage.removeItem("key");
        },
    },
});

export const { setUser, logout } = userSlice.actions;

export default userSlice.reducer;