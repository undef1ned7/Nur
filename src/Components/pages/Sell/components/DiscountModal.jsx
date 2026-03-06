import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";

const DiscountModal = ({
  show,
  onClose,
  discountValue,
  setDiscountValue,
  currentSubtotal,
  onApply,
}) => {
  if (!show) return null;

  return (
    <UniversalModal
      onClose={() => {
        onClose();
        setDiscountValue("");
      }}
      title={"Общая скидка"}
    >
      <div className="start__discount min-w-75">
        <div>
          <label>Сумма скидки</label>
          <input
            className="sell__header-input"
            type="number"
            min="0"
            step="0.01"
            onFocus={(e) => {
              if (e.target.value <= 0) {
                setDiscountValue("");
              }
            }}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value.replace(/\D/g, ""))}
            placeholder="Введите сумму скидки"
            autoFocus
          />
          {currentSubtotal && (
            <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              Сумма без скидки: {currentSubtotal}
            </p>
          )}
        </div>
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            columnGap: "10px",
            justifyContent: "end",
          }}
        >
          <button
            className="sell__reset"
            type="button"
            onClick={() => {
              onClose();
              setDiscountValue("");
            }}
          >
            Отмена
          </button>
          <button
            className="start__total-pay"
            style={{ width: "auto" }}
            type="button"
            onClick={() => {
              const discount =
                discountValue.trim() === "" ? "0" : discountValue;
              onApply(discount);
              onClose();
              setDiscountValue("");
            }}
          >
            Применить
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

export default DiscountModal;
