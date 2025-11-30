export const NewDebtModal = ({
  open,
  fullName,
  setFullName,
  phone,
  setPhone,
  amount,
  setAmount,
  dueDate,
  setDueDate,
  formErr,
  savingNew,
  onClose,
  onSubmit,
}) => {
  if (!open) return null;

  return (
    <div className="catalog__overlay" onClick={onClose}>
      <div
        className="catalog__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-new-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catalog__modalTitle" id="debt-new-title">
          Новый долг
        </div>

        {formErr && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#b91c1c",
              borderRadius: 10,
              padding: "8px 10px",
              marginBottom: 10,
              fontSize: 13,
            }}
          >
            {formErr}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <input
            className="catalog__input"
            placeholder="Имя *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
          />
          <input
            className="catalog__input"
            placeholder="Телефон * (только цифры, уникальный)"
            inputMode="numeric"
            pattern="\d*"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className="catalog__input"
            placeholder="Сумма долга * (только цифры)"
            inputMode="numeric"
            pattern="\d*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className="catalog__input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            title="Дата возврата долга (необязательно)"
          />

          <div className="catalog__modalActions" style={{ gap: 10 }}>
            <button
              type="button"
              className="catalog__btn"
              onClick={onClose}
              disabled={savingNew}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="catalog__btn catalog__btn--primary"
              disabled={savingNew}
            >
              {savingNew ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
