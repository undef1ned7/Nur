import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

const initialState = {
  // account данные
  accountId: "75d39bdf-dd85-48d3-a0bb-78fd8522da7d",
  jwt: "",
  amount: 50,

  // threads + чат
  items: [],
  loading: false,
  error: null,
  selected: null,
  messages: [],
  participants: {},
  unread: {},

  // ws + notify
  state: "closed", // ws state
  enabled:
    typeof Notification !== "undefined" &&
    Notification.permission === "granted",
};

export const fetchThreads = createAsyncThunk(
  "instagram/fetchThreads",
  async (_, { getState }) => {
    const { accountId, amount, jwt } = getState().instagram;
    const headers = { "Content-Type": "application/json" };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    const res = await fetch(
      `/api/instagram/accounts/${accountId}/threads/live/?amount=${amount}`,
      {
        headers,
        credentials: "include",
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.threads || [];
  }
);

const instagramSlice = createSlice({
  name: "instagram",
  initialState,
  reducers: {
    selectThread: (state, action) => {
      const id = action.payload;
      state.selected = id;
      state.messages = [];
      state.participants = {};
      state.unread[id] = 0;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setParticipants: (state, action) => {
      state.participants = action.payload;
    },
    incrementUnread: (state, action) => {
      const id = action.payload;
      state.unread[id] = (state.unread[id] || 0) + 1;
    },
    setWsState: (state, action) => {
      state.state = action.payload;
    },
    setNotifyEnabled: (state, action) => {
      state.enabled = action.payload;
    },

    // account setters
    setAccountId: (state, action) => {
      state.accountId = action.payload;
    },
    setJwt: (state, action) => {
      state.jwt = action.payload;
    },
    setAmount: (state, action) => {
      state.amount = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchThreads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchThreads.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchThreads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const {
  addMessage,
  incrementUnread,
  setWsState,
  setNotifyEnabled,
  selectThread,
  setAccountId,
  setAmount,
  setJwt,
  setParticipants,
} = instagramSlice.actions;

export const useInstagram = () => useSelector((state) => state.instagram);

export default instagramSlice.reducer;
