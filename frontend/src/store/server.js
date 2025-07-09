import { createSlice } from "@reduxjs/toolkit";
import { set } from "mongoose";

export const serverSlice = createSlice({
  name: "server",
  initialState: {
    id: "",
    domain: "",
    profile: {},
    publicKey: "",
    jwks: "",
    inbox: "",
    outbox: "",
    pages: [],
  },
  reducers: {
    setServer: (state, action) => {
      const { id, domain, profile, publicKey, jwks, inbox, outbox } =
        action.payload;
      state.id = id;
      state.domain = domain;
      state.profile = profile;
      state.publicKey = publicKey;
      state.jwks = jwks;
      state.inbox = inbox;
      state.outbox = outbox;
    },
    setId: (state, action) => {
      state.id = action.payload;
    },
    setDomain: (state, action) => {
      state.domain = action.payload;
    },
    setProfile: (state, action) => {
      state.profile = action.payload;
    },
    setPublicKey: (state, action) => {
      state.publicKey = action.payload;
    },
    setJwks: (state, action) => {
      state.jwks = action.payload;
    },
    setInbox: (state, action) => {
      state.inbox = action.payload;
    },
    setOutbox: (state, action) => {
      state.outbox = action.payload;
    },
    setPages: (state, action) => {
      state.pages = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setServer,
  setId,
  setDomain,
  setProfile,
  setPublicKey,
  setJwks,
  setInbox,
  setOutbox,
  setPages,
} = serverSlice.actions;

export default serverSlice.reducer;
