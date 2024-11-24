import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    loading: false,
    type: "public",
    page: 1,
    circles: [],
    posts: [],

};

export const postsSlice = createSlice({
    name: "posts",
    initialState,
    reducers: {
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        
    },
});

export const { setLoading } = postsSlice.actions;

export default postsSlice.reducer;