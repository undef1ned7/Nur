import { createSlice, createSelector } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

// ---- Базовые селекторы стора (экспортируем!)
export const selectUI = (s) => s.ui;
export const selectTx = (s) => s.jobs.transactions;
export const selectDepts = (s) => s.jobs.depts;

// ---- Производные селекторы
export const selectDeptsMap = createSelector([selectDepts], (depts) => {
  const map = new Map();
  (depts || []).forEach((d) => map.set(d.id, d));
  return map;
});

export const selectResolvedItems = createSelector(
  [selectTx, selectDeptsMap],
  (txs, dmap) =>
    (txs || []).map((t) => {
      const dep = dmap.get(t.department) || {};
      const dt = t.date ? `${t.date}T00:00:00` : new Date().toISOString();
      return {
        id: t.id || t.uuid || t.pk,
        departmentId: t.department,
        departmentName: dep.name || "—",
        title: t.name || "(без названия)",
        details: t.amount ? `Сумма: ${t.amount}` : t.details || "",
        datetime: dt,
        status: t.status || "new", // дефолт к API-статусу
      };  
    })
);

export const selectFiltered = createSelector(
  [selectResolvedItems, selectUI],
  (items, ui) =>
    items
      .filter((it) =>
        ui.selectedDepts.length
          ? ui.selectedDepts.includes(it.departmentId)
          : true
      )
      .filter((it) =>
        ui.selectedStatuses.length
          ? ui.selectedStatuses.includes(it.status)
          : true
      )
      .filter((it) =>
        ui.search
          ? (it.title + " " + it.details)
              .toLowerCase()
              .includes(ui.search.toLowerCase())
          : true
      )
      .filter((it) => {
        if (ui.dateFrom) {
          const from = new Date(ui.dateFrom + "T00:00:00");
          if (new Date(it.datetime) < from) return false;
        }
        if (ui.dateTo) {
          const to = new Date(ui.dateTo + "T23:59:59");
          if (new Date(it.datetime) > to) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
);

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    view: "table",
    selectedDepts: [], // массив UUID отделов
    selectedStatuses: [], // ['new','in_progress','review','done','blocked']
    dateFrom: "",
    dateTo: "",
    search: "",
    createOpen: false,
    flash: "",
  },
  reducers: {
    setView: (s, { payload }) => {
      s.view = payload;
    },
    toggleDept: (s, { payload }) => {
      s.selectedDepts = s.selectedDepts.includes(payload)
        ? s.selectedDepts.filter((d) => d !== payload)
        : [...s.selectedDepts, payload];
    },
    toggleStatus: (s, { payload }) => {
      s.selectedStatuses = s.selectedStatuses.includes(payload)
        ? s.selectedStatuses.filter((d) => d !== payload)
        : [...s.selectedStatuses, payload];
    },
    setDateFrom: (s, { payload }) => {
      s.dateFrom = payload;
    },
    setDateTo: (s, { payload }) => {
      s.dateTo = payload;
    },
    setSearch: (s, { payload }) => {
      s.search = payload;
    },
    openCreate: (s) => {
      s.createOpen = true;
    },
    closeCreate: (s) => {
      s.createOpen = false;
    },
    setFlash: (s, { payload }) => {
      s.flash = payload;
    },
    clearFlash: (s) => {
      s.flash = "";
    },
  },
});

export const {
  setView,
  toggleDept,
  toggleStatus,
  setDateFrom,
  setDateTo,
  setSearch,
  openCreate,
  closeCreate,
  setFlash,
  clearFlash,
} = uiSlice.actions;

export const useUi = () => useSelector((state) => state.ui);
export default uiSlice.reducer;
