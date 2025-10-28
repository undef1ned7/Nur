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
            placeholder="Например, Закупка материалов"
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
            type="number"
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
        <div className="vitrina__modal-section">
          <label>Касса</label>
          <select
            style={{ marginTop: 14, width: "100%" }}
            className="debt__input"
            name="cashbox"
            value={newCashbox.cashbox}
            onChange={(e) =>
              setNewCashbox({ ...newCashbox, cashbox: e.target.value })
            }
          >
            <option value="" disabled>
              Выберите кассу
            </option>
            {cashBoxes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.department_name}
              </option>
            ))}
          </select>
        </div>

        <div className="vitrina__modal-footer">
          <button
            className="vitrina__button vitrina__button--cancel"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="vitrina__button vitrina__button--save"
            onClick={handleAddCashbox}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCashFlowsModal;
