import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getNotifications,
  markAllNotificationsRead,
  getNotificationDetail,
  markNotificationRead,
} from '../../api/notification';
import { consultingNotificationLeadId } from '../../utils/consultingLeadSources';

const isUnread = (n) => !(n?.is_read ?? n?.read ?? false);
const idOf = (n) => n?.id ?? n?.uuid ?? n?.pk;

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

/**
 * Открыли чат лида → все непрочитанные уведомления по этому lead_id
 * помечаем прочитанными (колокольчик + POST /notifications/{id}/read/).
 */
export const markLeadNotificationsReadAsync = createAsyncThunk(
  'notification/markLeadRead',
  async (leadId, thunkAPI) => {
    const id = leadId != null ? String(leadId) : '';
    if (!id) return { leadId: id, ids: [] };

    let list = thunkAPI.getState().notification?.list || [];
    if (!list.length) {
      try {
        await thunkAPI
          .dispatch(fetchNotificationsAsync({ limit: 50, offset: 0 }))
          .unwrap();
      } catch {
        /* список опционален — всё равно пробуем локальный стейт */
      }
      list = thunkAPI.getState().notification?.list || [];
    }

    const targets = list.filter(
      (n) =>
        isUnread(n) && String(consultingNotificationLeadId(n) || '') === id,
    );
    const ids = targets.map(idOf).filter((x) => x != null && x !== '');

    // Оптимистично до API (тип = notificationSlice.markLeadNotificationsReadLocal).
    thunkAPI.dispatch({
      type: 'notification/markLeadNotificationsReadLocal',
      payload: id,
    });

    await Promise.allSettled(
      ids.map(async (notifId) => {
        try {
          await markNotificationRead(notifId);
        } catch {
          /* синтетический id от WS — локально уже прочитано */
        }
      }),
    );
    return { leadId: id, ids };
  },
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
