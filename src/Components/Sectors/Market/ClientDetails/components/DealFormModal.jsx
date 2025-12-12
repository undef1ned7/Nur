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
    <div className="modal-overlay">
      <div className="modal">
        <h3>{editingDeal ? "Редактировать сделку" : "Новая сделка"}</h3>

        <label className="field">
          <span>
            Название сделки <b className="req">*</b>
          </span>
          <input
            type="text"
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
            placeholder="Например: Продажа напитков"
          />
        </label>

        <label className="field">
          <span>
            Сумма <b className="req">*</b>
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={dealBudget}
            onChange={(e) => setDealBudget(e.target.value)}
            onBlur={() => setDealBudget(toDecimalString(dealBudget))}
            placeholder="0.00"
          />
        </label>

        <label className="field">
          <span>
            Статус <b className="req">*</b>
          </span>
          <select
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
            <label className="field">
              <span>
                Срок долга (мес.) <b className="req">*</b>
              </span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
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
            <label className="field">
              <span>Дата первого платежа</span>
              <input
                type="date"
                value={dealFirstDueDate}
                onChange={(e) => setDealFirstDueDate(e.target.value)}
                placeholder="Выберите дату"
              />
              <div className="hint">
                График платежей будет формироваться с этой даты (того же числа
                каждого месяца)
              </div>
            </label>
          </>
        )}

        <div className="modal-actions" style={{ flexWrap: "wrap" }}>
          <button
            className="btn btn--yellow"
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
            <button className="btn btn--red" onClick={handleDelete}>
              Удалить
            </button>
          )}
          <button className="btn btn--ghost" onClick={handleClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
