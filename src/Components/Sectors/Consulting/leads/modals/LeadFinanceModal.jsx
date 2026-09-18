/**
 * Консалтинг → Лиды → «Финансы».
 *
 * Редактируемая таблица рекламного отчёта: одна строка = один день закупки
 * (Дата · Показы · Лиды · Сумма затрат · Стоимость лида). «Стоимость лида»
 * считается автоматически (затраты ÷ лиды) и не редактируется. Внизу — строка
 * итогов. Кнопка «Сохранить» отправляет всю таблицу пакетом (bulk upsert).
 *
 * Доступ к кнопке — canManageConsultingLeadFinance (owner/admin/rop либо право
 * can_manage_lead_ad_spend). Контракт: docs/consulting/backend/08-lead-ad-spend.md
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FaFileExcel, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import {
  bulkSaveLeadAdSpend,
  listLeadAdSpend,
} from "../../../../../api/consultingLeadFinance";
import { downloadFinanceTemplate } from "../financeTemplate";
import { PeriodFilter } from "../../common/ListControls";
import { periodRange } from "../../common/listUtils";

const NUM_FMT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const money = (v) => NUM_FMT.format(Math.round((Number(v) || 0) * 100) / 100);

/** Локальная дата в формате input[type=date]. */
const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

let rowSeq = 0;
const blankRow = (date = "") => ({
  key: `new-${(rowSeq += 1)}`,
  id: null,
  date,
  impressions: "",
  leads: "",
  spend: "",
  note: "",
});

const toRow = (r) => ({
  key: r.id ? `row-${r.id}` : `new-${(rowSeq += 1)}`,
  id: r.id,
  date: r.date || "",
  impressions: r.impressions || "",
  leads: r.leads || "",
  spend: r.spend || "",
  note: r.note || "",
});

const costPerLead = (row) => {
  const leads = Number(row.leads) || 0;
  const spend = Number(row.spend) || 0;
  return leads > 0 ? spend / leads : 0;
};

const isEmptyRow = (r) =>
  !r.date && !r.impressions && !r.leads && !r.spend && !r.note;

