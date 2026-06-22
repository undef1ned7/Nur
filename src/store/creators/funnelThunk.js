import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";
import { normalizeDealCreateInput } from "../../tools/clientDeals";
import {
  fetchAccessibleFunnelBoards,
  fetchFunnelBoard,
} from "../../utils/funnelBoardFetch";

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
      return await fetchFunnelBoard(funnelId);
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/** Все доски доступных воронок (предпочтительно один запрос). */
export const getAccessibleFunnelBoards = createAsyncThunk(
  "funnel/getAccessibleBoards",
  async (funnelIds = [], { rejectWithValue }) => {
    try {
      return await fetchAccessibleFunnelBoards({
        funnelIds: Array.isArray(funnelIds) ? funnelIds : [],
      });
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  },
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

/* Передача лида в другую воронку (копия на основе исходного) */
export const transferLeadToFunnel = createAsyncThunk(
  "funnel/transferLead",
  async ({ id, target_funnel, target_stage = null }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/transfer/`, {
        target_funnel,
        target_stage,
      });
      return data;
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        try {
          const { data: source } = await api.get(`${BASE}/leads/${id}/`);
          const { data: created } = await api.post(`${BASE}/leads/`, {
            funnel: target_funnel,
            stage: target_stage,
            source_lead: id,
            title: source.title,
            full_name: source.full_name,
            phone: source.phone,
            email: source.email,
            source: source.source,
            description: source.description,
            estimated_value: source.estimated_value,
            probability: source.probability,
            urgency: source.urgency,
          });
          return created;
        } catch (fallbackErr) {
          return rejectWithValue(
            fallbackErr.response?.data || fallbackErr.message,
          );
        }
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
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

/** Участники лида (после создания, если bulk в POST не поддержан). */
export const setLeadParticipants = createAsyncThunk(
  "funnel/setLeadParticipants",
  async ({ id, participant_ids }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/participants/`, {
        participant_ids,
      });
      return data;
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        return { id, participant_ids, skipped: true };
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
);

/** Перенос завершённого лида в архив. */
export const archiveLead = createAsyncThunk(
  "funnel/archiveLead",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/archive/`);
      return data;
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        const { data } = await api.patch(`${BASE}/leads/${id}/`, {
          is_archived: true,
        });
        return data;
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
);

/** Архивные (завершённые) лиды для просмотра. */
export const getArchivedLeads = createAsyncThunk(
  "funnel/getArchivedLeads",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/leads/archived/`);
      return Array.isArray(data) ? data : data.results || data.leads || [];
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        const { data } = await api.get(`${BASE}/leads/`, {
          params: { is_archived: true, status: "won" },
        });
        return Array.isArray(data) ? data : data.results || [];
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
);

/* Взять лид из общего пула */
export const claimLead = createAsyncThunk(
  "funnel/claimLead",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/claim/`);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Вернуть лид в общий пул */
export const releaseLead = createAsyncThunk(
  "funnel/releaseLead",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/release/`);
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);

/* Назначить ответственного (руководитель) */
export const assignLead = createAsyncThunk(
  "funnel/assignLead",
  async ({ id, owner }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/leads/${id}/assign/`, { owner });
      return data;
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

/** Создать клиента на основе лида и привязать к карточке. */
export const createClientFromLead = createAsyncThunk(
  "funnel/createClientFromLead",
  async ({ leadId, ...clientData }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/leads/${leadId}/create-client/`,
        clientData,
      );
      return data?.client || data;
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        try {
          const { data: lead } = await api.get(`${BASE}/leads/${leadId}/`);
          const payload = {
            full_name:
              clientData.full_name || lead.full_name || lead.title || "Клиент",
            phone: clientData.phone || lead.phone || "",
            email: clientData.email || lead.email || "",
            type: "client",
            note: clientData.note || lead.description || "",
            source_lead: leadId,
            service: clientData.service || lead.service || undefined,
          };
          const { data: client } = await api.post("/main/clients/", payload);
          await api.patch(`${BASE}/leads/${leadId}/`, { client: client.id });
          return client;
        } catch (fallbackErr) {
          return rejectWithValue(
            fallbackErr.response?.data || fallbackErr.message,
          );
        }
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
);

/** Оформить оплату по лиду (наличные, перевод, долг, рассрочка). */
export const registerLeadPayment = createAsyncThunk(
  "funnel/registerLeadPayment",
  async (
    { leadId, payment_mode, amount, debt_months, prepayment, note },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post(
        `${BASE}/leads/${leadId}/register-payment/`,
        { payment_mode, amount, debt_months, prepayment, note },
      );
      return data;
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 501) {
        try {
          const { data: lead } = await api.get(`${BASE}/leads/${leadId}/`);
          const clientId = lead.client || lead.client_id;
          if (!clientId) {
            return rejectWithValue(
              "Сначала создайте клиента из лида.",
            );
          }
          const statusRuMap = {
            cash: "Продажа",
            transfer: "Продажа",
            debt: "Долги",
            installment: "Предоплата",
          };
          const payLabel =
            payment_mode === "transfer"
              ? "Перевод"
              : payment_mode === "cash"
                ? "Наличные"
                : payment_mode === "installment"
                  ? "Рассрочка"
                  : "Долг";
          const dealPayload = normalizeDealCreateInput({
            clientId,
            title: lead.title || "Оплата по лиду",
            statusRu: statusRuMap[payment_mode] || "Продажа",
            amount,
            debtMonths: debt_months,
            prepayment,
            note: [note, payLabel].filter(Boolean).join(" · "),
          });
          dealPayload.lead = leadId;
          dealPayload.payment_method = payment_mode;
          const { data: deal } = await api.post(
            `/main/clients/${clientId}/deals/`,
            dealPayload,
          );
          await api.patch(`${BASE}/leads/${leadId}/`, {
            payment_registered: true,
            payment_mode,
          });
          return { deal, lead_id: leadId, client_id: clientId };
        } catch (fallbackErr) {
          return rejectWithValue(
            fallbackErr.response?.data || fallbackErr.message,
          );
        }
      }
      return rejectWithValue(e.response?.data || e.message);
    }
  },
);
