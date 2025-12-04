export const PayDebtModal = ({
  open,
  payAmt,
  setPayAmt,
  payErr,
  savingPay,
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
        aria-labelledby="debt-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catalog__modalTitle" id="debt-pay-title">
          Оплатить (уменьшить долг)
        </div>

        {payErr && (
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
            {payErr}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <input
            className="catalog__input"
            placeholder="Сумма оплаты (только цифры)"
            inputMode="numeric"
            pattern="\d*"
            value={payAmt}
            onChange={(e) => setPayAmt(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <div className="catalog__modalActions" style={{ gap: 10 }}>
            <button
              type="button"
              className="catalog__btn"
              onClick={onClose}
              disabled={savingPay}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="catalog__btn catalog__btn--primary"
              disabled={savingPay}
            >
              {savingPay ? "Провожу…" : "Оплатить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
