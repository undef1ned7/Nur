import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Modal from "@/Components/common/Modal/Modal";
import { useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  getBuildingAdvanceRequests,
  approveBuildingAdvanceRequest,
  rejectBuildingAdvanceRequest,
  getBuildingCashRegisterRequests,
  approveBuildingCashRegisterRequest,
  rejectBuildingCashRegisterRequest,
  getBuildingCashRegisterRequest,
  uploadBuildingCashRegisterRequestFile,
} from "@/api/building";

const REQUEST_TYPE_LABELS = {
  apartment_sale: "Продажа квартиры",
  installment_initial_payment: "Первоначальный взнос (рассрочка)",
  installment_payment: "Платёж по рассрочке",
  contractor_payment: "Оплата подрядчику",
  procurement_payment: "Оплата закупки",
  advance: "Аванс",
  other: "Прочее",
};

function getRequestTypeLabel(requestType) {
  return REQUEST_TYPE_LABELS[requestType] || requestType || "—";
}

export default function AdvanceRequestsTab({
  selectedProjectId,
  cashRequestTypes = null,
  hideSalary = false,
}) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [salaryList, setSalaryList] = useState([]);
  const [cashRegisterList, setCashRegisterList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionKey, setActionKey] = useState(null);

  const [filesModalRequestId, setFilesModalRequestId] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  const [requestDetailLoading, setRequestDetailLoading] = useState(false);
  const [requestFileUploading, setRequestFileUploading] = useState(false);
  const [requestFileError, setRequestFileError] = useState(null);
  const [requestFileInput, setRequestFileInput] = useState(null);
  const [requestFileTitle, setRequestFileTitle] = useState("");

  const [decisionModal, setDecisionModal] = useState({
    open: false,
    mode: null,
    item: null,
    source: null,
    comment: "",
  });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedProjectId) params.residential_complex = selectedProjectId;

      const [salaryData, cashData] = await Promise.all([
        hideSalary ? Promise.resolve([]) : getBuildingAdvanceRequests(params).catch(() => []),
        getBuildingCashRegisterRequests({
          ...params,
          status: "pending",
        }).catch(() => []),
      ]);

      const salaryArr = Array.isArray(salaryData) ? salaryData : [];
      const cashArr = Array.isArray(cashData) ? cashData : [];
      const filteredCash =
        Array.isArray(cashRequestTypes) && cashRequestTypes.length > 0
          ? cashArr.filter((it) =>
              cashRequestTypes.includes(String(it?.request_type || "")),
            )
          : cashArr;

      setSalaryList(salaryArr);
      setCashRegisterList(filteredCash);
    } catch (err) {
      setError(
        validateResErrors(
          err?.response?.data ?? err,
          "Не удалось загрузить заявки",
        ),
      );
      setSalaryList([]);
      setCashRegisterList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, cashRequestTypes, hideSalary]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (!filesModalRequestId) {
      setRequestDetail(null);
      return;
    }
    setRequestDetailLoading(true);
    setRequestDetail(null);
    getBuildingCashRegisterRequest(filesModalRequestId)
      .then((data) => setRequestDetail(data))
      .catch(() => setRequestDetail(null))
      .finally(() => setRequestDetailLoading(false));
  }, [filesModalRequestId]);

  const handleUploadRequestFile = async (e) => {
    e.preventDefault();
    if (!filesModalRequestId || !requestFileInput) return;
    setRequestFileUploading(true);
    setRequestFileError(null);
    try {
      const formData = new FormData();
      formData.append("file", requestFileInput);
      if (requestFileTitle.trim()) formData.append("title", requestFileTitle.trim());
      await uploadBuildingCashRegisterRequestFile(filesModalRequestId, formData);
      const data = await getBuildingCashRegisterRequest(filesModalRequestId);
      setRequestDetail(data);
      setRequestFileInput(null);
      setRequestFileTitle("");
    } catch (err) {
      setRequestFileError(
        validateResErrors(err?.response?.data ?? err, "Не удалось загрузить файл"),
      );
    } finally {
      setRequestFileUploading(false);
    }
  };

  const openDecisionModal = (mode, item, source) => {
    setDecisionModal({
      open: true,
      mode,
      item,
      source,
      comment: "",
    });
  };

  const closeDecisionModal = () => {
    if (decisionSubmitting) return;
    setDecisionModal({ open: false, mode: null, item: null, source: null, comment: "" });
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    const { mode, item, source, comment } = decisionModal;
    const id = item?.id ?? item?.uuid;
    if (!id) return;
    const key = source === "salary" ? `salary-${id}` : `cr-${id}`;
    setDecisionSubmitting(true);
    setActionKey(key);
    try {
      if (mode === "approve") {
        if (source === "salary") {
          await approveBuildingAdvanceRequest(id, {
            paid_at: new Date().toISOString(),
            comment: comment.trim() || undefined,
          });
        } else {
          await approveBuildingCashRegisterRequest(id, {
            paid_at: new Date().toISOString(),
            comment: comment.trim() || undefined,
          });
        }
      } else {
        if (source === "salary") {
          await rejectBuildingAdvanceRequest(id, {
            reason: comment.trim() || undefined,
          });
        } else {
          await rejectBuildingCashRegisterRequest(id, {
            reason: comment.trim() || undefined,
          });
        }
      }
      closeDecisionModal();
      await fetchLists();
    } catch (err) {
      setError(
        validateResErrors(
          err?.response?.data ?? err,
          mode === "approve"
            ? "Не удалось одобрить заявку"
            : "Не удалось отклонить заявку",
        ),
      );
    } finally {
      setDecisionSubmitting(false);
      setActionKey(null);
    }
  };

  const handleApproveSalary = (item) => {
    openDecisionModal("approve", item, "salary");
  };

  const handleRejectSalary = (item) => {
    openDecisionModal("reject", item, "salary");
  };

  const handleApproveCashRegister = (item) => {
    openDecisionModal("approve", item, "cash_register");
  };

  const handleRejectCashRegister = (item) => {
    openDecisionModal("reject", item, "cash_register");
  };

  const hasItems = salaryList.length > 0 || cashRegisterList.length > 0;
  const isEmpty = !loading && !error && !hasItems;

  return (
    <DataContainer>
      <div className="warehouse-table-container w-full">
        {!selectedProjectId ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Выберите жилой комплекс в шапке раздела, чтобы увидеть заявки.
          </div>
        ) : loading && !hasItems ? (
          <div
            className="warehouse-table__loading"
            style={{ padding: 24, textAlign: "center" }}
          >
            Загрузка заявок...
          </div>
        ) : error ? (
          <div className="mt-2 text-sm text-red-500" style={{ padding: 24 }}>
            {String(error)}
          </div>
        ) : isEmpty ? (
          <div
            className="warehouse-table__empty"
            style={{ padding: 24, textAlign: "center" }}
          >
            Нет заявок со статусом «ожидает» по выбранному ЖК.
          </div>
        ) : (
          <table className="warehouse-table w-full">
            <thead>
              <tr>
                <th>Тип заявки</th>
                <th>Описание / источник</th>
                <th>Сумма</th>
                <th>Касса</th>
                <th>Дата</th>
                <th style={{ width: 200 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {salaryList.map((item) => {
                const id = item?.id ?? item?.uuid;
                const key = `salary-${id}`;
                const isBusy = actionKey === key;
                return (
                  <tr key={key}>
                    <td>Аванс (ЗП)</td>
                    <td>
                      {item?.employee_display ??
                        item?.payroll_line_employee_display ??
                        item?.employee_name ??
                        "—"}
                      {item?.payroll_title || item?.payroll_line_display
                        ? ` · ${item?.payroll_title || item?.payroll_line_display}`
                        : ""}
                    </td>
                    <td>{item?.amount ?? "—"}</td>
                    <td>{item?.cashbox_display ?? "—"}</td>
                    <td>
                      {item?.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                          disabled={isBusy}
                          onClick={() => handleApproveSalary(item)}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                          }}
                          disabled={isBusy}
                          onClick={() => handleRejectSalary(item)}
                        >
                          Отклонить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {cashRegisterList.map((item) => {
                const id = item?.id ?? item?.uuid;
                const key = `cr-${id}`;
                const isBusy = actionKey === key;
                const workEntryId = item?.work_entry;
                const otherParts = [
                  item?.comment,
                  item?.treaty_display || item?.treaty_number,
                  item?.client_display || item?.client_name,
                  item?.apartment_display || item?.apartment_number,
                ]
                  .filter(Boolean);
                const workEntryLabel =
                  item?.work_entry_display || item?.work_entry_title || workEntryId;
                return (
                  <tr key={key}>
                    <td>
                      {getRequestTypeLabel(item?.request_type)}
                    </td>
                    <td>
                      {otherParts.length > 0 && (
                        <span>{otherParts.join(" · ")}</span>
                      )}
                      {workEntryId && (
                        <>
                          {otherParts.length > 0 && " · "}
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/crm/building/work/${workEntryId}`)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              color: "var(--link-color, #2563eb)",
                              textDecoration: "underline",
                              fontSize: "inherit",
                            }}
                          >
                            {workEntryLabel}
                          </button>
                        </>
                      )}
                      {otherParts.length === 0 && !workEntryId && "—"}
                    </td>
                    <td>{item?.amount ?? "—"}</td>
                    <td>{item?.cashbox_display ?? item?.cashbox_name ?? "—"}</td>
                    <td>
                      {item?.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                          }}
                          disabled={isBusy}
                          onClick={() => setFilesModalRequestId(id)}
                        >
                          Файлы
                        </button>
                        <button
                          type="button"
                          className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                          disabled={isBusy}
                          onClick={() => handleApproveCashRegister(item)}
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid",
                            fontSize: 13,
                          }}
                          disabled={isBusy}
                          onClick={() => handleRejectCashRegister(item)}
                        >
                          Отклонить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={decisionModal.open}
        onClose={closeDecisionModal}
        title={decisionModal.mode === "approve" ? "Одобрить заявку" : "Отклонить заявку"}
      >
        <form onSubmit={handleDecisionSubmit} className="building-page">
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Комментарий (необязательно)</label>
            <textarea
              className="add-product-page__input"
              rows={3}
              value={decisionModal.comment}
              onChange={(e) =>
                setDecisionModal((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder={
                decisionModal.mode === "approve"
                  ? "Комментарий к одобрению"
                  : "Причина отклонения"
              }
            />
          </div>
          <div
            className="cash-register-decision-modal-actions"
            style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}
          >
            <button
              type="button"
              className="cash-register-decision-modal-btn cash-register-decision-modal-btn--cancel"
              onClick={closeDecisionModal}
              disabled={decisionSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cash-register-decision-modal-btn cash-register-decision-modal-btn--submit"
              disabled={decisionSubmitting}
            >
              {decisionSubmitting ? "Отправка..." : "Подтвердить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(filesModalRequestId)}
        onClose={() => {
          setFilesModalRequestId(null);
          setRequestDetail(null);
          setRequestFileError(null);
          setRequestFileInput(null);
          setRequestFileTitle("");
        }}
        title="Файлы заявки"
      >
        <div className="building-page">
          {requestDetailLoading ? (
            <div className="building-page__muted" style={{ padding: 16 }}>
              Загрузка...
            </div>
          ) : (
            <>
              {(requestDetail?.files && requestDetail.files.length > 0) ? (
                <div style={{ marginBottom: 16 }}>
                  <div className="add-product-page__label" style={{ marginBottom: 8 }}>
                    Прикреплённые файлы
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {requestDetail.files.map((f) => {
                      const url = f?.file_url ?? f?.url ?? f?.file;
                      const label = f?.title || "Файл";
                      return (
                        <li key={f?.id ?? f?.uuid ?? url} style={{ marginBottom: 6 }}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--link-color, #2563eb)",
                              textDecoration: "underline",
                            }}
                          >
                            {label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="building-page__muted" style={{ marginBottom: 16 }}>
                  Нет прикреплённых файлов.
                </div>
              )}
              <form onSubmit={handleUploadRequestFile}>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Прикрепить файл</label>
                  <input
                    type="file"
                    className="add-product-page__input"
                    onChange={(e) =>
                      setRequestFileInput(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div className="add-product-page__form-group">
                  <label className="add-product-page__label">Подпись (необязательно)</label>
                  <input
                    type="text"
                    className="add-product-page__input"
                    value={requestFileTitle}
                    onChange={(e) => setRequestFileTitle(e.target.value)}
                    placeholder="Например: Договор, Акт"
                  />
                </div>
                {requestFileError && (
                  <div className="add-product-page__error" style={{ marginBottom: 12 }}>
                    {String(requestFileError)}
                  </div>
                )}
                <div className="add-product-page__actions" style={{ marginTop: 12 }}>
                  <button
                    type="submit"
                    className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid",
                      fontSize: 13,
                    }}
                    disabled={requestFileUploading || !requestFileInput}
                  >
                    {requestFileUploading ? "Загрузка..." : "Загрузить"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </DataContainer>
  );
}
