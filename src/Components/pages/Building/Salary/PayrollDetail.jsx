import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "../../../../store/slices/building/salarySlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  fetchBuildingSalaryEmployees,
  fetchBuildingPayrolls,
  fetchBuildingPayrollLines,
  createBuildingPayrollLine,
  updateBuildingPayrollLine,
  approveBuildingPayroll,
  createBuildingPayrollLineAdjustment,
  deleteBuildingPayrollAdjustment,
  fetchBuildingPayrollLineAdjustments,
  fetchBuildingPayrollLinePayments,
  deleteBuildingPayrollLine,
} from "../../../../store/creators/building/salaryCreators";
import { fetchBuildingProjects } from "@/store/creators/building/projectsCreators";
import Modal from "@/Components/common/Modal/Modal";
import BuildingActionsMenu from "../shared/ActionsMenu";
import "./Detail.scss";

export default function BuildingSalaryPayrollDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { id } = useParams();

  const {
    employees,
    payrolls,
    linesByPayrollId,
    payrollsLoading,
    paymentsByLineId,
    adjustmentsByLineId,
  } = useBuildingSalary();
  const { items: residentialComplexes, selectedProjectId } =
    useBuildingProjects();

  const [newLineEmployee, setNewLineEmployee] = useState("");
  const [newLineAmount, setNewLineAmount] = useState("");
  const [newLineComment, setNewLineComment] = useState("");
  const [newLineResidentialComplex, setNewLineResidentialComplex] =
    useState("");

  const [isCreateLineModalOpen, setIsCreateLineModalOpen] = useState(false);
  const [expandedLineId, setExpandedLineId] = useState(null);

  const [isAdjustmentsModalOpen, setIsAdjustmentsModalOpen] = useState(false);
  const [adjType, setAdjType] = useState("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjComment, setAdjComment] = useState("");

  const [activePaymentsLineId, setActivePaymentsLineId] = useState(null);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [detailLineId, setDetailLineId] = useState(null);
  const [detailLineCommentEdit, setDetailLineCommentEdit] = useState("");
  const [linesViewMode, setLinesViewMode] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "cards" : "table",
  );

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
    if (detailLineId) {
      dispatch(fetchBuildingPayrollLineAdjustments(detailLineId));
      dispatch(fetchBuildingPayrollLinePayments(detailLineId));
    }
  }, [dispatch, detailLineId]);

  useEffect(() => {
    if (!newLineResidentialComplex && selectedProjectId) {
      setNewLineResidentialComplex(String(selectedProjectId));
    }
  }, [selectedProjectId, newLineResidentialComplex]);

  const payroll = useMemo(() => {
    if (!id || !Array.isArray(payrolls)) return null;
    return payrolls.find((p) => String(p.id ?? p.uuid) === String(id)) || null;
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

  const detailLine = useMemo(() => {
    if (!detailLineId || !payrollLinesBucket?.list) return null;
    return payrollLinesBucket.list.find(
      (l) => String(l?.id ?? l?.uuid) === String(detailLineId),
    ) ?? null;
  }, [detailLineId, payrollLinesBucket?.list]);

  useEffect(() => {
    setDetailLineCommentEdit(detailLine?.comment ?? "");
  }, [detailLineId, detailLine?.comment]);

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
    setIsPaymentsModalOpen(true);
    dispatch(fetchBuildingPayrollLinePayments(lineId));
  };

  const handleDeleteLine = (lineId) => {
    if (!id || !lineId) return;
    confirm("Удалить строку начисления?", async (ok) => {
      if (!ok) return;
      const res = await dispatch(
        deleteBuildingPayrollLine({ lineId, payrollId: id }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        if (detailLineId === lineId) setDetailLineId(null);
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось удалить строку",
          ),
          true,
        );
      }
    });
  };

  const paymentsBucket = activePaymentsLineId
    ? paymentsByLineId?.[String(activePaymentsLineId)] || {
        list: [],
        loading: false,
        error: null,
      }
    : { list: [], loading: false, error: null };
  const handleApprove = () => {
    if (!id || !payroll) return;
    confirm("Утвердить период начислений? После утверждения можно будет создавать выплаты.", async (ok) => {
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
    });
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
    <div className="add-product-page salary-detail">
      <div className="add-product-page__header">
        <button
          type="button"
          className="add-product-page__back"
          onClick={() => navigate("/crm/building/salary")}
        >
          <ArrowLeft size={18} />К периодам
        </button>
        <div className="add-product-page__title-section">
          <div className="add-product-page__icon">
            <CalendarDays size={24} />
          </div>
          <div>
            <h1 className="add-product-page__title">{title}</h1>
            <p className="add-product-page__subtitle">
              Детальная информация по периоду начислений и его строкам.
            </p>
          </div>
        </div>
      </div>

      <div className="add-product-page__content">
        {payrollsLoading && !payroll && (
          <div className="salary-detail__muted">
            Загрузка информации о периоде...
          </div>
        )}
        {!payrollsLoading && !payroll && (
          <div className="add-product-page__error">
            Не удалось найти период.
          </div>
        )}

        {payroll && (
          <>
            <div className="add-product-page__section">
              <div className="add-product-page__section-header">
                <div className="add-product-page__section-number">1</div>
                <h3 className="add-product-page__section-title">
                  Информация о периоде
                </h3>
              </div>
              <dl className="salary-detail__info-grid">
                <dt className="salary-detail__info-label">Название:</dt>
                <dd className="salary-detail__info-value">
                  {payroll.title || "—"}
                </dd>
                <dt className="salary-detail__info-label">Период:</dt>
                <dd className="salary-detail__info-value">
                  {payroll.period_start} — {payroll.period_end}
                </dd>
                <dt className="salary-detail__info-label">Статус:</dt>
                <dd className="salary-detail__info-value">
                  {PAYROLL_STATUS_LABELS[payroll.status] ??
                    PAYROLL_STATUS_LABELS.draft}
                </dd>
              </dl>
              {payroll.status === "draft" && (
                <div
                  className="add-product-page__actions"
                  style={{ marginTop: 16 }}
                >
                  <button
                    type="button"
                    className="add-product-page__submit-btn"
                    onClick={handleApprove}
                  >
                    Утвердить период
                  </button>
                </div>
              )}
            </div>

            {payroll.status !== "approved" && (
              <div className="add-product-page__section my-5 !gap-0">
                <div className="add-product-page__section-header !mb-0">
                  <div className="add-product-page__section-number">2</div>
                  <h3 className="add-product-page__section-title">Выплаты</h3>
                </div>
                <p className="salary-detail__muted">
                  Выплаты создаются по конкретным строкам начислений. Откройте
                  строку и выберите действие <b>«Выплаты»</b>, чтобы увидеть
                  список выплат и добавить новую.
                </p>
              </div>
            )}

            <div className="add-product-page__section">
              <div className="add-product-page__section-header salary-detail__section-header-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="add-product-page__section-number">
                    {payroll.status !== "approved" ? "3" : "2"}
                  </div>
                  <h3 className="add-product-page__section-title">
                    Строки начислений
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div className="salary-view-toggle">
                    <button
                      type="button"
                      className={`salary-tab${linesViewMode === "cards" ? " salary-tab--active" : ""}`}
                      onClick={() => setLinesViewMode("cards")}
                    >
                      Карточки
                    </button>
                    <button
                      type="button"
                      className={`salary-tab${linesViewMode === "table" ? " salary-tab--active" : ""}`}
                      onClick={() => setLinesViewMode("table")}
                    >
                      Таблица
                    </button>
                  </div>
                  {id && payroll?.status === "draft" && (
                    <button
                      type="button"
                      className="add-product-page__submit-btn"
                      onClick={() => setIsCreateLineModalOpen(true)}
                    >
                      + Добавить строку
                    </button>
                  )}
                </div>
              </div>
              {!id && (
                <div className="salary-detail__muted">
                  Идентификатор периода не указан.
                </div>
              )}
              {id && payrollLinesBucket.loading && (
                <div className="salary-detail__muted">
                  Загрузка строк начислений...
                </div>
              )}
              {id && payrollLinesBucket.error && (
                <div
                  className="add-product-page__error"
                  style={{ marginTop: 8 }}
                >
                  {String(
                    validateResErrors(
                      payrollLinesBucket.error,
                      "Не удалось загрузить строки начислений",
                    ),
                  )}
                </div>
              )}
              {id && !payrollLinesBucket.loading && linesViewMode === "cards" && (
                <div className="salary-lines-cards">
                  {(!payrollLinesBucket.list || payrollLinesBucket.list.length === 0) ? (
                    <div className="salary-lines-cards__empty">
                      Строки начислений пока не добавлены.
                    </div>
                  ) : (
                    (payrollLinesBucket.list || []).map((line) => {
                      const lid = line.id ?? line.uuid;
                      const emp = employeesById[String(line.employee)] || null;
                      const isApproved = payroll?.status === "approved";
                      const isDraft = payroll?.status === "draft";
                      return (
                        <div
                          key={lid}
                          className="salary-line-card"
                          onClick={() => setDetailLineId(lid)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetailLineId(lid);
                            }
                          }}
                        >
                          <div className="salary-line-card__main">
                            <div className="salary-line-card__title">
                              {emp?.display || emp?.name || "—"}
                            </div>
                            <div className="salary-line-card__row">
                              <span className="salary-line-card__label">База:</span>
                              <span>{line.base_amount ?? "—"}</span>
                            </div>
                            <div className="salary-line-card__row">
                              <span className="salary-line-card__label">К выплате:</span>
                              <span>{line.net_to_pay ?? "—"}</span>
                            </div>
                            <div className="salary-line-card__row">
                              <span className="salary-line-card__label">Выплачено:</span>
                              <span>{line.paid_total ?? "—"}</span>
                            </div>
                            {line.comment && (
                              <div className="salary-line-card__comment">
                                {line.comment}
                              </div>
                            )}
                          </div>
                          <div
                            className="salary-line-card__actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="salary-line-card__btn salary-line-card__btn--secondary"
                              onClick={() => setDetailLineId(lid)}
                            >
                              Подробнее
                            </button>
                            {isApproved && (
                              <button
                                type="button"
                                className="salary-line-card__btn salary-line-card__btn--primary"
                                onClick={() => openPayments(lid)}
                              >
                                Выплаты
                              </button>
                            )}
                            {isDraft && (
                              <button
                                type="button"
                                className="salary-line-card__btn salary-line-card__btn--danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLine(lid);
                                }}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {id && !payrollLinesBucket.loading && linesViewMode === "table" && (
                <div className="salary-detail__table-wrap">
                  <table className="salary-detail__table">
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>База</th>
                        <th>К выплате</th>
                        <th>Выплачено</th>
                        <th>Комментарий</th>
                        <th style={{ width: 200 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollLinesBucket.list || []).map((line) => {
                        const lid = line.id ?? line.uuid;
                        const emp =
                          employeesById[String(line.employee)] || null;
                        const isApproved = payroll?.status === "approved";
                        const isDraft = payroll?.status === "draft";
                        return (
                          <tr key={lid}>
                            <td>{emp?.display || emp?.name || "—"}</td>
                            <td>{line.base_amount}</td>
                            <td>{line.net_to_pay ?? "—"}</td>
                            <td>{line.paid_total ?? "—"}</td>
                            <td>{line.comment || ""}</td>
                            <td>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="building-btn"
                                  style={{ padding: "6px 12px", fontSize: 13 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailLineId(lid);
                                  }}
                                >
                                  Подробнее
                                </button>
                                {isApproved && (
                                  <button
                                    type="button"
                                    className="building-btn building-btn--primary"
                                    style={{ padding: "6px 12px", fontSize: 13 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPayments(lid);
                                    }}
                                  >
                                    Выплаты
                                  </button>
                                )}
                                {isDraft && (
                                  <button
                                    type="button"
                                    className="building-btn building-btn--danger"
                                    style={{ padding: "6px 12px", fontSize: 13 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLine(lid);
                                    }}
                                  >
                                    Удалить
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!payrollLinesBucket.list ||
                        payrollLinesBucket.list.length === 0) && (
                        <tr>
                          <td
                            colSpan={6}
                            className="salary-detail__muted"
                            style={{ textAlign: "center", padding: 24 }}
                          >
                            Строки начислений пока не добавлены.
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

      {isPaymentsModalOpen && activePaymentsLineId && (
        <Modal
          open={isPaymentsModalOpen}
          onClose={() => {
            setIsPaymentsModalOpen(false);
            setActivePaymentsLineId(null);
          }}
          title="Выплаты по строке"
        >
          {(() => {
            return (
              <div className="add-product-page add-product-page--modal-form">
                {paymentsBucket.loading && (
                  <div className="salary-detail__muted">Загрузка выплат...</div>
                )}
                {paymentsBucket.error && (
                  <div className="add-product-page__error">
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
                    className="salary-detail__table-wrap"
                    style={{ marginTop: 12 }}
                  >
                    <table className="salary-detail__table">
                      <thead>
                        <tr>
                          <th>Сумма</th>
                          <th>Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paymentsBucket.list || []).map((pmt) => (
                          <tr key={pmt.id ?? pmt.uuid}>
                            <td>{pmt.amount}</td>
                            <td>{pmt.paid_at ? new Date(pmt.paid_at).toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                        {(!paymentsBucket.list ||
                          paymentsBucket.list.length === 0) && (
                          <tr>
                            <td colSpan={2} style={{ textAlign: "center" }}>
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

      {detailLineId && (
        <Modal
          wrapperId="payroll-line-detail-modal"
          open={!!detailLineId}
          onClose={() => setDetailLineId(null)}
          title="Строка начисления"
        >
          {(() => {
            const line =
              (payrollLinesBucket.list || []).find(
                (l) => String(l?.id ?? l?.uuid) === String(detailLineId),
              ) ?? null;
            const emp = line ? employeesById[String(line.employee)] : null;
            const empName =
              emp?.display ||
              [emp?.first_name, emp?.last_name].filter(Boolean).join(" ") ||
              emp?.name ||
              line?.employee_display ||
              "—";
            const adjBucket = detailLineId
              ? adjustmentsByLineId?.[String(detailLineId)] ?? { list: [], loading: false, error: null }
              : { list: [], loading: false, error: null };
            const payBucket = detailLineId
              ? paymentsByLineId?.[String(detailLineId)] ?? { list: [], loading: false, error: null }
              : { list: [], loading: false, error: null };
            const adjustments = Array.isArray(adjBucket.list) ? adjBucket.list : [];
            const payments = Array.isArray(payBucket.list) ? payBucket.list : [];
            const remaining =
              line != null && line.net_to_pay != null && line.paid_total != null
                ? Math.max(0, Number(line.net_to_pay) - Number(line.paid_total))
                : null;
            return (
              <div className="add-product-page add-product-page--modal-form">
                {!line ? (
                  <p className="salary-detail__muted">Строка не найдена.</p>
                ) : (
                  <>
                    <div className="salary-detail__info-block">
                      <div className="salary-detail__info-row">
                        <span className="salary-detail__info-label">Сотрудник</span>
                        <span className="salary-detail__info-value">
                          {empName}
                        </span>
                      </div>
                      <div className="salary-detail__info-row">
                        <span className="salary-detail__info-label">База</span>
                        <span className="salary-detail__info-value">{line.base_amount ?? "—"}</span>
                      </div>
                      <div className="salary-detail__info-row">
                        <span className="salary-detail__info-label">Начислено к выплате</span>
                        <span className="salary-detail__info-value">{line.net_to_pay ?? "—"}</span>
                      </div>
                      <div className="salary-detail__info-row">
                        <span className="salary-detail__info-label">Выплачено</span>
                        <span className="salary-detail__info-value">{line.paid_total ?? "—"}</span>
                      </div>
                      <div className="salary-detail__info-row">
                        <span className="salary-detail__info-label">Остаток к выплате</span>
                        <span className="salary-detail__info-value">
                          {remaining != null ? remaining.toFixed(2) : "—"}
                        </span>
                      </div>
                      <div className="salary-detail__info-row salary-detail__info-row--full">
                        <span className="salary-detail__info-label">Комментарий</span>
                        <div className="salary-detail__comment-edit">
                          <input
                            type="text"
                            className="add-product-page__input salary-detail__comment-input"
                            value={detailLineCommentEdit}
                            onChange={(e) => setDetailLineCommentEdit(e.target.value)}
                            placeholder="Комментарий"
                          />
                          <button
                            type="button"
                            className="add-product-page__submit-btn"
                            style={{ padding: "6px 14px", fontSize: 13 }}
                            onClick={async () => {
                              if (!detailLineId) return;
                              const comment = String(detailLineCommentEdit ?? "").trim();
                              const res = await dispatch(
                                updateBuildingPayrollLine({
                                  lineId: detailLineId,
                                  payload: { comment },
                                }),
                              );
                              if (res.meta.requestStatus === "fulfilled") {
                                dispatch(fetchBuildingPayrollLines(id));
                              } else {
                                alert(
                                  validateResErrors(
                                    res.payload || res.error,
                                    "Не удалось сохранить комментарий",
                                  ),
                                  true,
                                );
                              }
                            }}
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    </div>

                    <h4 className="salary-detail__section-title">
                      Корректировки
                    </h4>
                    {adjBucket.loading && (
                      <div className="salary-detail__muted">Загрузка...</div>
                    )}
                    {!adjBucket.loading && (
                      <div className="salary-detail__table-wrap" style={{ marginBottom: 16 }}>
                        <table className="salary-detail__table">
                          <thead>
                            <tr>
                              <th>Тип</th>
                              <th>Сумма</th>
                              <th>Комментарий</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adjustments.map((adj) => (
                              <tr key={adj.id ?? adj.uuid}>
                                <td>{ADJUSTMENT_TYPE_LABELS[adj.type] || adj.type || "—"}</td>
                                <td>{adj.amount}</td>
                                <td>{adj.comment || ""}</td>
                              </tr>
                            ))}
                            {adjustments.length === 0 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign: "center" }}>
                                  Нет корректировок
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <h4 className="salary-detail__section-title">
                      Выплаты
                    </h4>
                    {payBucket.loading && (
                      <div className="salary-detail__muted">Загрузка...</div>
                    )}
                    {!payBucket.loading && (
                      <div className="salary-detail__table-wrap">
                        <table className="salary-detail__table">
                          <thead>
                            <tr>
                              <th>Сумма</th>
                              <th>Дата</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((pmt) => (
                              <tr key={pmt.id ?? pmt.uuid}>
                                <td>{pmt.amount}</td>
                                <td>{pmt.paid_at ? new Date(pmt.paid_at).toLocaleString() : "—"}</td>
                              </tr>
                            ))}
                            {payments.length === 0 && (
                              <tr>
                                <td colSpan={2} style={{ textAlign: "center" }}>
                                  Выплат пока нет
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="salary-detail__modal-actions">
                      {payroll?.status === "draft" && (
                        <button
                          type="button"
                          className="add-product-page__submit-btn"
                          onClick={() => {
                            setExpandedLineId(detailLineId);
                            setDetailLineId(null);
                            setIsAdjustmentsModalOpen(true);
                          }}
                        >
                          Добавить корректировку
                        </button>
                      )}
                      {payroll?.status === "approved" && (
                        <button
                          type="button"
                          className="add-product-page__submit-btn"
                          onClick={() => {
                            setDetailLineId(null);
                            openPayments(detailLineId);
                          }}
                        >
                          Выплаты
                        </button>
                      )}
                      <button
                        type="button"
                        className="add-product-page__cancel-btn"
                        onClick={() => setDetailLineId(null)}
                      >
                        Закрыть
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {isAdjustmentsModalOpen && expandedLineId && (
        <Modal
          open={isAdjustmentsModalOpen}
          onClose={() => {
            setIsAdjustmentsModalOpen(false);
            setDetailLineId(expandedLineId);
            setExpandedLineId(null);
          }}
          title="Корректировки строки"
        >
          {(() => {
            const line =
              (payrollLinesBucket.list || []).find(
                (l) => String(l.id ?? l.uuid) === String(expandedLineId),
              ) || null;
            const adjBucket = adjustmentsByLineId?.[String(expandedLineId)] ?? { list: [] };
            const adjustments = Array.isArray(adjBucket.list) ? adjBucket.list : [];
            return (
              <div className="add-product-page add-product-page--modal-form">
                <p
                  className="add-product-page__subtitle"
                  style={{ marginBottom: 12 }}
                >
                  База: <b>{line?.base_amount ?? "—"}</b>, комментарий:{" "}
                  <b>{line?.comment || "—"}</b>
                </p>
                <form
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
                    if (adjType === "advance") {
                      const rcId = line?.residential_complex ?? selectedProjectId;
                      const rc = (residentialComplexes || []).find(
                        (p) => String(p.id ?? p.uuid) === String(rcId),
                      );
                      const cashboxId = rc?.salary_cashbox;
                      if (!cashboxId) {
                        alert(
                          "Для аванса укажите кассу. Настройте кассу для ЗП в карточке ЖК (вкладка «Касса»).",
                          true,
                        );
                        return;
                      }
                      payload.cashbox = cashboxId;
                      payload.paid_at = new Date().toISOString();
                    }
                    const res = await dispatch(
                      createBuildingPayrollLineAdjustment({
                        lineId: expandedLineId,
                        payload,
                      }),
                    );
                    if (res.meta.requestStatus === "fulfilled") {
                      setAdjAmount("");
                      setAdjComment("");
                      dispatch(fetchBuildingPayrollLineAdjustments(expandedLineId));
                      dispatch(fetchBuildingPayrollLines(id));
                      setIsAdjustmentsModalOpen(false);
                      setDetailLineId(expandedLineId);
                      setExpandedLineId(null);
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
                  style={{ marginBottom: 12 }}
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
                    <label className="add-product-page__label">Сумма</label>
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
                    <label className="add-product-page__label">
                      Комментарий
                    </label>
                    <input
                      className="add-product-page__input"
                      value={adjComment}
                      onChange={(e) => setAdjComment(e.target.value)}
                      placeholder="Комментарий"
                    />
                  </div>
                  <div className="add-product-page__actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="add-product-page__cancel-btn"
                      onClick={() => {
                        setIsAdjustmentsModalOpen(false);
                        setDetailLineId(expandedLineId);
                        setExpandedLineId(null);
                      }}
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
                <div className="salary-detail__table-wrap">
                  <table className="salary-detail__table">
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
          <form
            className="add-product-page add-product-page--modal-form"
            onSubmit={handleCreateLine}
          >
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Сотрудник *</label>
              <select
                className="add-product-page__input"
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
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">
                Жилой комплекс *
              </label>
              <select
                className="add-product-page__input"
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
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Сумма</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="add-product-page__input"
                value={newLineAmount}
                onChange={(e) => setNewLineAmount(e.target.value)}
                placeholder="45000.00"
              />
            </div>
            <div className="add-product-page__form-group">
              <label className="add-product-page__label">Комментарий</label>
              <input
                className="add-product-page__input"
                value={newLineComment}
                onChange={(e) => setNewLineComment(e.target.value)}
                placeholder="Например: Оклад за месяц"
              />
            </div>
            <div className="add-product-page__actions">
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={() => setIsCreateLineModalOpen(false)}
              >
                Отмена
              </button>
              <button type="submit" className="add-product-page__submit-btn">
                Добавить
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
