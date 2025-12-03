import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";

// Модалка выбора способа оплаты
export const PaymentChoiceModal = ({
  show,
  onClose,
  paymentChoice,
  setPaymentChoice,
  onConfirm,
}) => {
  if (!show) return null;

  return (
    <UniversalModal onClose={onClose} title={"Выбор способа оплаты"}>
      <div
        style={{
          width: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <p style={{ fontSize: "14px", color: "#555" }}>
          Нажмите стрелку влево для выбора оплаты <b>наличными</b>, стрелку
          вправо — для оплаты <b>переводом</b>. Enter — подтвердить.
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => setPaymentChoice("cash")}
            className={`start__total-pay ${
              paymentChoice === "cash" ? "active" : ""
            }`}
            style={{
              flex: 1,
              border:
                paymentChoice === "cash" ? "2px solid #000" : "1px solid #ddd",
              backgroundColor: paymentChoice === "cash" ? "#f7d617" : "#f3f4f6",
            }}
          >
            Наличными (←)
          </button>
          <button
            type="button"
            onClick={() => setPaymentChoice("card")}
            className={`start__total-pay ${
              paymentChoice === "card" ? "active" : ""
            }`}
            style={{
              flex: 1,
              border:
                paymentChoice === "card" ? "2px solid #000" : "1px solid #ddd",
              backgroundColor: paymentChoice === "card" ? "#f7d617" : "#f3f4f6",
            }}
          >
            Переводом (→)
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button type="button" className="sell__reset" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="start__total-pay"
            style={{ width: "auto" }}
            onClick={onConfirm}
          >
            Подтвердить (Enter)
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

// Модалка оплаты наличными
export const CashModal = ({
  show,
  onClose,
  currentTotal,
  cashReceived,
  setCashReceived,
  cashPaymentConfirmed,
  setCashPaymentConfirmed,
  setPaymentMethod,
  onPay,
  setAlert,
}) => {
  if (!show) return null;

  return (
    <UniversalModal
      onClose={() => {
        if (!cashPaymentConfirmed) {
          setCashReceived("");
          setPaymentMethod(null);
        }
        setCashPaymentConfirmed(false);
        onClose();
      }}
      title={"Оплата наличными"}
    >
      <div className="start__cash-payment" style={{ width: "400px" }}>
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            К оплате: {currentTotal} сом
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 500,
            }}
          >
            Сумма от покупателя
          </label>
          <input
            type="text"
            value={cashReceived}
            onChange={(e) => {
              let value = e.target.value;
              // Заменяем запятую на точку для единообразия
              value = value.replace(/,/g, ".");
              // Удаляем все символы кроме цифр и точки
              value = value.replace(/[^\d.]/g, "");
              // Удаляем лишние точки (оставляем только первую)
              const parts = value.split(".");
              if (parts.length > 2) {
                value = parts[0] + "." + parts.slice(1).join("");
              }
              // Ограничиваем до 2 знаков после запятой
              if (parts.length === 2 && parts[1].length > 2) {
                value = parts[0] + "." + parts[1].substring(0, 2);
              }
              setCashReceived(value);
            }}
            placeholder="Введите сумму"
            className="sell__header-input"
            style={{ width: "100%" }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const normalizedValue = cashReceived.replace(/,/g, ".");
                const received = parseFloat(normalizedValue) || 0;
                const total =
                  parseFloat(String(currentTotal).replace(/,/g, ".")) || 0;
                if (received >= total && received > 0) {
                  onPay();
                } else {
                  setAlert({
                    open: true,
                    type: "error",
                    message: `Недостаточно средств. К оплате: ${total.toFixed(
                      2
                    )} сом`,
                  });
                }
              }
            }}
          />
        </div>
        {cashReceived &&
          (() => {
            const normalizedReceived = cashReceived.replace(/,/g, ".");
            const normalizedTotal = String(currentTotal).replace(/,/g, ".");
            const received = parseFloat(normalizedReceived) || 0;
            const total = parseFloat(normalizedTotal) || 0;
            return (
              received > 0 && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "15px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span>Получено:</span>
                    <span style={{ fontWeight: 600 }}>
                      {received.toFixed(2)} сом
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span>К оплате:</span>
                    <span style={{ fontWeight: 600 }}>
                      {total.toFixed(2)} сом
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "10px",
                      borderTop: "2px solid #ddd",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: received >= total ? "#22c55e" : "#ef4444",
                    }}
                  >
                    <span>Сдача:</span>
                    <span>{(received - total).toFixed(2)} сом</span>
                  </div>
                  {received < total && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "8px",
                        backgroundColor: "#fee2e2",
                        color: "#b42318",
                        borderRadius: "4px",
                        fontSize: "14px",
                        textAlign: "center",
                      }}
                    >
                      Недостаточно средств
                    </div>
                  )}
                </div>
              )
            );
          })()}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="sell__reset"
            type="button"
            onClick={() => {
              setCashReceived("");
              setPaymentMethod(null);
              setCashPaymentConfirmed(false);
              onClose();
            }}
          >
            Отмена
          </button>
          <button
            className="start__total-pay"
            style={{ width: "auto" }}
            type="button"
            onClick={onPay}
            disabled={(() => {
              if (!cashReceived) return true;
              const normalizedReceived = cashReceived.replace(/,/g, ".");
              const normalizedTotal = String(currentTotal).replace(/,/g, ".");
              const received = parseFloat(normalizedReceived) || 0;
              const total = parseFloat(normalizedTotal) || 0;
              return received < total || received <= 0;
            })()}
          >
            Оплатить
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

// Модалка выбора чека
export const ReceiptChoiceModal = ({
  show,
  onClose,
  receiptWithCheck,
  setReceiptWithCheck,
  paymentMethod,
  onConfirm,
}) => {
  if (!show) return null;

  return (
    <UniversalModal onClose={onClose} title={"Продажа с чеком или без"}>
      <div
        style={{
          width: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <p style={{ fontSize: "14px", color: "#555" }}>
          Выберите, как провести оплату: <b>с печатью чека</b> или
          <b> без чека</b>. Enter подтвердит текущий выбор.
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => setReceiptWithCheck(true)}
            className={`start__total-pay ${receiptWithCheck ? "active" : ""}`}
            style={{
              flex: 1,
              border: receiptWithCheck ? "2px solid #000" : "1px solid #ddd",
              backgroundColor: receiptWithCheck ? "#f7d617" : "#f3f4f6",
            }}
          >
            С чеком (←)
          </button>
          <button
            type="button"
            onClick={() => setReceiptWithCheck(false)}
            className={`start__total-pay ${!receiptWithCheck ? "active" : ""}`}
            style={{
              flex: 1,
              border: !receiptWithCheck ? "2px solid #000" : "1px solid #ddd",
              backgroundColor: !receiptWithCheck ? "#f7d617" : "#f3f4f6",
            }}
          >
            Без чека (→)
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button type="button" className="sell__reset" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="start__total-pay"
            style={{ width: "auto" }}
            onClick={onConfirm}
          >
            Подтвердить (Enter)
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};
