import React, { useMemo, useState } from "react";
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

/** Санитизация и валидация денег: пусто | целое ≥ 0, ограничим верхнюю границу */
const clampMoney = (value, max = 10_000_000) => {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
};

/** Выплаты мастерам — редактирование ставок и итог за месяц */
const RecordaRates = ({
  year,
  month,
  employees = [],
  appointments = [],
  rates = {},
  ratesLoading = false,
  ratesError = "",
  onChangeRate,
  onSaveRates,
}) => {
  const [page, setPage] = useState(1);

  // фильтры периода (по умолчанию из пропсов)
  const [fltYear, setFltYear] = useState(
    Number(year) >= 2025 && Number(year) <= 2026 ? Number(year) : 2025
  );
  const [fltMonth, setFltMonth] = useState(
    Number(month) >= 1 && Number(month) <= 12 ? Number(month) : new Date().getMonth() + 1
  );

  const periodLabel = `${pad2(fltMonth)}.${fltYear}`;

  // Дедуп мастеров по id + сортировка по имени
  const normalizedEmployees = useMemo(() => {
    const seen = new Set();
    const unique = [];
    for (const e of Array.isArray(employees) ? employees : []) {
      const id = String(e?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push({ id, name: e?.name || "—" });
    }
    return unique.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [employees]);

  // Подсчёт завершённых записей по мастеру за выбранный период
  const doneByMaster = useMemo(() => {
    const m = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (a?.status !== "completed") continue;
      const d = new Date(a?.start_at);
      if (!Number.isFinite(d.getTime?.() ?? NaN)) continue;
      if (!(d.getFullYear() === fltYear && d.getMonth() + 1 === fltMonth)) continue;
      const key = String(a?.barber ?? "");
      if (!key) continue;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [appointments, fltYear, fltMonth]);

  // Основные строки таблицы
  const rows = useMemo(() => {
    return normalizedEmployees.map((e) => {
      const r = rates[e.id] || {};
      const completed = Number(doneByMaster.get(String(e.id)) || 0);
      const perRec = Number(r.perRecord || 0) || 0;
      const perMon = Number(r.perMonth || 0) || 0;
      const total = completed * perRec + perMon;
      return {
        id: e.id,
        name: e.name,
        completed,
        perRecord: r.perRecord ?? "",
        perMonth: r.perMonth ?? "",
        total,
      };
    });
  }, [normalizedEmployees, rates, doneByMaster]);

  const totals = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Обработчик изменения ставки с валидацией (не логируем, только сводим к числу)
  const handleRateChange = (id, field, raw) => {
    // Разрешаем пустую строку, чтобы пользователь мог стереть значение
    const next = raw === "" ? "" : clampMoney(raw);
    onChangeRate?.(id, field, next);
  };

  return (
    <section className="recordarates" aria-label="Выплаты мастерам">
      <header className="recordarates__header">
        <h2 className="recordarates__title">
          Выплаты
        </h2>

        <div className="recordarates__filters" aria-label="Фильтры периода">
          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Месяц</span>
            <select
              className="recordarates__select"
              value={fltMonth}
              onChange={(e) => { setFltMonth(Number(e.target.value)); setPage(1); }}
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
              value={fltYear}
              onChange={(e) => { setFltYear(Number(e.target.value)); setPage(1); }}
              aria-label="Год"
            >
              {[2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="recordarates__btn recordarates__btn--primary recordarates__btn--icon"
          onClick={onSaveRates}
          disabled={ratesLoading}
          aria-label="Сохранить ставки"
          title="Сохранить ставки"
          type="button"
        >
          <FaSync />
          <span className="recordarates__btnText">
            {ratesLoading ? "Сохранение…" : "Сохранить ставки"}
          </span>
        </button>
      </header>

      {ratesError && <div className="recordarates__alert">{ratesError}</div>}

      <div className="recordarates__tableWrap">
        <table className="recordarates__table">
          <thead>
            <tr>
              <th scope="col">Мастер</th>
              <th scope="col">Завершено</th>
              <th scope="col">Ставка / запись</th>
              <th scope="col">Фикс / месяц</th>
              <th scope="col">Выплата</th>
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
              <td colSpan={4} style={{ textAlign: "right" }}>
                <b>Итого фонд выплат:</b>
              </td>
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
