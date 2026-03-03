import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import {
  fetchBuildingSalaryEmployees,
  updateBuildingSalaryEmployeeCompensation,
  fetchBuildingPayrolls,
  createBuildingPayroll,
  approveBuildingPayroll,
  fetchBuildingPayrollLines,
  createBuildingPayrollLine,
} from "../../../../store/creators/building/salaryCreators";

export default function BuildingSalary() {
  const dispatch = useDispatch();
  const alert = useAlert();

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

  const [activeTab, setActiveTab] = useState("payrolls");
  const [selectedPayrollId, setSelectedPayrollId] = useState(null);
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [newLineEmployee, setNewLineEmployee] = useState("");
  const [newLineAmount, setNewLineAmount] = useState("");

  useEffect(() => {
    dispatch(fetchBuildingSalaryEmployees());
    dispatch(fetchBuildingPayrolls());
  }, [dispatch]);

  useEffect(() => {
    if (selectedPayrollId) {
      dispatch(fetchBuildingPayrollLines(selectedPayrollId));
    }
  }, [dispatch, selectedPayrollId]);

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

  const handleCreateLine = async (e) => {
    e.preventDefault();
    if (!selectedPayrollId) {
      alert("Сначала выберите период", true);
      return;
    }
    if (!newLineEmployee) {
      alert("Выберите сотрудника", true);
      return;
    }
    const payload = {
      employee: newLineEmployee,
      base_amount: newLineAmount ? String(newLineAmount) : undefined,
    };
    const res = await dispatch(
      createBuildingPayrollLine({ payrollId: selectedPayrollId, payload }),
    );
    if (res.meta.requestStatus === "fulfilled") {
      alert("Строка добавлена");
      setNewLineEmployee("");
      setNewLineAmount("");
    } else {
      alert(
        validateResErrors(
          res.payload || res.error,
          "Не удалось добавить строку",
        ),
        true,
      );
    }
  };

  const payrollLinesBucket = selectedPayrollId
    ? linesByPayrollId?.[String(selectedPayrollId)] || {
        list: [],
        loading: false,
        error: null,
      }
    : { list: [], loading: false, error: null };

  const employeesById = useMemo(() => {
    const map = {};
    (employees || []).forEach((e) => {
      const id = e.id ?? e.uuid;
      if (id != null) {
        map[String(id)] = e;
      }
    });
    return map;
  }, [employees]);

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
                  </tr>
                </thead>
                <tbody>
                  {(employees || []).map((e) => {
                    const id = e.id ?? e.uuid;
                    const comp = e.compensation || {};
                    return (
                      <tr key={id}>
                        <td>{e.display || e.name || "—"}</td>
                        <td>{comp.salary_type || "—"}</td>
                        <td>{comp.base_salary ?? "—"}</td>
                        <td>{comp.is_active ? "Да" : "Нет"}</td>
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
            <form
              className="building-page"
              onSubmit={handleCreatePayroll}
              style={{ marginBottom: 16 }}
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
                  type="submit"
                  className="building-btn building-btn--primary"
                  disabled={payrollsCreating}
                >
                  {payrollsCreating ? "Создание..." : "Создать период"}
                </button>
              </div>
            </form>

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
                      const isSelected =
                        selectedPayrollId &&
                        String(selectedPayrollId) === String(id);
                      return (
                        <tr
                          key={id}
                          onClick={() => setSelectedPayrollId(id)}
                          style={{
                            cursor: "pointer",
                            background: isSelected ? "#e0f2fe" : "inherit",
                          }}
                        >
                          <td>{p.title || "—"}</td>
                          <td>
                            {p.period_start} — {p.period_end}
                          </td>
                          <td>{p.status || "draft"}</td>
                          <td>
                            {p.status === "draft" && (
                              <button
                                type="button"
                                className="building-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprovePayroll(p);
                                }}
                              >
                                Утвердить
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

          <div className="building-page__card">
            <h2 className="building-page__title" style={{ fontSize: 18 }}>
              Строки начислений
            </h2>
            {!selectedPayrollId && (
              <div className="building-page__muted">
                Выберите период слева, чтобы увидеть строки начислений.
              </div>
            )}
            {selectedPayrollId && (
              <>
                <form
                  className="building-page"
                  onSubmit={handleCreateLine}
                  style={{ marginBottom: 12 }}
                >
                  <label>
                    <div className="building-page__label">Сотрудник *</div>
                    <select
                      className="building-page__select"
                      value={newLineEmployee}
                      onChange={(e) => setNewLineEmployee(e.target.value)}
                    >
                      <option value="">Не выбран</option>
                      {(employees || []).map((e) => (
                        <option key={e.id ?? e.uuid} value={e.id ?? e.uuid}>
                          {e.display || e.name || "—"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="building-page__label">Сумма</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="building-page__input"
                      value={newLineAmount}
                      onChange={(e) => setNewLineAmount(e.target.value)}
                      placeholder="45000.00"
                    />
                  </label>
                  <div
                    className="building-page__actions"
                    style={{ marginTop: 8 }}
                  >
                    <button
                      type="submit"
                      className="building-btn building-btn--primary"
                    >
                      Добавить строку
                    </button>
                  </div>
                </form>

                {payrollLinesBucket.loading && (
                  <div className="building-page__muted">
                    Загрузка строк начислений...
                  </div>
                )}
                {payrollLinesBucket.error && (
                  <div className="building-page__error">
                    {String(
                      validateResErrors(
                        payrollLinesBucket.error,
                        "Не удалось загрузить строки",
                      ),
                    )}
                  </div>
                )}
                {!payrollLinesBucket.loading && (
                  <div className="building-table building-table--shadow">
                    <table>
                      <thead>
                        <tr>
                          <th>Сотрудник</th>
                          <th>Базовая сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(payrollLinesBucket.list || []).map((line) => {
                          const emp = employeesById[
                            String(line.employee ?? line.employee_id)
                          ];
                          return (
                            <tr key={line.id ?? line.uuid}>
                              <td>
                                {emp?.display ||
                                  emp?.name ||
                                  line.employee_display ||
                                  "—"}
                              </td>
                              <td>{line.base_amount ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
