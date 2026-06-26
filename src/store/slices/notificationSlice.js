import { createSlice } from '@reduxjs/toolkit';
import {
  fetchNotificationsAsync,
  markAllNotificationsReadAsync,
  fetchNotificationDetailAsync,
  markNotificationReadAsync,
} from '../creators/notificationCreators';

const initialState = {
  list: [],
  count: 0,          // всего уведомлений (для пагинации)
  unreadCount: 0,    // непрочитанных (счётчик в колокольчике, real-time)
  hasMore: false,    // есть ли ещё страницы (lazy load)
  loading: false,
  loadingMore: false,
  error: null,
  detail: null,
  markingAllRead: false,
};

const isUnread = (n) => !(n?.is_read ?? n?.read ?? false);
const idOf = (n) => n?.id ?? n?.uuid ?? n?.pk;

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    /** Новое уведомление из WebSocket — добавляем в начало, без дублей. */
    notificationReceived: (state, action) => {
      const n = action.payload;
      if (!n) return;
      const id = idOf(n);
      if (id != null && state.list.some((x) => idOf(x) === id)) {
        return; // защита от дублей (WS может прислать повтор)
      }
      state.list.unshift(n);
      state.count += 1;
      if (isUnread(n)) state.unreadCount += 1;
    },
    /** Локально отметить одно прочитанным (оптимистично). */
    notificationMarkedReadLocal: (state, action) => {
      const id = action.payload;
      const item = state.list.find((x) => idOf(x) === id);
      if (item && isUnread(item)) {
        item.is_read = true;
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    /** Локально отметить все прочитанными. */
    allMarkedReadLocal: (state) => {
      state.list = state.list.map((n) => ({ ...n, is_read: true, read: true }));
      state.unreadCount = 0;
    },
    /** Явная установка счётчика непрочитанных (из WS-события счётчика). */
    unreadCountSet: (state, action) => {
      state.unreadCount = Math.max(0, Number(action.payload) || 0);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationsAsync.pending, (state, action) => {
        if (action.meta.arg?.append) state.loadingMore = true;
        else state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationsAsync.fulfilled, (state, action) => {
        const { data, append } = action.payload || {};
        const results = data?.results ?? (Array.isArray(data) ? data : []);
        const count =
          typeof data?.count === 'number' ? data.count : results.length;
        state.loading = false;
        state.loadingMore = false;

        if (append) {
          const existing = new Set(state.list.map(idOf));
          state.list = state.list.concat(
            results.filter((n) => !existing.has(idOf(n))),
          );
        } else {
          state.list = results;
        }
        state.count = count;
        state.hasMore = state.list.length < count;
        state.unreadCount =
          typeof data?.unread_count === 'number'
            ? data.unread_count
            : state.list.filter(isUnread).length;
      })
      .addCase(fetchNotificationsAsync.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload;
      })

      // mark ALL read (оптимистично)
      .addCase(markAllNotificationsReadAsync.pending, (state) => {
        state.markingAllRead = true;
        state.list = state.list.map((n) => ({ ...n, is_read: true, read: true }));
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsReadAsync.fulfilled, (state) => {
        state.markingAllRead = false;
      })
      .addCase(markAllNotificationsReadAsync.rejected, (state) => {
        state.markingAllRead = false;
      })

      // mark ONE read (оптимистично в pending; откат в rejected)
      .addCase(markNotificationReadAsync.pending, (state, action) => {
        const id = action.meta.arg;
        const item = state.list.find((x) => idOf(x) === id);
        if (item && isUnread(item)) {
          item.is_read = true;
          item.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationReadAsync.rejected, (state, action) => {
        const id = action.payload?.id;
        const item = state.list.find((x) => idOf(x) === id);
        if (item) {
          item.is_read = false;
          item.read = false;
          state.unreadCount += 1;
        }
      })

      .addCase(fetchNotificationDetailAsync.fulfilled, (state, action) => {
        state.detail = action.payload;
      });
  },
});

export const {
  notificationReceived,
  notificationMarkedReadLocal,
  allMarkedReadLocal,
  unreadCountSet,
} = notificationSlice.actions;

export default notificationSlice.reducer;
