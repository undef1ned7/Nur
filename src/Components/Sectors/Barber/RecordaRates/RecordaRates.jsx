import React, { useMemo, useState, useEffect } from "react";
import "./RecordaRates.scss";
import { FaSync } from "react-icons/fa";

const PAGE_SIZE = 12;
const pad2 = (n) => String(n).padStart(2, "0");
const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/* ===== helpers ===== */
const KG_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+06
const isCompleted = (s) => {
  const v = String(s || "").trim().toLowerCase();
  return v === "completed" || v === "завершено" || v === "завершен";
};
/** быстрый YYYY-MM из start_at; если формат странный — берём время в +06 */
const y_m_fromStartAt = (iso) => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]) };
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  const kg = new Date(t + KG_OFFSET_MS);
  return { y: kg.getUTCFullYear(), m: kg.getUTCMonth() + 1 };
};
/** валидация денег */
const clampMoney = (value, max = 10_000_000) => {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
};

/**
 * ЛОКАЛЬНЫЕ правки по периодам: draftRates хранит значения отдельно по каждому месяцу.
 * Ключ: draftRates[barberId][period] = { perRecord?, perMonth? }
 * Это гарантирует, что «фикс / месяц» редактируется и применяется ТОЛЬКО для выбранного месяца.
 */
const getDraft = (draft, barberId, period) => draft?.[barberId]?.[period] || {};

