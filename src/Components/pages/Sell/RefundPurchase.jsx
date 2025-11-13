import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
// import { updateSellProduct } from "../../../store/creators/productCreators";

// кассы
import {
  useCash,
  getCashBoxes,
  addCashFlows,
} from "../../../store/slices/cashSlice";
import { updateSellProduct } from "../../../store/creators/saleThunk";
import { useUser } from "../../../store/slices/userSlice";

const RefundPurchase = ({ onClose, onChanged, item }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();

  const [selectCashBox, setSelectCashBox] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // подгружаем кассы при открытии модалки
    dispatch(getCashBoxes());
  }, [dispatch]);

  const name = item?.name ?? item?.product_name ?? "Товар";
  const qty = item?.quantity ?? item?.qty ?? null;
  const sum = item?.total ?? item?.amount ?? null;

  const validate = () => {
    if (!item?.id) return "Не найден идентификатор продажи.";
    if (!selectCashBox) return "Выберите кассу.";
    return "";
  };

  const onConfirm = useCallback(async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await dispatch(
        updateSellProduct({
          id: item.id,
          updatedData: {
            status: "canceled",
            // cashbox: selectCashBox, // <-- переименуй, если бэк ждёт другое поле
          },
        })
      ).unwrap();

      await dispatch(
        addCashFlows({
          cashbox: selectCashBox,
          type: "expense",
          name: `Возврат товаров: ${
            item?.client_name || new Date(item.created_at).toLocaleDateString()
          }`,
          source_cashbox_flow_id: item.id,
          source_business_operation_id: "Продажа",
          amount: item.total,
          status:
            company?.subscription_plan?.name === "Старт"
              ? "approved"
              : "pending",
        })
      ).unwrap();

      onChanged?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      setError("Не удалось выполнить возврат. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, item, selectCashBox, onChanged, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm]);

  return (
    <div
      className="add-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-title"
    >
      <div className="add-modal__overlay" onClick={onClose} />

      <div className="add-modal__content" style={{ maxWidth: 520 }}>
        <div className="add-modal__header">
          <h3 id="refund-title">Подтверждение возврата</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div style={{ paddingTop: 6 }}>
          <p style={{ lineHeight: 1.5, opacity: 0.9 }}>
            Вы уверены, что хотите оформить <b>возврат</b> по позиции?
          </p>

          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              border: "1px solid var(--c-border, #e5e7eb)",
              borderRadius: 8,
              // background: "var(--c-bg-soft, #0b0f14)",
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {item.client_name || "Нет имени"}
            </div>
            {qty != null && (
              <div style={{ marginTop: 4 }}>
                Количество: <b>{qty}</b>
              </div>
            )}
            {sum != null && (
              <div style={{ marginTop: 4 }}>
                Сумма: <b>{sum}</b>
              </div>
            )}
            {/* <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              Статус продажи будет изменён на <b>canceled</b>.
            </div> */}
          </div>

          {/* выбор кассы */}
          <select
            style={{ marginTop: 14, width: "100%" }}
            className="debt__input"
            value={selectCashBox}
            onChange={(e) => setSelectCashBox(e.target.value)}
          >
            <option value="" disabled>
              Выберите кассу для операции возврата
            </option>
            {cashBoxes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.department_name}
              </option>
            ))}
          </select>

          {error && (
            <div style={{ marginTop: 12, color: "#c0392b", fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={submitting}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Отмена
            </button>

            <button
              type="button"
              className="btn danger-btn"
              onClick={onConfirm}
              disabled={submitting}
              style={{ flex: 1, justifyContent: "center" }}
              title="Изменить статус на canceled"
            >
              {submitting ? "Оформляем..." : "Подтвердить возврат"}
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Подсказка: Enter — подтвердить, Esc — закрыть.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPurchase;
