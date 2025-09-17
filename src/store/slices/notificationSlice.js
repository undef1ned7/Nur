import { createSlice } from '@reduxjs/toolkit';
import {
  fetchNotificationsAsync,
  markAllNotificationsReadAsync,
  fetchNotificationDetailAsync
} from '../creators/notificationCreators';

const initialState = {
  list: [],
  count: 0,
  loading: false,
  error: null,
  detail: null,
  markingAllRead: false,
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.results;
        state.count = action.payload.count;
      })
      .addCase(fetchNotificationsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markAllNotificationsReadAsync.pending, (state) => {
        state.markingAllRead = true;
      })
      .addCase(markAllNotificationsReadAsync.fulfilled, (state) => {
        state.markingAllRead = false;
        state.list = state.list.map(n => ({ ...n, is_read: true }));
      })
      .addCase(markAllNotificationsReadAsync.rejected, (state) => {
        state.markingAllRead = false;
      })
      .addCase(fetchNotificationDetailAsync.fulfilled, (state, action) => {
        state.detail = action.payload;
      });
  }
});

export default notificationSlice.reducer;