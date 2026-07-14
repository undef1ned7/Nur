import {
  Clock,
  Percent,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { getCashBoxes, useCash } from "../../../../store/slices/cashSlice";
import {
  createSalaryPayout,
  deleteWorkSession,
  getSalarySummary,
  listHourlyRates,
  listPieceRates,
  listSalaryAccruals,
  listSalaryPayouts,
  listWorkSessions,
  updateHourlyRate,
  updatePieceRate,
  upsertWorkSession,
} from "../../../../api/productionSalary";
import "../../Warehouse/Salary/Salary.scss";

/**
 * Зарплата производства: почасовой оклад (табель часов) + сдельная оплата
 * за произведённую продукцию. Контракт API: docs/production/salary.md.
 * Пока бэкенд не готов (404) — страница показывает уведомление и не ломается.
 */

const TABS = {
  ACCRUALS: "accruals",
  RATES: "rates",
  TIMESHEET: "timesheet",
  PAYOUTS: "payouts",
};

const KIND_LABELS = {
  hourly: "Почасовое",
  piece: "Сдельное",
};

const STATUS_LABELS = {
  accrued: "Начислено",
  paid: "Выплачено",
  canceled: "Отменено",
};

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const fmtMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtQty = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("ru-RU");
};

const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const errorText = (e) => {
  const detail = e?.detail || e?.message;
  return typeof detail === "string" && detail
    ? detail
    : "Не удалось загрузить данные";
};

/** Раздел ещё не реализован на сервере (404 от API). */
const isNotReady = (e) => e?.status === 404;

const employeeLabel = (e) => {
  if (!e) return "—";
  const full = String(e.full_name || "").trim();
  if (full) return full;
  const name = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  return e.email || e.username || String(e.id || "—");
};

