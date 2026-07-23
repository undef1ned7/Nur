// src/Components/Sectors/Consulting/salary/salary.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaPercent, FaSave, FaSyncAlt, FaWallet, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import {
  createSalaryPayout,
  getSalarySummary,
  listSalaryAccruals,
  listSalaryPayouts,
  listSalaryRates,
  updateSalaryRate,
} from "../../../../api/consultingSalary";
import { useAlert } from "../../../../hooks/useDialog";
import "./salary.scss";

const EMPLOYEES_URL = "/users/employees/";
const PER_PAGE = 12;

const TABS = { ACCRUALS: "accruals", RATES: "rates", PAYOUTS: "payouts" };

const STATUS_LABELS = {
  pending: "Ожидает",
  accrued: "Начислено",
  paid: "Выплачено",
  canceled: "Отменено",
};

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const employeeName = (e) =>
  [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

const fmtMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
};

const fmtPercent = (v) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`
    : "—";
};

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("ru-RU");
};

const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

const isNotReady = (e) => e?.status === 404 || e?.status === 501;
const errorText = (e) =>
  (typeof e?.detail === "string" && e.detail) || "Не удалось загрузить данные.";

const Salary = () => {
  const { profile } = useUser();
  const alert = useAlert();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [tab, setTab] = useState(TABS.ACCRUALS);

  /* Справочник сотрудников — для имён и фильтра/выплат */
  const [employees, setEmployees] = useState([]);
  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), employeeName(e)));
    return m;
  }, [employees]);

  useEffect(() => {
    api
      .get(EMPLOYEES_URL)
      .then((res) => setEmployees(asArray(res.data)))
      .catch(() => {});
  }, []);

  /* Общие фильтры по периоду/сотруднику */
  const [dateFrom, setDateFrom] = useState(monthAgoISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [userFilter, setUserFilter] = useState("");

  return (
    <div className="salary">
      <div className="salary__header">
        <div className="salary__titleWrap">
          <h2 className="salary__title">Зарплата</h2>
          <div className="salary__subtitle">
            Автоматическое начисление процента с закрытых продаж
          </div>
        </div>
        <div className="salary__tabs" role="tablist">
          <button
            type="button"
            className={`salary__tab ${tab === TABS.ACCRUALS ? "is-active" : ""}`}
            onClick={() => setTab(TABS.ACCRUALS)}
          >
            Начисления
          </button>
          {isOwnerOrAdmin && (
            <button
              type="button"
              className={`salary__tab ${tab === TABS.RATES ? "is-active" : ""}`}
              onClick={() => setTab(TABS.RATES)}
            >
              Ставки
            </button>
          )}
          <button
            type="button"
            className={`salary__tab ${tab === TABS.PAYOUTS ? "is-active" : ""}`}
            onClick={() => setTab(TABS.PAYOUTS)}
          >
            Выплаты
          </button>
        </div>
      </div>

      {tab !== TABS.RATES && (
        <div className="salary__filters">
          <label className="salary__filterField">
            <span>С</span>
            <input
              type="date"
              className="salary__input"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="salary__filterField">
            <span>По</span>
            <input
              type="date"
              className="salary__input"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {isOwnerOrAdmin && (
            <label className="salary__filterField">
              <span>Сотрудник</span>
              <select
                className="salary__input"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                <option value="">Все сотрудники</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {employeeName(e)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {tab === TABS.ACCRUALS && (
        <AccrualsTab
          dateFrom={dateFrom}
          dateTo={dateTo}
          userFilter={userFilter}
          empById={empById}
          isOwnerOrAdmin={isOwnerOrAdmin}
        />
      )}
      {tab === TABS.RATES && isOwnerOrAdmin && <RatesTab alert={alert} />}
      {tab === TABS.PAYOUTS && (
        <PayoutsTab
          dateFrom={dateFrom}
          dateTo={dateTo}
          userFilter={userFilter}
          empById={empById}
          employees={employees}
          isOwnerOrAdmin={isOwnerOrAdmin}
          alert={alert}
        />
      )}
    </div>
  );
};

/* ==================== НАЧИСЛЕНИЯ ==================== */
function AccrualsTab({ dateFrom, dateTo, userFilter, empById, isOwnerOrAdmin }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setErr("");
      setNotReady(false);
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        user: userFilter || undefined,
        status: statusFilter || undefined,
        page: pageNum,
        page_size: PER_PAGE,
      };
      try {
        const [accrualsData, summaryData] = await Promise.all([
          listSalaryAccruals(params),
          getSalarySummary({
            date_from: dateFrom,
            date_to: dateTo,
            user: userFilter || undefined,
          }).catch(() => null),
        ]);
        const rows = asArray(accrualsData);
        setItems(rows);
        setCount(
          typeof accrualsData?.count === "number"
            ? accrualsData.count
            : rows.length,
        );
        setSummary(summaryData);
        setPage(pageNum);
      } catch (e) {
        if (isNotReady(e)) setNotReady(true);
        else setErr(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, userFilter, statusFilter],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));

  const totals = useMemo(() => {
    if (summary?.totals) return summary.totals;
    // fallback: считаем по текущей странице (грубая оценка)
    let accrued = 0;
    let paid = 0;
    items.forEach((a) => {
      const amt = Number(a.amount) || 0;
      if (a.status === "paid") paid += amt;
      else if (a.status === "accrued" || a.status === "pending") accrued += amt;
    });
    return { accrued, paid, remaining: accrued };
  }, [summary, items]);

  if (notReady) return <NotReadyNotice />;

  return (
    <>
      <div className="salary__cards">
        <SummaryCard label="Начислено (к выплате)" value={fmtMoney(totals.accrued)} />
        <SummaryCard label="Выплачено за период" value={fmtMoney(totals.paid)} />
        <SummaryCard
          label="Остаток к выплате"
          value={fmtMoney(totals.remaining ?? totals.accrued)}
          accent
        />
      </div>

      <div className="salary__subToolbar">
        <select
          className="salary__input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="salary__btn" onClick={() => load(page)}>
          <FaSyncAlt /> Обновить
        </button>
      </div>

      {!!err && <div className="salary__alert">{err}</div>}

      <div className="salary__tableWrap">
        <table className="salary__table">
          <thead>
            <tr>
              <th>Дата</th>
              {isOwnerOrAdmin && <th>Сотрудник</th>}
              <th>Услуга</th>
              <th>База</th>
              <th>%</th>
              <th>Начислено</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="salary__empty" colSpan={7}>
                  Загрузка…
                </td>
              </tr>
            ) : items.length ? (
              items.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDateTime(a.created_at)}</td>
                  {isOwnerOrAdmin && (
                    <td>{empById.get(String(a.user)) || a.user_display || "—"}</td>
                  )}
                  <td>{a.service_name || a.service_display || "—"}</td>
                  <td>{fmtMoney(a.base_amount ?? a.service_amount)}</td>
                  <td>{fmtPercent(a.percent)}</td>
                  <td>
                    <b>{fmtMoney(a.amount)}</b>
                  </td>
                  <td>
                    <span
                      className={`salary__status salary__status--${a.status || "accrued"}`}
                    >
                      {STATUS_LABELS[a.status] || a.status || "—"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="salary__empty" colSpan={7}>
                  Нет начислений за период
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={totalPages} onPage={load} count={count} />
    </>
  );
}

/* ==================== СТАВКИ ==================== */
function RatesTab({ alert }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setNotReady(false);
    try {
      const data = await listSalaryRates({ search: q.trim() || undefined });
      setRows(asArray(data));
    } catch (e) {
      if (isNotReady(e)) setNotReady(true);
      else setErr(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (serviceId) => {
    const percent = drafts[serviceId];
    if (percent === undefined) return;
    const n = Number(String(percent).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      alert("Процент должен быть числом от 0 до 100.", true);
      return;
    }
    setSavingId(serviceId);
    try {
      await updateSalaryRate(serviceId, { percent: n.toFixed(2) });
      setDrafts((d) => {
        const next = { ...d };
        delete next[serviceId];
        return next;
      });
      await load();
      alert("Ставка сохранена.");
    } catch (e) {
      alert(errorText(e), true);
    } finally {
      setSavingId(null);
    }
  };

  if (notReady) return <NotReadyNotice />;

  return (
    <>
      <div className="salary__subToolbar">
        <input
          className="salary__input"
          placeholder="Поиск услуги…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="salary__btn" onClick={load}>
          <FaSyncAlt /> Обновить
        </button>
      </div>

      <p className="salary__hint">
        <FaPercent /> Процент начисляется сотруднику автоматически при закрытии
        продажи/выигрыше лида с этой услугой. 0% — начисление не производится.
      </p>

      {!!err && <div className="salary__alert">{err}</div>}

      <div className="salary__tableWrap">
        <table className="salary__table">
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Базовая цена</th>
              <th>Ставка, %</th>
              <th>Обновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="salary__empty" colSpan={5}>
                  Загрузка…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((r) => {
                const sid = r.service || r.id;
                const draft = drafts[sid];
                const value = draft !== undefined ? draft : r.percent ?? "";
                const dirty = draft !== undefined && String(draft) !== String(r.percent ?? "");
                return (
                  <tr key={sid}>
                    <td>{r.service_name || r.name || "—"}</td>
                    <td>{fmtMoney(r.price)}</td>
                    <td>
                      <input
                        className="salary__inlineInput"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={value}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [sid]: e.target.value }))
                        }
                      />
                    </td>
                    <td>{r.updated_at ? fmtDateTime(r.updated_at) : "—"}</td>
                    <td className="salary__rowActions">
                      <button
                        className="salary__btn salary__btn--primary salary__btn--sm"
                        onClick={() => save(sid)}
                        disabled={!dirty || savingId === sid}
                      >
                        <FaSave /> {savingId === sid ? "…" : "Сохранить"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="salary__empty" colSpan={5}>
                  Услуги не найдены. Создайте их в разделе «Услуги».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ==================== ВЫПЛАТЫ ==================== */
function PayoutsTab({
  dateFrom,
  dateTo,
  userFilter,
  empById,
  employees,
  isOwnerOrAdmin,
  alert,
}) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [err, setErr] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      setErr("");
      setNotReady(false);
      try {
        const data = await listSalaryPayouts({
          date_from: dateFrom,
          date_to: dateTo,
          user: userFilter || undefined,
          page: pageNum,
          page_size: PER_PAGE,
        });
        const rows = asArray(data);
        setItems(rows);
        setCount(typeof data?.count === "number" ? data.count : rows.length);
        setPage(pageNum);
      } catch (e) {
        if (isNotReady(e)) setNotReady(true);
        else setErr(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, userFilter],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));

  if (notReady) return <NotReadyNotice />;

  return (
    <>
      {isOwnerOrAdmin && (
        <div className="salary__subToolbar">
          <button className="salary__btn" onClick={() => load(page)}>
            <FaSyncAlt /> Обновить
          </button>
          <button
            className="salary__btn salary__btn--primary"
            onClick={() => setPayOpen(true)}
          >
            <FaWallet /> Выплатить
          </button>
        </div>
      )}

      {!!err && <div className="salary__alert">{err}</div>}

      <div className="salary__tableWrap">
        <table className="salary__table">
          <thead>
            <tr>
              <th>Дата</th>
              {isOwnerOrAdmin && <th>Сотрудник</th>}
              <th>Сумма</th>
              <th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="salary__empty" colSpan={4}>
                  Загрузка…
                </td>
              </tr>
            ) : items.length ? (
              items.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDateTime(p.created_at)}</td>
                  {isOwnerOrAdmin && (
                    <td>{empById.get(String(p.user)) || p.user_display || "—"}</td>
                  )}
                  <td>
                    <b>{fmtMoney(p.amount)}</b>
                  </td>
                  <td>{p.comment || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="salary__empty" colSpan={4}>
                  Выплат за период нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={totalPages} onPage={load} count={count} />

      {payOpen && (
        <PayoutModal
          employees={employees}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            load(1);
          }}
          alert={alert}
        />
      )}
    </>
  );
}

function PayoutModal({ employees, onClose, onDone, alert }) {
  const [user, setUser] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(String(amount).replace(",", "."));
    if (!user) return alert("Выберите сотрудника.", true);
    if (!Number.isFinite(n) || n <= 0) return alert("Укажите сумму больше нуля.", true);
    setSaving(true);
    try {
      await createSalaryPayout({ user, amount: n.toFixed(2), comment: comment.trim() });
      onDone?.();
    } catch (err) {
      alert(errorText(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="salary__overlay" onClick={onClose}>
      <div className="salary__modal" onClick={(e) => e.stopPropagation()}>
        <div className="salary__modalHeader">
          <h3 className="salary__modalTitle">Выплата сотруднику</h3>
          <button className="salary__iconBtn" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>
        <form className="salary__form" onSubmit={submit}>
          <div className="salary__field">
            <label className="salary__label">Сотрудник *</label>
            <select
              className="salary__input"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoFocus
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                </option>
              ))}
            </select>
          </div>
          <div className="salary__field">
            <label className="salary__label">Сумма *</label>
            <input
              className="salary__input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Например: 15000"
            />
          </div>
          <div className="salary__field">
            <label className="salary__label">Комментарий</label>
            <input
              className="salary__input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
          <p className="salary__hint">
            Выплата закрывает начисления сотрудника в статусе «Начислено» по
            порядку (FIFO) на сумму выплаты.
          </p>
          <div className="salary__footer">
            <button
              type="button"
              className="salary__btn salary__btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="salary__btn salary__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Выплатить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== Общие ==================== */
function SummaryCard({ label, value, accent }) {
  return (
    <div className={`salary__summaryCard ${accent ? "is-accent" : ""}`}>
      <div className="salary__summaryLabel">{label}</div>
      <div className="salary__summaryValue">{value} с</div>
    </div>
  );
}

function Pager({ page, totalPages, onPage, count }) {
  if (count <= PER_PAGE) return null;
  return (
    <div className="salary__pager">
      <button
        className="salary__pageBtn"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        Назад
      </button>
      <span className="salary__page">
        Стр. {page} из {totalPages}
      </span>
      <button
        className="salary__pageBtn"
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Далее
      </button>
    </div>
  );
}

function NotReadyNotice() {
  return (
    <div className="salary__notice">
      <b>Раздел ещё не подключён на бэкенде.</b>
      <p>
        Автоматическое начисление процентов, ставки услуг и выплаты появятся
        после реализации серверной части. Контракт: docs/consulting/salary-auto-accrual.md.
      </p>
    </div>
  );
}

export default Salary;
