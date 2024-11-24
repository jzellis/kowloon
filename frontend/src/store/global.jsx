import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    loading: true,
    title: "Kowloon",
    description: "",
    postEditorVisible: false,
    postType: "Note",
    postTitle: "",
    postLink: "",
    postContent: "",
    postAudience: "",
    postReplyAudience: "",
    settings: {}
};

export const globalSlice = createSlice({
    name: "global",
    initialState,
    reducers: {
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        setTitle: (state, action) => {
            state.title = action.payload;
        },
        setPostLink: (state, action) => {
            state.postLink = action.payload;
        },
        setDescription: (state, action) => {
            state.description = action.payload;
        },

        togglePostEditor: (state,action) => {
            state.postEditorVisible = !state.postEditorVisible;
        },
        showPostEditor: (state) => {
            state.postEditorVisible = true;
        },
        hidePostEditor: (state) => {
            state.postEditorVisible = false;
        },
        setPostType: (state, action) => {
            state.postType = action.payload;
        },
        setPostTitle: (state, action) => {
            state.postTitle = action.payload;
        },
        setPostContent: (state, action) => {
            state.postContent = action.payload;
        },
        setPostAudience: (state, action) => {
            state.postAudience = action.payload;
        },
        setPostReplyAudience: (state, action) => {
            state.postReplyAudience = action.payload;
        },
        setSettings: (state, action) => {
            state.settings = action.payload;
        }
    },
});

export const { setLoading, setTitle, setPostLink, setDescription, togglePostEditor, showPostEditor, hidePostEditor, setPostType, setPostTitle, setPostContent, setPostAudience, setPostReplyAudience, setSettings } = globalSlice.actions;

export default globalSlice.reducer;