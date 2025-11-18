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
import {
  updateSellProduct,
  historySellProductDetail,
} from "../../../store/creators/saleThunk";
import { updateProductAsync } from "../../../store/creators/productCreators";
import { useUser } from "../../../store/slices/userSlice";
import api from "../../../api";

const RefundPurchase = ({ onClose, onChanged, item }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { company } = useUser();

  const [selectCashBox, setSelectCashBox] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // подгружаем кассы при открытии модалки
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Загружаем полные данные о продаже при открытии модалки
  useEffect(() => {
    const loadSaleData = async () => {
      if (!item?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await dispatch(historySellProductDetail(item.id));
        if (historySellProductDetail.fulfilled.match(result)) {
          setSaleData(result.payload);
        } else {
          console.error("Ошибка загрузки данных продажи:", result.payload);
          setError("Не удалось загрузить данные о продаже.");
        }
      } catch (err) {
        console.error("Ошибка загрузки данных продажи:", err);
        setError("Не удалось загрузить данные о продаже.");
      } finally {
        setLoading(false);
      }
    };

    loadSaleData();
  }, [dispatch, item?.id]);

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

  // Используем загруженные данные или переданный item
  const currentItem = saleData || item;
  const name = currentItem?.name ?? currentItem?.product_name ?? "Товар";
  const qty = currentItem?.quantity ?? currentItem?.qty ?? null;
  const sum = currentItem?.total ?? currentItem?.amount ?? null;

  const validate = () => {
    if (!currentItem?.id) return "Не найден идентификатор продажи.";
    // Проверяем кассу только если кассы уже загружены (не undefined) и есть, но касса не выбрана
    // Если кассы еще загружаются (cashBoxes undefined), не блокируем кнопку
    if (Array.isArray(cashBoxes) && cashBoxes.length > 0 && !selectCashBox) {
      return "Касса не выбрана. Создайте кассу в разделе «Кассы».";
    }
    if (Array.isArray(cashBoxes) && cashBoxes.length === 0) {
      return "Нет доступных касс. Создайте кассу в разделе «Кассы».";
    }
    return "";
  };

  const onConfirm = useCallback(async () => {
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
    setSubmitting(true);
    try {
      // 1. Обновляем статус продажи на "canceled"
      await dispatch(
        updateSellProduct({
          id: currentItem.id,
          updatedData: {
            status: "canceled",
            // cashbox: selectCashBox, // <-- переименуй, если бэк ждёт другое поле
          },
        })
      ).unwrap();

      // 2. Возвращаем товары на склад
      if (
        currentItem.items &&
        Array.isArray(currentItem.items) &&
        currentItem.items.length > 0
      ) {
        for (const saleItem of currentItem.items) {
          const productId = saleItem.product;
          const returnQuantity = Number(saleItem.quantity) || 0;

          if (!productId || returnQuantity <= 0) {
            console.warn(
              `Пропущен товар: productId=${productId}, quantity=${returnQuantity}`
            );
            continue;
          }

          try {
            // Получаем текущий товар для получения актуального количества
            const { data: currentProduct } = await api.get(
              `/main/products/${productId}/`
            );

            const currentQuantity = Number(currentProduct?.quantity || 0);
            const newQuantity = currentQuantity + returnQuantity;

            // Обновляем количество товара на складе
            await dispatch(
              updateProductAsync({
                productId,
                updatedData: {
                  quantity: newQuantity,
                },
              })
            ).unwrap();
          } catch (productError) {
            console.error(
              `Ошибка при возврате товара ${productId} на склад:`,
              productError
            );
            // Продолжаем обработку других товаров даже при ошибке
          }
        }
      }

      // 3. Создаем расход в кассе
      await dispatch(
        addCashFlows({
          cashbox: selectCashBox,
          type: "expense",
          name: `Возврат товаров: ${
            currentItem?.client_name ||
            new Date(currentItem.created_at).toLocaleDateString()
          }`,
          source_cashbox_flow_id: currentItem.id,
          source_business_operation_id: "Продажа",
          amount: currentItem.total,
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
  }, [dispatch, currentItem, selectCashBox, company, onChanged, onClose]);

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
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Загрузка данных о продаже...</p>
            </div>
          ) : (
            <>
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
                  {currentItem?.client_name || "Нет имени"}
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

              {/* касса автоматически выбирается - скрыто от пользователя */}

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
                  disabled={submitting || loading}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  Отмена
                </button>

                <button
                  type="button"
                  className="btn danger-btn"
                  onClick={onConfirm}
                  disabled={submitting || loading}
                  style={{ flex: 1, justifyContent: "center" }}
                  title="Изменить статус на canceled"
                >
                  {submitting ? "Оформляем..." : "Подтвердить возврат"}
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Подсказка: Enter — подтвердить, Esc — закрыть.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefundPurchase;
