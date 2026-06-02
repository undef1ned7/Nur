import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalculator,
  FaChartLine,
  FaCog,
  FaEdit,
  FaInfoCircle,
  FaLock,
} from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { convertEmployeeAccessesToLabels } from "./employeeAccessLabels";
import EmployeeAccessModal from "./modals/EmployeeAccessModal";
import EmployeeEditModal from "./modals/EmployeeEditModal";
import MarketSaleEmployeePayProfileModal from "./modals/MarketSaleEmployeePayProfileModal";
import {
  isSaleEmployeePayrollSector,
  salePayrollSectorEmoji,
} from "./saleEmployeePayroll";
import { RoleSelect } from "./Masters";
import "./Masters.scss";

const EMPLOYEES_LIST_URL = "/users/employees/";
const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;
const ROLES_LIST_URL = "/users/roles/";

const SYSTEM_ROLES = ["owner", "admin"];
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const normalizeEmail = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  role: e.role ?? null,
  custom_role: e.custom_role ?? null,
  role_display: e.role_display ?? "",
  branches: Array.isArray(e.branches) ? e.branches : e.branch ? [e.branch] : [],
  branch: e.branch ?? null,
  track_number: e.track_number ?? "",
  phone_number: e.phone_number ?? "",
});

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

const ruLabelSys = (c) =>
  c === "owner" ? "Владелец" : c === "admin" ? "Администратор" : c || "";

const sysCodeFromName = (n) => {
  const l = String(n || "")
    .trim()
    .toLowerCase();
  if (["admin", "administrator", "админ", "администратор"].includes(l))
    return "admin";
  if (["owner", "владелец"].includes(l)) return "owner";
  return null;
};

const pickApiError = (e, fb) => {
  const d = e?.response?.data;
  if (!d) return fb;
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    try {
      const k = Object.keys(d)[0];
      const v = Array.isArray(d[k]) ? d[k][0] : d[k];
      return String(v || fb);
    } catch {
      return fb;
    }
  }
  return fb;
};

const emptyEmp = {
  email: "",
  first_name: "",
  last_name: "",
  roleChoice: "",
  track_number: "",
  phone_number: "",
  branch: "",
};

