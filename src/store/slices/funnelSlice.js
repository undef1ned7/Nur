import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  getFunnels,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  getFunnelBoard,
  createStage,
  updateStage,
  deleteStage,
  createLead,
  updateLead,
  deleteLead,
  moveLeadStage,
  claimLead,
  releaseLead,
  assignLead,
  getAllowedTransitions,
  recalculateScore,
  winLead,
  loseLead,
  getLeadTimeline,
  addLeadActivity,
  getLeadTasks,
  createLeadTask,
  updateLeadTask,
  deleteLeadTask,
  getLossReasons,
  createLossReason,
  getFunnelAnalytics,
} from "../creators/funnelThunk";

const initialState = {
  funnels: [],
  board: null, // { funnel, columns: [{ stage, leads }], unassigned: [] }
  loading: false, // загрузка списка воронок / общих операций
  boardLoading: false, // загрузка доски
  error: null,

  // справочники / расширенные данные
  lossReasons: [],
  analytics: null,
  analyticsLoading: false,

  // данные по открытой карточке лида
  allowedTransitions: null, // { current_stage, allowed: [...] }
  timeline: [],
  timelineLoading: false,
  tasks: [],
  tasksLoading: false,
};

/* ---------- helpers ---------- */

// Найти и удалить лид из всех колонок/unassigned, вернуть удалённый
const pluckLead = (board, leadId) => {
  if (!board) return null;
  let removed = null;
  for (const col of board.columns || []) {
    const i = (col.leads || []).findIndex((l) => l.id === leadId);
    if (i !== -1) {
      removed = col.leads.splice(i, 1)[0];
      return removed;
    }
  }
  const j = (board.unassigned || []).findIndex((l) => l.id === leadId);
  if (j !== -1) removed = board.unassigned.splice(j, 1)[0];
  return removed;
};

// Положить лид в колонку нужной стадии (или в unassigned)
const placeLead = (board, lead) => {
  if (!board) return;
  const stageId = lead.stage;
  if (!stageId) {
    board.unassigned = [lead, ...(board.unassigned || [])];
    return;
  }
  const col = (board.columns || []).find((c) => c.stage?.id === stageId);
  if (col) {
    col.leads = [lead, ...(col.leads || [])];
  } else {
    board.unassigned = [lead, ...(board.unassigned || [])];
  }
};

// Лид относится к текущей открытой воронке?
const belongsToBoard = (board, lead) =>
  board && lead && board.funnel?.id === lead.funnel;

