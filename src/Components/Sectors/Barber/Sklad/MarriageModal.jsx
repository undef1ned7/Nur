import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { updateProductAsync } from "../../../../store/creators/productCreators";
import { X } from "lucide-react";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import { useLocation } from "react-router-dom";

const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const MarriageModal = ({ onClose, onChanged, item }) => {
  const [defectiveQty, setDefectiveQty] = useState(""); // количество брака
  const [selectCashBox, setSelectCashBox] = useState("");
  const [error, setError] = useState("");
  const { list: cashBoxes } = useCash();
  const dispatch = useDispatch();
  const { company } = useUser();
  const { pathname } = useLocation();
  console.log(pathname);

  // предполагаем, что purchase_price — это СЕБЕСТОИМОСТЬ за 1 шт.
  const unitCost = useMemo(
    () =>
      toNum(
        pathname === "/crm/production/warehouse"
          ? item?.price
          : item?.purchase_price
      ),
    [item]
  );
  const stockQty = useMemo(() => toNum(item?.quantity), [item]);
  const q = toNum(defectiveQty);

  // сумма расхода по себестоимости
  const expense = useMemo(() => +(q * unitCost).toFixed(2), [q, unitCost]);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const validate = () => {
    if (!q) return "Введите количество брака";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) {
      return "Количество должно быть целым числом";
    }
    if (q > stockQty)
      return `Нельзя списать больше, чем в наличии (${stockQty})`;
    // Проверяем кассу только если кассы уже загружены (не undefined) и есть, но касса не выбрана
    // Если кассы еще загружаются (cashBoxes undefined), не блокируем кнопку
    if (Array.isArray(cashBoxes) && cashBoxes.length > 0 && !selectCashBox) {
      return "Касса не выбрана. Создайте кассу в разделе «Кассы».";
    }
    if (Array.isArray(cashBoxes) && cashBoxes.length === 0) {
      return "Нет доступных касс. Создайте кассу в разделе «Кассы».";
    }
    if (unitCost < 0) return "Себестоимость указана неверно";
    return "";
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    // Дополнительная проверка кассы перед выполнением операции
    if (!selectCashBox) {
      setError("Касса не выбрана. Создайте кассу в разделе «Кассы».");
      return;
    }

    setError("");

    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { quantity: stockQty - q },
        })
      ).unwrap();

      // 2) пишем расход в кассу по себестоимости
      await dispatch(
        addCashFlows({
          cashbox: selectCashBox,
          type: "expense",
          name: `Списание брака: ${item?.name}`,
          amount: expense,
          status:
            company?.subscription_plan?.name === "Старт"
              ? "approved"
              : "pending",
          // description: `Брак ${q} шт. × ${unitCost} = ${expense}`,
        })
      ).unwrap();

      onChanged?.();
      onClose?.();
    } catch (e) {
      console.log(e);
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3>Списание брака</h3>
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
            placeholder="Количество брака"
            className="debt__input"
            value={defectiveQty}
            onChange={(e) => setDefectiveQty(e.target.value)}
            min={1}
            step={1}
          />

          {/* касса автоматически выбирается - скрыто от пользователя */}

          <div style={{ marginTop: 12 }}>
            К списанию: <b>{isFinite(expense) ? expense : 0}</b>
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

          <button
            style={{
              marginTop: 15,
              width: "100%",
              justifyContent: "center",
            }}
            className="btn edit-btn"
            type="submit"
            disabled={!defectiveQty || !!validate()}
          >
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
};

export default MarriageModal;
