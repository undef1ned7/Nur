import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
import {
  fetchProductsAsync,
  updateProductAsync,
} from "../../../../../store/creators/productCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../../store/slices/cashSlice";
import { useUser } from "../../../../../store/slices/userSlice";

const AcceptPendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { list: products, loading } = useSelector((s) => s.product);
  const { list: cashBoxes } = useCash();
  const { company } = useUser();
  const [selectedCashBox, setSelectedCashBox] = useState("");

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectedCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectedCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectedCashBox]);

  const pending = useMemo(
    () =>
      (products || []).filter(
        (p) => String(p.status).toLowerCase() === "pending"
      ),
    [products]
  );

  const refresh = () => {
    dispatch(fetchProductsAsync({})).finally(() => {
      onChanged?.();
    });
  };

  const calcExpenseAmount = (item) => {
    const price = Number(item?.purchase_price ?? item?.price ?? 0);
    const qty = Number(item?.quantity ?? 0);
    const amt = price * qty;
    return Math.round(amt * 100) / 100;
  };

  const handleAccept = async (item) => {
    // Дополнительная проверка кассы перед выполнением операции
    if (!selectedCashBox) {
      alert("Касса не выбрана. Создайте кассу в разделе «Кассы».");
      return;
    }
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "accepted" },
        })
      ).unwrap();

      const amount = calcExpenseAmount(item);
      if (amount > 0) {
        await dispatch(
          addCashFlows({
            cashbox: selectedCashBox,
            type: "expense",
            name: item.name,
            amount,
            source_cashbox_flow_id: item.id,
            source_business_operation_id: "Возврат товара",
            status:
              company?.subscription_plan?.name === "Старт"
                ? "approved"
                : "pending",
          })
        ).unwrap();
      }
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось принять товар");
    }
  };

  const handleReject = async (item) => {
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { status: "rejected" },
        })
      ).unwrap();
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отклонить товар");
    }
  };

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>Принятие товаров (статус: pending)</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Касса (обязательно для принятия)</label>
          {selectedCashBox && cashBoxes && cashBoxes.length > 0 ? (
            <span
              className="add-modal__input"
              style={{ padding: "8px", display: "block" }}
            >
              Касса:{" "}
              {cashBoxes.find((cash) => cash.id === selectedCashBox)?.name ||
                cashBoxes.find((cash) => cash.id === selectedCashBox)
                  ?.department_name ||
                "Касса"}
            </span>
          ) : (
            <span
              className="add-modal__input"
              style={{ padding: "8px", display: "block", color: "#999" }}
            >
              Нет доступных касс
            </span>
          )}
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : pending.length === 0 ? (
          <div className="add-modal__section">
            Нет товаров со статусом pending.
          </div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: 400, overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Название</th>
                  <th>Поставщик</th>
                  <th>Кол-во</th>
                  <th>Закуп. цена</th>
                  <th>Итого (расход)</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item, idx) => {
                  const expense = calcExpenseAmount(item);
                  return (
                    <tr key={item.id}>
                      <td>{idx + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.client_name || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>{item.purchase_price ?? "—"}</td>
                      <td>{expense.toFixed(2)}</td>
                      <td>
                        <button
                          className="add-modal__save"
                          style={{ marginRight: 8 }}
                          onClick={() => handleAccept(item)}
                        >
                          Принять
                        </button>
                        <button
                          className="add-modal__cancel"
                          onClick={() => handleReject(item)}
                        >
                          Отказать
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button
            className="add-modal__save"
            onClick={() => dispatch(fetchProductsAsync({}))}
          >
            Обновить список
          </button>
        </div>
      </div>
    </div>
  );
};

export default AcceptPendingModal;
