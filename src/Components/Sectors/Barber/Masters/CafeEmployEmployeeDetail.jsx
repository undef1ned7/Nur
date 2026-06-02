// Детальная карточка сотрудника (сектор «Кафе»): /crm/employ/:employeeId
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaLock } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { convertEmployeeAccessesToLabels } from "./employeeAccessLabels";
import EmployeeAccessModal from "./modals/EmployeeAccessModal";
import CafeWaiterPayProfileModal from "./modals/CafeWaiterPayProfileModal";
import MarketSaleEmployeePayProfileModal from "./modals/MarketSaleEmployeePayProfileModal";
import { employPayrollDetailPath } from "./saleEmployeePayroll";
import { resolveEmployeeRoleLabel } from "./resolveEmployeeRoleLabel";
import "./Masters.scss";

const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;
const ROLES_LIST_URL = "/users/roles/";

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

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

const CafeEmployEmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { company, tariff, profile } = useUser();

  const [employee, setEmployee] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [accessLabels, setAccessLabels] = useState([]);
  const [accessSaving, setAccessSaving] = useState(false);

  const sectorName = String(company?.sector?.name || "").trim();
  const isCafe = sectorName === "Кафе";
  const isMarket = sectorName === "Маркет" || sectorName === "Магазин";
  const isProduction = sectorName === "Производство";

  const roleById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => {
      if (r.id != null && String(r.id).trim() !== "") {
        m.set(r.id, r);
      }
    });
    return m;
  }, [roles]);

  const reload = useCallback(async () => {
    if (!employeeId) return;
    setLoadErr("");
    try {
      const [empRes, rolesRes] = await Promise.all([
        api.get(EMPLOYEE_ITEM_URL(employeeId)),
        api.get(ROLES_LIST_URL),
      ]);
      setEmployee(empRes.data);
      setRoles(asArray(rolesRes.data).map((r) => ({ id: r.id, name: r.name || "" })));
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
    ? resolveEmployeeRoleLabel(display, roleById)
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

  if (!isCafe && !isMarket && !isProduction) {
    return <Navigate to="/crm/employ" replace />;
  }

  if (isMarket && employeeId) {
    return <Navigate to={`/crm/employ/market/${employeeId}`} replace />;
  }

  if (isProduction && employeeId) {
    const path = employPayrollDetailPath(sectorName, employeeId);
    if (path) return <Navigate to={path} replace />;
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
                  {isMarket ? "🛒 Зарплата сотрудника" : "☕ Зарплата официанта"}
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
            </div>
          </div>

          {isCafe ? (
            <CafeWaiterPayProfileModal
              open={salaryOpen}
              employee={display}
              onClose={() => setSalaryOpen(false)}
              employeeDisplayName={fullName(display)}
            />
          ) : null}
          {isMarket ? (
            <MarketSaleEmployeePayProfileModal
              open={salaryOpen}
              employee={display}
              onClose={() => setSalaryOpen(false)}
              employeeDisplayName={fullName(display)}
            />
          ) : null}

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
        </>
      )}
    </div>
  );
};

export default CafeEmployEmployeeDetail;