export default function LeadFinanceModal({ onClose, alert }) {
  // Фильтр периода — по умолчанию текущий месяц, а не «всё подряд»: таблица
  // копится ежедневно, без фильтра список быстро становится нечитаемым.
  const [period, setPeriod] = useState(() => periodRange("month"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Дефолтная дата новой пустой строки — сегодня, если он входит в
  // выбранный период, иначе конец периода (иначе строка «потеряется» при
  // сохранении: bulk теперь скопирован диапазоном фильтра, см. save()).
  const defaultNewRowDate = () => {
    const today = todayISO();
    if (
      (!period.date_from || today >= period.date_from) &&
      (!period.date_to || today <= period.date_to)
    ) {
      return today;
    }
    return period.date_to || today;
  };

  useEffect(() => {
    const controller = new AbortController();
    listLeadAdSpend(
      { date_from: period.date_from, date_to: period.date_to },
      { signal: controller.signal },
    )
      .then(({ results }) => {
        if (!mounted.current) return;
        const mapped = results.map(toRow);
        // Всегда оставляем 3 пустые строки в хвосте под ввод.
        setRows([
          ...mapped,
          blankRow(mapped.length ? "" : defaultNewRowDate()),
          blankRow(),
          blankRow(),
        ]);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted.current || e?.name === "CanceledError") return;
        if (e?.status === 404 || e?.status === 501) setUnavailable(true);
        else if (e?.detail) alert?.(e.detail, true);
        setRows([blankRow(defaultNewRowDate()), blankRow(), blankRow()]);
        setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- period объект новый на каждый рендер, сравниваем по значениям ниже
  }, [period.date_from, period.date_to, alert]);

  const setCell = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, blankRow(todayISO())]);

  const removeRow = (key) =>
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [blankRow(todayISO())];
    });

  const totals = useMemo(() => {
    const acc = { impressions: 0, leads: 0, spend: 0 };
    rows.forEach((r) => {
      acc.impressions += Number(r.impressions) || 0;
      acc.leads += Number(r.leads) || 0;
      acc.spend += Number(r.spend) || 0;
    });
    acc.cpl = acc.leads > 0 ? acc.spend / acc.leads : 0;
    return acc;
  }, [rows]);

  const save = async () => {
    const filled = rows.filter((r) => !isEmptyRow(r));

    const noDate = filled.find((r) => !r.date);
    if (noDate) {
      alert?.("У каждой заполненной строки должна быть дата.", true);
      return;
    }
    const seen = new Set();
    for (const r of filled) {
      if (seen.has(r.date)) {
        alert?.(
          `Дата ${r.date} встречается дважды — оставьте одну строку.`,
          true,
        );
        return;
      }
      seen.add(r.date);
    }
    // Сохранение теперь заменяет строки только внутри выбранного периода
    // (см. save() ниже) — дата вне периода потерялась бы молча, поэтому
    // просим сначала расширить фильтр.
    const outOfRange = filled.find(
      (r) =>
        (period.date_from && r.date < period.date_from) ||
        (period.date_to && r.date > period.date_to),
    );
    if (outOfRange) {
      alert?.(
        `Дата ${outOfRange.date} вне выбранного периода. Расширьте период или исправьте дату.`,
        true,
      );
      return;
    }

    const items = filled.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      date: r.date,
      impressions: Number(r.impressions) || 0,
      leads: Number(r.leads) || 0,
      spend: Number(r.spend) || 0,
      note: r.note?.trim() || "",
    }));

    setSaving(true);
    try {
      const { results } = await bulkSaveLeadAdSpend(items, {
        date_from: period.date_from,
        date_to: period.date_to,
      });
      if (!mounted.current) return;
      const mapped = results.map(toRow);
      setRows([...mapped, blankRow(), blankRow(), blankRow()]);
      alert?.("Рекламный отчёт сохранён.");
    } catch (e) {
      if (e?.status === 404 || e?.status === 501) {
        setUnavailable(true);
        alert?.("Раздел «Финансы лидов» ещё подключается на сервере.", true);
      } else {
        alert?.(e?.detail || "Не удалось сохранить отчёт.", true);
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={() => !saving && onClose()}>
      <div
        className="leads__modal leads__modal--finance"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-finance-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="lead-finance-title">
            Финансы
          </h3>
          <button
            type="button"
            className="leads__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <p className="leads__financeHint">
          Заносите расходы на рекламу по дням: показы, полученные лиды и сумму
          затрат. «Стоимость лида» считается автоматически. Данные сохраняются
          на сервере.
        </p>

        <PeriodFilter
          dateFrom={period.date_from}
          dateTo={period.date_to}
          onChange={(next) => {
            setLoading(true);
            setPeriod(next);
          }}
        />

        {unavailable && (
          <div className="leads__warn">
            Эндпоинт рекламного отчёта ещё не готов на бэкенде — таблицу можно
            заполнять, но сохранение недоступно.
          </div>
        )}

        {loading ? (
          <div className="leads__financeLoading">Загрузка…</div>
        ) : (
          <div className="leads__financeTableWrap">
            <table className="leads__financeTable">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Показы</th>
                  <th>Лиды</th>
                  <th>Сумма затрат</th>
                  <th>Стоимость лида</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <input
                        type="date"
                        className="cList__input"
                        value={r.date}
                        onChange={(e) => setCell(r.key, "date", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        className="cList__input"
                        value={r.impressions}
                        onChange={(e) =>
                          setCell(r.key, "impressions", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        className="cList__input"
                        value={r.leads}
                        onChange={(e) =>
                          setCell(r.key, "leads", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="cList__input"
                        value={r.spend}
                        onChange={(e) =>
                          setCell(r.key, "spend", e.target.value)
                        }
                      />
                    </td>
                    <td className="leads__financeCalc">
                      {money(costPerLead(r))}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="leads__iconBtn leads__iconBtn--sm"
                        onClick={() => removeRow(r.key)}
                        aria-label="Удалить строку"
                      >
                        <FaTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Итого</th>
                  <td>{money(totals.impressions)}</td>
                  <td>{money(totals.leads)}</td>
                  <td>{money(totals.spend)}</td>
                  <td className="leads__financeCalc">{money(totals.cpl)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="leads__financeActions">
          <button
            type="button"
            className="leads__btn leads__btn--sm"
            onClick={addRow}
            disabled={loading || saving}
          >
            <FaPlus aria-hidden /> Строка
          </button>
          <button
            type="button"
            className="leads__btn leads__btn--sm"
            onClick={downloadFinanceTemplate}
            title="Скачать пустой Excel-шаблон рекламного отчёта"
          >
            <FaFileExcel aria-hidden /> Шаблон Excel
          </button>
          <span className="leads__financeSpacer" />
          <button
            type="button"
            className="leads__btn"
            onClick={onClose}
            disabled={saving}
          >
            Закрыть
          </button>
          <button
            type="button"
            className="leads__btn leads__btn--primary"
            onClick={save}
            disabled={loading || saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
