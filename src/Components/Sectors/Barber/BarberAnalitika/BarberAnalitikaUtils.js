// BarberAnalitikaUtils.js
import { useEffect, useMemo, useState } from "react";
import api from "../../../../api";

/* ─── helpers ─── */
export const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const fmt = (x) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(toNum(x));

export const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");

export const fmtMoney = (n) => `${fmt(n)} c`;

export const take = (arr, n) => arr.slice(0, n);

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const clean = (s, fallback = "—") =>
  (s ?? "").toString().trim() || fallback;

export const keyOf = (s, fallback = "—") =>
  clean(s, fallback).replace(/\s+/g, " ").toLowerCase();

export const pad2 = (n) => String(n).padStart(2, "0");

export const months = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const monthRange = (year, monthIdx) => {
  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
  return { startTs: start.getTime(), endTs: end.getTime() - 1 };
};

// Форматирование даты в формат YYYY-MM-DD для API
export const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/* для записей берём start_at */
export const tsOf = (x) => {
  const v =
    x?.start_at ||
    x?.sold_at ||
    x?.date ||
    x?.datetime ||
    x?.accepted_at ||
    x?.updated_at ||
    x?.created_at;
  const t = v ? new Date(v).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

export const padDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* ─── cashflows (кассы строительства) ─── */
export async function fetchAllConstructionCashflows(params = {}) {
  const acc = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await api.get("/construction/cashflows/", {
        params: { page, page_size: 200, ...params },
      });
      const rows = asArray(res?.data);
      acc.push(...rows);
      if (!res?.data?.next) break;
      page += 1;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  return acc;
}

/* ─── tiny pager ─── */
export const usePaged = (rows, pageSize) => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => setPage(1), [rows, pageSize]);

  const slice = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  return { page, pages, setPage, slice };
};
