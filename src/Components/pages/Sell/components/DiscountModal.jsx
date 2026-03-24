import { useCallback, useEffect } from "react";
import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";

const DiscountModal = ({
  show,
  onClose,
  discountValue,
  setDiscountValue,
  currentSubtotal,
  onApply,
  mode = "amount", // "amount" | "percent"
  setMode, // опционально, если нужно менять режим из модалки
}) => {
  const handleClose = useCallback(() => {
    onClose();
    setDiscountValue("");
  }, [onClose, setDiscountValue]);

  const handleApply = useCallback(() => {
    const discount = String(discountValue || "").trim() === "" ? "0" : discountValue;
    onApply(discount);
    onClose();
    setDiscountValue("");
  }, [discountValue, onApply, onClose, setDiscountValue]);

  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, handleClose, handleApply]);

  if (!show) return null;

  return (
    <UniversalModal
      onClose={handleClose}
      title={"Общая скидка"}
    >
      <div className="start__discount min-w-75">
        <div style={{ marginBottom: "10px", display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={`sell__reset ${
              mode === "amount" ? "start__total-pay" : ""
            }`}
            onClick={() => setMode && setMode("amount")}
          >
            Сумма
          </button>
          <button
            type="button"
            className={`sell__reset ${
              mode === "percent" ? "start__total-pay" : ""
            }`}
            onClick={() => setMode && setMode("percent")}
          >
            Процент
          </button>
        </div>
        <div>
          <label>{mode === "percent" ? "Скидка, %" : "Сумма скидки"}</label>
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
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={
              mode === "percent"
                ? "Введите скидку в %"
                : "Введите сумму скидки"
            }
            autoFocus
          />
          {currentSubtotal && mode === "amount" && (
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
            onClick={handleClose}
          >
            Отмена
          </button>
          <button
            className="start__total-pay"
            style={{ width: "auto" }}
            type="button"
            onClick={handleApply}
          >
            Применить
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

export default DiscountModal;