const fmtMoney = (n) =>
  Number(n || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPeriodRu = (from, to) => {
  try {
    const f = new Date(`${from}T12:00:00`);
    const t = new Date(`${to}T12:00:00`);
    const opts = { day: "numeric", month: "long", year: "numeric" };
    return `${f.toLocaleDateString("ru-RU", opts)} — ${t.toLocaleDateString("ru-RU", opts)}`;
  } catch {
    return `${from} — ${to}`;
  }
};

const monthRange = (year, month) => {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

const PROFILE_SCOPE_LABELS = {
  branch: "Профиль филиала",
  global: "Общий профиль компании",
};

const MarketEmployEmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { company, tariff, profile } = useUser();

  const [employee, setEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [accessLabels, setAccessLabels] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [empAlerts, setEmpAlerts] = useState([]);
  const [empFieldErrors, setEmpFieldErrors] = useState({});
  const [empForm, setEmpForm] = useState(emptyEmp);
  const [editingEmpId, setEditingEmpId] = useState(null);

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryRows, setSalaryRows] = useState([]);
  const [salaryError, setSalaryError] = useState("");
  const [empAnalyticsLoading, setEmpAnalyticsLoading] = useState(false);
  const [empAnalyticsError, setEmpAnalyticsError] = useState("");
  const [empSalesPayload, setEmpSalesPayload] = useState(null);
  const [empShiftsPayload, setEmpShiftsPayload] = useState(null);
  const [activePanel, setActivePanel] = useState("payroll");

  const sectorName = String(company?.sector?.name || "").trim();
  const isSalePayroll = isSaleEmployeePayrollSector(sectorName);
  const payrollEmoji = salePayrollSectorEmoji(sectorName);

  const showBranchSelect = useMemo(() => {
    const tariffLower = String(tariff || "").toLowerCase();
    return tariffLower !== "старт" && tariffLower !== "start";
  }, [tariff]);

  const roleById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  const roleOptions = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({
      key: `sys:${code}`,
      label: ruLabelSys(code),
    }));
    const cus = roles
      .filter((r) => !sysCodeFromName(r.name))
      .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));
    return [...sys, ...cus].sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [roles]);

  const reload = useCallback(async () => {
    if (!employeeId) return;
    setLoadErr("");
    try {
      const [empRes, listRes, rolesRes, brRes] = await Promise.all([
        api.get(EMPLOYEE_ITEM_URL(employeeId)),
        api.get(EMPLOYEES_LIST_URL),
        api.get(ROLES_LIST_URL),
        api.get("/users/branches/").catch(() => ({ data: [] })),
      ]);
      setEmployee(empRes.data);
      setAllEmployees(asArray(listRes.data).map(normalizeEmployee));
      setRoles(asArray(rolesRes.data).map((r) => ({ id: r.id, name: r.name || "" })));
      setBranches(asArray(brRes.data));
    } catch (e) {
      setLoadErr(validateResErrors(e, "Не удалось загрузить сотрудника"));
      setEmployee(null);
    }
  }, [employeeId]);

  const fetchSalary = useCallback(async () => {
    if (!employeeId || !isSalePayroll) return;
    setSalaryLoading(true);
    setSalaryError("");
    try {
      const params = {
        tab: "salary",
        period_start: dateFrom,
        period_end: dateTo,
      };
      const branch = profile?.active_branch || profile?.branch;
      if (branch) params.branch = String(branch);
      const { data } = await api.get("/main/analytics/market/", { params });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setSalaryRows(rows.filter((r) => String(r.user_id) === String(employeeId)));
    } catch (e) {
      setSalaryError(validateResErrors(e, "Не удалось загрузить аналитику зарплаты"));
      setSalaryRows([]);
    } finally {
      setSalaryLoading(false);
    }
  }, [employeeId, isSalePayroll, dateFrom, dateTo, profile?.active_branch, profile?.branch]);

  const fetchEmployeeMarketAnalytics = useCallback(async () => {
    if (!employeeId || !isSalePayroll) return;
    setEmpAnalyticsLoading(true);
    setEmpAnalyticsError("");
    try {
      const common = {
        period_start: dateFrom,
        period_end: dateTo,
      };
      const branch = profile?.active_branch || profile?.branch;
      if (branch) common.branch = String(branch);
      const [salesRes, shiftsRes] = await Promise.all([
        api.get("/main/analytics/market/", {
          params: { ...common, tab: "sales", cashier: String(employeeId) },
        }),
        api.get("/main/analytics/market/", {
          params: { ...common, tab: "shifts", cashier: String(employeeId) },
        }),
      ]);
      setEmpSalesPayload(salesRes?.data || null);
      setEmpShiftsPayload(shiftsRes?.data || null);
    } catch (e) {
      setEmpAnalyticsError(validateResErrors(e, "Не удалось загрузить аналитику сотрудника"));
      setEmpSalesPayload(null);
      setEmpShiftsPayload(null);
    } finally {
      setEmpAnalyticsLoading(false);
    }
  }, [employeeId, isSalePayroll, dateFrom, dateTo, profile?.active_branch, profile?.branch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    fetchSalary();
  }, [fetchSalary]);

  useEffect(() => {
    fetchEmployeeMarketAnalytics();
  }, [fetchEmployeeMarketAnalytics]);

  const empSalesCards = useMemo(() => {
    const c = empSalesPayload?.cards || {};
    return {
      revenue: fmtMoney(c.revenue || 0),
      transactions: Number(c.transactions || 0).toLocaleString("ru-RU"),
      avgCheck: fmtMoney(c.avg_check || 0),
      clients: Number(c.clients || 0).toLocaleString("ru-RU"),
    };
  }, [empSalesPayload]);

  const empSalesTopProducts = useMemo(
    () => (Array.isArray(empSalesPayload?.tables?.top_products) ? empSalesPayload.tables.top_products : []),
    [empSalesPayload],
  );
  const empSalesDocuments = useMemo(
    () => (Array.isArray(empSalesPayload?.tables?.documents) ? empSalesPayload.tables.documents : []),
    [empSalesPayload],
  );
  const empSalesPaymentMethods = useMemo(
    () =>
      Array.isArray(empSalesPayload?.charts?.payment_methods)
        ? empSalesPayload.charts.payment_methods
        : [],
    [empSalesPayload],
  );
  const empShiftRows = useMemo(
    () => (Array.isArray(empShiftsPayload?.tables?.active_shifts) ? empShiftsPayload.tables.active_shifts : []),
    [empShiftsPayload],
  );

  const salarySummary = salaryRows[0] || null;

  const applyPeriodPreset = (preset) => {
    const now = new Date();
    if (preset === "thisMonth") {
      const r = monthRange(now.getFullYear(), now.getMonth());
      setDateFrom(r.from);
      setDateTo(now.toISOString().slice(0, 10));
      return;
    }
    if (preset === "lastMonth") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const r = monthRange(d.getFullYear(), d.getMonth());
      setDateFrom(r.from);
      setDateTo(r.to);
      return;
    }
    if (preset === "last7") {
      const to = new Date(now);
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      setDateFrom(from.toISOString().slice(0, 10));
      setDateTo(to.toISOString().slice(0, 10));
    }
  };

  const refreshAll = () => {
    fetchSalary();
    fetchEmployeeMarketAnalytics();
  };

  const display = employee ? normalizeEmployee(employee) : null;
  const roleLabel = display
    ? display.role
      ? ruLabelSys(display.role)
      : roleById.get(display.custom_role)?.name || display.role_display || "—"
    : "—";

  const openAccess = () => {
    if (!employee || display?.role === "owner") return;
    const labels = convertEmployeeAccessesToLabels(employee, company?.sector?.name);
    setAccessEmployee(employee);
    setAccessLabels(labels);
    setAccessOpen(true);
  };

  const saveAccesses = async (payload) => {
    if (!accessEmployee) return;
    setAccessSaving(true);
    try {
      await api.patch(EMPLOYEE_ITEM_URL(accessEmployee.id), payload);
      setAccessOpen(false);
      setAccessEmployee(null);
      setAccessLabels([]);
      await reload();
    } finally {
      setAccessSaving(false);
    }
  };

  const openEdit = () => {
    if (!display) return;
    const roleChoice = display.role
      ? `sys:${display.role}`
      : display.custom_role
        ? `cus:${display.custom_role}`
        : "";
    const branchValue =
      Array.isArray(display.branches) && display.branches.length > 0
        ? display.branches[0]
        : display.branch || "";
    setEditingEmpId(display.id);
    setEmpForm({
      email: display.email || "",
      first_name: display.first_name || "",
      last_name: display.last_name || "",
      roleChoice,
      track_number: display.track_number || "",
      phone_number: display.phone_number || "",
      branch: branchValue,
    });
    setEmpAlerts([]);
    setEmpFieldErrors({});
    setEditOpen(true);
  };

  const submitEmployeeEdit = async (e) => {
    e.preventDefault();
    if (!editingEmpId) return;
    const errs = {};
    const alerts = [];
    const email = normalizeEmail(empForm.email);
    if (!email || !emailRx.test(email)) {
      errs.email = true;
      alerts.push("Проверьте Email.");
    }
    if (!String(empForm.first_name || "").trim()) {
      errs.first_name = true;
      alerts.push("Укажите имя.");
    }
    if (!String(empForm.last_name || "").trim()) {
      errs.last_name = true;
      alerts.push("Укажите фамилию.");
    }
    if (!empForm.roleChoice) {
      errs.roleChoice = true;
      alerts.push("Выберите роль.");
    }
    const exists = allEmployees.some(
      (u) => normalizeEmail(u.email) === email && u.id !== editingEmpId,
    );
    if (exists) {
      errs.email = true;
      alerts.push("Сотрудник с таким Email уже существует.");
    }
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(alerts);
      return;
    }
    const payload = {
      email,
      first_name: String(empForm.first_name || "").trim(),
      last_name: String(empForm.last_name || "").trim(),
      phone_number: String(empForm.phone_number || "").trim(),
      track_number: String(empForm.track_number || "").trim(),
      role: null,
      custom_role: null,
    };
    if (empForm.roleChoice.startsWith("sys:")) payload.role = empForm.roleChoice.slice(4);
    if (empForm.roleChoice.startsWith("cus:")) payload.custom_role = empForm.roleChoice.slice(4);
    if (showBranchSelect && empForm.branch) payload.branches = [empForm.branch];
    setEmpSaving(true);
    try {
      await api.patch(EMPLOYEE_ITEM_URL(editingEmpId), payload);
      setEditOpen(false);
      setEditingEmpId(null);
      await reload();
    } catch (err) {
      setEmpAlerts([pickApiError(err, "Не удалось обновить сотрудника.")]);
    } finally {
      setEmpSaving(false);
    }
  };

  if (!isSalePayroll) return <Navigate to="/crm/employ" replace />;
  if (!employeeId) return <Navigate to="/crm/employ" replace />;

  const periodLabel = formatPeriodRu(dateFrom, dateTo);
  const isRefreshing = salaryLoading || empAnalyticsLoading;

  return (
    <div className="barbermasters cafeEmployDetail marketEmployDetail">
      <div className="barbermasters__top">
        <button
          type="button"
          className="barbermasters__btn barbermasters__btn--secondary"
          onClick={() => navigate("/crm/employ")}
        >
          <FaArrowLeft /> К списку сотрудников
        </button>
      </div>

      {loading && <div className="barbermasters__help">Загрузка…</div>}
      {!loading && loadErr && <div className="barbermasters__alert">{loadErr}</div>}

      {!loading && !loadErr && display && (
        <>
          <div className="marketEmployDetail__layout">
            <aside className="marketEmployDetail__sidebar">
              <header className="cafeEmployDetail__head marketEmployDetail__profileHead">
                <div className="barbermasters__avatar cafeEmployDetail__avatar">
                  {(fullName(display) || display.email || "•").trim().charAt(0).toUpperCase() || "•"}
                </div>
                <div className="cafeEmployDetail__headText">
                  <h1 className="cafeEmployDetail__title">{fullName(display) || "Без имени"}</h1>
                  <div className="cafeEmployDetail__meta">
                    <span className="cafeEmployDetail__metaItem">{display.email || "—"}</span>
                    <span className="cafeEmployDetail__metaDot">·</span>
                    <span className="cafeEmployDetail__metaItem">{roleLabel}</span>
                  </div>
                </div>
              </header>

              <dl className="marketEmployDetail__profileFacts">
                <div>
                  <dt>Телефон</dt>
                  <dd>{display.phone_number || "—"}</dd>
                </div>
                <div>
                  <dt>Трек-номер</dt>
                  <dd>{display.track_number || "—"}</dd>
                </div>
              </dl>

              {display.role !== "owner" ? (
                <div className="marketEmployDetail__sidebarCta">
                  <p className="marketEmployDetail__sidebarCtaText">
                    Сначала укажите схему: оклад, процент от продаж или оба варианта.
                  </p>
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--primary marketEmployDetail__sidebarCtaBtn"
                    onClick={() => setSalaryOpen(true)}
                  >
                    <FaCog aria-hidden /> Настроить зарплату
                  </button>
                </div>
              ) : null}

              <div className="cafeEmployDetail__actions marketEmployDetail__sidebarActions">
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--secondary"
                  onClick={openEdit}
                >
                  <FaEdit /> Редактировать
                </button>
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--secondary"
                  onClick={openAccess}
                  disabled={display.role === "owner"}
                >
                  <FaLock /> Доступы
                </button>
              </div>
            </aside>

            <div className="marketEmployDetail__content">
              <div className="marketEmployDetail__guide" role="note">
                <FaInfoCircle className="marketEmployDetail__guideIcon" aria-hidden />
                <div>
                  <strong>Как считается зарплата</strong>
                  <ol className="marketEmployDetail__guideList">
                    <li>Настройте схему начисления (оклад и/или % от продаж).</li>
                    <li>
                      В расчёт попадают только <em>оплаченные</em> чеки, где этот сотрудник
                      указан как оформивший продажу.
                    </li>
                    <li>Выберите период ниже — система покажет начисление и детализацию.</li>
                  </ol>
                </div>
              </div>

              <div className="marketEmployDetail__periodCard">
                <div className="marketEmployDetail__periodHead">
                  <span className="marketEmployDetail__periodTitle">Период отчёта</span>
                  <span className="marketEmployDetail__periodHint">{periodLabel}</span>
                </div>
                <div className="marketEmployDetail__presets">
                  <button
                    type="button"
                    className="marketEmployDetail__presetBtn"
                    onClick={() => applyPeriodPreset("thisMonth")}
                  >
                    Текущий месяц
                  </button>
                  <button
                    type="button"
                    className="marketEmployDetail__presetBtn"
                    onClick={() => applyPeriodPreset("lastMonth")}
                  >
                    Прошлый месяц
                  </button>
                  <button
                    type="button"
                    className="marketEmployDetail__presetBtn"
                    onClick={() => applyPeriodPreset("last7")}
                  >
                    7 дней
                  </button>
                </div>
                <div className="marketEmployDetail__filters">
                  <label className="marketEmployDetail__dateField">
                    <span>С</span>
                    <input
                      type="date"
                      className="barbermasters__input marketEmployDetail__dateInput"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      aria-label="Дата начала периода"
                    />
                  </label>
                  <label className="marketEmployDetail__dateField">
                    <span>По</span>
                    <input
                      type="date"
                      className="barbermasters__input marketEmployDetail__dateInput"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      aria-label="Дата окончания периода"
                    />
                  </label>
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--primary marketEmployDetail__refreshBtn"
                    onClick={refreshAll}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Обновление…" : "Показать за период"}
                  </button>
                </div>
              </div>

              <div
                className="marketEmployDetail__tabs"
                role="tablist"
                aria-label="Разделы карточки сотрудника"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "payroll"}
                  className={`marketEmployDetail__tab${activePanel === "payroll" ? " marketEmployDetail__tab--active" : ""}`}
                  onClick={() => setActivePanel("payroll")}
                >
                  <FaCalculator aria-hidden /> Расчёт зарплаты
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "sales"}
                  className={`marketEmployDetail__tab${activePanel === "sales" ? " marketEmployDetail__tab--active" : ""}`}
                  onClick={() => setActivePanel("sales")}
                >
                  <FaChartLine aria-hidden /> Продажи и смены
                </button>
              </div>

              {activePanel === "payroll" ? (
                <section
                  className="marketEmployDetail__panel"
                  role="tabpanel"
                  aria-label="Расчёт зарплаты"
                >
                  {salaryError ? <div className="barbermasters__alert">{salaryError}</div> : null}

                  {salaryLoading ? (
                    <div className="marketEmployDetail__panelLoading">Считаем зарплату за период…</div>
                  ) : null}

                  {!salaryLoading && salarySummary ? (
                    <>
                      <div className="marketEmployDetail__salaryHero">
                        <div className="marketEmployDetail__salaryHeroMain">
                          <span className="marketEmployDetail__salaryHeroLabel">
                            К выплате за период
                          </span>
                          <span className="marketEmployDetail__salaryHeroTotal">
                            {fmtMoney(salarySummary.total)} <small>сом</small>
                          </span>
                          <span className="marketEmployDetail__salaryHeroScheme">
                            {salarySummary.pay_scheme_label || salarySummary.pay_scheme || "—"}
                            {salarySummary.profile_scope
                              ? ` · ${PROFILE_SCOPE_LABELS[salarySummary.profile_scope] || salarySummary.profile_scope}`
                              : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="barbermasters__btn barbermasters__btn--secondary"
                          onClick={() => setSalaryOpen(true)}
                        >
                          Изменить схему
                        </button>
                      </div>

                      <div className="marketEmployDetail__breakdown">
                        <div className="marketEmployDetail__breakdownItem">
                          <span className="marketEmployDetail__breakdownLabel">Оклад за период</span>
                          <span className="marketEmployDetail__breakdownValue">
                            {fmtMoney(salarySummary.base_prorated)}
                          </span>
                          <span className="marketEmployDetail__breakdownHint">
                            из {fmtMoney(salarySummary.monthly_base_salary)} / мес ·{" "}
                            {salarySummary.period_days || 0} дн.
                          </span>
                        </div>
                        <div className="marketEmployDetail__breakdownItem">
                          <span className="marketEmployDetail__breakdownLabel">Продажи сотрудника</span>
                          <span className="marketEmployDetail__breakdownValue">
                            {fmtMoney(salarySummary.employee_sales_period)}
                          </span>
                          <span className="marketEmployDetail__breakdownHint">
                            оплаченные чеки за период
                          </span>
                        </div>
                        <div className="marketEmployDetail__breakdownItem marketEmployDetail__breakdownItem--accent">
                          <span className="marketEmployDetail__breakdownLabel">
                            Бонус {fmtMoney(salarySummary.sales_percent)}%
                          </span>
                          <span className="marketEmployDetail__breakdownValue">
                            {fmtMoney(salarySummary.percent_bonus)}
                          </span>
                          <span className="marketEmployDetail__breakdownHint">
                            % от суммы продаж
                          </span>
                        </div>
                      </div>

                      <details className="marketEmployDetail__detailsTable">
                        <summary>Все поля расчёта (таблица)</summary>
                        <div className="marketEmployDetail__tableWrap">
                          <table className="marketEmployDetail__table marketEmployDetail__table--compact">
                            <thead>
                              <tr>
                                <th>Схема</th>
                                <th>Оклад/мес</th>
                                <th>%</th>
                                <th>Дней</th>
                                <th>Оклад за период</th>
                                <th>Продажи</th>
                                <th>Бонус</th>
                                <th>Итого</th>
                              </tr>
                            </thead>
                            <tbody>
                              {salaryRows.map((r, idx) => (
                                <tr key={`${r.user_id || "u"}-${idx}`}>
                                  <td>{r.pay_scheme_label || r.pay_scheme || "—"}</td>
                                  <td>{fmtMoney(r.monthly_base_salary)}</td>
                                  <td>{fmtMoney(r.sales_percent)}</td>
                                  <td>{r.period_days || 0}</td>
                                  <td>{fmtMoney(r.base_prorated)}</td>
                                  <td>{fmtMoney(r.employee_sales_period)}</td>
                                  <td>{fmtMoney(r.percent_bonus)}</td>
                                  <td>{fmtMoney(r.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </>
                  ) : null}

                  {!salaryLoading && !salarySummary ? (
                    <div className="marketEmployDetail__emptyState">
                      <div className="marketEmployDetail__emptyStateIcon" aria-hidden>
                        {payrollEmoji}
                      </div>
                      <h3 className="marketEmployDetail__emptyStateTitle">
                        Нет расчёта за выбранный период
                      </h3>
                      <p className="marketEmployDetail__emptyStateText">
                        Обычно это значит, что схема зарплаты ещё не настроена, или за период не
                        было оплаченных продаж от этого сотрудника.
                      </p>
                      {display.role !== "owner" ? (
                        <button
                          type="button"
                          className="barbermasters__btn barbermasters__btn--primary"
                          onClick={() => setSalaryOpen(true)}
                        >
                          <FaCog aria-hidden /> Настроить зарплату
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activePanel === "sales" ? (
                <section
                  className="marketEmployDetail__panel"
                  role="tabpanel"
                  aria-label="Продажи и смены"
                >
                  <p className="marketEmployDetail__panelIntro">
                    Сводка по кассе за тот же период. Для начисления % используются продажи, где
                    сотрудник — автор чека (см. вкладку «Расчёт зарплаты»).
                  </p>
                  {empAnalyticsError ? (
                    <div className="barbermasters__alert">{empAnalyticsError}</div>
                  ) : null}
                  {empAnalyticsLoading ? (
                    <div className="marketEmployDetail__panelLoading">Загружаем продажи…</div>
                  ) : null}

                  <div className="marketEmployDetail__kpis">
                    <div className="marketEmployDetail__kpi">
                      <div className="marketEmployDetail__kpiLabel">Выручка</div>
                      <div className="marketEmployDetail__kpiValue">{empSalesCards.revenue}</div>
                    </div>
                    <div className="marketEmployDetail__kpi">
                      <div className="marketEmployDetail__kpiLabel">Чеков</div>
                      <div className="marketEmployDetail__kpiValue">{empSalesCards.transactions}</div>
                    </div>
                    <div className="marketEmployDetail__kpi">
                      <div className="marketEmployDetail__kpiLabel">Средний чек</div>
                      <div className="marketEmployDetail__kpiValue">{empSalesCards.avgCheck}</div>
                    </div>
                    <div className="marketEmployDetail__kpi">
                      <div className="marketEmployDetail__kpiLabel">Клиенты</div>
                      <div className="marketEmployDetail__kpiValue">{empSalesCards.clients}</div>
                    </div>
                  </div>

                  <h4 className="marketEmployDetail__blockTitle">Оплата</h4>
                  <div className="marketEmployDetail__tableWrap">
                    <table className="marketEmployDetail__table marketEmployDetail__table--compact">
                      <thead>
                        <tr>
                          <th>Способ</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empSalesPaymentMethods.length ? (
                          empSalesPaymentMethods.map((m, idx) => (
                            <tr key={`${m.method || m.name || "pm"}-${idx}`}>
                              <td>{m.method || m.name || "—"}</td>
                              <td>{fmtMoney(m.total || m.count || 0)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="marketEmployDetail__empty">
                              Нет данных за период
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="marketEmployDetail__blockTitle">Топ товаров</h4>
                  <div className="marketEmployDetail__tableWrap">
                    <table className="marketEmployDetail__table marketEmployDetail__table--compact">
                      <thead>
                        <tr>
                          <th>Товар</th>
                          <th>Шт.</th>
                          <th>Выручка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empSalesTopProducts.length ? (
                          empSalesTopProducts.map((p, idx) => (
                            <tr key={`${p.name || "prod"}-${idx}`}>
                              <td>{p.name || "—"}</td>
                              <td>{p.sold || 0}</td>
                              <td>{fmtMoney(p.revenue || 0)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="marketEmployDetail__empty">
                              Нет данных
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="marketEmployDetail__blockTitle">Документы</h4>
                  <div className="marketEmployDetail__tableWrap">
                    <table className="marketEmployDetail__table marketEmployDetail__table--compact">
                      <thead>
                        <tr>
                          <th>Тип</th>
                          <th>Кол-во</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empSalesDocuments.length ? (
                          empSalesDocuments.map((d, idx) => (
                            <tr key={`${d.name || "doc"}-${idx}`}>
                              <td>{d.name || "—"}</td>
                              <td>{d.count || d.quantity || 0}</td>
                              <td>{fmtMoney(d.sum || d.amount || 0)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="marketEmployDetail__empty">
                              Нет данных
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="marketEmployDetail__blockTitle">Смены</h4>
                  <div className="marketEmployDetail__tableWrap">
                    <table className="marketEmployDetail__table marketEmployDetail__table--compact">
                      <thead>
                        <tr>
                          <th>Сотрудник</th>
                          <th>Касса</th>
                          <th>Продажи</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empShiftRows.length ? (
                          empShiftRows.map((s, idx) => (
                            <tr key={`${s.shift_id || s.id || "shift"}-${idx}`}>
                              <td>{s.cashier || s.employee || "—"}</td>
                              <td>{s.cashbox || "—"}</td>
                              <td>{fmtMoney(s.sales || 0)}</td>
                              <td>{s.status || "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="marketEmployDetail__empty">
                              Нет смен за период
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <MarketSaleEmployeePayProfileModal
            open={salaryOpen}
            employee={display}
            onClose={() => setSalaryOpen(false)}
            employeeDisplayName={fullName(display)}
          />
          <EmployeeAccessModal
            accessModalOpen={accessOpen}
            setAccessModalOpen={setAccessOpen}
            accessModalEmployee={accessEmployee}
            accessModalAccesses={accessLabels}
            handleSaveEmployeeAccesses={saveAccesses}
            profile={profile}
            tariff={tariff}
            company={company}
            empSaving={accessSaving}
          />
          <EmployeeEditModal
            empEditOpen={editOpen}
            empSaving={empSaving}
            setEmpEditOpen={setEditOpen}
            empAlerts={empAlerts}
            empFieldErrors={empFieldErrors}
            empForm={empForm}
            setEmpForm={setEmpForm}
            submitEmployeeEdit={submitEmployeeEdit}
            company={company}
            roleOptions={roleOptions}
            showBranchSelect={showBranchSelect}
            branches={branches}
            RoleSelect={RoleSelect}
          />
        </>
      )}
    </div>
  );
};

export default MarketEmployEmployeeDetail;
