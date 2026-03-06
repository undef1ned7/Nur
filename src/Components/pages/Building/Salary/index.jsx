import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  fetchBuildingSalaryEmployees,
  updateBuildingSalaryEmployeeCompensation,
  fetchBuildingPayrolls,
  createBuildingPayroll,
  approveBuildingPayroll,
  deleteBuildingPayroll,
  fetchBuildingPayrollLines,
  createBuildingPayrollLine,
} from "../../../../store/creators/building/salaryCreators";
import Modal from "@/Components/common/Modal/Modal";
import BuildingSalaryMyLines from "./MyLines";

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

  const { selectedProjectId } = useBuildingProjects();

  const [activeTab, setActiveTab] = useState("payrolls");
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [payrollStatusFilter, setPayrollStatusFilter] = useState("");
  const [isCreatePeriodModalOpen, setIsCreatePeriodModalOpen] = useState(false);

  const SALARY_TYPE_LABELS = {
    monthly: "Месячный оклад",
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
    const payload = {
      title: newPeriodTitle.trim(),
      period_start: newPeriodStart,
      period_end: newPeriodEnd,
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

  const handleApprovePayroll = async (payroll) => {
    const id = payroll?.id ?? payroll?.uuid;
    if (!id) return;
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
    <div className="building-page building-page--salary">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Зарплата</h1>
          <p className="building-page__subtitle">
            Начисления и выплаты сотрудникам строительного подразделения.
          </p>
        </div>
      </div>

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
                disabled={payrollsCreating}
                style={{ marginLeft: 8 }}
              >
                {payrollsCreating ? "Создание..." : "Создать"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="building-page__tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`building-btn ${
            activeTab === "payrolls" ? "building-btn--primary" : ""
          }`}
          onClick={() => setActiveTab("payrolls")}
        >
          Периоды начислений
        </button>
        <button
          type="button"
          className={`building-btn ${
            activeTab === "employees" ? "building-btn--primary" : ""
          }`}
          style={{ marginLeft: 8 }}
          onClick={() => setActiveTab("employees")}
        >
          Сотрудники
        </button>
        <button
          type="button"
          className={`building-btn ${
            activeTab === "my" ? "building-btn--primary" : ""
          }`}
          style={{ marginLeft: 8 }}
          onClick={() => setActiveTab("my")}
        >
          Мои начисления
        </button>
      </div>

      {activeTab === "employees" && (
        <div className="building-page__card">
          {employeesLoading && (
            <div className="building-page__muted">
              Загрузка сотрудников...
            </div>
          )}
          {employeesError && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  employeesError,
                  "Не удалось загрузить сотрудников",
                ),
              )}
            </div>
          )}
          {!employeesLoading && !employeesError && (
            <div className="building-table building-table--shadow">
              <table>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Тип оклада</th>
                    <th>Базовый оклад</th>
                    <th>Активен</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(employees || []).map((e) => {
                    const id = e.id ?? e.uuid;
                    const salaryType =
                      e.salary_type || e.compensation?.salary_type || "—";
                    const baseSalary =
                      e.base_salary != null
                        ? e.base_salary
                        : e.compensation?.base_salary ?? "—";
                    const isActive =
                      typeof e.is_active === "boolean"
                        ? e.is_active
                        : Boolean(e.compensation?.is_active);
                    return (
                      <tr key={id}>
                        <td>{e.display || e.name || "—"}</td>
                        <td>{SALARY_TYPE_LABELS[salaryType] || "—"}</td>
                        <td>{baseSalary}</td>
                        <td>{isActive ? "Да" : "Нет"}</td>
                        <td>
                          {id && (
                            <button
                              type="button"
                              className="building-btn"
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "payrolls" && (
        <div className="building-page__layout building-page__layout--2col">
          <div className="building-page__card">
            <h2 className="building-page__title" style={{ fontSize: 18 }}>
              Периоды
            </h2>
            <div
              className="building-page__actions"
              style={{
                marginBottom: 12,
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="building-btn building-btn--primary"
                onClick={() => setIsCreatePeriodModalOpen(true)}
              >
                Новый период
              </button>
              <select
                className="building-page__select"
                style={{ maxWidth: 220 }}
                value={payrollStatusFilter}
                onChange={(e) => setPayrollStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                {Object.entries(PAYROLL_STATUS_LABELS).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {payrollsLoading && (
              <div className="building-page__muted">Загрузка периодов...</div>
            )}
            {payrollsError && (
              <div className="building-page__error">
                {String(
                  validateResErrors(
                    payrollsError,
                    "Не удалось загрузить периоды",
                  ),
                )}
              </div>
            )}
            {!payrollsLoading && !payrollsError && (
              <div className="building-table building-table--shadow">
                <table>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Период</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(payrolls || []).map((p) => {
                      const id = p.id ?? p.uuid;
                      return (
                        <tr key={id}>
                          <td>{p.title || "—"}</td>
                          <td>
                            {p.period_start} — {p.period_end}
                          </td>
                          <td>
                            {PAYROLL_STATUS_LABELS[p.status] ||
                              PAYROLL_STATUS_LABELS.draft}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                type="button"
                                className="building-btn"
                                onClick={() =>
                                  navigate(
                                    `/crm/building/salary/payroll/${id}`,
                                  )
                                }
                              >
                                Детали
                              </button>
                              {p.status === "draft" && (
                                <>
                                  <button
                                    type="button"
                                    className="building-btn"
                                    onClick={() => handleApprovePayroll(p)}
                                  >
                                    Утвердить
                                  </button>
                                  <button
                                    type="button"
                                    className="building-btn"
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "my" && <BuildingSalaryMyLines />}
    </div>
  );
}
