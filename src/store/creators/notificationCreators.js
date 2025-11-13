import { createAsyncThunk } from '@reduxjs/toolkit';
import { getNotifications, markAllNotificationsRead, getNotificationDetail } from '../../api/notification';

export const fetchNotificationsAsync = createAsyncThunk(
  'notification/fetchAll',
  async (params, thunkAPI) => {
    try {
      return await getNotifications(params);
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
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