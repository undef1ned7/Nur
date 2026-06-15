import { useEffect, useMemo, useState } from "react";
import {
  toDecimalString,
  ruStatusToKind,
  kindToRu,
  toYYYYMMDD,
  msgFromError,
  normalizeDealFromApi,
  buildDealPayload,
  dealHasPayments,
} from "../clientDetails.helpers";
import api from "../../../../../api";
import { useConfirm } from "../../../../../hooks/useDialog";

export default function DealFormModal({
  open,
  clientId,
  editingDeal,
  onClose,
  onSaved,
  onDeleted,
  onError,
}) {
  const confirm = useConfirm();
  const [dealName, setDealName] = useState("");
  const [dealBudget, setDealBudget] = useState("");
  const [dealStatus, setDealStatus] = useState("Продажа");
  const [dealDebtDays, setDealDebtDays] = useState("");
  const [dealPrepayment, setDealPrepayment] = useState("");
  const [dealFirstDueDate, setDealFirstDueDate] = useState("");
  const [dealNote, setDealNote] = useState("");

  const paymentsExist = useMemo(
    () => dealHasPayments(editingDeal),
    [editingDeal],
  );

  useEffect(() => {
    if (!open) return;
    if (editingDeal) {
      setDealName(editingDeal.title || "");
      setDealBudget(
        editingDeal.amount !== undefined && editingDeal.amount !== null
          ? String(editingDeal.amount)
          : "",
      );
      setDealStatus(kindToRu(editingDeal.kind));
      setDealDebtDays(
        editingDeal.debt_days != null
          ? String(editingDeal.debt_days)
          : editingDeal.debt_months != null
            ? String(Number(editingDeal.debt_months) * 30)
            : "",
      );
      setDealPrepayment(
        editingDeal.prepayment != null ? String(editingDeal.prepayment) : "",
      );
      setDealFirstDueDate(
        editingDeal.first_due_date
          ? toYYYYMMDD(editingDeal.first_due_date)
          : "",
      );
      setDealNote(editingDeal.note || "");
    } else {
      setDealName("");
      setDealBudget("");
      setDealStatus("Продажа");
      setDealDebtDays("");
      setDealPrepayment("");
      setDealFirstDueDate("");
      setDealNote("");
    }
  }, [open, editingDeal]);

  const dealKind = ruStatusToKind(dealStatus);
  const isDebtSelected = dealKind === "debt";
  const isPrepaymentSelected = dealKind === "prepayment";

  const canSaveDeal =
    String(dealName).trim().length >= 1 &&
    Number(toDecimalString(dealBudget)) >= 0 &&
    !!clientId &&
    (paymentsExist || !isDebtSelected || Number(dealDebtDays) >= 1);

  if (!open || !clientId) return null;

  const createDealApi = async (form) => {
    const payload = buildDealPayload({
      ...form,
      clientId,
      forCreate: true,
      paymentsExist: false,
    });
    const res = await api.post(`/main/clients/${clientId}/deals/`, payload);
    return normalizeDealFromApi(res);
  };

  const updateDealApi = async (form) => {
    const payload = buildDealPayload({
      ...form,
      paymentsExist,
    });
    const res = await api.patch(
      `/main/clients/${clientId}/deals/${form.dealId}/`,
      payload,
    );
    return normalizeDealFromApi(res);
  };

  const deleteDealApi = async (dealId) => {
    await api.delete(`/main/clients/${clientId}/deals/${dealId}/`);
  };

  const handleSave = async () => {
    if (!canSaveDeal) {
      onError?.(
        isDebtSelected && !paymentsExist
          ? "Заполните название, сумму и срок долга (дней)"
          : "Заполните название и корректную сумму",
      );
      return;
    }

    const form = {
      title: dealName,
      statusRu: dealStatus,
      amount: dealBudget,
      debt_days: dealDebtDays,
      prepayment: dealPrepayment,
      first_due_date: dealFirstDueDate,
      note: dealNote,
    };

    try {
      if (editingDeal) {
        const updated = await updateDealApi({
          ...form,
          dealId: editingDeal.id,
        });
        onSaved?.(updated);
      } else {
        const created = await createDealApi(form);
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
    confirm("Удалить сделку?", async (ok) => {
      if (!ok) return;
      try {
        await deleteDealApi(editingDeal.id);
        onDeleted?.(editingDeal.id);
        onClose?.();
      } catch (e) {
        console.error(e);
        onError?.(msgFromError(e, "Не удалось удалить сделку"));
      }
    });
  };

  return (
    <div
      className="deal-form-modal__overlay modal-overlay"
      onClick={() => onClose?.()}
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
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="deal-form-modal__content">
          {paymentsExist && (
            <div className="deal-form-modal__hint hint">
              По сделке уже есть платежи — можно изменить только название и
              комментарий.
            </div>
          )}

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

            {!paymentsExist && (
              <>
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
                    onFocus={() => {
                      if (
                        toDecimalString(dealBudget) === "0.00" ||
                        toDecimalString(dealBudget) === "0"
                      ) {
                        setDealBudget("");
                      }
                    }}
                  />
                </label>

                <label className="deal-form-modal__field field">
                  <span className="deal-form-modal__label">
                    Тип <b className="req">*</b>
                  </span>
                  <select
                    className="deal-form-modal__input deal-form-modal__select"
                    value={dealStatus}
                    onChange={(e) => setDealStatus(e.target.value)}
                  >
                    <option>Продажа</option>
                    <option>Долг</option>
                    <option>Предоплата</option>
                  </select>
                </label>
              </>
            )}

            {!paymentsExist && isDebtSelected && (
              <>
                <label className="deal-form-modal__field field">
                  <span className="deal-form-modal__label">
                    Срок долга (дней) <b className="req">*</b>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    className="deal-form-modal__input"
                    value={dealDebtDays}
                    onChange={(e) => setDealDebtDays(e.target.value)}
                    placeholder="Например: 30"
                  />
                </label>

                <label className="deal-form-modal__field field">
                  <span className="deal-form-modal__label">Предоплата</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="deal-form-modal__input"
                    value={dealPrepayment}
                    onChange={(e) => setDealPrepayment(e.target.value)}
                    onBlur={() =>
                      setDealPrepayment(toDecimalString(dealPrepayment))
                    }
                    placeholder="0.00"
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
                  />
                  <div className="deal-form-modal__hint hint">
                    Если не указана — сегодня + срок в днях
                  </div>
                </label>
              </>
            )}

            {!paymentsExist && isPrepaymentSelected && (
              <label className="deal-form-modal__field field">
                <span className="deal-form-modal__label">Сумма предоплаты</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="deal-form-modal__input"
                  value={dealPrepayment}
                  onChange={(e) => setDealPrepayment(e.target.value)}
                  onBlur={() =>
                    setDealPrepayment(toDecimalString(dealPrepayment || dealBudget))
                  }
                  placeholder={toDecimalString(dealBudget)}
                />
              </label>
            )}

            <label className="deal-form-modal__field field">
              <span className="deal-form-modal__label">Комментарий</span>
              <textarea
                className="deal-form-modal__input"
                rows={2}
                value={dealNote}
                onChange={(e) => setDealNote(e.target.value)}
                placeholder="Необязательно"
              />
            </label>
          </div>
        </div>

        <div className="deal-form-modal__actions modal-actions">
          <button
            className="deal-form-modal__btn deal-form-modal__btn--primary btn btn--yellow"
            onClick={handleSave}
            disabled={!canSaveDeal}
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
            onClick={() => onClose?.()}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