const ProductionSalary = () => {
  const dispatch = useDispatch();
  const { profile } = useUser();
  const { list: cashBoxes } = useCash();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    isOwnerOrAdmin && tabParam === TABS.RATES
      ? TABS.RATES
      : isOwnerOrAdmin && tabParam === TABS.TIMESHEET
        ? TABS.TIMESHEET
        : tabParam === TABS.PAYOUTS
          ? TABS.PAYOUTS
          : TABS.ACCRUALS;

  const setTab = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next === TABS.ACCRUALS) sp.delete("tab");
          else sp.set("tab", next);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ---------- Справочники ----------
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (isOwnerOrAdmin) {
      (async () => {
        try {
          const { data } = await api.get("/users/employees/");
          if (!cancelled) setEmployees(normalizeList(data));
        } catch {
          if (!cancelled) setEmployees([]);
        }
      })();
      dispatch(getCashBoxes());
    }
    return () => {
      cancelled = true;
    };
  }, [dispatch, isOwnerOrAdmin]);

  const employeeLabelById = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => map.set(String(e.id), employeeLabel(e)));
    return map;
  }, [employees]);

  const resolveEmployeeName = useCallback(
    (row) =>
      row?.employee_name ||
      employeeLabelById.get(String(row?.employee)) ||
      row?.employee ||
      "—",
    [employeeLabelById],
  );

  // ---------- Общие фильтры периода ----------
  const [dateFrom, setDateFrom] = useState(monthAgoISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [employeeFilter, setEmployeeFilter] = useState("");

  const periodParams = useMemo(() => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (employeeFilter) params.employee = employeeFilter;
    return params;
  }, [dateFrom, dateTo, employeeFilter]);

  const [notReady, setNotReady] = useState(false);

  // ---------- Начисления + сводка ----------
  const [accruals, setAccruals] = useState([]);
  const [accrualsCount, setAccrualsCount] = useState(0);
  const [summaryRows, setSummaryRows] = useState([]);
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccruals = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = { ...periodParams };
    if (kindFilter) params.kind = kindFilter;
    if (statusFilter) params.status = statusFilter;
    try {
      const [accrualsData, summaryData] = await Promise.all([
        listSalaryAccruals(params),
        getSalarySummary(periodParams),
      ]);
      setAccruals(normalizeList(accrualsData));
      setAccrualsCount(
        accrualsData?.count ?? normalizeList(accrualsData).length,
      );
      setSummaryRows(normalizeList(summaryData));
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setError(errorText(e));
      setAccruals([]);
      setAccrualsCount(0);
      setSummaryRows([]);
    } finally {
      setLoading(false);
    }
  }, [periodParams, kindFilter, statusFilter]);

  useEffect(() => {
    if (tab === TABS.ACCRUALS) loadAccruals();
  }, [tab, loadAccruals]);

  const summaryTotals = useMemo(
    () =>
      summaryRows.reduce(
        (acc, row) => {
          acc.total += Number(row.total || 0);
          acc.accrued += Number(row.accrued || 0);
          acc.paid += Number(row.paid || 0);
          acc.hours += Number(row.hours_total || 0);
          return acc;
        },
        { total: 0, accrued: 0, paid: 0, hours: 0 },
      ),
    [summaryRows],
  );

  // ---------- Ставки ----------
  const [hourlyRates, setHourlyRates] = useState([]);
  const [pieceRates, setPieceRates] = useState([]);
  const [rateProducts, setRateProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [hourlyDrafts, setHourlyDrafts] = useState({});
  const [pieceDrafts, setPieceDrafts] = useState({});
  const [rateSaving, setRateSaving] = useState({});

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const [hourlyData, pieceData] = await Promise.all([
        listHourlyRates(),
        listPieceRates(),
      ]);
      setHourlyRates(normalizeList(hourlyData));
      setPieceRates(normalizeList(pieceData));
      setHourlyDrafts({});
      setPieceDrafts({});
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setRatesError(errorText(e));
      setHourlyRates([]);
      setPieceRates([]);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === TABS.RATES && isOwnerOrAdmin) loadRates();
  }, [tab, isOwnerOrAdmin, loadRates]);

  // Товары для назначения сдельной ставки (поиск по каталогу)
  useEffect(() => {
    if (tab !== TABS.RATES || !isOwnerOrAdmin) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("main/products/list/", {
          params: productSearch.trim()
            ? { search: productSearch.trim() }
            : {},
        });
        if (!cancelled) setRateProducts(normalizeList(data));
      } catch {
        if (!cancelled) setRateProducts([]);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, isOwnerOrAdmin, productSearch]);

  const hourlyRateByEmployee = useMemo(() => {
    const map = new Map();
    hourlyRates.forEach((r) => map.set(String(r.employee), r));
    return map;
  }, [hourlyRates]);

  const pieceRateByProduct = useMemo(() => {
    const map = new Map();
    pieceRates.forEach((r) => map.set(String(r.product), r));
    return map;
  }, [pieceRates]);

  const validAmount = (value) => {
    const num = Number(String(value).replace(",", "."));
    return Number.isFinite(num) && num >= 0;
  };

  const handleSaveHourlyRate = async (employeeId) => {
    const draft = hourlyDrafts[employeeId];
    if (draft === undefined) return;
    if (!validAmount(draft)) {
      setRatesError("Ставка должна быть неотрицательным числом");
      return;
    }
    setRatesError("");
    setRateSaving((prev) => ({ ...prev, [`h-${employeeId}`]: true }));
    try {
      const updated = await updateHourlyRate(employeeId, {
        hourly_rate: String(draft).replace(",", "."),
      });
      setHourlyRates((prev) => {
        const exists = prev.some((r) => String(r.employee) === String(employeeId));
        if (exists) {
          return prev.map((r) =>
            String(r.employee) === String(employeeId) ? { ...r, ...updated } : r,
          );
        }
        return [...prev, updated];
      });
      setHourlyDrafts((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setRatesError(errorText(e));
    } finally {
      setRateSaving((prev) => ({ ...prev, [`h-${employeeId}`]: false }));
    }
  };

  const handleSavePieceRate = async (productId) => {
    const draft = pieceDrafts[productId];
    if (draft === undefined) return;
    if (!validAmount(draft)) {
      setRatesError("Ставка должна быть неотрицательным числом");
      return;
    }
    setRatesError("");
    setRateSaving((prev) => ({ ...prev, [`p-${productId}`]: true }));
    try {
      const updated = await updatePieceRate(productId, {
        amount_per_unit: String(draft).replace(",", "."),
      });
      setPieceRates((prev) => {
        const exists = prev.some((r) => String(r.product) === String(productId));
        if (exists) {
          return prev.map((r) =>
            String(r.product) === String(productId) ? { ...r, ...updated } : r,
          );
        }
        return [...prev, updated];
      });
      setPieceDrafts((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setRatesError(errorText(e));
    } finally {
      setRateSaving((prev) => ({ ...prev, [`p-${productId}`]: false }));
    }
  };

  // ---------- Табель ----------
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionForm, setSessionForm] = useState({
    employee: "",
    date: todayISO(),
    hours: "",
    comment: "",
  });
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionFormError, setSessionFormError] = useState("");

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const data = await listWorkSessions(periodParams);
      setSessions(normalizeList(data));
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setSessionsError(errorText(e));
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [periodParams]);

  useEffect(() => {
    if (tab === TABS.TIMESHEET && isOwnerOrAdmin) loadSessions();
  }, [tab, isOwnerOrAdmin, loadSessions]);

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!sessionForm.employee) {
      setSessionFormError("Выберите сотрудника");
      return;
    }
    const hoursNum = Number(String(sessionForm.hours).replace(",", "."));
    if (!Number.isFinite(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      setSessionFormError("Часы — число от 0 до 24");
      return;
    }
    setSessionFormError("");
    setSessionSubmitting(true);
    try {
      await upsertWorkSession({
        employee: sessionForm.employee,
        date: sessionForm.date,
        hours: String(hoursNum),
        comment: sessionForm.comment.trim() || undefined,
      });
      setSessionForm((prev) => ({ ...prev, hours: "", comment: "" }));
      await loadSessions();
    } catch (err) {
      console.error(err);
      setSessionFormError(errorText(err));
    } finally {
      setSessionSubmitting(false);
    }
  };

  const handleSessionDelete = async (session) => {
    try {
      await deleteWorkSession(session.id);
      await loadSessions();
    } catch (e) {
      console.error(e);
      setSessionsError(errorText(e));
    }
  };

  // ---------- Выплаты ----------
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState("");
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    employee: "",
    amount: "",
    cashbox: "",
    comment: "",
  });
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutFormError, setPayoutFormError] = useState("");

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    setPayoutsError("");
    try {
      const data = await listSalaryPayouts(periodParams);
      setPayouts(normalizeList(data));
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setPayoutsError(errorText(e));
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, [periodParams]);

  useEffect(() => {
    if (tab === TABS.PAYOUTS) loadPayouts();
  }, [tab, loadPayouts]);

  const balanceByEmployee = useMemo(() => {
    const map = new Map();
    summaryRows.forEach((row) => map.set(String(row.employee), row));
    return map;
  }, [summaryRows]);

  const openPayoutModal = async () => {
    // Балансы нужны для подстановки суммы — подтягиваем сводку, если её ещё нет
    if (summaryRows.length === 0) {
      try {
        const data = await getSalarySummary(periodParams);
        setSummaryRows(normalizeList(data));
      } catch {
        // не критично — сумму можно ввести вручную
      }
    }
    setPayoutForm({
      employee: "",
      amount: "",
      cashbox: cashBoxes?.[0]?.id || "",
      comment: "",
    });
    setPayoutFormError("");
    setPayoutModalOpen(true);
  };

  const handlePayoutEmployeeChange = (employeeId) => {
    const balance = balanceByEmployee.get(String(employeeId));
    setPayoutForm((prev) => ({
      ...prev,
      employee: employeeId,
      amount:
        balance?.accrued != null && Number(balance.accrued) > 0
          ? String(balance.accrued)
          : prev.amount,
    }));
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutForm.employee) {
      setPayoutFormError("Выберите сотрудника");
      return;
    }
    if (!payoutForm.cashbox) {
      setPayoutFormError("Выберите кассу");
      return;
    }
    const amountNum = Number(String(payoutForm.amount).replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPayoutFormError("Сумма должна быть больше нуля");
      return;
    }
    setPayoutFormError("");
    setPayoutSubmitting(true);
    try {
      await createSalaryPayout({
        employee: payoutForm.employee,
        amount: String(amountNum),
        cashbox: payoutForm.cashbox,
        comment: payoutForm.comment.trim() || undefined,
      });
      setPayoutModalOpen(false);
      await loadPayouts();
    } catch (err) {
      console.error(err);
      setPayoutFormError(errorText(err));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  // ---------- Рендер ----------

  const renderPeriodFilters = (extra = null) => (
    <div className="warehouse-salary__filters">
      <label className="warehouse-salary__filter">
        С
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </label>
      <label className="warehouse-salary__filter">
        По
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </label>
      {isOwnerOrAdmin && (
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="warehouse-salary__select"
        >
          <option value="">Все сотрудники</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {employeeLabel(emp)}
            </option>
          ))}
        </select>
      )}
      {extra}
    </div>
  );

  const renderSummaryCards = () => (
    <div className="warehouse-salary__cards">
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">
          Начислено за период
        </span>
        <span className="warehouse-salary__card-value">
          {fmtMoney(summaryTotals.total)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">К выплате</span>
        <span className="warehouse-salary__card-value warehouse-salary__card-value--accent">
          {fmtMoney(summaryTotals.accrued)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">Выплачено</span>
        <span className="warehouse-salary__card-value">
          {fmtMoney(summaryTotals.paid)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">Часов за период</span>
        <span className="warehouse-salary__card-value">
          {fmtQty(summaryTotals.hours)}
        </span>
      </div>
    </div>
  );

  const renderEmployeeSummaryTable = () => {
    if (!isOwnerOrAdmin || summaryRows.length === 0) return null;
    return (
      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">Итоги по сотрудникам</h3>
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Часы</th>
                <th>Почасовое</th>
                <th>Изделий</th>
                <th>Сдельное</th>
                <th>Всего</th>
                <th>Выплачено</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.employee}>
                  <td>{resolveEmployeeName(row)}</td>
                  <td>{fmtQty(row.hours_total)}</td>
                  <td>{fmtMoney(row.hourly_amount)}</td>
                  <td>{fmtQty(row.piece_quantity)}</td>
                  <td>{fmtMoney(row.piece_amount)}</td>
                  <td>{fmtMoney(row.total)}</td>
                  <td>{fmtMoney(row.paid)}</td>
                  <td className="warehouse-salary__cell-accent">
                    {fmtMoney(row.accrued)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const describeAccrual = (a) => {
    if (a.kind === "hourly") {
      return `${fmtQty(a.hours)} ч × ${fmtMoney(a.rate)} сом/ч`;
    }
    const product = a.product_name || "товар";
    return `${product}: ${fmtQty(a.quantity)} × ${fmtMoney(a.amount_per_unit)} сом`;
  };

  const renderAccrualsTab = () => (
    <>
      {renderPeriodFilters(
        <>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="warehouse-salary__select"
          >
            <option value="">Почасовые и сдельные</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="warehouse-salary__select"
          >
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </>,
      )}

      {renderSummaryCards()}
      {renderEmployeeSummaryTable()}

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">
          История начислений{accrualsCount ? ` (${accrualsCount})` : ""}
        </h3>
        {error && <div className="warehouse-salary__error">{error}</div>}
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Дата</th>
                {isOwnerOrAdmin && <th>Сотрудник</th>}
                <th>Тип</th>
                <th>Расчёт</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 6 : 5}
                    className="warehouse-salary__empty"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : accruals.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 6 : 5}
                    className="warehouse-salary__empty"
                  >
                    Начислений за выбранный период нет.
                  </td>
                </tr>
              ) : (
                accruals.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.created_at)}</td>
                    {isOwnerOrAdmin && <td>{resolveEmployeeName(a)}</td>}
                    <td>{KIND_LABELS[a.kind] || a.kind || "—"}</td>
                    <td>{describeAccrual(a)}</td>
                    <td>{fmtMoney(a.amount)}</td>
                    <td>{STATUS_LABELS[a.status] || a.status || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderRatesTab = () => (
    <>
      {ratesError && (
        <div className="warehouse-salary__error">{ratesError}</div>
      )}

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">
          <Clock size={16} /> Почасовые ставки сотрудников
        </h3>
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Ставка, сом/час</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ratesLoading ? (
                <tr>
                  <td colSpan={3} className="warehouse-salary__empty">
                    Загрузка…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={3} className="warehouse-salary__empty">
                    Сотрудников не найдено.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const rate = hourlyRateByEmployee.get(String(emp.id));
                  const current = rate?.hourly_rate ?? "0";
                  const draft = hourlyDrafts[emp.id] ?? current;
                  const dirty = String(draft) !== String(current);
                  return (
                    <tr key={emp.id}>
                      <td>{employeeLabel(emp)}</td>
                      <td>
                        <input
                          type="text"
                          className="warehouse-salary__rate-input"
                          value={draft}
                          onChange={(e) =>
                            setHourlyDrafts((prev) => ({
                              ...prev,
                              [emp.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="warehouse-salary__save-btn"
                          onClick={() => handleSaveHourlyRate(emp.id)}
                          disabled={!dirty || rateSaving[`h-${emp.id}`]}
                        >
                          <Save size={14} />
                          {rateSaving[`h-${emp.id}`]
                            ? "Сохранение…"
                            : "Сохранить"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">
          <Percent size={16} /> Сдельные ставки за единицу продукции
        </h3>
        <div className="warehouse-salary__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск товара…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Ед.</th>
                <th>Ставка, сом/ед.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rateProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="warehouse-salary__empty">
                    Товары не найдены.
                  </td>
                </tr>
              ) : (
                rateProducts.map((product) => {
                  const rate = pieceRateByProduct.get(String(product.id));
                  const current = rate?.amount_per_unit ?? "0";
                  const draft = pieceDrafts[product.id] ?? current;
                  const dirty = String(draft) !== String(current);
                  return (
                    <tr key={product.id}>
                      <td>{product.name || "—"}</td>
                      <td>{product.unit || "шт."}</td>
                      <td>
                        <input
                          type="text"
                          className="warehouse-salary__rate-input"
                          value={draft}
                          onChange={(e) =>
                            setPieceDrafts((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="warehouse-salary__save-btn"
                          onClick={() => handleSavePieceRate(product.id)}
                          disabled={!dirty || rateSaving[`p-${product.id}`]}
                        >
                          <Save size={14} />
                          {rateSaving[`p-${product.id}`]
                            ? "Сохранение…"
                            : "Сохранить"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderTimesheetTab = () => (
    <>
      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">Внести часы за день</h3>
        {sessionFormError && (
          <div className="warehouse-salary__error">{sessionFormError}</div>
        )}
        <form
          onSubmit={handleSessionSubmit}
          className="warehouse-salary__filters"
        >
          <select
            value={sessionForm.employee}
            onChange={(e) =>
              setSessionForm((prev) => ({ ...prev, employee: e.target.value }))
            }
            className="warehouse-salary__select"
          >
            <option value="">Сотрудник…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {employeeLabel(emp)}
              </option>
            ))}
          </select>
          <label className="warehouse-salary__filter">
            Дата
            <input
              type="date"
              value={sessionForm.date}
              onChange={(e) =>
                setSessionForm((prev) => ({ ...prev, date: e.target.value }))
              }
            />
          </label>
          <label className="warehouse-salary__filter">
            Часы
            <input
              type="text"
              style={{ width: 70 }}
              placeholder="8"
              value={sessionForm.hours}
              onChange={(e) =>
                setSessionForm((prev) => ({ ...prev, hours: e.target.value }))
              }
            />
          </label>
          <label className="warehouse-salary__filter">
            Комментарий
            <input
              type="text"
              value={sessionForm.comment}
              onChange={(e) =>
                setSessionForm((prev) => ({
                  ...prev,
                  comment: e.target.value,
                }))
              }
            />
          </label>
          <button
            type="submit"
            className="warehouse-salary__save-btn"
            disabled={sessionSubmitting}
          >
            <Save size={14} />
            {sessionSubmitting ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
        <p style={{ fontSize: 12, opacity: 0.65, margin: "6px 0 0" }}>
          Повторное сохранение за ту же дату обновляет часы. Начисление
          считается по ставке сом/час из вкладки «Ставки».
        </p>
      </div>

      {renderPeriodFilters()}

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">Табель</h3>
        {sessionsError && (
          <div className="warehouse-salary__error">{sessionsError}</div>
        )}
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Часы</th>
                <th>Комментарий</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessionsLoading ? (
                <tr>
                  <td colSpan={5} className="warehouse-salary__empty">
                    Загрузка…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="warehouse-salary__empty">
                    Записей за выбранный период нет.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{fmtDate(s.date)}</td>
                    <td>{resolveEmployeeName(s)}</td>
                    <td>{fmtQty(s.hours)}</td>
                    <td>{s.comment || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="warehouse-salary__save-btn"
                        onClick={() => handleSessionDelete(s)}
                        title="Удалить запись"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderPayoutsTab = () => (
    <>
      {renderPeriodFilters(
        isOwnerOrAdmin ? (
          <button
            type="button"
            className="warehouse-salary__save-btn"
            onClick={openPayoutModal}
          >
            <Wallet size={14} />
            Выплатить
          </button>
        ) : null,
      )}

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">История выплат</h3>
        {payoutsError && (
          <div className="warehouse-salary__error">{payoutsError}</div>
        )}
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Дата</th>
                {isOwnerOrAdmin && <th>Сотрудник</th>}
                <th>Сумма</th>
                <th>Касса</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {payoutsLoading ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 5 : 4}
                    className="warehouse-salary__empty"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 5 : 4}
                    className="warehouse-salary__empty"
                  >
                    Выплат за выбранный период нет.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtDateTime(p.created_at)}</td>
                    {isOwnerOrAdmin && <td>{resolveEmployeeName(p)}</td>}
                    <td>{fmtMoney(p.amount)}</td>
                    <td>{p.cashbox_name || "—"}</td>
                    <td>{p.comment || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderPayoutModal = () => {
    if (!payoutModalOpen) return null;
    const selectedBalance = balanceByEmployee.get(
      String(payoutForm.employee),
    );
    return (
      <div className="warehouse-salary__modal">
        <div
          className="warehouse-salary__modal-overlay"
          onClick={() => setPayoutModalOpen(false)}
        />
        <div className="warehouse-salary__modal-content">
          <div className="warehouse-salary__modal-header">
            <h3>Выплата зарплаты</h3>
            <button
              type="button"
              onClick={() => setPayoutModalOpen(false)}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
          {payoutFormError && (
            <div className="warehouse-salary__error">{payoutFormError}</div>
          )}
          <form onSubmit={handlePayoutSubmit}>
            <label className="warehouse-salary__modal-field">
              Сотрудник
              <select
                value={payoutForm.employee}
                onChange={(e) => handlePayoutEmployeeChange(e.target.value)}
              >
                <option value="">Выберите…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {employeeLabel(emp)}
                  </option>
                ))}
              </select>
            </label>
            {selectedBalance && (
              <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0" }}>
                К выплате: {fmtMoney(selectedBalance.accrued)} сом
              </p>
            )}
            <label className="warehouse-salary__modal-field">
              Сумма, сом
              <input
                type="text"
                value={payoutForm.amount}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
            </label>
            <label className="warehouse-salary__modal-field">
              Касса
              <select
                value={payoutForm.cashbox}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    cashbox: e.target.value,
                  }))
                }
              >
                <option value="">Выберите кассу…</option>
                {(cashBoxes || []).map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.name || cb.department_name || cb.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="warehouse-salary__modal-field">
              Комментарий
              <input
                type="text"
                value={payoutForm.comment}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
              />
            </label>
            <div className="warehouse-salary__modal-actions">
              <button
                type="button"
                onClick={() => setPayoutModalOpen(false)}
                disabled={payoutSubmitting}
              >
                Отмена
              </button>
              <button type="submit" disabled={payoutSubmitting}>
                {payoutSubmitting ? "Выплата…" : "Выплатить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="warehouse-salary">
      <div className="warehouse-salary__header">
        <h2 className="warehouse-salary__title">
          {isOwnerOrAdmin ? "Зарплата производства" : "Моя зарплата"}
        </h2>
        <button
          type="button"
          className="warehouse-salary__refresh"
          onClick={() => {
            if (tab === TABS.RATES) loadRates();
            else if (tab === TABS.TIMESHEET) loadSessions();
            else if (tab === TABS.PAYOUTS) loadPayouts();
            else loadAccruals();
          }}
          disabled={loading || ratesLoading || sessionsLoading || payoutsLoading}
          title="Обновить"
        >
          <RefreshCw size={18} />
          Обновить
        </button>
      </div>

      <div className="warehouse-salary__tabs">
        <button
          type="button"
          className={`warehouse-salary__tab ${tab === TABS.ACCRUALS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.ACCRUALS)}
        >
          Начисления
        </button>
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`warehouse-salary__tab ${tab === TABS.RATES ? "is-active" : ""}`}
            onClick={() => setTab(TABS.RATES)}
          >
            <Percent size={14} />
            Ставки
          </button>
        )}
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`warehouse-salary__tab ${tab === TABS.TIMESHEET ? "is-active" : ""}`}
            onClick={() => setTab(TABS.TIMESHEET)}
          >
            <Clock size={14} />
            Табель
          </button>
        )}
        <button
          type="button"
          className={`warehouse-salary__tab ${tab === TABS.PAYOUTS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.PAYOUTS)}
        >
          Выплаты
        </button>
      </div>

      {notReady && (
        <div className="warehouse-salary__notice">
          Раздел «Зарплата» ещё не активирован на сервере. Данные появятся
          после обновления бэкенда (см. docs/production/salary.md).
        </div>
      )}

      {tab === TABS.RATES && isOwnerOrAdmin
        ? renderRatesTab()
        : tab === TABS.TIMESHEET && isOwnerOrAdmin
          ? renderTimesheetTab()
          : tab === TABS.PAYOUTS
            ? renderPayoutsTab()
            : renderAccrualsTab()}

      {renderPayoutModal()}
    </div>
  );
};

export default ProductionSalary;
