import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { updateProductAsync } from "../../../store/creators/productCreators";
import { X } from "lucide-react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useUser } from "../../../store/slices/userSlice";
import { useLocation } from "react-router-dom";

const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const MarriageModal = ({ onClose, onChanged, item }) => {
  const [defectiveQty, setDefectiveQty] = useState(""); // количество для операции
  const [selectCashBox, setSelectCashBox] = useState("");
  const [error, setError] = useState("");
  const { list: cashBoxes } = useCash();
  const dispatch = useDispatch();
  const { company } = useUser();
  const { pathname } = useLocation();

  // себестоимость за 1 шт (или price для производства)
  const unitCost = useMemo(
    () =>
      toNum(
        pathname === "/crm/production/warehouse"
          ? item?.price
          : item?.purchase_price
      ),
    [item, pathname]
  );

  const stockQty = useMemo(() => toNum(item?.quantity), [item]);
  const q = toNum(defectiveQty);
  const expense = useMemo(() => +(q * unitCost).toFixed(2), [q, unitCost]);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const validateWriteoff = () => {
    if (!item?.id) return "Нет выбранного товара";
    if (!q) return "Введите количество";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (q > stockQty)
      return `Нельзя списать больше, чем в наличии (${stockQty})`;
    if (unitCost < 0) return "Себестоимость указана неверно";
    return "";
  };

  const validateReturn = () => {
    if (!item?.id) return "Нет выбранного товара";
    if (!q) return "Введите количество для возврата";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (q > stockQty)
      return `Нельзя вернуть больше, чем в наличии (${stockQty})`;
    if (!selectCashBox) return "Выберите кассу для прихода";
    if (unitCost < 0) return "Себестоимость указана неверно";
    return "";
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validateWriteoff();
    if (err) {
      setError(err);
      return;
    }
    setError("");

    try {
      // списание брака — просто уменьшаем остаток
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { quantity: stockQty - q },
        })
      ).unwrap();

      onChanged?.();
      onClose?.();
    } catch (e) {
      console.log(e);
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    }
  };

  const onReturn = async () => {
    const err = validateReturn();
    if (err) {
      setError(err);
      return;
    }
    setError("");

    const confirmMsg = `Подтвердите возврат товара:
Наименование: ${item?.name}
Количество к возврату: ${q} шт.
Сумма прихода: ${(q * unitCost).toFixed(2)}`;

    if (!window.confirm(confirmMsg)) return;

    try {
      // уменьшаем остаток на q
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { quantity: stockQty - q },
        })
      ).unwrap();

      // приход в кассу на сумму возврата
      const incomeAmount = +(q * unitCost).toFixed(2);
      await dispatch(
        addCashFlows({
          cashbox: selectCashBox,
          type: "income",
          name: `Возврат товара: ${item?.name}`,
          amount: incomeAmount,
          source_cashbox_flow_id: item.id,
          source_business_operation_id: "Возврат товара",
          status:
            company?.subscription_plan?.name === "Старт"
              ? "approved"
              : "pending",
          // description: `Возврат ${q} шт. × ${unitCost} = ${incomeAmount}`,
        })
      ).unwrap();

      onChanged?.();
      onClose?.();
    } catch (e) {
      console.log(e);
      setError("Не удалось выполнить возврат. Попробуйте ещё раз.");
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3>Списание брака / Возврат</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form onSubmit={onFormSubmit}>
          <h4>Товар: {item?.name}</h4>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            В наличии: <b>{stockQty}</b> шт. · Себестоимость: <b>{unitCost}</b>
          </div>

          <input
            style={{ marginTop: 15, width: "100%" }}
            type="number"
            name="defectiveQty"
            placeholder="Количество (для списания/возврата)"
            className="debt__input"
            value={defectiveQty}
            onChange={(e) => setDefectiveQty(e.target.value)}
            min={1}
            step={1}
          />

          {/* касса нужна для операции "Возврат" */}
          <select
            style={{ marginTop: 15, width: "100%" }}
            value={selectCashBox}
            onChange={(e) => setSelectCashBox(e.target.value)}
            className="debt__input"
          >
            <option value="">Выберите кассу (для прихода при возврате)</option>
            {cashBoxes?.map((cash) => (
              <option key={cash.id} value={cash.id}>
                {cash.name ?? cash.department_name}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            Сумма : <b>{isFinite(expense) ? expense : 0}</b>
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                color: "#c0392b",
                fontSize: 14,
                lineHeight: 1.3,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
            <button
              style={{ flex: 1, justifyContent: "center" }}
              className="btn edit-btn"
              type="submit"
              disabled={!!validateWriteoff()}
            >
              Списать брак
            </button>

            <button
              type="button"
              style={{ flex: 1, justifyContent: "center" }}
              className="btn danger-btn"
              onClick={onReturn}
              disabled={!!validateReturn()}
              title="Возврат на указанное количество: приход по себестоимости"
            >
              Возврат товара
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarriageModal;
