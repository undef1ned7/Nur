import { useContext, useEffect, useMemo, useState } from "react";
import { Handshake, X, Trash2, Info } from "lucide-react";
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
import { ThemeModeContext } from "../../../../../theme/ThemeModeProvider";
import "../ClientModals.redesign.scss";

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
  const { mode } = useContext(ThemeModeContext);
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
    <div className="cmx__overlay" data-theme={mode} onClick={() => onClose?.()}>
      <div
        className="cmx__dialog cmx__dialog--md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cmx__header">
          <div className="cmx__heading">
            <span className="cmx__heading-icon">
              <Handshake />
            </span>
            <div className="cmx__heading-text">
              <h3 className="cmx__title">
                {editingDeal ? "Редактировать сделку" : "Новая сделка"}
              </h3>
              <p className="cmx__subtitle">
                {editingDeal
                  ? "Измените параметры сделки клиента"
                  : "Заполните данные новой сделки"}
              </p>
            </div>
          </div>
          <button
            className="cmx__close"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            <X />
          </button>
        </div>

        <div className="cmx__body">
          {paymentsExist && (
            <div className="cmx__note">
              <Info />
              <span>
                По сделке уже есть платежи — можно изменить только название и
                комментарий.
              </span>
            </div>
          )}

          <div className="cmx__grid">
            <label className="cmx__field cmx__field--full">
              <span className="cmx__label">
                Название сделки <b className="cmx__req">*</b>
              </span>
              <input
                type="text"
                className="cmx__input"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Например: Продажа напитков"
              />
            </label>

            {!paymentsExist && (
              <>
                <label className="cmx__field">
                  <span className="cmx__label">
                    Сумма <b className="cmx__req">*</b>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="cmx__input"
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

                <label className="cmx__field">
                  <span className="cmx__label">
                    Тип <b className="cmx__req">*</b>
                  </span>
                  <select
                    className="cmx__select"
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
                <label className="cmx__field">
                  <span className="cmx__label">
                    Срок долга (дней) <b className="cmx__req">*</b>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    className="cmx__input"
                    value={dealDebtDays}
                    onChange={(e) => setDealDebtDays(e.target.value)}
                    placeholder="Например: 30"
                  />
                </label>

                <label className="cmx__field">
                  <span className="cmx__label">Предоплата</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="cmx__input"
                    value={dealPrepayment}
                    onChange={(e) => setDealPrepayment(e.target.value)}
                    onBlur={() =>
                      setDealPrepayment(toDecimalString(dealPrepayment))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label className="cmx__field cmx__field--full">
                  <span className="cmx__label">Дата первого платежа</span>
                  <input
                    type="date"
                    className="cmx__input"
                    value={dealFirstDueDate}
                    onChange={(e) => setDealFirstDueDate(e.target.value)}
                  />
                  <span className="cmx__hint">
                    Если не указана — сегодня + срок в днях
                  </span>
                </label>
              </>
            )}

            {!paymentsExist && isPrepaymentSelected && (
              <label className="cmx__field cmx__field--full">
                <span className="cmx__label">Сумма предоплаты</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="cmx__input"
                  value={dealPrepayment}
                  onChange={(e) => setDealPrepayment(e.target.value)}
                  onBlur={() =>
                    setDealPrepayment(
                      toDecimalString(dealPrepayment || dealBudget)
                    )
                  }
                  placeholder={toDecimalString(dealBudget)}
                />
              </label>
            )}

            <label className="cmx__field cmx__field--full">
              <span className="cmx__label">Комментарий</span>
              <textarea
                className="cmx__textarea"
                rows={2}
                value={dealNote}
                onChange={(e) => setDealNote(e.target.value)}
                placeholder="Необязательно"
              />
            </label>
          </div>
        </div>

        <div className="cmx__footer">
          <div className="cmx__footer-left">
            {editingDeal && (
              <button
                className="cmx__btn cmx__btn--danger"
                onClick={handleDelete}
              >
                <Trash2 /> Удалить
              </button>
            )}
          </div>
          <div className="cmx__footer-right">
            <button
              className="cmx__btn cmx__btn--ghost"
              onClick={() => onClose?.()}
            >
              Отмена
            </button>
            <button
              className="cmx__btn cmx__btn--primary"
              onClick={handleSave}
              disabled={!canSaveDeal}
            >
              {editingDeal ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
