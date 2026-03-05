import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import Modal from "@/Components/common/Modal/Modal";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import {
  fetchBuildingSalaryEmployees,
  fetchBuildingPayrolls,
  fetchBuildingPayrollLines,
  fetchBuildingPayrollLineAdjustments,
  createBuildingPayrollLineAdjustment,
  deleteBuildingPayrollAdjustment,
  fetchBuildingPayrollLinePayments,
  createBuildingPayrollLinePayment,
} from "../../../../store/creators/building/salaryCreators";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { fetchBuildingProjects } from "@/store/creators/building/projectsCreators";

export default function BuildingSalaryLineDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { payrollId, lineId } = useParams();

  const {
    employees,
    payrolls,
    linesByPayrollId,
    paymentsByLineId,
    adjustmentsByLineId,
  } = useBuildingSalary();
  const { items: residentialComplexes, selectedProjectId } = useBuildingProjects();
  const cashboxId = useMemo(() => {
    console.log(residentialComplexes);
    console.log(selectedProjectId);
    return residentialComplexes.find(item => item.id === selectedProjectId)?.company_cashbox;
  }, [selectedProjectId, residentialComplexes]);
  const [adjType, setAdjType] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchBuildingSalaryEmployees());
    dispatch(fetchBuildingPayrolls());
    dispatch(fetchBuildingProjects());
  }, [dispatch]);

  useEffect(() => {
    if (payrollId) {
      dispatch(fetchBuildingPayrollLines(payrollId));
    }
  }, [dispatch, payrollId]);

  useEffect(() => {
    if (!lineId) return;
    dispatch(fetchBuildingPayrollLineAdjustments(lineId));
    dispatch(fetchBuildingPayrollLinePayments(lineId));
  }, [dispatch, lineId]);

  const payroll = useMemo(() => {
    if (!payrollId || !Array.isArray(payrolls)) return null;
    return (
      payrolls.find(
        (p) => String(p.id ?? p.uuid) === String(payrollId),
      ) || null
    );
  }, [payrolls, payrollId]);

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

  const line = useMemo(() => {
    if (!payrollId || !lineId) return null;
    const bucket =
      linesByPayrollId?.[String(payrollId)] || { list: [] };
    const arr = Array.isArray(bucket.list) ? bucket.list : [];
    return (
      arr.find(
        (l) => String(l.id ?? l.uuid) === String(lineId),
      ) || null
    );
  }, [linesByPayrollId, payrollId, lineId]);

  const employee =
    line && employeesById[String(line.employee)]
      ? employeesById[String(line.employee)]
      : null;

  const rcId = line?.residential_complex;
  const rc =
    (residentialComplexes || []).find(
      (p) => String(p.id ?? p.uuid) === String(rcId),
    ) || null;

  const isPayrollApproved = payroll?.status === "approved";
  const isPayrollPaid = payroll?.status === "paid";
  const canEditAdjustments = payroll?.status === "draft";
  const canCreatePayments = isPayrollApproved;

  const adjustmentsBucket =
    lineId && adjustmentsByLineId?.[String(lineId)]
      ? adjustmentsByLineId[String(lineId)]
      : { list: [], loading: false, error: null };

  const paymentsBucket =
    lineId && paymentsByLineId?.[String(lineId)]
      ? paymentsByLineId[String(lineId)]
      : { list: [], loading: false, error: null };

  const handleBack = () => {
    if (payrollId) {
      navigate(`/crm/building/salary/payroll/${payrollId}`);
    } else {
      navigate("/crm/building/salary");
    }
  };

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    if (!lineId) return;
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
      createBuildingPayrollLineAdjustment({ lineId, payload }),
    );
    if (res.meta.requestStatus === "fulfilled") {
      setAdjAmount("");
      setAdjComment("");
      dispatch(fetchBuildingPayrollLineAdjustments(lineId));
      dispatch(fetchBuildingPayrollLines(payrollId));
    } else {
      alert(
        validateResErrors(
          res.payload || res.error,
          "Не удалось добавить корректировку",
        ),
        true,
      );
    }
  };

  const handleDeleteAdjustment = (adjId) => {
    if (!adjId) return;
    confirm("Удалить корректировку?", async (ok) => {
      if (!ok) return;
      const res = await dispatch(deleteBuildingPayrollAdjustment(adjId));
      if (res.meta.requestStatus === "fulfilled") {
        if (lineId) {
          dispatch(fetchBuildingPayrollLineAdjustments(lineId));
          dispatch(fetchBuildingPayrollLines(payrollId));
        }
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось удалить корректировку",
          ),
          true,
        );
      }
    });
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    if (!lineId) return;
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
          cashbox: cashboxId,
        };
        const res = await dispatch(
          createBuildingPayrollLinePayment({ lineId, payload }),
        );
        if (res.meta.requestStatus === "fulfilled") {
          setPayAmount("");
          dispatch(fetchBuildingPayrollLinePayments(lineId));
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
  };

  const ADJUSTMENT_TYPE_LABELS = {
    bonus: "Бонус",
    deduction: "Удержание",
    advance: "Аванс",
  };

  const title = `Строка начисления — ${employee?.display || employee?.name || "Сотрудник"}`;

  return (
    <div className="building-page building-page--salary-detail">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">{title}</h1>
          <p className="building-page__subtitle">
            Детальная информация по строке начисления, корректировкам и выплатам.
          </p>
        </div>
        <button
          type="button"
          className="building-btn"
          onClick={handleBack}
        >
          ← К периоду
        </button>
      </div>

      {!line && (
        <div className="building-page__card">
          <div className="building-page__muted">
            Не удалось найти строку начисления.
          </div>
        </div>
      )}

      {line && (
        <>
          <div className="building-page__card">
            <h2 className="building-page__title" style={{ fontSize: 18 }}>
              Основная информация
            </h2>
            <div className="building-page">
              <div>
                <div className="building-page__label">Сотрудник</div>
                <div>{employee?.display || employee?.name || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">Жилой комплекс</div>
                <div>{rc?.name || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">База</div>
                <div>{line.base_amount || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">К выплате</div>
                <div>{line.net_to_pay || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">Выплачено</div>
                <div>{line.paid_total || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">Комментарий</div>
                <div>{line.comment || "—"}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="building-page__label">Статус периода</div>
                <div>
                  {payroll?.status === "draft" && "Черновик"}
                  {payroll?.status === "approved" && "Утверждён"}
                  {payroll?.status === "paid" && "Выплачен"}
                </div>
              </div>
            </div>
          </div>

          <div className="building-page__card">
            <details open>
              <summary className="building-page__cardTitle">
                Корректировки
              </summary>
              {adjustmentsBucket.loading && (
                <div className="building-page__muted" style={{ marginTop: 8 }}>
                  Загрузка корректировок...
                </div>
              )}
              {adjustmentsBucket.error && (
                <div className="building-page__error" style={{ marginTop: 8 }}>
                  {String(
                    validateResErrors(
                      adjustmentsBucket.error,
                      "Не удалось загрузить корректировки",
                    ),
                  )}
                </div>
              )}
              {canEditAdjustments && (
                <div
                  className="building-page__actions"
                  style={{ marginTop: 8 }}
                >
                  <button
                    type="button"
                    className="building-btn building-btn--primary"
                    onClick={() => setIsAdjModalOpen(true)}
                  >
                    Добавить корректировку
                  </button>
                </div>
              )}
              {!canEditAdjustments && (
                <div
                  className="building-page__muted"
                  style={{ marginTop: 8 }}
                >
                  Период не в статусе черновика — изменять корректировки
                  нельзя.
                </div>
              )}

              <div
                className="building-table building-table--shadow"
                style={{ marginTop: 8 }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Комментарий</th>
                      {canEditAdjustments && <th style={{ width: 80 }}>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(adjustmentsBucket.list || []).map((adj) => (
                      <tr key={adj.id ?? adj.uuid}>
                        <td>
                          {ADJUSTMENT_TYPE_LABELS[adj.type] ||
                            adj.type ||
                            "—"}
                        </td>
                        <td>{adj.amount}</td>
                        <td>{adj.comment || ""}</td>
                        {canEditAdjustments && (
                          <td>
                            <button
                              type="button"
                              className="building-btn"
                              onClick={() =>
                                handleDeleteAdjustment(adj.id ?? adj.uuid)
                              }
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {(!adjustmentsBucket.list ||
                      adjustmentsBucket.list.length === 0) && (
                        <tr>
                          <td
                            colSpan={canEditAdjustments ? 4 : 3}
                            style={{ textAlign: "center" }}
                          >
                            Корректировок пока нет.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <div className="building-page__card">
            <details open={canCreatePayments}>
              <summary className="building-page__cardTitle">
                Выплаты
              </summary>
              {!canCreatePayments && (
                <div
                  className="building-page__muted"
                  style={{ marginTop: 8 }}
                >
                  Выплаты можно создавать только после утверждения периода.
                </div>
              )}
              {canCreatePayments && (
                <div
                  className="building-page__actions"
                  style={{ marginTop: 8 }}
                >
                  <button
                    type="button"
                    className="building-btn building-btn--primary"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    Создать выплату
                  </button>
                </div>
              )}

              {paymentsBucket.loading && (
                <div className="building-page__muted" style={{ marginTop: 8 }}>
                  Загрузка выплат...
                </div>
              )}
              {paymentsBucket.error && (
                <div className="building-page__error" style={{ marginTop: 8 }}>
                  {String(
                    validateResErrors(
                      paymentsBucket.error,
                      "Не удалось загрузить выплаты",
                    ),
                  )}
                </div>
              )}
              {!paymentsBucket.loading && (
                <div
                  className="building-table building-table--shadow"
                  style={{ marginTop: 8 }}
                >
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
            </details>
          </div>
        </>
      )}

      {isAdjModalOpen && (
        <Modal
          open={isAdjModalOpen}
          onClose={() => setIsAdjModalOpen(false)}
          title="Добавить корректировку"
        >
          <form className="building-page" onSubmit={handleAddAdjustment}>
            <label>
              <div className="building-page__label">Тип</div>
              <select
                className="building-page__select"
                value={adjType}
                onChange={(e) => setAdjType(e.target.value)}
              >
                <option value="bonus">Бонус</option>
                <option value="deduction">Удержание</option>
                <option value="advance">Аванс</option>
              </select>
            </label>
            <label>
              <div className="building-page__label">Сумма *</div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="building-page__input"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="1000.00"
              />
            </label>
            <label>
              <div className="building-page__label">Комментарий</div>
              <input
                className="building-page__input"
                value={adjComment}
                onChange={(e) => setAdjComment(e.target.value)}
                placeholder="Комментарий"
              />
            </label>
            <div className="building-page__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => setIsAdjModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
              >
                Добавить
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isPaymentModalOpen && (
        <Modal
          open={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Создать выплату"
        >
          <form className="building-page" onSubmit={handleCreatePayment}>
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
              />
            </label>
            <div className="building-page__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
              >
                Создать выплату
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

