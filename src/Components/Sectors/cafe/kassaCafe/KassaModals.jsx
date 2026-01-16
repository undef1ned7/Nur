import React from "react";

/* helpers */
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

/* ───────────────────────────────────────────────── */
/* Row: используй внутри модалок (чтобы не плодить инлайны) */
const Row = ({ label, value }) => (
  <div className="kassa-modal__row">
    <div className="kassa-modal__rowLabel">{label}</div>
    <div className="kassa-modal__rowValue">{value || "—"}</div>
  </div>
);

/* ───────────────────────────────────────────────── */
/* Модалка: создание кассы */
export const CreateCashboxModal = ({
  open,
  name,
  onNameChange,
  onClose,
  onSave,
}) => {
  if (!open) return null;

  return (
    <div className="kassa-modal">
      <div className="kassa-modal__overlay" onClick={onClose} />
      <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="kassa-modal__header">
          <h3 className="kassa-modal__title">Создать кассу</h3>
          <button
            className="kassa-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="kassa-modal__section">
          <label className="kassa-modal__label">Название кассы *</label>
          <input
            className="kassa-modal__input"
            type="text"
            placeholder="Например: касса №1"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
          />
        </div>

        <div className="kassa-modal__footer">
          <button
            className="kassa__btn kassa__btn--primary"
            onClick={onSave}
            type="button"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

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
      ? "kassa-modal__pill kassa-modal__pill--income"
      : "kassa-modal__pill kassa-modal__pill--expense";

  return (
    <div className="kassa-modal" onClick={onClose}>
      <div className="kassa-modal__overlay" />
      <div className="kassa-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="kassa-modal__header">
          <h3 className="kassa-modal__title kassa-modal__title--row">
            <span className={pillClass}>
              {op.type === "income" ? "ПРИХОД" : "РАСХОД"}
            </span>
            <span className="kassa-modal__amount">{money(op.amount)}</span>
          </h3>

          <button
            className="kassa-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="kassa-modal__section kassa-modal__grid">
          <div className="kassa-modal__box">
            <div className="kassa-modal__boxTitle">Общее</div>
            <Row label="Наименование" value={op.title || "—"} />
            <Row label="Дата/время" value={whenDT(op.created_at)} />
            <Row label="Касса" value={cashboxTitle || "—"} />
            {opDetail?.category && <Row label="Категория" value={opDetail.category} />}
            {opDetail?.method && <Row label="Способ оплаты" value={opDetail.method} />}
            {opDetail?.userName && <Row label="Кассир" value={opDetail.userName} />}
          </div>

          {(opDetail?.orderId || opDetail?.tableLabel || opDetail?.zoneTitle) && (
            <div className="kassa-modal__box">
              <div className="kassa-modal__boxTitle">Источник</div>
              {opDetail.orderId && <Row label="Заказ" value={`#${opDetail.orderId}`} />}
              {opDetail.tableLabel && <Row label="Стол" value={opDetail.tableLabel} />}
              {opDetail.zoneTitle && <Row label="Зона" value={opDetail.zoneTitle} />}
            </div>
          )}

          {(opLoading || opDetail?.clientName || opDetail?.clientPhone) && (
            <div className="kassa-modal__box">
              <div className="kassa-modal__boxTitle">Клиент</div>
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
            <div className="kassa-modal__box">
              <div className="kassa-modal__boxTitle">Примечание</div>
              <div>{opDetail.comment}</div>
            </div>
          )}
        </div>

        <div className="kassa-modal__footer">
          <button className="kassa__btn" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
