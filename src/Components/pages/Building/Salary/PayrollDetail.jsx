import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  fetchBuildingSalaryEmployees,
  fetchBuildingPayrolls,
  fetchBuildingPayrollLines,
  createBuildingPayrollLine,
  approveBuildingPayroll,
  createBuildingPayrollLineAdjustment,
  deleteBuildingPayrollAdjustment,
  fetchBuildingPayrollLinePayments,
  createBuildingPayrollLinePayment,
} from "../../../../store/creators/building/salaryCreators";
import { fetchBuildingProjects } from "@/store/creators/building/projectsCreators";
import Modal from "@/Components/common/Modal/Modal";
import BuildingActionsMenu from "../shared/ActionsMenu";

export default function BuildingSalaryPayrollDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { id } = useParams();

  const { employees, payrolls, linesByPayrollId, payrollsLoading, paymentsByLineId } =
    useBuildingSalary();
  const { items: residentialComplexes, selectedProjectId } = useBuildingProjects();

  const [newLineEmployee, setNewLineEmployee] = useState("");
  const [newLineAmount, setNewLineAmount] = useState("");
  const [newLineComment, setNewLineComment] = useState("");
  const [newLineResidentialComplex, setNewLineResidentialComplex] = useState("");

  const [isCreateLineModalOpen, setIsCreateLineModalOpen] = useState(false);
  const [expandedLineId, setExpandedLineId] = useState(null);

  const [isAdjustmentsModalOpen, setIsAdjustmentsModalOpen] = useState(false);
  const [adjType, setAdjType] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");

  const [activePaymentsLineId, setActivePaymentsLineId] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payShift, setPayShift] = useState("");
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchBuildingSalaryEmployees());
    dispatch(fetchBuildingPayrolls());
    dispatch(fetchBuildingProjects());
  }, [dispatch]);

  useEffect(() => {
    if (id) {
      dispatch(fetchBuildingPayrollLines(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (!newLineResidentialComplex && selectedProjectId) {
      setNewLineResidentialComplex(String(selectedProjectId));
    }
  }, [selectedProjectId, newLineResidentialComplex]);

  const payroll = useMemo(() => {
    if (!id || !Array.isArray(payrolls)) return null;
    return (
      payrolls.find(
        (p) => String(p.id ?? p.uuid) === String(id),
      ) || null
    );
  }, [payrolls, id]);

  const PAYROLL_STATUS_LABELS = {
    draft: "Черновик",
    approved: "Утверждён",
    paid: "Выплачен",
  };

  const ADJUSTMENT_TYPE_LABELS = {
    bonus: "Бонус",
    deduction: "Удержание",
    advance: "Аванс",
  };

  const payrollLinesBucket = id
    ? linesByPayrollId?.[String(id)] || {
      list: [],
      loading: false,
      error: null,
    }
    : { list: [], loading: false, error: null };

  const employeesById = useMemo(() => {
    const map = {};
    (employees || []).forEach((e) => {
      const eid = e.id ?? e.uuid;
      if (eid != null) {
        map[String(eid)] = e;
      }
    });
    return map;
  }, [employees]);
  const openPayments = (lineId) => {
    if (!lineId) return;
    setActivePaymentsLineId(lineId);
    setPayAmount("");
    setPayShift("");
    setIsPaymentsModalOpen(true);
    dispatch(fetchBuildingPayrollLinePayments(lineId));
  };

  const paymentsBucket = activePaymentsLineId
    ? paymentsByLineId?.[String(activePaymentsLineId)] || {
      list: [],
      loading: false,
      error: null,
    }
    : { list: [], loading: false, error: null };
  const handleApprove = async () => {
    if (!id || !payroll) return;
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
    if (!id) return;
    if (!newLineEmployee) {
      alert("Выберите сотрудника", true);
      return;
    }
    if (!newLineResidentialComplex) {
      alert("Выберите ЖК для строки начисления", true);
      return;
    }
    const payload = {
      employee: newLineEmployee,
      base_amount: newLineAmount ? String(newLineAmount) : undefined,
      comment: newLineComment || "",
      residential_complex: newLineResidentialComplex,
    };
    const res = await dispatch(
      createBuildingPayrollLine({ payrollId: id, payload }),
    );
    if (res.meta.requestStatus === "fulfilled") {
      alert("Строка добавлена");
      setNewLineEmployee("");
      setNewLineAmount("");
      setNewLineComment("");
      setNewLineResidentialComplex(selectedProjectId || "");
      dispatch(fetchBuildingPayrollLines(id));
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

  const title = payroll?.title || "Период начислений";

  return (
    <div className="building-page building-page--salary-detail">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">{title}</h1>
          <p className="building-page__subtitle">
            Детальная информация по периоду начислений и его строкам.
          </p>
        </div>
        <button
          type="button"
          className="building-btn"
          onClick={() => navigate("/crm/building/salary")}
        >
          ← К периодам
        </button>
      </div>

      <div className="building-page__card" style={{ marginBottom: 16 }}>
        {payrollsLoading && !payroll && (
          <div className="building-page__muted">
            Загрузка информации о периоде...
          </div>
        )}
        {!payrollsLoading && !payroll && (
          <div className="building-page__error">
            Не удалось найти период.
          </div>
        )}
        {payroll && (
          <div className="building-page">
            <div>
              <div className="building-page__label">Название</div>
              <div>{payroll.title || "—"}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="building-page__label">Период</div>
              <div>
                {payroll.period_start} — {payroll.period_end}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="building-page__label">Статус</div>
              <div>
                {PAYROLL_STATUS_LABELS[payroll.status] ||
                  PAYROLL_STATUS_LABELS.draft}
              </div>
            </div>
            {payroll.status === "draft" && (
              <div className="building-page__actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="building-btn building-btn--primary"
                  onClick={handleApprove}
                >
                  Утвердить период
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {payroll?.status !== "approved" && (
        <div className="building-page__card">
          <details>
            <summary
              className="building-page__cardTitle"
              style={{ cursor: "pointer" }}
            >
              Выплаты
            </summary>
            <div className="building-page__muted" style={{ marginTop: 8 }}>
              Выплаты создаются по конкретным строкам начислений. Откройте
              строку и выберите действие <b>«Выплаты»</b>, чтобы увидеть список
              выплат и добавить новую.
            </div>
          </details>
        </div>
      )}

      <div className="building-page__card">
        <details open>
          <summary
            className="building-page__cardTitle"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <span>Строки начислений</span>
            {id && payroll?.status === "draft" && (
              <button
                type="button"
                className="building-btn building-btn--primary"
                style={{ padding: "2px 10px", fontSize: 12 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsCreateLineModalOpen(true);
                }}
              >
                + Добавить
              </button>
            )}
          </summary>

          {!id && (
            <div className="building-page__muted" style={{ marginTop: 8 }}>
              Идентификатор периода не указан.
            </div>
          )}

          {id && (
            <>
              {payrollLinesBucket.loading && (
                <div className="building-page__muted" style={{ marginTop: 8 }}>
                  Загрузка строк начислений...
                </div>
              )}
              {payrollLinesBucket.error && (
                <div className="building-page__error" style={{ marginTop: 8 }}>
                  {String(
                    validateResErrors(
                      payrollLinesBucket.error,
                      "Не удалось загрузить строки начислений",
                    ),
                  )}
                </div>
              )}
              {!payrollLinesBucket.loading && (
                <div
                  className="building-table building-table--shadow"
                  style={{ marginTop: 8 }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>База</th>
                        <th>К выплате</th>
                        <th>Выплачено</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollLinesBucket.list || []).map((line) => {
                        const lid = line.id ?? line.uuid;
                        const emp =
                          employeesById[String(line.employee)] || null;


                        return (
                          <tr
                            key={lid}
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              navigate(
                                `/crm/building/salary/payroll/${id}/line/${lid}`,
                              )
                            }
                          >
                            <td>{emp?.display || emp?.name || "—"}</td>
                            <td>{line.base_amount}</td>
                            <td>{line.net_to_pay ?? "—"}</td>
                            <td>{line.paid_total ?? "—"}</td>
                            <td>{line.comment || ""}</td>
                          </tr>
                        );
                      })}
                      {(!payrollLinesBucket.list ||
                        payrollLinesBucket.list.length === 0) && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center" }}>
                              Строки начислений пока не добавлены.
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </details>
      </div>

      {isPaymentsModalOpen && activePaymentsLineId && (
        <Modal
          open={isPaymentsModalOpen}
          onClose={() => {
            setIsPaymentsModalOpen(false);
            setActivePaymentsLineId(null);
            setPayAmount("");
            setPayShift("");
          }}
          title="Выплаты по строке"
        >
          {(() => {
            const line =
              (payrollLinesBucket.list || []).find(
                (l) => String(l.id ?? l.uuid) === String(activePaymentsLineId),
              ) || null;
            const rcId = line?.residential_complex;
            const rc =
              (residentialComplexes || []).find(
                (p) => String(p.id ?? p.uuid) === String(rcId),
              ) || null;
            const hasSalaryCashbox = !!rc?.salary_cashbox;
            return (
              <div className="building-page">
                {!hasSalaryCashbox && rcId && (
                  <div
                    className="building-page__card"
                    style={{
                      marginBottom: 12,
                      borderLeft: "4px solid #f97316",
                    }}
                  >
                    <div
                      className="building-page__label"
                      style={{ marginBottom: 4 }}
                    >
                      Внимание
                    </div>
                    <div className="building-page__muted" style={{ marginBottom: 8 }}>
                      Для ЖК{" "}
                      <b>{rc?.name || rcId}</b> не настроена касса для выплат
                      зарплаты. Укажите поле <b>Касса для ЗП по ЖК</b> в
                      настройках ЖК, чтобы создавать выплаты по этой строке.
                    </div>
                    <button
                      type="button"
                      className="building-btn building-btn--primary"
                      onClick={() => {
                        setIsPaymentsModalOpen(false);
                        setActivePaymentsLineId(null);
                        navigate(
                          `/crm/building/projects/${rcId}?from=salary-payroll&payrollId=${id}`,
                        );
                      }}
                    >
                      Откройте настройки ЖК
                    </button>
                  </div>
                )}

                <form
                  className="building-page"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!activePaymentsLineId) return;
                    if (!payAmount) {
                      alert("Укажите сумму выплаты", true);
                      return;
                    }
                    confirm(
                      `Создать выплату на сумму ${payAmount}?`,
                      async (ok) => {
                        if (!ok) return;
                        const payload = {
                          amount: String(payAmount),
                        };
                        const res = await dispatch(
                          createBuildingPayrollLinePayment({
                            lineId: activePaymentsLineId,
                            payload,
                          }),
                        );
                        if (res.meta.requestStatus === "fulfilled") {
                          setPayAmount("");
                          dispatch(
                            fetchBuildingPayrollLinePayments(
                              activePaymentsLineId,
                            ),
                          );
                        } else {
                          alert(
                            validateResErrors(
                              res.payload || res.error,
                              "Не удалось создать выплату",
                            ),
                            true,
                          );
                        }
                      },
                    );
                  }}
                  style={{ marginBottom: 12 }}
                >
                  <label>
                    <div className="building-page__label">Сумма *</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="building-page__input"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="10000.00"
                      disabled={!hasSalaryCashbox}
                    />
                  </label>
                  <div
                    className="building-page__actions"
                    style={{ marginTop: 8 }}
                  >
                    <button
                      type="button"
                      className="building-btn"
                      onClick={() => {
                        setIsPaymentsModalOpen(false);
                        setActivePaymentsLineId(null);
                        setPayAmount("");
                        setPayShift("");
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="building-btn building-btn--primary"
                      style={{ marginLeft: 8 }}
                      disabled={!hasSalaryCashbox}
                    >
                      Создать выплату
                    </button>
                  </div>
                </form>

                {paymentsBucket.loading && (
                  <div className="building-page__muted">
                    Загрузка выплат...
                  </div>
                )}
                {paymentsBucket.error && (
                  <div className="building-page__error">
                    {String(
                      validateResErrors(
                        paymentsBucket.error,
                        "Не удалось загрузить выплаты",
                      ),
                    )}
                  </div>
                )}
                {!paymentsBucket.loading && (
                  <div className="building-table building-table--shadow">
                    <table>
                      <thead>
                        <tr>
                          <th>Сумма</th>
                          <th>Касса</th>
                          <th>Смена</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paymentsBucket.list || []).map((pmt) => (
                          <tr key={pmt.id ?? pmt.uuid}>
                            <td>{pmt.amount}</td>
                            <td>
                              {pmt.cashbox_display || pmt.cashbox || "—"}
                            </td>
                            <td>{pmt.shift || "—"}</td>
                            <td>{pmt.paid_at || "—"}</td>
                          </tr>
                        ))}
                        {(!paymentsBucket.list ||
                          paymentsBucket.list.length === 0) && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: "center" }}>
                                Выплаты по этой строке ещё не создавались.
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {isAdjustmentsModalOpen && expandedLineId && (
        <Modal
          open={isAdjustmentsModalOpen}
          onClose={() => setIsAdjustmentsModalOpen(false)}
          title="Корректировки строки"
        >
          {(() => {
            const line =
              (payrollLinesBucket.list || []).find(
                (l) =>
                  String(l.id ?? l.uuid) === String(expandedLineId),
              ) || null;
            const adjustments = Array.isArray(line?.adjustments)
              ? line.adjustments
              : [];
            return (
              <div>
                <div
                  style={{
                    marginBottom: 8,
                    fontSize: 13,
                    color: "rgba(0,0,0,0.65)",
                  }}
                >
                  База: <b>{line?.base_amount ?? "—"}</b>, комментарий:{" "}
                  <b>{line?.comment || "—"}</b>
                </div>
                <form
                  className="building-page"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!expandedLineId) return;
                    if (!adjAmount) {
                      alert("Введите сумму корректировки", true);
                      return;
                    }
                    const payload = {
                      type: adjType,
                      amount: String(adjAmount),
                      comment: adjComment || "",
                    };
                    const res = await dispatch(
                      createBuildingPayrollLineAdjustment({
                        lineId: expandedLineId,
                        payload,
                      }),
                    );
                    if (res.meta.requestStatus === "fulfilled") {
                      setAdjAmount("");
                      setAdjComment("");
                      dispatch(fetchBuildingPayrollLines(id));
                    } else {
                      alert(
                        validateResErrors(
                          res.payload || res.error,
                          "Не удалось добавить корректировку",
                        ),
                        true,
                      );
                    }
                  }}
                  style={{ marginBottom: 8 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      className="building-page__select"
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value)}
                    >
                      <option value="bonus">Бонус</option>
                      <option value="deduction">Удержание</option>
                      <option value="advance">Аванс</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="building-page__input"
                      style={{ maxWidth: 140 }}
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      placeholder="1000.00"
                    />
                    <input
                      className="building-page__input"
                      style={{ flex: 1, minWidth: 120 }}
                      value={adjComment}
                      onChange={(e) => setAdjComment(e.target.value)}
                      placeholder="Комментарий"
                    />
                    <button
                      type="submit"
                      className="building-btn building-btn--primary"
                    >
                      Добавить
                    </button>
                  </div>
                </form>
                <div className="building-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Комментарий</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((adj) => (
                        <tr key={adj.id ?? adj.uuid}>
                          <td>
                            {ADJUSTMENT_TYPE_LABELS[adj.type] || adj.type}
                          </td>
                          <td>{adj.amount}</td>
                          <td>{adj.comment || ""}</td>
                          <td>
                            <button
                              type="button"
                              className="building-btn"
                              onClick={async () => {
                                const res = await dispatch(
                                  deleteBuildingPayrollAdjustment(
                                    adj.id ?? adj.uuid,
                                  ),
                                );
                                if (res.meta.requestStatus !== "fulfilled") {
                                  alert(
                                    validateResErrors(
                                      res.payload || res.error,
                                      "Не удалось удалить корректировку",
                                    ),
                                    true,
                                  );
                                } else {
                                  dispatch(fetchBuildingPayrollLines(id));
                                }
                              }}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                      {adjustments.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center" }}>
                            Корректировки пока не добавлены.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
      {isCreateLineModalOpen && (
        <Modal
          open={isCreateLineModalOpen}
          onClose={() => setIsCreateLineModalOpen(false)}
          title="Добавить строку начислений"
        >
          <form className="building-page" onSubmit={handleCreateLine}>
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
              <div className="building-page__label">Жилой комплекс *</div>
              <select
                className="building-page__select"
                value={newLineResidentialComplex}
                onChange={(e) => setNewLineResidentialComplex(e.target.value)}
              >
                <option value="">Не выбран</option>
                {(residentialComplexes || []).map((rc) => (
                  <option key={rc.id ?? rc.uuid} value={rc.id ?? rc.uuid}>
                    {rc.name || "ЖК"}
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
            <label>
              <div className="building-page__label">Комментарий</div>
              <input
                className="building-page__input"
                value={newLineComment}
                onChange={(e) => setNewLineComment(e.target.value)}
                placeholder="Например: Оклад за месяц"
              />
            </label>
            <div className="building-page__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => setIsCreateLineModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
                style={{ marginLeft: 8 }}
              >
                Добавить
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

