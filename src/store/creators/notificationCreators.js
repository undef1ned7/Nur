import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getNotifications,
  markAllNotificationsRead,
  getNotificationDetail,
  markNotificationRead,
} from '../../api/notification';

export const fetchNotificationsAsync = createAsyncThunk(
  'notification/fetchAll',
  async (params, thunkAPI) => {
    try {
      const data = await getNotifications(params);
      // Признак догрузки страницы (lazy load) — не затирать список, а добавить.
      return { data, append: Boolean(params?.append), offset: params?.offset || 0 };
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

// Отметить ОДНО уведомление прочитанным (с оптимистичным обновлением в слайсе).
export const markNotificationReadAsync = createAsyncThunk(
  'notification/markOneRead',
  async (id, thunkAPI) => {
    try {
      await markNotificationRead(id);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue({ id, err });
    }
  }
);

export const markAllNotificationsReadAsync = createAsyncThunk(
  'notification/markAllRead',
  async (_, thunkAPI) => {
    try {
      return await markAllNotificationsRead();
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const fetchNotificationDetailAsync = createAsyncThunk(
  'notification/fetchOne',
  async (id, thunkAPI) => {
    try {
      return await getNotificationDetail(id);
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);