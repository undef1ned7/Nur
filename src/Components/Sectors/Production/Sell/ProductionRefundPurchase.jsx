import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  agentSaleReturn,
  getAgentSaleDetail,
  getAllProductionSaleDetail,
  getAllProductionSaleReturn,
} from "../../../../api/agentSales";
import { useUser } from "../../../../store/slices/userSlice";
import Modal from "../../../common/Modal/Modal";

const extractApiError = (errorLike) => {
  const value =
    errorLike?.response?.data?.detail ??
    errorLike?.response?.data?.message ??
    errorLike?.response?.data ??
    errorLike?.message;

  if (Array.isArray(value)) {
    return value.map((item) => extractApiError(item)).join(", ");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .map((item) => extractApiError(item))
      .filter(Boolean)
      .join(", ");
  }

  return String(value || "Не удалось выполнить возврат. Попробуйте еще раз.");
};

const STATUS_LABELS = {
  paid: "Оплачена",
  debt: "Долг",
  new: "Новая",
  canceled: "Отменена",
};

const ProductionRefundPurchase = ({
  onClose,
  onChanged,
  item,
  useGlobalAccess,
}) => {
  const { profile } = useUser();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [isDefect, setIsDefect] = useState(false);

  const isAgent =
    String(profile?.role || "")
      .trim()
      .toLowerCase() === "agent";

  useEffect(() => {
    setQuantities({});
    setIsDefect(false);
    setError("");
  }, [item?.id]);

  useEffect(() => {
    const loadSaleData = async () => {
      if (!item?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = useGlobalAccess
          ? await getAllProductionSaleDetail(item.id)
          : await getAgentSaleDetail(item.id);
        setSaleData(data);
      } catch (err) {
        console.error("Ошибка загрузки данных продажи:", err);
        setError("Не удалось загрузить данные о продаже.");
      } finally {
        setLoading(false);
      }
    };

    loadSaleData();
  }, [item?.id, useGlobalAccess]);

  const currentItem = saleData || item;

  const saleItems = useMemo(() => {
    if (!Array.isArray(currentItem?.items)) return [];
    return currentItem.items.map((saleItem, index) => {
      const maxQuantity = Number(saleItem?.quantity ?? saleItem?.qty ?? 0) || 0;
      return {
        id: saleItem?.id ?? saleItem?.sale_item_id ?? `sale-item-${index}`,
        name:
          saleItem?.name_snapshot ??
          saleItem?.name ??
          saleItem?.product_name ??
          saleItem?.display_name ??
          saleItem?.object_name ??
          `Позиция ${index + 1}`,
        quantity: maxQuantity,
        unitPrice: Number(saleItem?.unit_price ?? saleItem?.price ?? 0) || 0,
        unit: saleItem?.unit ?? saleItem?.unit_name ?? "шт",
      };
    });
  }, [currentItem]);

  const partialItems = useMemo(
    () =>
      saleItems
        .map((saleItem) => {
          const rawValue = String(quantities[saleItem.id] ?? "")
            .trim()
            .replace(",", ".");
          if (!rawValue) return null;
          const quantity = Number(rawValue);
          if (!Number.isFinite(quantity) || quantity <= 0) return null;
          return {
            sale_item_id: saleItem.id,
            quantity,
          };
        })
        .filter(Boolean),
    [quantities, saleItems],
  );

  const partialCount = partialItems.length;
  const isReturnableStatus = ["paid", "debt"].includes(
    String(currentItem?.status || "").trim().toLowerCase(),
  );

  const statusLabel =
    STATUS_LABELS[String(currentItem?.status || "").toLowerCase()] ||
    currentItem?.status ||
    "—";

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const validateCommon = useCallback(() => {
    if (!currentItem?.id) return "Не найден идентификатор продажи.";
    if (!isReturnableStatus) {
      return "Возврат возможен только для оплаченных или долговых продаж.";
    }
    return "";
  }, [currentItem?.id, isReturnableStatus]);

  const validatePartial = useCallback(() => {
    const commonError = validateCommon();
    if (commonError) return commonError;
    if (partialItems.length === 0) {
      return "Укажите количество хотя бы для одной позиции.";
    }

    for (const partialItem of partialItems) {
      const sourceItem = saleItems.find(
        (saleItem) => String(saleItem.id) === String(partialItem.sale_item_id),
      );
      if (!sourceItem) return "Одна из позиций чека не найдена.";
      if (partialItem.quantity > sourceItem.quantity) {
        return `Для "${sourceItem.name}" нельзя вернуть больше ${sourceItem.quantity}.`;
      }
      if (isAgent && !Number.isInteger(partialItem.quantity)) {
        return "Для агентских продаж количество возврата должно быть целым.";
      }
    }

    return "";
  }, [isAgent, partialItems, saleItems, validateCommon]);

  const performReturn = useCallback(
    async (itemsForReturn) => {
      setError("");
      setSubmitting(true);
      try {
        const payload = {};
        if (Array.isArray(itemsForReturn) && itemsForReturn.length > 0) {
          payload.items = itemsForReturn;
        }
        if (isDefect) {
          payload.is_defect = true;
        }
        const returnedSale = useGlobalAccess
          ? await getAllProductionSaleReturn(currentItem.id, payload)
          : await agentSaleReturn(currentItem.id, payload);
        onChanged?.(returnedSale);
        if (!onChanged) onClose?.();
      } catch (err) {
        setError(extractApiError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem?.id, isDefect, onChanged, onClose, useGlobalAccess],
  );

  const onConfirmFull = useCallback(async () => {
    const validationError = validateCommon();
    if (validationError) {
      setError(validationError);
      return;
    }
    await performReturn();
  }, [performReturn, validateCommon]);

  const onConfirmPartial = useCallback(async () => {
    const validationError = validatePartial();
    if (validationError) {
      setError(validationError);
      return;
    }
    await performReturn(partialItems);
  }, [partialItems, performReturn, validatePartial]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Возврат продажи"
      className="sellReturnModal"
      contentClassName="sellReturnModal__content"
      wrapperId="production-sell-return-modal"
    >
      <div className="sellReturn">
        {loading ? (
          <div className="sellReturn__loading">
            <p>Загрузка данных о продаже...</p>
          </div>
        ) : (
          <>
            <p className="sellReturn__lead">
              <b>Полный возврат</b> — нажмите «Вернуть весь чек».{" "}
              <b>Частичный</b> — укажите количество в колонке «Вернуть» только
              для нужных позиций.
            </p>

            <div className="sellReturn__type">
              <div className="sellReturn__typeLabel">Тип операции</div>
              <div className="sellReturn__typeOptions">
                <label
                  className={`sellReturn__typeOption${!isDefect ? " sellReturn__typeOption--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="return-type"
                    checked={!isDefect}
                    onChange={() => setIsDefect(false)}
                  />
                  <span className="sellReturn__typeOptionBody">
                    <b>Обычный возврат</b>
                    <span>
                      Товар возвращается на склад
                      {isAgent ? " агента" : ""}.
                    </span>
                  </span>
                </label>
                <label
                  className={`sellReturn__typeOption${isDefect ? " sellReturn__typeOption--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="return-type"
                    checked={isDefect}
                    onChange={() => setIsDefect(true)}
                  />
                  <span className="sellReturn__typeOptionBody">
                    <b>Брак</b>
                    <span>
                      Товар списывается, на склад не возвращается.
                      {isAgent
                        ? " Учитывается в аналитике брака."
                        : " Для кассовых чеков влияет только на склад."}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="sellReturn__summary">
              <div className="sellReturn__summaryMain">
                <div className="sellReturn__summaryTitle">
                  {currentItem?.client_name || "Без клиента"}
                </div>
                <div className="sellReturn__summaryMeta">
                  Чек #{String(currentItem?.id || "").slice(0, 8) || "—"}
                </div>
              </div>
              <div className="sellReturn__summaryGrid">
                <div className="sellReturn__summaryItem">
                  <span>Статус</span>
                  <b>{statusLabel}</b>
                </div>
                <div className="sellReturn__summaryItem">
                  <span>Сумма</span>
                  <b>
                    {formatMoney(currentItem?.total || currentItem?.amount)} сом
                  </b>
                </div>
                <div className="sellReturn__summaryItem">
                  <span>Позиций</span>
                  <b>{saleItems.length}</b>
                </div>
              </div>
            </div>

            {saleItems.length > 0 && (
              <div className="sellReturn__items">
                <div className="sellReturn__itemsHead">
                  <span>Позиция</span>
                  <span>Макс. возврат</span>
                  <span>Вернуть</span>
                </div>

                {saleItems.map((saleItem) => (
                  <div key={saleItem.id} className="sellReturn__itemRow">
                    <div className="sellReturn__itemInfo">
                      <div className="sellReturn__itemName">{saleItem.name}</div>
                      <div className="sellReturn__itemMeta">
                        {formatMoney(saleItem.unitPrice)} сом × {saleItem.quantity}
                      </div>
                    </div>
                    <div className="sellReturn__itemAvailable">
                      {saleItem.quantity} {saleItem.unit}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={saleItem.quantity}
                      step={isAgent ? "1" : "0.001"}
                      inputMode="decimal"
                      className="sellReturn__qtyInput"
                      value={quantities[saleItem.id] ?? ""}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [saleItem.id]: e.target.value,
                        }))
                      }
                      placeholder="0"
                      aria-label={`Количество возврата: ${saleItem.name}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {isAgent && saleItems.length > 0 && (
              <div className="sellReturn__hint">
                Для агентских продаж частичный возврат доступен только целым
                количеством.
              </div>
            )}

            {error && <div className="sellReturn__error">{error}</div>}

            <div className="sellReturn__actions">
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
                className="btn"
                onClick={onConfirmFull}
                disabled={submitting || loading || !isReturnableStatus}
                style={{ flex: 1, justifyContent: "center" }}
              >
                {submitting && partialCount === 0
                  ? "Оформляем..."
                  : "Вернуть весь чек"}
              </button>

              <button
                type="button"
                className="btn danger-btn"
                onClick={onConfirmPartial}
                disabled={
                  submitting ||
                  loading ||
                  !isReturnableStatus ||
                  partialCount === 0
                }
                style={{ flex: 1, justifyContent: "center" }}
              >
                {submitting && partialCount > 0
                  ? "Оформляем..."
                  : `Частичный возврат${partialCount > 0 ? ` (${partialCount})` : ""}`}
              </button>
            </div>

            <div className="sellReturn__hint">
              Esc — закрыть окно. Частичный возврат активируется после ввода
              количества.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ProductionRefundPurchase;
