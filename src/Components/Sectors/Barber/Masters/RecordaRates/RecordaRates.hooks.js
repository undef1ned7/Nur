// RecordaRates.hooks.js
import { useMemo } from "react";
import {
  isCompleted,
  y_m_fromStartAt,
  dateKG,
  toNum,
} from "./RecordaRates.utils";

export const useMasterAggregates = (appointments, year, month) => {
  const doneByMaster = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [appointments, year, month]);

  const revenueByMaster = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!key) continue;
      const price = toNum(a?.price);
      map.set(key, (map.get(key) || 0) + price);
    }
    return map;
  }, [appointments, year, month]);

  const daysByMaster = useMemo(() => {
    const m = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const empId = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!empId) continue;
      const day = dateKG(a?.start_at);
      const inner = m.get(empId) || new Map();
      const prev = inner.get(day) || { records: 0, revenue: 0 };
      const price = toNum(a?.price);
      inner.set(day, {
        records: prev.records + 1,
        revenue: prev.revenue + price,
      });
      m.set(empId, inner);
    }
    return m;
  }, [appointments, year, month]);

  return { doneByMaster, revenueByMaster, daysByMaster };
};

export const useYearOptions = () =>
  useMemo(() => [2025, 2026, 2027], []);
