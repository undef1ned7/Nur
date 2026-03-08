import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Receipt } from "lucide-react";
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
} from "../../../../store/creators/building/salaryCreators";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { fetchBuildingProjects } from "@/store/creators/building/projectsCreators";
import "./Detail.scss";

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
  const { items: residentialComplexes, selectedProjectId } =
    useBuildingProjects();
  const [adjType, setAdjType] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);

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
      payrolls.find((p) => String(p.id ?? p.uuid) === String(payrollId)) || null
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
    const bucket = linesByPayrollId?.[String(payrollId)] || { list: [] };
    const arr = Array.isArray(bucket.list) ? bucket.list : [];
    return arr.find((l) => String(l.id ?? l.uuid) === String(lineId)) || null;
  }, [linesByPayrollId, payrollId, lineId]);

  /** Касса для аванса: приоритет — ЖК строки (line.residential_complex), иначе выбранный ЖК */
  const advanceCashboxId = useMemo(() => {
    const list = Array.isArray(residentialComplexes)
      ? residentialComplexes
      : [];
    const rcId = line?.residential_complex ?? selectedProjectId;
    const rc = list.find(
      (item) => String(item.id ?? item.uuid) === String(rcId),
    );
    return rc?.salary_cashbox || null;
  }, [residentialComplexes, line?.residential_complex, selectedProjectId]);

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

  const netToPay = useMemo(() => {
    const v = Number(line?.net_to_pay ?? 0);
    return Number.isFinite(v) ? v : null;
  }, [line]);

  const paidTotalNum = useMemo(() => {
    const v = Number(line?.paid_total ?? 0);
    return Number.isFinite(v) ? v : null;
  }, [line]);

  const remainingToPay = useMemo(() => {
    if (netToPay == null || paidTotalNum == null) return null;
    const diff = netToPay - paidTotalNum;
    return diff > 0 ? diff : 0;
  }, [netToPay, paidTotalNum]);

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
    if (adjType === "advance") {
      if (!advanceCashboxId) {
        alert(
          "Для аванса укажите кассу. Настройте кассу для ЗП в карточке ЖК (вкладка «Касса»).",
          true,
        );
        return;
      }
      payload.cashbox = advanceCashboxId;
      payload.paid_at = new Date().toISOString();
    }
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

  const ADJUSTMENT_TYPE_LABELS = {
    bonus: "Бонус",
    deduction: "Удержание",
    advance: "Аванс",
  };

  const title = `Строка начисления — ${employee?.display || employee?.name || "Сотрудник"}`;

  return (
    <div className="add-product-page salary-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={handleBack}
        >
          <ArrowLeft size={18} />
          К периоду
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">{title}</h1>
            <p className="add-product-page__subtitle">
              Детальная информация по строке начисления, корректировкам и
              выплатам.
            </p>
          </div>
        </div>
      </div>

      <div className="add-product-page__content">
        {!line && (
          <div className="salary-detail__muted">
            Не удалось найти строку начисления.
          </div>
        )}

        {line && (
          <>
            <div className="add-product-page__section">
              <div className="add-product-page__section-header">
                <div className="add-product-page__section-number">1</div>
                <h3 className="add-product-page__section-title">
                  Основная информация
                </h3>
              </div>
              <div className="salary-detail__info-grid">
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">Сотрудник</span>
                  <span className="salary-detail__info-value">
                    {employee?.display || employee?.name || "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">Жилой комплекс</span>
                  <span className="salary-detail__info-value">
                    {rc?.name || "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">База</span>
                  <span className="salary-detail__info-value">
                    {line.base_amount || "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">
                    Начислено к выплате
                  </span>
                  <span className="salary-detail__info-value">
                    {line.net_to_pay ?? "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">Выплачено</span>
                  <span className="salary-detail__info-value">
                    {line.paid_total ?? "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">
                    Остаток к выплате
                  </span>
                  <span className="salary-detail__info-value">
                    {remainingToPay != null ? remainingToPay.toFixed(2) : "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">Комментарий</span>
                  <span className="salary-detail__info-value">
                    {line.comment || "—"}
                  </span>
                </div>
                <div className="salary-detail__info-row">
                  <span className="salary-detail__info-label">Статус периода</span>
                  <span className="salary-detail__info-value">
                    {payroll?.status === "draft" && "Черновик"}
                    {payroll?.status === "approved" && "Утверждён"}
                    {payroll?.status === "paid" && "Выплачен"}
                  </span>
                </div>
              </div>
            </div>

            <div className="add-product-page__section">
              <div className="add-product-page__section-header salary-detail__section-header-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="add-product-page__section-number">2</div>
                  <h3 className="add-product-page__section-title">
                    Корректировки
                  </h3>
                </div>
                {canEditAdjustments && (
                  <button
                    type="button"
                    className="add-product-page__submit-btn"
                    onClick={() => setIsAdjModalOpen(true)}
                  >
                    Добавить корректировку
                  </button>
                )}
              </div>
              {!canEditAdjustments && (
                <p className="salary-detail__muted">
                  Период не в статусе черновика — изменять корректировки нельзя.
                </p>
              )}
              {adjustmentsBucket.loading && (
                <div className="salary-detail__muted">
                  Загрузка корректировок...
                </div>
              )}
              {adjustmentsBucket.error && (
                <div className="add-product-page__error" style={{ marginTop: 8 }}>
                  {String(
                    validateResErrors(
                      adjustmentsBucket.error,
                      "Не удалось загрузить корректировки",
                    ),
                  )}
                </div>
              )}
              {!adjustmentsBucket.loading && (
                <div className="salary-detail__table-wrap">
                  <table className="salary-detail__table">
                    <thead>
                      <tr>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Комментарий</th>
                        {canEditAdjustments && (
                          <th style={{ width: 100 }}>Действия</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(adjustmentsBucket.list || []).map((adj) => (
                        <tr key={adj.id ?? adj.uuid}>
                          <td>
                            {ADJUSTMENT_TYPE_LABELS[adj.type] || adj.type || "—"}
                          </td>
                          <td>{adj.amount}</td>
                          <td>{adj.comment || ""}</td>
                          {canEditAdjustments && (
                            <td>
                              <button
                                type="button"
                                className="add-product-page__cancel-btn"
                                style={{ padding: "6px 12px", fontSize: 13 }}
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
                            className="salary-detail__muted"
                            style={{ textAlign: "center", padding: 24 }}
                          >
                            Корректировок пока нет.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="add-product-page__section">
              <div className="add-product-page__section-header salary-detail__section-header-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="add-product-page__section-number">3</div>
                  <h3 className="add-product-page__section-title">Выплаты</h3>
                </div>
              </div>
              {paymentsBucket.loading && (
                <div className="salary-detail__muted">
                  Загрузка выплат...
                </div>
              )}
              {paymentsBucket.error && (
                <div className="add-product-page__error" style={{ marginTop: 8 }}>
                  {String(
                    validateResErrors(
                      paymentsBucket.error,
                      "Не удалось загрузить выплаты",
                    ),
                  )}
                </div>
              )}
              {!paymentsBucket.loading && (
                <div className="salary-detail__table-wrap">
                  <table className="salary-detail__table">
                    <thead>
                      <tr>
                        <th>Сумма</th>
                        <th>Выплатил</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentsBucket.list || []).map((pmt) => (
                        <tr key={pmt.id ?? pmt.uuid}>
                          <td>{pmt.amount}</td>
                          <td>
                            {pmt.paid_by_display || pmt.paid_by || "—"}
                          </td>
                          <td>
                            {pmt.paid_at
                              ? new Date(pmt.paid_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {(!paymentsBucket.list ||
                        paymentsBucket.list.length === 0) && (
                        <tr>
                          <td
                            colSpan={3}
                            className="salary-detail__muted"
                            style={{ textAlign: "center", padding: 24 }}
                          >
                            Выплаты по этой строке ещё не создавались.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isAdjModalOpen && (
        <Modal
          open={isAdjModalOpen}
          onClose={() => setIsAdjModalOpen(false)}
          title="Добавить корректировку"
        >
          <form
            className="add-product-page add-product-page--modal-form"
            onSubmit={handleAddAdjustment}
          >
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Тип</label>
              <select
                className="add-product-page__input"
                value={adjType}
                onChange={(e) => setAdjType(e.target.value)}
              >
                <option value="bonus">Бонус</option>
                <option value="deduction">Удержание</option>
                <option value="advance">Аванс</option>
              </select>
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Сумма *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="add-product-page__input"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="1000.00"
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Комментарий</label>
              <input
                className="add-product-page__input"
                value={adjComment}
                onChange={(e) => setAdjComment(e.target.value)}
                placeholder="Комментарий"
              />
            </div>
            <div className="add-product-page__actions">
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={() => setIsAdjModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="add-product-page__submit-btn"
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
