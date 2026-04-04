// Детальная карточка сотрудника (сектор «Кафе»): /crm/employ/:employeeId
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaLock } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { convertEmployeeAccessesToLabels } from "./employeeAccessLabels";
import EmployeeAccessModal from "./modals/EmployeeAccessModal";
import EmployeeEditModal from "./modals/EmployeeEditModal";
import CafeWaiterPayProfileModal from "./modals/CafeWaiterPayProfileModal";
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

const focusFirstInvalid = (errs) => {
  const order = ["email", "first_name", "last_name", "roleChoice"];
  const key = order.find((k) => errs[k]);
  if (key) {
    const el = document.querySelector(`.barbermasters__form [name="${key}"]`);
    if (el?.focus) el.focus();
  }
};

function validateEmployeeForm(form, isEdit, editId, employeesList) {
  const alerts = [];
  const errs = {};
  const email = normalizeEmail(form.email);
  if (!email) {
    errs.email = true;
    alerts.push("Укажите Email.");
  } else if (!emailRx.test(email)) {
    errs.email = true;
    alerts.push("Email указан неверно.");
  } else {
    const exists = employeesList.some(
      (u) =>
        normalizeEmail(u.email) === email && (!isEdit || u.id !== editId)
    );
    if (exists) {
      errs.email = true;
      alerts.push("Сотрудник с таким Email уже существует.");
    }
  }
  const first = String(form.first_name || "").trim();
  const last = String(form.last_name || "").trim();
  if (!first) {
    errs.first_name = true;
    alerts.push("Укажите имя.");
  } else if (first.length < 2) {
    errs.first_name = true;
    alerts.push("Имя: минимум 2 символа.");
  }
  if (!last) {
    errs.last_name = true;
    alerts.push("Укажите фамилию.");
  } else if (last.length < 2) {
    errs.last_name = true;
    alerts.push("Фамилия: минимум 2 символа.");
  }
  if (!form.roleChoice) {
    errs.roleChoice = true;
    alerts.push("Выберите роль.");
  }
  return { errs, alerts };
}

const CafeEmployEmployeeDetail = () => {
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

  const isCafe = company?.sector?.name === "Кафе";

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
    const seen = new Set();
    const out = [];
    for (const o of [...sys, ...cus]) {
      const k = o.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
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

  const display = employee ? normalizeEmployee(employee) : null;
  const roleLabel = display
    ? display.role
      ? ruLabelSys(display.role)
      : roles.length
        ? roleById.get(display.custom_role)?.name || display.role_display || "—"
        : display.role_display || "—"
    : "—";

  const isOwner = display?.role === "owner";
  const canSalary = !isOwner;

  const openAccess = () => {
    if (!employee || isOwner) return;
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
    } catch (err) {
      console.error(err);
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
    const { errs, alerts } = validateEmployeeForm(
      empForm,
      true,
      editingEmpId,
      allEmployees
    );
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstInvalid(errs);
      return;
    }
    const payload = {
      email: normalizeEmail(empForm.email),
      first_name: empForm.first_name.trim(),
      last_name: empForm.last_name.trim(),
      phone_number: empForm.phone_number.trim(),
      track_number: empForm.track_number.trim(),
      role: null,
      custom_role: null,
    };
    if (empForm.roleChoice.startsWith("sys:"))
      payload.role = empForm.roleChoice.slice(4);
    else if (empForm.roleChoice.startsWith("cus:"))
      payload.custom_role = empForm.roleChoice.slice(4);
    if (showBranchSelect && empForm.branch) {
      payload.branches = [empForm.branch];
    }

    setEmpSaving(true);
    setEmpAlerts([]);
    try {
      await api.patch(EMPLOYEE_ITEM_URL(editingEmpId), payload);
      setEditOpen(false);
      setEditingEmpId(null);
      setEmpForm(emptyEmp);
      await reload();
    } catch (err) {
      setEmpAlerts([pickApiError(err, "Не удалось обновить сотрудника.")]);
    } finally {
      setEmpSaving(false);
    }
  };

  if (!isCafe) {
    return <Navigate to="/crm/employ" replace />;
  }

  if (!employeeId) {
    return <Navigate to="/crm/employ" replace />;
  }

  if (!loading && !loadErr && employee?.role === "owner") {
    return <Navigate to="/crm/employ" replace />;
  }

  return (
    <div className="barbermasters cafeEmployDetail">
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
      {!loading && loadErr && (
        <div className="barbermasters__alert">{loadErr}</div>
      )}

      {!loading && !loadErr && display && (
        <>
          <div className="cafeEmployDetail__main">
            <header className="cafeEmployDetail__head">
              <div className="barbermasters__avatar cafeEmployDetail__avatar">
                {(fullName(display) || display.email || "•")
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "•"}
              </div>
              <div className="cafeEmployDetail__headText">
                <h1 className="cafeEmployDetail__title">
                  {fullName(display) || "Без имени"}
                </h1>
                <div className="cafeEmployDetail__meta">
                  <span className="cafeEmployDetail__metaItem">
                    {display.email || "—"}
                  </span>
                  <span className="cafeEmployDetail__metaDot" aria-hidden>
                    ·
                  </span>
                  <span className="cafeEmployDetail__metaItem">{roleLabel}</span>
                </div>
              </div>
            </header>

            <section className="cafeEmployDetail__section" aria-label="Контакты">
              <div className="cafeEmployDetail__grid">
                <div>
                  <div className="cafeEmployDetail__label">Телефон</div>
                  <div className="cafeEmployDetail__value">
                    {display.phone_number || "—"}
                  </div>
                </div>
                <div>
                  <div className="cafeEmployDetail__label">Трек-номер</div>
                  <div className="cafeEmployDetail__value">
                    {display.track_number || "—"}
                  </div>
                </div>
                <div className="cafeEmployDetail__gridFull">
                  <div className="cafeEmployDetail__label">ID</div>
                  <div className="cafeEmployDetail__mono cafeEmployDetail__value">
                    {display.id}
                  </div>
                </div>
              </div>
            </section>

            <div className="cafeEmployDetail__actions">
              {canSalary && (
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--primary"
                  onClick={() => setSalaryOpen(true)}
                >
                  ☕ Зарплата официанта
                </button>
              )}
              <button
                type="button"
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={openAccess}
                disabled={isOwner}
                title={
                  isOwner
                    ? "Для владельца доступы не настраиваются"
                    : "Управление доступами"
                }
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

          <CafeWaiterPayProfileModal
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

export default CafeEmployEmployeeDetail;
