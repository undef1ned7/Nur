/**
 * Окно «Отменить продажу / оформить возврат» (ТЗ №8).
 *
 * Продажа не удаляется: она тянет за собой абонентский график, начисление
 * зарплаты, приход в кассе и цифры аналитики. Удаление оставило бы всё это
 * «висеть», поэтому фиксируем отмену с причиной, а сервер откатывает
 * последствия одной транзакцией.
 */
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  CANCEL_REASONS,
  REFUND_MODES,
  cancelConsultingSale,
  refundConsultingSale,
} from "../../../../api/consultingSales";
import { fmtMoney, num } from "../common/listUtils";

const LEAD_ACTIONS = [
  { value: "return_to_work", label: "Вернуть лид в работу" },
  { value: "reject", label: "Пометить лид отказом" },
  { value: "", label: "Не трогать лид" },
];

export default function SaleCancelModal({ sale, onClose, onDone, onError }) {
  const total = num(sale?.total ?? sale?.service_price);

  const [mode, setMode] = useState("full"); // full | partial
  const [amount, setAmount] = useState(String(total || ""));
  const [reason, setReason] = useState(CANCEL_REASONS[0].value);
  const [comment, setComment] = useState("");
  const [refundMode, setRefundMode] = useState(REFUND_MODES[0].value);
  const [leadAction, setLeadAction] = useState("return_to_work");
  const [saving, setSaving] = useState(false);

  const isPartial = mode === "partial";

  const submit = async (e) => {
    e.preventDefault();
    if (reason === "other" && !comment.trim()) {
      onError?.("Для причины «Другое» нужен комментарий.");
      return;
    }
    if (isPartial) {
      const value = num(amount);
      if (value <= 0) {
        onError?.("Укажите сумму возврата больше нуля.");
        return;
      }
      if (total && value > total) {
        onError?.("Сумма возврата не может превышать сумму продажи.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        reason,
        comment: comment.trim(),
        refund_mode: refundMode,
      };
      if (isPartial) {
        await refundConsultingSale(sale.id, { ...payload, amount: num(amount) });
      } else {
        await cancelConsultingSale(sale.id, {
          ...payload,
          lead_action: leadAction || undefined,
        });
      }
      onDone?.();
    } catch (e2) {
      onError?.(
        e2?.detail ||
          "Не удалось отменить продажу. Проверьте права и повторите попытку.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sale__overlay" onClick={() => !saving && onClose()}>
      <div
        className="sale__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-cancel-title"
      >
        <div className="sale__modalHead">
          <h3 className="sale__modalTitle" id="sale-cancel-title">
            Отмена продажи
          </h3>
          <button
            type="button"
            className="sale__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="sale__cancelSummary">
          <div>
            <span className="sale__cancelLabel">Клиент</span>
            <b>{sale?.client_display || "—"}</b>
          </div>
          <div>
            <span className="sale__cancelLabel">Услуга</span>
            <b>{sale?.service_display || "—"}</b>
          </div>
          <div>
            <span className="sale__cancelLabel">Сумма</span>
            <b>{fmtMoney(total)}</b>
          </div>
        </div>

        <p className="sale__cancelNote">
          При отмене автоматически снимается абонентская плата клиента,
          аннулируются будущие платежи по долгу и рассрочке, отменяется
          начисление зарплаты продавцу, а в кассе оформляется возврат. Сумма
          уйдёт из выручки того периода, в котором была продажа.
        </p>

        <form className="sale__form" onSubmit={submit}>
          <div className="sale__field">
            <label className="sale__label">Что делаем</label>
            <div className="sale__segmented">
              <button
                type="button"
                className={`sale__segment${!isPartial ? " is-active" : ""}`}
                onClick={() => setMode("full")}
              >
                Полная отмена
              </button>
              <button
                type="button"
                className={`sale__segment${isPartial ? " is-active" : ""}`}
                onClick={() => setMode("partial")}
              >
                Частичный возврат
              </button>
            </div>
          </div>

          {isPartial && (
            <div className="sale__field">
              <label className="sale__label">Сумма возврата</label>
              <input
                className="cList__input"
                type="number"
                min="0"
                max={total || undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <small className="sale__hint">
                Начисление зарплаты уменьшится пропорционально возвращённой сумме.
              </small>
            </div>
          )}

          <div className="sale__field">
            <label className="sale__label">Причина</label>
            <select
              className="cList__input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sale__field">
            <label className="sale__label">Возврат денег клиенту</label>
            <select
              className="cList__input"
              value={refundMode}
              onChange={(e) => setRefundMode(e.target.value)}
            >
              {REFUND_MODES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {refundMode !== "none" && (
              <small className="sale__hint">
                В кассе появится расходная операция «Возврат клиенту» — её
                подтверждает ответственный за кассу.
              </small>
            )}
          </div>

          {!isPartial && (
            <div className="sale__field">
              <label className="sale__label">Что делать с лидом</label>
              <select
                className="cList__input"
                value={leadAction}
                onChange={(e) => setLeadAction(e.target.value)}
              >
                {LEAD_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <small className="sale__hint">
                Лид не должен оставаться «выигранным» при отменённой продаже.
              </small>
            </div>
          )}

          <div className="sale__field">
            <label className="sale__label">
              Комментарий{reason === "other" ? "" : " (необязательно)"}
            </label>
            <textarea
              className="cList__input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="sale__formActions">
            <button
              type="button"
              className="sale__btn"
              onClick={onClose}
              disabled={saving}
            >
              Закрыть
            </button>
            <button
              type="submit"
              className="sale__btn sale__btn--danger"
              disabled={saving}
            >
              {saving
                ? "Выполняется…"
                : isPartial
                  ? "Оформить возврат"
                  : "Отменить продажу"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
