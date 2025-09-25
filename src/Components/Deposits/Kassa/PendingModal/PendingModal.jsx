import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
// import "./Sklad.scss";

// import { fetchProductsAsync } from "../../../store/creators/productCreators";

import { useEffect, useMemo } from "react";
import {
  fetchProductsAsync,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import {
  getCashFlows,
  updateCashFlows,
  useCash,
} from "../../../../store/slices/cashSlice";

const PendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { cashFlows } = useCash();
  const { list: products, loading } = useSelector((s) => s.product);

  // Товары, ожидающие отправки (при необходимости поправьте статус на "pending")
  const pending = useMemo(
    () => (cashFlows || []).filter((p) => p.status === false),
    [cashFlows]
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
    try {
      // Только смена статуса -> history, без кассы/движений денег
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: true },
        })
      ).unwrap();

      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отправить товар");
    }
  };

  const handleReject = async (item) => {
    try {
      await dispatch(
        updateCashFlows({
          productId: item.id,
          updatedData: { status: false },
        })
      ).unwrap();
      refresh();
    } catch (e) {
      console.error(e);
      alert("Не удалось отклонить товар");
    }
  };

  useEffect(() => {
    dispatch(getCashFlows());
  }, []);

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" role="dialog" aria-modal="true">
        <div className="add-modal__header">
          <h3>В ожидании</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
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
                  <th>Тип</th>
                  <th>Касса</th>
                  {/* <th>Закуп. цена</th> */}
                  <th>Сумма</th>
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
                      <td>{item.cashbox_name || "—"}</td>
                      <td>{item.type}</td>
                      <td>{item.amount ?? "—"}</td>
                      {/* <td>{expense.toFixed(2)}</td> */}
                      <td>
                        <button
                          className="add-modal__save"
                          style={{ marginRight: 8 }}
                          title="Принять товар"
                          onClick={() => handleAccept(item)}
                        >
                          Отправить
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

export default PendingModal;
