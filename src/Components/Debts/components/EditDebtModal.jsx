export const EditDebtModal = ({
  open,
  eFullName,
  setEFullName,
  ePhone,
  setEPhone,
  eAmount,
  setEAmount,
  eDueDate,
  setEDueDate,
  editErr,
  savingEdit,
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
        aria-labelledby="debt-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catalog__modalTitle" id="debt-edit-title">
          Изменить долг
        </div>

        {editErr && (
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
            {editErr}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <input
            className="catalog__input"
            placeholder="Имя *"
            value={eFullName}
            onChange={(e) => setEFullName(e.target.value)}
            autoFocus
          />
          <input
            className="catalog__input"
            placeholder="Телефон * (только цифры)"
            inputMode="numeric"
            pattern="\d*"
            value={ePhone}
            onChange={(e) => setEPhone(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className="catalog__input"
            placeholder="Сумма долга * (только цифры)"
            inputMode="numeric"
            pattern="\d*"
            value={eAmount}
            onChange={(e) => setEAmount(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className="catalog__input"
            type="date"
            value={eDueDate}
            onChange={(e) => setEDueDate(e.target.value)}
            title="Дата возврата долга (необязательно)"
          />

          <div className="catalog__modalActions" style={{ gap: 10 }}>
            <button
              type="button"
              className="catalog__btn"
              onClick={onClose}
              disabled={savingEdit}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="catalog__btn catalog__btn--primary"
              disabled={savingEdit}
            >
              {savingEdit ? "Сохранение…" : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
