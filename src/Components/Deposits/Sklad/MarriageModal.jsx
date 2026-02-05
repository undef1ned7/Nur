import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAlert, useConfirm } from "../../../hooks/useDialog";

const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const MarriageModal = ({ onClose, onChanged, item }) => {
  const alert = useAlert()
  const confirm = useConfirm()
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
  const q = useMemo(() => toNum(defectiveQty), [defectiveQty]);
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

  const validateWriteoff = useCallback(() => {
    if (!item?.id) return "Нет выбранного товара";
    if (!q) return "Введите количество";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (q > stockQty)
      return `Нельзя списать больше, чем в наличии (${stockQty})`;
    if (unitCost < 0) return "Себестоимость указана неверно";
    return "";
  }, [item, q, stockQty, unitCost]);

  const validateReturn = useCallback(() => {
    if (!item?.id) return "Нет выбранного товара";
    if (!q) return "Введите количество для возврата";
    if (q <= 0) return "Количество должно быть больше 0";
    if (!Number.isInteger(q)) return "Количество должно быть целым числом";
    if (q > stockQty)
      return `Нельзя вернуть больше, чем в наличии (${stockQty})`;
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
  }, [item, q, stockQty, cashBoxes, selectCashBox]);

  const onFormSubmit = async (e) => {
    e.preventDefault();
    const err = validateWriteoff();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    try {
      // списание брака — уменьшаем остаток
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { quantity: stockQty - q },
        })
      ).unwrap();

      // отправка в аналитику (расход по себестоимости)
      if (selectCashBox && expense > 0) {
        try {
          await dispatch(
            addCashFlows({
              cashbox: selectCashBox,
              type: "expense",
              name: `Списание брака: ${item?.name}`,
              amount: expense,
              source_cashbox_flow_id: item.id,
              source_business_operation_id: "Списание брака",
              status:
                company?.subscription_plan?.name === "Старт"
                  ? "approved"
                  : "pending",
            })
          ).unwrap();
        } catch (cashErr) {
          console.warn("Ошибка при записи расхода в аналитику:", cashErr);
        }
      }

      alert('Товар списан!', () => {
        onChanged?.();
        onClose?.();
      })
    } catch (e) {
      console.log(e);
      alert("Не удалось сохранить. Попробуйте ещё раз.", true)
    }
  };

  const onReturn = async () => {
    const err = validateReturn();
    if (err) {
      alert(err, true)
      return;
    }

    // Дополнительная проверка кассы перед выполнением операции
    if (!selectCashBox) {
      alert("Касса не выбрана. Создайте кассу в разделе «Кассы».", true);
      return;
    }
    setError("");
    const confirmMsg = `Подтвердите возврат товара:
Наименование: ${item?.name}
Количество к возврату: ${q} шт.
Сумма прихода: ${(q * unitCost).toFixed(2)}`;
    confirm(confirmMsg, async (result) => {
      if (result) {
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
          alert('Возврат выполнен!', () => {
            onChanged?.();
            onClose?.();
          })
        } catch (e) {
          console.log(e);
          alert("Не удалось выполнить возврат. Попробуйте ещё раз.", true)
        }
      }
    })
  };

  return (
    <div className="add-modal z-50!">
      <div className="add-modal__overlay z-50!" onClick={onClose} />
      <div className="add-modal__content z-50!" style={{ height: "auto" }}>
        <div className="add-modal__header">
          <h3 className="text-xl">Списание брака / Возврат</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <form className="flex flex-col gap-2" onSubmit={onFormSubmit}>
          <h4 className="text-lg font-medium">Товар: {item?.name}</h4>
          <p>
            В наличии: <b>{stockQty}</b> шт.
          </p>
          <p>
            Себестоимость: <b>{unitCost}</b>
          </p>
          <input
            type="number"
            name="defectiveQty"
            placeholder="Количество (для списания/возврата)"
            className="debt__input border rounded-lg p-2 w-full"
            value={defectiveQty}
            onChange={(e) => setDefectiveQty(e.target.value)}
            min={1}
            step={1}
          />

          {/* касса автоматически выбирается - скрыто от пользователя */}

          <div>
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
