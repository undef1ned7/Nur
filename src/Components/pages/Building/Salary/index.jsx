import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  fetchBuildingSalaryEmployees,
  fetchBuildingPayrolls,
  createBuildingPayroll,
  approveBuildingPayroll,
  deleteBuildingPayroll,
} from "../../../../store/creators/building/salaryCreators";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Modal from "@/Components/common/Modal/Modal";
import BuildingSalaryMyLines from "./MyLines";
import "./Salary.scss";

export default function BuildingSalary() {
  const dispatch = useDispatch();
  const alert = useAlert();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const {
    employees,
    employeesLoading,
    employeesError,
    employeesUpdatingId,
    payrolls,
    payrollsLoading,
    payrollsError,
    payrollsCreating,
    linesByPayrollId,
  } = useBuildingSalary();

  const { selectedProjectId, items: projects } = useBuildingProjects();

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const arr = Array.isArray(projects) ? projects : [];
    const found = arr.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const [activeTab, setActiveTab] = useState("payrolls");
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [payrollStatusFilter, setPayrollStatusFilter] = useState("");
  const [isCreatePeriodModalOpen, setIsCreatePeriodModalOpen] = useState(false);
  const [payrollViewMode, setPayrollViewMode] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? "cards"
      : "table",
  );

  const getMonthPeriod = (monthOffset) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    const year = d.getFullYear();
    const month = d.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const pad = (n) => String(n).padStart(2, "0");
    const start = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`;
    const end = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];
    const monthLabel = `${monthNames[month]} ${year}`;
    const title = `ЗП за ${monthNames[month].toLowerCase()} ${year}`;
    return { start, end, title, monthLabel };
  };

  const applyMonthPeriod = (monthOffset) => {
    const { start, end, title } = getMonthPeriod(monthOffset);
    setNewPeriodStart(start);
    setNewPeriodEnd(end);
    setNewPeriodTitle(title);
  };

  const SALARY_TYPE_LABELS = {
    monthly: "Месячный оклад",
    monthly_pct: "Оклад + % от продаж",
    daily: "Дневная ставка",
    hourly: "Почасовая ставка",
  };

  const PAYROLL_STATUS_LABELS = {
    draft: "Черновик",
    approved: "Утверждён",
    paid: "Выплачен",
  };

  useEffect(() => {
    dispatch(fetchBuildingSalaryEmployees());
    const params = {
      residential_complex: selectedProjectId || undefined,
      status: payrollStatusFilter || undefined,
    };
    dispatch(fetchBuildingPayrolls(params));
  }, [dispatch, selectedProjectId, payrollStatusFilter]);

  const handleCreatePayroll = async (e) => {
    e.preventDefault();
    if (!newPeriodTitle.trim() || !newPeriodStart || !newPeriodEnd) {
      alert("Заполните название и даты периода", true);
      return;
    }
    if (!selectedProjectId) {
      alert("Выберите ЖК в фильтре выше", true);
      return;
    }
    const payload = {
      title: newPeriodTitle.trim(),
      period_start: newPeriodStart,
      period_end: newPeriodEnd,
      residential_complex: selectedProjectId,
    };
    const res = await dispatch(createBuildingPayroll(payload));
    if (res.meta.requestStatus === "fulfilled") {
      alert("Период создан");
      setNewPeriodTitle("");
      setNewPeriodStart("");
      setNewPeriodEnd("");
    } else {
      alert(
        validateResErrors(
          res.payload || res.error,
          "Не удалось создать период",
        ),
        true,
      );
    }
  };

  const handleApprovePayroll = (payroll) => {
    const id = payroll?.id ?? payroll?.uuid;
    if (!id) return;
    confirm(
      "Утвердить период начислений? После утверждения можно будет создавать выплаты.",
      async (ok) => {
        if (!ok) return;
        const res = await dispatch(approveBuildingPayroll(id));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Период утвержден");
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось утвердить период",
            ),
            true,
          );
        }
      },
    );
  };

  const handleDeletePayroll = async (payroll) => {
    const id = payroll?.id ?? payroll?.uuid;
    if (!id) return;
    confirm(
      "Удалить период начислений? Это действие нельзя отменить.",
      async (ok) => {
        if (!ok) return;
        const res = await dispatch(deleteBuildingPayroll(id));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Период удалён");
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось удалить период",
            ),
            true,
          );
        }
      },
    );
  };

  return (
    <div className="warehouse-page building-page building-page--salary">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">💰</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Зарплата</h1>
            <p className="warehouse-header__subtitle">
              {selectedProjectId ? (
                <>
                  ЖК: <b>{selectedProjectName}</b>. Начисления и выплаты
                  сотрудникам.
                </>
              ) : (
                "Начисления и выплаты сотрудникам строительного подразделения."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          onClick={() => setIsCreatePeriodModalOpen(true)}
        >
          Новый период
        </button>
      </div>

      <div className="warehouse-search-section">
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <div className="salary-tabs">
            <button
              type="button"
              className={`salary-tab${activeTab === "payrolls" ? " salary-tab--active" : ""}`}
              onClick={() => setActiveTab("payrolls")}
            >
              Периоды начислений
            </button>
            <button
              type="button"
              className={`salary-tab${activeTab === "employees" ? " salary-tab--active" : ""}`}
              onClick={() => setActiveTab("employees")}
            >
              Сотрудники
            </button>
            <button
              type="button"
              className={`salary-tab${activeTab === "my" ? " salary-tab--active" : ""}`}
              onClick={() => setActiveTab("my")}
            >
              Мои начисления
            </button>
          </div>
          {activeTab === "payrolls" && (
            <>
              <select
                className="salary-toolbar__select"
                value={payrollStatusFilter}
                onChange={(e) => setPayrollStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                {Object.entries(PAYROLL_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="salary-view-toggle">
                <button
                  type="button"
                  className={`salary-tab${payrollViewMode === "cards" ? " salary-tab--active" : ""}`}
                  onClick={() => setPayrollViewMode("cards")}
                  title="Карточки"
                >
                  Карточки
                </button>
                <button
                  type="button"
                  className={`salary-tab${payrollViewMode === "table" ? " salary-tab--active" : ""}`}
                  onClick={() => setPayrollViewMode("table")}
                  title="Таблица"
                >
                  Таблица
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {payrollsError && activeTab === "payrolls" && (
        <div className="mt-2 text-sm text-red-500">
          {String(
            validateResErrors(payrollsError, "Не удалось загрузить периоды"),
          )}
        </div>
      )}
      {employeesError && activeTab === "employees" && (
        <div className="mt-2 text-sm text-red-500">
          {String(
            validateResErrors(
              employeesError,
              "Не удалось загрузить сотрудников",
            ),
          )}
        </div>
      )}

      <DataContainer>
        <div className="warehouse-table-container w-full">
          {activeTab === "employees" && (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Тип оклада</th>
                  <th>Базовый оклад</th>
                  <th>Активен</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {employeesLoading ? (
                  <tr>
                    <td colSpan={5} className="warehouse-table__loading">
                      Загрузка сотрудников...
                    </td>
                  </tr>
                ) : employeesError ? (
                  <tr>
                    <td colSpan={5} className="warehouse-table__empty">
                      {String(
                        validateResErrors(
                          employeesError,
                          "Не удалось загрузить сотрудников",
                        ),
                      )}
                    </td>
                  </tr>
                ) : !employees || employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="warehouse-table__empty">
                      Сотрудников пока нет.
                    </td>
                  </tr>
                ) : (
                  (employees || []).map((e) => {
                    const id = e.id ?? e.uuid;
                    const salaryType =
                      e.salary_type || e.compensation?.salary_type || "—";
                    const baseSalary =
                      e.base_salary != null
                        ? e.base_salary
                        : (e.compensation?.base_salary ?? "—");
                    const isActive =
                      typeof e.is_active === "boolean"
                        ? e.is_active
                        : Boolean(e.compensation?.is_active);
                    return (
                      <tr
                        key={id}
                        onClick={() =>
                          id && navigate(`/crm/building/salary/employee/${id}`)
                        }
                      >
                        <td>{e.display || e.name || "—"}</td>
                        <td>{SALARY_TYPE_LABELS[salaryType] || "—"}</td>
                        <td>{baseSalary}</td>
                        <td>{isActive ? "Да" : "Нет"}</td>
                        <td
                          onClick={(ev) => ev.stopPropagation()}
                          style={{ textAlign: "right" }}
                        >
                          {id && (
                            <button
                              type="button"
                              className="warehouse-search__filter-btn"
                              style={{ padding: "6px 12px", fontSize: 13 }}
                              onClick={() =>
                                navigate(`/crm/building/salary/employee/${id}`)
                              }
                            >
                              Настроить
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === "payrolls" && payrollViewMode === "cards" && (
            <div className="salary-cards">
              {payrollsLoading ? (
                <div className="salary-cards__loading">
                  Загрузка периодов...
                </div>
              ) : payrollsError ? (
                <div className="salary-cards__error">
                  {String(
                    validateResErrors(
                      payrollsError,
                      "Не удалось загрузить периоды",
                    ),
                  )}
                </div>
              ) : !payrolls || payrolls.length === 0 ? (
                <div className="salary-cards__empty">
                  Периодов начислений пока нет. Создайте первый.
                </div>
              ) : (
                (payrolls || []).map((p) => {
                  const id = p.id ?? p.uuid;
                  return (
                    <div
                      key={id}
                      className="salary-card"
                      onClick={() =>
                        navigate(`/crm/building/salary/payroll/${id}`)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/crm/building/salary/payroll/${id}`);
                        }
                      }}
                    >
                      <div className="salary-card__main">
                        <div className="salary-card__title">
                          {p.title || "—"}
                        </div>
                        <div className="salary-card__period">
                          {p.period_start} — {p.period_end}
                        </div>
                        <span
                          className={`salary-card__status salary-card__status--${p.status || "draft"}`}
                        >
                          {PAYROLL_STATUS_LABELS[p.status] ||
                            PAYROLL_STATUS_LABELS.draft}
                        </span>
                      </div>
                      <div
                        className="salary-card__actions"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="salary-card__btn salary-card__btn--primary"
                          onClick={() =>
                            navigate(`/crm/building/salary/payroll/${id}`)
                          }
                        >
                          Детали
                        </button>
                        {p.status === "draft" && (
                          <>
                            <button
                              type="button"
                              className="salary-card__btn salary-card__btn--success"
                              onClick={() => handleApprovePayroll(p)}
                            >
                              Утвердить
                            </button>
                            <button
                              type="button"
                              className="salary-card__btn salary-card__btn--danger"
                              onClick={() => handleDeletePayroll(p)}
                            >
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "payrolls" && payrollViewMode === "table" && (
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Период</th>
                  <th>Статус</th>
                  <th style={{ width: 200 }} />
                </tr>
              </thead>
              <tbody>
                {payrollsLoading ? (
                  <tr>
                    <td colSpan={4} className="warehouse-table__loading">
                      Загрузка периодов...
                    </td>
                  </tr>
                ) : payrollsError ? (
                  <tr>
                    <td colSpan={4} className="warehouse-table__empty">
                      {String(
                        validateResErrors(
                          payrollsError,
                          "Не удалось загрузить периоды",
                        ),
                      )}
                    </td>
                  </tr>
                ) : !payrolls || payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="warehouse-table__empty">
                      Периодов начислений пока нет. Создайте первый.
                    </td>
                  </tr>
                ) : (
                  (payrolls || []).map((p) => {
                    const id = p.id ?? p.uuid;
                    return (
                      <tr
                        key={id}
                        onClick={() =>
                          navigate(`/crm/building/salary/payroll/${id}`)
                        }
                      >
                        <td>{p.title || "—"}</td>
                        <td>
                          {p.period_start} — {p.period_end}
                        </td>
                        <td>
                          {PAYROLL_STATUS_LABELS[p.status] ||
                            PAYROLL_STATUS_LABELS.draft}
                        </td>
                        <td
                          onClick={(ev) => ev.stopPropagation()}
                          style={{ textAlign: "right" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="warehouse-search__filter-btn"
                              style={{ padding: "6px 12px", fontSize: 13 }}
                              onClick={() =>
                                navigate(`/crm/building/salary/payroll/${id}`)
                              }
                            >
                              Детали
                            </button>
                            {p.status === "draft" && (
                              <>
                                <button
                                  type="button"
                                  className="warehouse-search__filter-btn"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 13,
                                    background: "rgba(34, 197, 94, 0.1)",
                                    borderColor: "rgba(34, 197, 94, 0.4)",
                                  }}
                                  onClick={() => handleApprovePayroll(p)}
                                >
                                  Утвердить
                                </button>
                                <button
                                  type="button"
                                  className="warehouse-search__filter-btn"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 13,
                                    color: "#b02a37",
                                    borderColor: "rgba(220, 53, 69, 0.4)",
                                  }}
                                  onClick={() => handleDeletePayroll(p)}
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === "my" && <BuildingSalaryMyLines />}
        </div>
      </DataContainer>

      {isCreatePeriodModalOpen && (
        <Modal
          open={isCreatePeriodModalOpen}
          onClose={() => setIsCreatePeriodModalOpen(false)}
          title="Новый период начислений"
        >
          <form
            className="building-page"
            onSubmit={(e) => {
              handleCreatePayroll(e);
              if (!payrollsCreating) {
                setIsCreatePeriodModalOpen(false);
              }
            }}
          >
            <label>
              <div className="building-page__label">Название периода *</div>
              <input
                className="building-page__input"
                value={newPeriodTitle}
                onChange={(e) => setNewPeriodTitle(e.target.value)}
                placeholder="Например: ЗП за март 2026"
              />
            </label>
            <div
              className="building-page__form-group"
              style={{ marginBottom: 12 }}
            >
              <div className="building-page__label">Быстрый выбор периода</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="building-btn"
                  onClick={() => applyMonthPeriod(0)}
                >
                  {getMonthPeriod(0).monthLabel}
                </button>
                <button
                  type="button"
                  className="building-btn"
                  onClick={() => applyMonthPeriod(1)}
                >
                  {getMonthPeriod(1).monthLabel}
                </button>
                <button
                  type="button"
                  className="building-btn"
                  onClick={() => applyMonthPeriod(2)}
                >
                  {getMonthPeriod(2).monthLabel}
                </button>
              </div>
              <div
                className="building-page__muted"
                style={{ marginTop: 6, fontSize: 12 }}
              >
                Либо укажите даты вручную ниже.
              </div>
            </div>
            <label>
              <div className="building-page__label">Дата начала *</div>
              <input
                type="date"
                className="building-page__input"
                value={newPeriodStart}
                onChange={(e) => setNewPeriodStart(e.target.value)}
              />
            </label>
            <label>
              <div className="building-page__label">Дата окончания *</div>
              <input
                type="date"
                className="building-page__input"
                value={newPeriodEnd}
                onChange={(e) => setNewPeriodEnd(e.target.value)}
              />
            </label>
            <div className="building-page__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => setIsCreatePeriodModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
                disabled={payrollsCreating || !selectedProjectId}
                style={{ marginLeft: 8 }}
              >
                {payrollsCreating ? "Создание..." : "Создать"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