const RecordaRates = ({
  year,                      // <- управляется родителем
  month,                     // <- управляется родителем
  onChangeYear,              // (y:number) => void
  onChangeMonth,             // (m:number) => void
  employees = [],
  appointments = [],         // весь массив, НЕ фильтрованный
  rates = {},                // ставки ТЕКУЩЕГО периода от родителя
  ratesLoading = false,
  ratesError = "",
  onChangeRate,              // (barberId, field, value) => void (используем для синка текущего периода)
  onSaveRates,               // ({ perRecordPeriod, perMonthPeriods }) => void
}) => {
  const [page, setPage] = useState(1);
  const [draftRates, setDraftRates] = useState({});
  const period = `${year}-${pad2(month)}`;

  // Когда сменился период или прилетели новые rates — сбрасываем/синхронизируем драфт для текущего периода
  useEffect(() => {
    setPage(1);
    // создадим слепок для текущего периода, чтобы инпуты показывали значения из props
    setDraftRates((prev) => {
      const next = { ...prev };
      Object.keys(rates || {}).forEach((barberId) => {
        const r = rates[barberId] || {};
        next[barberId] = next[barberId] || {};
        next[barberId][period] = {
          perRecord: r.perRecord === "" || r.perRecord == null ? 0 : Number(r.perRecord) || 0,
          perMonth:  r.perMonth  === "" || r.perMonth  == null ? 0 : Number(r.perMonth)  || 0,
        };
      });
      return next;
    });
  }, [period, rates]);

  /* ===== мастера ===== */
  const normalizedEmployees = useMemo(() => {
    const seen = new Set();
    const arr = [];
    for (const e of Array.isArray(employees) ? employees : []) {
      const id = String(e?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      arr.push({ id, name: e?.name || "—" });
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [employees]);

  /* ===== завершённые по мастеру за выбранный период ===== */
  const doneByMaster = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? "");
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [appointments, year, month]);

  /* ===== строки таблицы ===== */
  const rows = useMemo(() => {
    return normalizedEmployees.map((e) => {
      const base = rates[e.id] || {};
      const draft = getDraft(draftRates, e.id, period);
      const perRec = draft.perRecord ?? (base.perRecord === "" || base.perRecord == null ? 0 : Number(base.perRecord) || 0);
      const perMon = draft.perMonth  ?? (base.perMonth  === "" || base.perMonth  == null ? 0 : Number(base.perMonth)  || 0);
      const completed = Number(doneByMaster.get(String(e.id)) || 0);
      const total = completed * perRec + perMon;
      return { id: e.id, name: e.name, completed, perRecord: perRec, perMonth: perMon, total };
    });
  }, [normalizedEmployees, rates, draftRates, doneByMaster, period]);

  const totals = useMemo(() => rows.reduce((acc, r) => acc + Number(r.total || 0), 0), [rows]);

  /* ===== пагинация ===== */
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ===== изменение ставок (только для ТЕКУЩЕГО месяца) ===== */
  const handleRateChange = (barberId, field, raw) => {
    const nextVal = raw === "" ? "" : clampMoney(raw);
    setDraftRates((prev) => {
      const byUser = { ...(prev[barberId] || {}) };
      byUser[period] = { ...(byUser[period] || {}), [field]: nextVal };
      return { ...prev, [barberId]: byUser };
    });
    // Синхронизируем видимый месяц с родителем (его rates относится к текущему периоду)
    onChangeRate?.(barberId, field, nextVal);
  };

  /* ===== сохранить — ТОЛЬКО текущий месяц/год ===== */
  const handleSave = () => {
    onSaveRates?.({ perRecordPeriod: period, perMonthPeriods: [period] });
  };

  return (
    <section className="recordarates" aria-label="Выплаты мастерам">
      <header className="recordarates__header">
        <h2 className="recordarates__title">Выплаты</h2>

        <div className="recordarates__filters" aria-label="Период">
          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Месяц</span>
            <select
              className="recordarates__select"
              value={month}
              onChange={(e) => { onChangeMonth?.(Number(e.target.value)); setPage(1); }}
              aria-label="Месяц"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>

          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Год</span>
            <select
              className="recordarates__select"
              value={year}
              onChange={(e) => { onChangeYear?.(Number(e.target.value)); setPage(1); }}
              aria-label="Год"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="recordarates__btn recordarates__btn--primary recordarates__btn--icon"
          onClick={handleSave}
          disabled={ratesLoading}
          aria-label="Сохранить ставки"
          title="Сохранить ставки"
          type="button"
        >
          <FaSync />
          <span className="recordarates__btnText">
            {ratesLoading ? "Сохранение…" : "Сохранить ставки (текущий месяц)"}
          </span>
        </button>
      </header>

      {ratesError && <div className="recordarates__alert">{ratesError}</div>}

      <div className="recordarates__tableWrap">
        <table className="recordarates__table">
          <thead>
            <tr>
              <th>Мастер</th>
              <th>Завершено</th>
              <th>Ставка / запись</th>
              <th>Фикс / месяц</th>
              <th>Выплата</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{fmtInt(r.completed)}</td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="number"
                    min="0"
                    step="50"
                    inputMode="numeric"
                    value={r.perRecord}
                    onChange={(e) => handleRateChange(r.id, "perRecord", e.target.value)}
                    placeholder="сом/запись"
                    aria-label="Ставка за запись"
                    title="Ставка за запись"
                    disabled={ratesLoading}
                  />
                </td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="number"
                    min="0"
                    step="100"
                    inputMode="numeric"
                    value={r.perMonth}
                    onChange={(e) => handleRateChange(r.id, "perMonth", e.target.value)}
                    placeholder="фикс за месяц"
                    aria-label="Фикс за месяц"
                    title="Фикс за месяц"
                    disabled={ratesLoading}
                  />
                </td>
                <td><b>{fmtMoney(r.total)}</b></td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td className="recordarates__muted" colSpan={5}>Нет мастеров.</td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}><b>Итого фонд выплат:</b></td>
              <td><b>{fmtMoney(totals)}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <nav className="recordarates__pager" aria-label="Пагинация">
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            type="button"
          >
            Назад
          </button>
          <span className="recordarates__pageInfo">Стр. {safePage}/{totalPages}</span>
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            type="button"
          >
            Далее
          </button>
        </nav>
      )}
    </section>
  );
};

export default RecordaRates;
