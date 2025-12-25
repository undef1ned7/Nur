import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { useDispatch } from "react-redux";
import { getReceiptJson } from "../../../../../store/creators/saleThunk";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
} from "../../../../pages/Sell/services/printService";
import "./ReceiptPreviewModal.scss";

const ReceiptPreviewModal = ({ receiptId, receiptData: initialReceiptData, onClose, onEdit }) => {
  const dispatch = useDispatch();
  const [receiptData, setReceiptData] = useState(initialReceiptData);
  const [loading, setLoading] = useState(!initialReceiptData);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Если данные уже переданы, используем их
    if (initialReceiptData) {
      setReceiptData(initialReceiptData);
      setLoading(false);
      return;
    }

    // Иначе загружаем данные
    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dispatch(getReceiptJson(receiptId));
        if (result.type === "products/getReceiptJson/fulfilled") {
          setReceiptData(result.payload);
        } else {
          setError("Не удалось загрузить чек");
        }
      } catch (err) {
        console.error("Ошибка при загрузке чека:", err);
        setError("Ошибка при загрузке чека");
      } finally {
        setLoading(false);
      }
    };

    if (receiptId) {
      loadReceipt();
    }
  }, [receiptId, initialReceiptData, dispatch]);

  const handlePrint = async () => {
    if (!receiptData && !receiptId) return;

    // Проверяем подключение принтера
    const isPrinterConnected = await checkPrinterConnection();

    if (!isPrinterConnected) {
      alert("Принтер не подключен. Пожалуйста, подключите принтер перед печатью.");
      return;
    }

    setPrinting(true);
    try {
      let dataToPrint = receiptData;
      
      // Если данных нет, загружаем их заново
      if (!dataToPrint && receiptId) {
        const result = await dispatch(getReceiptJson(receiptId));
        if (result.type === "products/getReceiptJson/fulfilled") {
          dataToPrint = result.payload;
        } else {
          throw new Error("Не удалось загрузить данные чека для печати");
        }
      }

      if (dataToPrint && Array.isArray(dataToPrint.items)) {
        // Преобразуем данные в формат для печати
        const printData = {
          items: dataToPrint.items.map((item) => ({
            name: item.name,
            qty: parseFloat(item.qty),
            price: parseFloat(item.unit_price),
            total: parseFloat(item.total),
          })),
          total: parseFloat(dataToPrint.totals?.total || 0),
          subtotal: parseFloat(dataToPrint.totals?.subtotal || 0),
          discount_total: parseFloat(dataToPrint.totals?.discount_total || 0),
          company: dataToPrint.company?.name || "",
          payment: dataToPrint.payment || {},
        };
        await handleCheckoutResponseForPrinting(printData);
      } else {
        throw new Error("Нет данных для печати");
      }
      onClose();
    } catch (printError) {
      console.error("Ошибка при печати чека:", printError);
      alert("Ошибка при печати чека: " + (printError.message || "Неизвестная ошибка"));
    } finally {
      setPrinting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatMoney = (amount) => {
    return parseFloat(amount || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <div className="receipt-preview-modal-overlay" onClick={onClose}>
        <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
          <div className="receipt-preview-modal__loading">Загрузка чека...</div>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="receipt-preview-modal-overlay" onClick={onClose}>
        <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
          <div className="receipt-preview-modal__error">
            {error || "Чек не найден"}
          </div>
          <div className="receipt-preview-modal__actions">
            <button className="receipt-preview-modal__close-btn" onClick={onClose}>
              ЗАКРЫТЬ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Нормализация данных из нового формата API
  const items = Array.isArray(receiptData?.items)
    ? receiptData.items.map((item) => ({
        id: item.id,
        name: item.name || item.product_name || "Товар",
        qty: parseFloat(item.qty || item.quantity || 0),
        price: parseFloat(item.unit_price || item.price || 0),
        total: parseFloat(item.total || 0),
        unit: item.unit || "ШТ",
      }))
    : [];

  const doc = receiptData?.document || receiptData?.sale || {};
  const company = receiptData?.company || {};
  const cashier = receiptData?.cashier || {};
  const client = receiptData?.client || null;

  const subtotal = parseFloat(receiptData?.totals?.subtotal || 0);
  const discount = parseFloat(receiptData?.totals?.discount_total || 0);
  const tax = parseFloat(receiptData?.totals?.tax_total || 0);
  const total = parseFloat(receiptData?.totals?.total || 0);
  
  const payment = receiptData?.payment || {};
  const paidCash = payment.method === "cash" ? parseFloat(payment.cash_received || 0) : 0;
  const paidCard = payment.method === "card" ? parseFloat(total) : 0;
  const change = parseFloat(payment.change || 0);

  return (
    <div className="receipt-preview-modal-overlay" onClick={onClose}>
      <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-preview-modal__header">
          <h2 className="receipt-preview-modal__title">Предварительный просмотр чека</h2>
          <button className="receipt-preview-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="receipt-preview-modal__content">
          <div className="receipt-preview-modal__receipt">
            {/* Дата и время создания */}
            <div className="receipt-preview-modal__created-date">
              {formatDate(new Date().toISOString())}
            </div>

            {/* Заголовок чека */}
            <div className="receipt-preview-modal__receipt-header">
              <div className="receipt-preview-modal__doc-title">
                ТОВАРНЫЙ ЧЕК №{doc.number || doc.doc_no || ""} от{" "}
                {formatDate(doc.date || doc.created_at)}
              </div>
            </div>

            {/* Информация о продавце */}
            <div className="receipt-preview-modal__company-info">
              <div className="receipt-preview-modal__company-name">
                {company?.name || "market"}
              </div>
              {company?.address && (
                <div className="receipt-preview-modal__company-address">
                  {company.address}
                </div>
              )}
            </div>

            {/* Таблица товаров */}
            <div className="receipt-preview-modal__table">
              {/* Заголовок таблицы */}
              <div className="receipt-preview-modal__table-header">
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--no">
                  №
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--name">
                  Наименование
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--unit">
                  Ед. изм.
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--qty">
                  Кол-во
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--price">
                  Цена
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--sum">
                  Сумма
                </div>
              </div>

              {/* Строки товаров */}
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="receipt-preview-modal__table-row"
                  >
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--no">
                      {index + 1}
                    </div>
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--name">
                      {item.name}
                    </div>
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--unit">
                      {item.unit}
                    </div>
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--qty">
                      {formatMoney(item.qty)}
                    </div>
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--price">
                      {formatMoney(item.price)}
                    </div>
                    <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--sum">
                      {formatMoney(item.total)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="receipt-preview-modal__table-row">
                  <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--name" style={{ gridColumn: "1 / -1" }}>
                    Нет товаров
                  </div>
                </div>
              )}

              {/* Строка "Итого:" */}
              <div className="receipt-preview-modal__table-row receipt-preview-modal__table-row--total">
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--no"></div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--name">
                  Итого:
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--unit"></div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--qty">
                  {formatMoney(items.reduce((sum, it) => sum + it.qty, 0))}
                </div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--price"></div>
                <div className="receipt-preview-modal__table-col receipt-preview-modal__table-col--sum">
                  {formatMoney(total)}
                </div>
              </div>
            </div>

            {/* Информация о кассире и клиенте */}
            {(cashier?.name || client?.full_name) && (
              <div className="receipt-preview-modal__receipt-info">
                {cashier?.name && (
                  <div className="receipt-preview-modal__info-row">
                    <span>Кассир:</span>
                    <span>{cashier.name}</span>
                  </div>
                )}
                {client?.full_name && (
                  <div className="receipt-preview-modal__info-row">
                    <span>Покупатель:</span>
                    <span>{client.full_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Итоги */}
            <div className="receipt-preview-modal__receipt-totals">
              <div className="receipt-preview-modal__total-row">
                <span>Промежуточный итог:</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="receipt-preview-modal__total-row">
                  <span>Скидка:</span>
                  <span>-{formatMoney(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="receipt-preview-modal__total-row">
                  <span>Налог:</span>
                  <span>{formatMoney(tax)}</span>
                </div>
              )}
              <div className="receipt-preview-modal__divider"></div>
              <div className="receipt-preview-modal__total-row receipt-preview-modal__total-row--bold">
                <span>ИТОГО:</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>

            {/* Оплата */}
            {(paidCash > 0 || paidCard > 0 || change > 0) && (
              <>
                <div className="receipt-preview-modal__divider"></div>
                <div className="receipt-preview-modal__receipt-payment">
                  {paidCash > 0 && (
                    <div className="receipt-preview-modal__payment-row">
                      <span>Наличными:</span>
                      <span>{formatMoney(paidCash)}</span>
                    </div>
                  )}
                  {paidCard > 0 && (
                    <div className="receipt-preview-modal__payment-row">
                      <span>Картой:</span>
                      <span>{formatMoney(paidCard)}</span>
                    </div>
                  )}
                  {change > 0 && (
                    <div className="receipt-preview-modal__payment-row">
                      <span>Сдача:</span>
                      <span>{formatMoney(change)}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Футер чека */}
            <div className="receipt-preview-modal__receipt-footer">
              <div className="receipt-preview-modal__divider"></div>
              <div className="receipt-preview-modal__thank-you">
                Спасибо за покупку!
              </div>
            </div>
          </div>
        </div>

        <div className="receipt-preview-modal__actions">
          <button
            className="receipt-preview-modal__print-btn"
            onClick={handlePrint}
            disabled={printing}
          >
            <Printer size={20} />
            {printing ? "Печать..." : "ПЕЧАТАТЬ"}
          </button>
          <button className="receipt-preview-modal__close-btn" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreviewModal;

