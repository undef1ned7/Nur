import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

const BASE = "/consalting";

/* ===================== Воронки (Funnels) ===================== */

export const getFunnels = createAsyncThunk(
  "funnel/getFunnels",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/funnels/`, { params });
      // Поддерживаем как пагинацию, так и простой массив
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const createFunnel = createAsyncThunk(
  "funnel/createFunnel",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/funnels/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const updateFunnel = createAsyncThunk(
  "funnel/updateFunnel",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/funnels/${id}/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const deleteFunnel = createAsyncThunk(
  "funnel/deleteFunnel",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/funnels/${id}/`);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Доска (канбан) — воронка + колонки + лиды без стадии */
export const getFunnelBoard = createAsyncThunk(
  "funnel/getBoard",
  async (funnelId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/funnels/${funnelId}/board/`);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Стадии (Funnel Stages) ===================== */

export const getFunnelStages = createAsyncThunk(
  "funnel/getStages",
  async (funnelId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/funnel-stages/`, {
        params: { funnel: funnelId },
      });
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const createStage = createAsyncThunk(
  "funnel/createStage",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/funnel-stages/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const updateStage = createAsyncThunk(
  "funnel/updateStage",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/funnel-stages/${id}/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const deleteStage = createAsyncThunk(
  "funnel/deleteStage",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/funnel-stages/${id}/`);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Лиды (Leads) ===================== */

export const getLeads = createAsyncThunk(
  "funnel/getLeads",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/leads/`, { params });
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const createLead = createAsyncThunk(
  "funnel/createLead",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const updateLead = createAsyncThunk(
  "funnel/updateLead",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/leads/${id}/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const deleteLead = createAsyncThunk(
  "funnel/deleteLead",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/leads/${id}/`);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Перемещение лида между стадиями (drag & drop) */
export const moveLeadStage = createAsyncThunk(
  "funnel/moveStage",
  async ({ id, stage }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/move-stage/`, {
        stage,
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Разрешённые переходы для лида (подсветка валидных колонок) */
export const getAllowedTransitions = createAsyncThunk(
  "funnel/allowedTransitions",
  async (leadId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `${BASE}/leads/${leadId}/allowed-transitions/`
      );
      return data; // { current_stage, allowed: [...] }
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Пересчитать скоринг лида */
export const recalculateScore = createAsyncThunk(
  "funnel/recalculateScore",
  async (leadId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/leads/${leadId}/recalculate-score/`
      );
      return data; // обновлённая карточка лида
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Закрыть лид успешно */
export const winLead = createAsyncThunk(
  "funnel/winLead",
  async ({ id, stage }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/leads/${id}/win/`,
        stage ? { stage } : {}
      );
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Закрыть лид с потерей (причина обязательна) */
export const loseLead = createAsyncThunk(
  "funnel/loseLead",
  async ({ id, loss_reason, loss_comment, stage }, { rejectWithValue }) => {
    try {
      const payload = { loss_reason, loss_comment };
      if (stage) payload.stage = stage;
      const { data } = await api.post(`${BASE}/leads/${id}/lose/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Лента активностей (timeline) ===================== */

export const getLeadTimeline = createAsyncThunk(
  "funnel/getTimeline",
  async (leadId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/leads/${leadId}/timeline/`);
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const addLeadActivity = createAsyncThunk(
  "funnel/addActivity",
  async ({ leadId, type, title, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${leadId}/activities/`, {
        type,
        title,
        body,
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Задачи по лидам (lead-tasks) ===================== */

export const getLeadTasks = createAsyncThunk(
  "funnel/getLeadTasks",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/lead-tasks/`, { params });
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const createLeadTask = createAsyncThunk(
  "funnel/createLeadTask",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/lead-tasks/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const updateLeadTask = createAsyncThunk(
  "funnel/updateLeadTask",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/lead-tasks/${id}/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const deleteLeadTask = createAsyncThunk(
  "funnel/deleteLeadTask",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/lead-tasks/${id}/`);
      return id;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Причины проигрыша (loss-reasons) ===================== */

export const getLossReasons = createAsyncThunk(
  "funnel/getLossReasons",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/loss-reasons/`, {
        params: { is_active: true, ...params },
      });
      return Array.isArray(data) ? data : data.results || [];
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

export const createLossReason = createAsyncThunk(
  "funnel/createLossReason",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/loss-reasons/`, payload);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* ===================== Аналитика воронки ===================== */

export const getFunnelAnalytics = createAsyncThunk(
  "funnel/getAnalytics",
  async ({ funnelId, params } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `${BASE}/funnels/${funnelId}/analytics/`,
        { params }
      );
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);