const funnelSlice = createSlice({
  name: "funnel",
  initialState,
  reducers: {
    clearFunnelError: (state) => {
      state.error = null;
    },
    // сбросить данные открытой карточки лида (при закрытии модалки)
    clearLeadDetail: (state) => {
      state.timeline = [];
      state.tasks = [];
      state.allowedTransitions = null;
    },
    // Оптимистичное перемещение карточки в UI до ответа сервера
    moveLeadLocally: (state, { payload: { leadId, toStageId } }) => {
      const lead = pluckLead(state.board, leadId);
      if (!lead) return;
      lead.stage = toStageId || null;
      placeLead(state.board, lead);
    },
    // Real-time: добавить или обновить карточку (WebSocket upsert)
    upsertLeadOnBoard: (state, { payload: lead }) => {
      if (!belongsToBoard(state.board, lead)) return;
      pluckLead(state.board, lead.id);
      placeLead(state.board, lead);
    },
    // Real-time: убрать карточку с доски (WebSocket removed/deleted)
    removeLeadFromBoard: (state, { payload: id }) => {
      pluckLead(state.board, id);
    },
  },
  extraReducers: (builder) => {
    builder
      /* ---------- funnels ---------- */
      .addCase(getFunnels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getFunnels.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.funnels = payload;
      })
      .addCase(getFunnels.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(createFunnel.fulfilled, (state, { payload }) => {
        state.funnels = [payload, ...(state.funnels || [])];
      })
      .addCase(createFunnel.rejected, (state, { payload }) => {
        state.error = payload;
      })

      .addCase(updateFunnel.fulfilled, (state, { payload }) => {
        state.funnels = (state.funnels || []).map((f) =>
          f.id === payload.id ? payload : f
        );
        if (state.board?.funnel?.id === payload.id) {
          state.board.funnel = { ...state.board.funnel, ...payload };
        }
      })
      .addCase(deleteFunnel.fulfilled, (state, { payload: id }) => {
        state.funnels = (state.funnels || []).filter((f) => f.id !== id);
        if (state.board?.funnel?.id === id) state.board = null;
      })

      /* ---------- board ---------- */
      .addCase(getFunnelBoard.pending, (state) => {
        state.boardLoading = true;
        state.error = null;
      })
      .addCase(getFunnelBoard.fulfilled, (state, { payload }) => {
        state.boardLoading = false;
        state.board = payload;
      })
      .addCase(getFunnelBoard.rejected, (state, { payload }) => {
        state.boardLoading = false;
        state.error = payload;
      })

      /* ---------- stages ---------- */
      .addCase(createStage.fulfilled, (state, { payload }) => {
        const board = state.board;
        if (board && board.funnel?.id === payload.funnel) {
          board.columns = [...(board.columns || []), { stage: payload, leads: [] }];
          board.columns.sort(
            (a, b) => (a.stage?.order ?? 0) - (b.stage?.order ?? 0)
          );
        }
      })
      .addCase(createStage.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(updateStage.fulfilled, (state, { payload }) => {
        const col = (state.board?.columns || []).find(
          (c) => c.stage?.id === payload.id
        );
        if (col) col.stage = { ...col.stage, ...payload };
        state.board?.columns?.sort(
          (a, b) => (a.stage?.order ?? 0) - (b.stage?.order ?? 0)
        );
      })
      .addCase(deleteStage.fulfilled, (state, { payload: id }) => {
        const board = state.board;
        if (!board) return;
        const col = (board.columns || []).find((c) => c.stage?.id === id);
        if (col) {
          // лиды стадии переходят в "без стадии"
          for (const lead of col.leads || []) {
            lead.stage = null;
            board.unassigned = [lead, ...(board.unassigned || [])];
          }
          board.columns = board.columns.filter((c) => c.stage?.id !== id);
        }
      })

      /* ---------- leads ---------- */
      .addCase(createLead.fulfilled, (state, { payload }) => {
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(createLead.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(updateLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(deleteLead.fulfilled, (state, { payload: id }) => {
        pluckLead(state.board, id);
      })

      /* ---------- move-stage ---------- */
      .addCase(moveLeadStage.fulfilled, (state, { payload }) => {
        // синхронизируем карточку с серверной (status/closed_at могли поменяться)
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        placeLead(state.board, payload);
      })
      .addCase(moveLeadStage.rejected, (state, { payload }) => {
        state.error = payload;
      })

      .addCase(claimLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(claimLead.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(releaseLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(releaseLead.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(assignLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(assignLead.rejected, (state, { payload }) => {
        state.error = payload;
      })

      /* ---------- win / lose / score (возвращают карточку лида) ---------- */
      .addCase(winLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(winLead.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(loseLead.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })
      .addCase(loseLead.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(recalculateScore.fulfilled, (state, { payload }) => {
        if (!state.board) return;
        pluckLead(state.board, payload.id);
        if (belongsToBoard(state.board, payload)) placeLead(state.board, payload);
      })

      /* ---------- allowed transitions ---------- */
      .addCase(getAllowedTransitions.pending, (state) => {
        state.allowedTransitions = null;
      })
      .addCase(getAllowedTransitions.fulfilled, (state, { payload }) => {
        state.allowedTransitions = payload;
      })

      /* ---------- timeline ---------- */
      .addCase(getLeadTimeline.pending, (state) => {
        state.timelineLoading = true;
      })
      .addCase(getLeadTimeline.fulfilled, (state, { payload }) => {
        state.timelineLoading = false;
        state.timeline = payload;
      })
      .addCase(getLeadTimeline.rejected, (state, { payload }) => {
        state.timelineLoading = false;
        state.error = payload;
      })
      .addCase(addLeadActivity.fulfilled, (state, { payload }) => {
        state.timeline = [payload, ...(state.timeline || [])];
      })
      .addCase(addLeadActivity.rejected, (state, { payload }) => {
        state.error = payload;
      })

      /* ---------- lead tasks ---------- */
      .addCase(getLeadTasks.pending, (state) => {
        state.tasksLoading = true;
      })
      .addCase(getLeadTasks.fulfilled, (state, { payload }) => {
        state.tasksLoading = false;
        state.tasks = payload;
      })
      .addCase(getLeadTasks.rejected, (state, { payload }) => {
        state.tasksLoading = false;
        state.error = payload;
      })
      .addCase(createLeadTask.fulfilled, (state, { payload }) => {
        state.tasks = [payload, ...(state.tasks || [])];
      })
      .addCase(createLeadTask.rejected, (state, { payload }) => {
        state.error = payload;
      })
      .addCase(updateLeadTask.fulfilled, (state, { payload }) => {
        state.tasks = (state.tasks || []).map((t) =>
          t.id === payload.id ? payload : t
        );
      })
      .addCase(deleteLeadTask.fulfilled, (state, { payload: id }) => {
        state.tasks = (state.tasks || []).filter((t) => t.id !== id);
      })

      /* ---------- loss reasons ---------- */
      .addCase(getLossReasons.fulfilled, (state, { payload }) => {
        state.lossReasons = payload;
      })
      .addCase(createLossReason.fulfilled, (state, { payload }) => {
        state.lossReasons = [...(state.lossReasons || []), payload];
      })

      /* ---------- analytics ---------- */
      .addCase(getFunnelAnalytics.pending, (state) => {
        state.analyticsLoading = true;
        state.analytics = null;
      })
      .addCase(getFunnelAnalytics.fulfilled, (state, { payload }) => {
        state.analyticsLoading = false;
        state.analytics = payload;
      })
      .addCase(getFunnelAnalytics.rejected, (state, { payload }) => {
        state.analyticsLoading = false;
        state.error = payload;
      });
  },
});

export const {
  clearFunnelError,
  clearLeadDetail,
  moveLeadLocally,
  upsertLeadOnBoard,
  removeLeadFromBoard,
} = funnelSlice.actions;
export const useFunnel = () => useSelector((state) => state.funnel);

export default funnelSlice.reducer;
