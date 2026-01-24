import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import api from "../../../../../api";

/* helpers */
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const sanitizeDecimalInput = (value) => {
  const raw = String(value ?? "").replace(",", ".");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

/* ───────────────────────────────────────────────── */
/* Row: используй внутри модалок (чтобы не плодить инлайны) */
const Row = ({ label, value }) => (
  <div className="cafeKassa__row">
    <div className="cafeKassa__rowLabel">{label}</div>
    <div className="cafeKassa__rowValue">{value || "—"}</div>
  </div>
);

/* ───────────────────────────────────────────────── */
/* Модалка: детали операции */
export const OperationDetailsModal = ({
  open,
  op,
  opDetail,
  opLoading,
  cashboxTitle,
  onClose,
}) => {
  if (!open || !op) return null;

  const pillClass =
    op.type === "income"
      ? "cafeKassa__pill cafeKassa__pill--income"
      : "cafeKassa__pill cafeKassa__pill--expense";

  return (
    <div className="cafeKassa__modalOverlay" onClick={onClose}>
      <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle cafeKassa__modalTitle--row">
            <span className={pillClass}>
              {op.type === "income" ? "ПРИХОД" : "РАСХОД"}
            </span>
            <span className="cafeKassa__amount">{money(op.amount)}</span>
          </h3>

          <button
            className="cafeKassa__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="cafeKassa__form cafeKassa__form--grid">
          <div className="cafeKassa__box">
            <div className="cafeKassa__boxTitle">Общее</div>
            <Row label="Наименование" value={op.title || "—"} />
            <Row label="Дата/время" value={whenDT(op.created_at)} />
            <Row label="Касса" value={cashboxTitle || "—"} />
            {opDetail?.category && <Row label="Категория" value={opDetail.category} />}
            {opDetail?.method && <Row label="Способ оплаты" value={opDetail.method} />}
            {opDetail?.userName && <Row label="Кассир" value={opDetail.userName} />}
          </div>

          {(opDetail?.orderId || opDetail?.tableLabel || opDetail?.zoneTitle) && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Источник</div>
              {opDetail.orderId && <Row label="Заказ" value={`#${opDetail.orderId}`} />}
              {opDetail.tableLabel && <Row label="Стол" value={opDetail.tableLabel} />}
              {opDetail.zoneTitle && <Row label="Зона" value={opDetail.zoneTitle} />}
            </div>
          )}

          {(opLoading || opDetail?.clientName || opDetail?.clientPhone) && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Клиент</div>
              {opLoading ? (
                <div>Загрузка данных…</div>
              ) : (
                <>
                  {opDetail?.clientName && <Row label="Имя" value={opDetail.clientName} />}
                  {opDetail?.clientPhone && <Row label="Телефон" value={opDetail.clientPhone} />}
                </>
              )}
            </div>
          )}

          {opDetail?.comment && (
            <div className="cafeKassa__box">
              <div className="cafeKassa__boxTitle">Примечание</div>
              <div>{opDetail.comment}</div>
            </div>
          )}
        </div>

        <div className="cafeKassa__formActions">
          <button className="cafeKassa__btn" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────── */
/* Модалка: добавление расхода/прихода */
export const AddOperationModal = ({
  open,
  cashboxId,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState({
    name: "",
    amount: "",
    type: "expense",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = (form.name || "").trim();
    const amt = Number(form.amount?.replace(",", ".")) || 0;

    if (!title) {
      setError("Введите наименование операции");
      return;
    }

    if (amt <= 0) {
      setError("Введите сумму больше нуля");
      return;
    }

    if (!cashboxId) {
      setError("Не указана касса");
      return;
    }

    try {
      setError("");
      setLoading(true);

      await api.post("/construction/cashflows/", {
        cashbox: cashboxId,
        type: form.type,
        name: title,
        amount: amt,
      });

      setForm({ name: "", amount: "", type: "expense" });
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setError("Не удалось добавить операцию. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setForm({ name: "", amount: "", type: "expense" });
      setError("");
      onClose();
    }
  };

  return (
    <div className="cafeKassa__modalOverlay" onClick={handleClose}>
      <div className="cafeKassa__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeKassa__modalHeader">
          <h3 className="cafeKassa__modalTitle">Добавить операцию</h3>
          <button
            className="cafeKassa__iconBtn"
            onClick={handleClose}
            aria-label="Закрыть"
            type="button"
            disabled={loading}
          >
            <FaTimes />
          </button>
        </div>

        <form className="cafeKassa__form" onSubmit={handleSubmit}>
          {error && (
            <div className="cafeKassa__alert cafeKassa__alert--error">
              {error}
            </div>
          )}

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Тип операции *</label>
            <div className="cafeKassa__switch" style={{ margin: 0 }}>
              <button
                type="button"
                className={`cafeKassa__chip ${form.type === "expense" ? "cafeKassa__chip--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
                disabled={loading}
              >
                Расход
              </button>
              <button
                type="button"
                className={`cafeKassa__chip ${form.type === "income" ? "cafeKassa__chip--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: "income" }))}
                disabled={loading}
              >
                Приход
              </button>
            </div>
          </div>

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Наименование *</label>
            <input
              className="cafeKassa__input"
              type="text"
              placeholder="Введите наименование операции"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={loading}
            />
          </div>

          <div className="cafeKassa__field">
            <label className="cafeKassa__label">Сумма (сом) *</label>
            <input
              className="cafeKassa__input"
              type="text"
              inputMode="decimal"
              placeholder="Введите сумму"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amount: sanitizeDecimalInput(e.target.value),
                }))
              }
              required
              disabled={loading}
            />
          </div>

          <div className="cafeKassa__formActions">
            <button
              type="button"
              className="cafeKassa__btn"
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cafeKassa__btn cafeKassa__btn--primary"
              disabled={loading}
            >
              {loading ? "Добавление..." : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
