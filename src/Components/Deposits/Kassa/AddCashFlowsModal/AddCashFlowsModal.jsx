import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useDispatch } from "react-redux";

const AddCashFlowsModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    cashbox: "",
    // is_consumption: true,
    type: "expense", // Дефолтный тип для новой операции
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, []);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !newCashbox.cashbox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setNewCashbox((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, newCashbox.cashbox]);

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows(newCashbox));

      onClose();
      setNewCashbox({ name: "", amount: 0, type: "expense", cashbox: "" });
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  return (
    <div className="vitrina__overlay">
      <div className="vitrina__modal vitrina__modal--add">
        <div className="vitrina__modal-header">
          <h3>Добавление расхода</h3>
          <X className="vitrina__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="vitrina__modal-section">
          <label>Наименование</label>
          <input
            type="text"
            name="name"
            placeholder=""
            className="vitrina__modal-input"
            value={newCashbox.name}
            onChange={(e) =>
              setNewCashbox({ ...newCashbox, name: e.target.value })
            }
          />
        </div>
        <div className="vitrina__modal-section">
          <label>Сумма</label>
          <input
            type="text"
            placeholder="Например, 10000"
            className="vitrina__modal-input"
            name="amount"
            value={newCashbox.amount}
            onChange={(e) =>
              setNewCashbox({
                ...newCashbox,
                amount: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
        {/* <div className="vitrina__modal-section">
          <label>Касса</label>
          {newCashbox.cashbox && cashBoxes && cashBoxes.length > 0 ? (
            <span
              className="debt__input"
              style={{ padding: "8px", display: "block" }}
            >
              Касса:{" "}
              {cashBoxes.find((c) => c.id === newCashbox.cashbox)?.name ||
                cashBoxes.find((c) => c.id === newCashbox.cashbox)
                  ?.department_name ||
                "Касса"}
            </span>
          ) : (
            <span
              className="debt__input"
              style={{ padding: "8px", display: "block", color: "#999" }}
            >
              Нет доступных касс
            </span>
          )}
        </div> */}

        <div className="vitrina__modal-footer">
          <button
            className="vitrina__button vitrina__button--cancel"
            onClick={onClose}
          >
            Отмена
          </button>
          <button className="sklad__add" onClick={handleAddCashbox}>
            Создать расход
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCashFlowsModal;
