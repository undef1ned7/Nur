import { useEffect, useState } from "react";
import {
  toDecimalString,
  ruStatusToKind,
  kindToRu,
  toYYYYMMDD,
  msgFromError,
  normalizeDealFromApi,
} from "../clientDetails.helpers";
import api from "../../../../../api";

export default function DealFormModal({
  open,
  clientId,
  editingDeal,
  onClose,
  onSaved,
  onDeleted,
  onError,
}) {
  const [dealName, setDealName] = useState("");
  const [dealBudget, setDealBudget] = useState("");
  const [dealStatus, setDealStatus] = useState("Продажа");
  const [dealDebtMonths, setDealDebtMonths] = useState("");
  const [dealFirstDueDate, setDealFirstDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingDeal) {
      setDealName(editingDeal.title || "");
      setDealBudget(
        editingDeal.amount !== undefined && editingDeal.amount !== null
          ? String(editingDeal.amount)
          : ""
      );
      setDealStatus(kindToRu(editingDeal.kind));
      setDealDebtMonths(
        editingDeal.debt_months !== undefined &&
        editingDeal.debt_months !== null
          ? String(editingDeal.debt_months)
          : ""
      );
      setDealFirstDueDate(
        editingDeal.first_due_date
          ? toYYYYMMDD(editingDeal.first_due_date)
          : ""
      );
    } else {
      setDealName("");
      setDealBudget("");
      setDealStatus("Продажа");
      setDealDebtMonths("");
      setDealFirstDueDate("");
    }
  }, [open, editingDeal]);

  const isDebtSelected = ruStatusToKind(dealStatus) === "debt";

  const canSaveDeal =
    String(dealName).trim().length >= 1 &&
    Number(toDecimalString(dealBudget)) >= 0 &&
    !!clientId &&
    (!isDebtSelected || Number(dealDebtMonths) >= 1);

  // GUARD — теперь после всех хуков
  if (!open || !clientId) return null;

  const createDealApi = async ({
    title,
    statusRu,
    amount,
    debt_months,
    first_due_date,
  }) => {
    const payload = {
      title: String(title || "").trim(),
      kind: ruStatusToKind(statusRu),
      amount: toDecimalString(amount),
      note: "",
      client: clientId,
      ...(ruStatusToKind(statusRu) === "debt" && Number(debt_months) > 0
        ? { debt_months: parseInt(debt_months, 10) }
        : {}),
      ...(ruStatusToKind(statusRu) === "debt" &&
      first_due_date &&
      toYYYYMMDD(first_due_date)
        ? { first_due_date: toYYYYMMDD(first_due_date) }
        : {}),
    };
    const res = await api.post(`/main/clients/${clientId}/deals/`, payload);
    return normalizeDealFromApi(res);
  };

  const updateDealApi = async ({
    dealId,
    title,
    statusRu,
    amount,
    debt_months,
    first_due_date,
  }) => {
    const payload = {
      title: String(title || "").trim(),
      kind: ruStatusToKind(statusRu),
      amount: toDecimalString(amount),
      note: "",
      client: clientId,
      ...(ruStatusToKind(statusRu) === "debt" && Number(debt_months) > 0
        ? { debt_months: parseInt(debt_months, 10) }
        : {}),
      ...(ruStatusToKind(statusRu) === "debt" &&
      first_due_date &&
      toYYYYMMDD(first_due_date)
        ? { first_due_date: toYYYYMMDD(first_due_date) }
        : {}),
    };
    const res = await api.patch(
      `/main/clients/${clientId}/deals/${dealId}/`,
      payload
    );
    return normalizeDealFromApi(res);
  };

  const deleteDealApi = async (dealId) => {
    await api.delete(`/main/clients/${clientId}/deals/${dealId}/`);
  };

  const handleSave = async () => {
    if (!canSaveDeal) {
      onError?.(
        isDebtSelected
          ? "Заполните название, сумму и срок долга"
          : "Заполните название и корректную сумму"
      );
      return;
    }

    try {
      if (editingDeal) {
        const updated = await updateDealApi({
          dealId: editingDeal.id,
          title: dealName,
          statusRu: dealStatus,
          amount: dealBudget,
          debt_months: dealDebtMonths,
          first_due_date: dealFirstDueDate,
        });
        onSaved?.(updated);
      } else {
        const created = await createDealApi({
          title: dealName,
          statusRu: dealStatus,
          amount: dealBudget,
          debt_months: dealDebtMonths,
          first_due_date: dealFirstDueDate,
        });
        onSaved?.(created);
      }
      onClose?.();
    } catch (e) {
      console.error(e);
      onError?.(msgFromError(e, "Не удалось сохранить сделку"));
    }
  };

  const handleDelete = async () => {
    if (!editingDeal) return;
    const ok = window.confirm("Удалить сделку?");
    if (!ok) return;
    try {
      await deleteDealApi(editingDeal.id);
      onDeleted?.(editingDeal.id);
      onClose?.();
    } catch (e) {
      console.error(e);
      onError?.(msgFromError(e, "Не удалось удалить сделку"));
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <div
      className="deal-form-modal__overlay modal-overlay"
      onClick={handleClose}
    >
      <div
        className="deal-form-modal modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="deal-form-modal__header">
          <h3 className="deal-form-modal__title">
            {editingDeal ? "Редактировать сделку" : "Новая сделка"}
          </h3>
          <button
            className="deal-form-modal__close"
            onClick={handleClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="deal-form-modal__content">
          <div className="deal-form-modal__fields">
            <label className="deal-form-modal__field field">
              <span className="deal-form-modal__label">
                Название сделки <b className="req">*</b>
              </span>
              <input
                type="text"
                className="deal-form-modal__input"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Например: Продажа напитков"
              />
            </label>

            <label className="deal-form-modal__field field">
              <span className="deal-form-modal__label">
                Сумма <b className="req">*</b>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="deal-form-modal__input"
                value={dealBudget}
                onChange={(e) => setDealBudget(e.target.value)}
                onBlur={() => setDealBudget(toDecimalString(dealBudget))}
                placeholder="0.00"
              />
            </label>

            <label className="deal-form-modal__field field">
              <span className="deal-form-modal__label">
                Статус <b className="req">*</b>
              </span>
              <select
                className="deal-form-modal__input deal-form-modal__select"
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
              >
                <option>Продажа</option>
                <option>Долг</option>
                <option>Аванс</option>
                <option>Предоплата</option>
              </select>
            </label>

            {isDebtSelected && (
              <>
                <label className="deal-form-modal__field field">
                  <span className="deal-form-modal__label">
                    Срок долга (мес.) <b className="req">*</b>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    className="deal-form-modal__input"
                    value={dealDebtMonths}
                    onChange={(e) => setDealDebtMonths(e.target.value)}
                    onBlur={() => {
                      const n = parseInt(dealDebtMonths || "0", 10);
                      setDealDebtMonths(
                        Number.isFinite(n) && n > 0 ? String(n) : ""
                      );
                    }}
                    placeholder="Например: 6"
                  />
                </label>
                <label className="deal-form-modal__field field">
                  <span className="deal-form-modal__label">
                    Дата первого платежа
                  </span>
                  <input
                    type="date"
                    className="deal-form-modal__input"
                    value={dealFirstDueDate}
                    onChange={(e) => setDealFirstDueDate(e.target.value)}
                    placeholder="Выберите дату"
                  />
                  <div className="deal-form-modal__hint hint">
                    График платежей будет формироваться с этой даты (того же
                    числа каждого месяца)
                  </div>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="deal-form-modal__actions modal-actions">
          <button
            className="deal-form-modal__btn deal-form-modal__btn--primary btn btn--yellow"
            onClick={handleSave}
            disabled={!canSaveDeal}
            title={
              !canSaveDeal
                ? isDebtSelected
                  ? "Заполните название, сумму и срок долга"
                  : "Заполните название и сумму"
                : ""
            }
          >
            {editingDeal ? "Сохранить" : "Добавить"}
          </button>
          {editingDeal && (
            <button
              className="deal-form-modal__btn deal-form-modal__btn--danger btn btn--red"
              onClick={handleDelete}
            >
              Удалить
            </button>
          )}
          <button
            className="deal-form-modal__btn deal-form-modal__btn--secondary btn btn--ghost"
            onClick={handleClose}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
