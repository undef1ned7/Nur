import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaLock } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { convertEmployeeAccessesToLabels } from "./employeeAccessLabels";
import EmployeeAccessModal from "./modals/EmployeeAccessModal";
import EmployeeEditModal from "./modals/EmployeeEditModal";
import MarketSaleEmployeePayProfileModal from "./modals/MarketSaleEmployeePayProfileModal";
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

  const sectorName = String(company?.sector?.name || "").trim();
  const isMarket = sectorName === "Маркет" || sectorName === "Магазин";

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
    if (!employeeId || !isMarket) return;
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
  }, [employeeId, isMarket, dateFrom, dateTo, profile?.active_branch, profile?.branch]);

  const fetchEmployeeMarketAnalytics = useCallback(async () => {
    if (!employeeId || !isMarket) return;
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
  }, [employeeId, isMarket, dateFrom, dateTo, profile?.active_branch, profile?.branch]);

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

  if (!isMarket) return <Navigate to="/crm/employ" replace />;
  if (!employeeId) return <Navigate to="/crm/employ" replace />;

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
          <div className="cafeEmployDetail__main">
            <header className="cafeEmployDetail__head">
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

            <section className="cafeEmployDetail__section">
              <div className="cafeEmployDetail__grid">
                <div>
                  <div className="cafeEmployDetail__label">Телефон</div>
                  <div className="cafeEmployDetail__value">{display.phone_number || "—"}</div>
                </div>
                <div>
                  <div className="cafeEmployDetail__label">Трек-номер</div>
                  <div className="cafeEmployDetail__value">{display.track_number || "—"}</div>
                </div>
                <div className="cafeEmployDetail__gridFull">
                  <div className="cafeEmployDetail__label">ID</div>
                  <div className="cafeEmployDetail__mono cafeEmployDetail__value">{display.id}</div>
                </div>
              </div>
            </section>

            <div className="cafeEmployDetail__actions">
              {display.role !== "owner" ? (
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--primary"
                  onClick={() => setSalaryOpen(true)}
                >
                  🛒 Зарплата сотрудника
                </button>
              ) : null}
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={openAccess}
                disabled={display.role === "owner"}
              >
                <FaLock /> Доступы
              </button>
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={openEdit}
              >
                <FaEdit /> Редактировать
              </button>
            </div>
          </div>

          <section className="marketEmployDetail__analytics">
            <div className="marketEmployDetail__head">
              <h3 className="marketEmployDetail__title">Аналитика зарплаты сотрудника</h3>
              <div className="marketEmployDetail__filters">
                <label className="marketEmployDetail__dateField">
                  <span>От</span>
                  <input
                    type="date"
                    className="barbermasters__input marketEmployDetail__dateInput"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="marketEmployDetail__dateField">
                  <span>До</span>
                  <input
                    type="date"
                    className="barbermasters__input marketEmployDetail__dateInput"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--secondary marketEmployDetail__refreshBtn"
                  onClick={fetchSalary}
                  disabled={salaryLoading}
                >
                  {salaryLoading ? "Загрузка..." : "Обновить"}
                </button>
              </div>
            </div>
            {salaryError ? <div className="barbermasters__alert">{salaryError}</div> : null}
            <div className="marketEmployDetail__tableWrap">
              <table className="marketEmployDetail__table">
                <thead>
                  <tr>
                    <th>Схема</th>
                    <th>Оклад/мес</th>
                    <th>%</th>
                    <th>Дней</th>
                    <th>Оклад за период</th>
                    <th>Продажи сотрудника</th>
                    <th>Бонус %</th>
                    <th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryRows.length > 0 ? (
                    salaryRows.map((r, idx) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="marketEmployDetail__empty">
                        Данных за период нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="marketEmployDetail__analytics">
            <div className="marketEmployDetail__head">
              <h3 className="marketEmployDetail__title">Продажи, возвраты и смены сотрудника</h3>
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary marketEmployDetail__refreshBtn"
                onClick={fetchEmployeeMarketAnalytics}
                disabled={empAnalyticsLoading}
              >
                {empAnalyticsLoading ? "Загрузка..." : "Обновить аналитику"}
              </button>
            </div>
            {empAnalyticsError ? (
              <div className="barbermasters__alert">{empAnalyticsError}</div>
            ) : null}
            <div className="marketEmployDetail__kpis">
              <div className="marketEmployDetail__kpi">
                <div className="marketEmployDetail__kpiLabel">Выручка</div>
                <div className="marketEmployDetail__kpiValue">{empSalesCards.revenue}</div>
              </div>
              <div className="marketEmployDetail__kpi">
                <div className="marketEmployDetail__kpiLabel">Транзакции</div>
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

            <div className="marketEmployDetail__tableWrap">
              <table className="marketEmployDetail__table">
                <thead>
                  <tr>
                    <th>Способ оплаты</th>
                    <th>Показатель</th>
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
                      <td colSpan={2} className="marketEmployDetail__empty">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="marketEmployDetail__tableWrap">
              <table className="marketEmployDetail__table">
                <thead>
                  <tr>
                    <th>Топ товары</th>
                    <th>Продано</th>
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
                      <td colSpan={3} className="marketEmployDetail__empty">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="marketEmployDetail__tableWrap">
              <table className="marketEmployDetail__table">
                <thead>
                  <tr>
                    <th>Документ</th>
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
                      <td colSpan={3} className="marketEmployDetail__empty">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="marketEmployDetail__tableWrap">
              <table className="marketEmployDetail__table">
                <thead>
                  <tr>
                    <th>Смены</th>
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
                      <td colSpan={4} className="marketEmployDetail__empty">Нет данных</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

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
