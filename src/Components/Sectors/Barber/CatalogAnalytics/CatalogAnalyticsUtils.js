// CatalogAnalyticsUtils.js
import { useEffect, useMemo, useState } from "react";
import api from "../../../../api";

/* ─── helpers ─── */
export const toNum = (v) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

export const fmt = (x) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
    toNum(x)
  );

export const take = (arr, n) => arr.slice(0, n);

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const clean = (s, fallback = "—") =>
  (s ?? "").toString().trim() || fallback;

export const keyOf = (s, fallback = "—") =>
  clean(s, fallback).replace(/\s+/g, " ").toLowerCase();

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

export const tsOf = (x) => {
  const v =
    x?.created_at ||
    x?.sold_at ||
    x?.date ||
    x?.datetime ||
    x?.accepted_at ||
    x?.updated_at;
  const t = v ? new Date(v).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/* ─── пагинатор ─── */
export const usePaged = (rows, pageSize) => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => setPage(1), [rows, pageSize]);

  const slice = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );

  return { page, pages, setPage, slice };
};

/* ─── кассовые операции (все страницы) ─── */
export async function fetchAllConstructionCashflows(params = {}) {
  const acc = [];
  let page = 1;
  // простая пагинация, без зацикливания
  // (бекап if next зациклится)
  const seen = new Set();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const key = `${page}`;
    if (seen.has(key)) break;
    seen.add(key);

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
