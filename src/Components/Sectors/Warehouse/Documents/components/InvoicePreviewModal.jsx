import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { pdf } from "@react-pdf/renderer";

import { getWarehouseDocumentById } from "../../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../../store/slices/userSlice";
import InvoicePdfDocument from "./InvoicePdfDocument";

import "./InvoicePreviewModal.scss";

const InvoicePreviewModal = ({
  invoiceId,
  invoiceData: initialInvoiceData,
  document: initialDocument,
  onClose,
  onEdit,
}) => {
  const dispatch = useDispatch();
  const { company } = useUser();
  const [invoiceData, setInvoiceData] = useState(initialInvoiceData);
  const [loading, setLoading] = useState(!initialInvoiceData && !initialDocument);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);

  // Функция для преобразования warehouse документа в формат для PDF
  const transformWarehouseDocument = (doc) => {
    if (!doc) return null;

    // Получаем данные компании
    const seller = {
      id: company?.id || "",
      name: company?.name || "",
      inn: company?.inn || "",
      okpo: company?.okpo || "",
      score: company?.score || "",
      bik: company?.bik || "",
      address: company?.address || "",
      phone: company?.phone || null,
      email: company?.email || null,
    };

    // Получаем данные контрагента
    const buyer = doc.counterparty
      ? {
          id: doc.counterparty.id,
          name: doc.counterparty.name || "",
          inn: doc.counterparty.inn || "",
          okpo: doc.counterparty.okpo || "",
          score: doc.counterparty.score || "",
          bik: doc.counterparty.bik || "",
          address: doc.counterparty.address || "",
          phone: doc.counterparty.phone || null,
          email: doc.counterparty.email || null,
        }
      : null;

    // Преобразуем товары
    const items = Array.isArray(doc.items)
      ? doc.items.map((item) => ({
          id: item.id,
          name: item.product?.name || item.name || "Товар",
          qty: String(item.qty || item.quantity || 0),
          unit_price: String(Number(item.price || 0).toFixed(2)),
          total: String(Number(item.total || item.qty * item.price || 0).toFixed(2)),
          unit: item.product?.unit || item.unit || "ШТ",
          article: item.product?.article || item.article || "",
          discount_percent: Number(item.discount_percent || 0),
          price_before_discount: String(Number(item.price || 0).toFixed(2)),
        }))
      : [];

    // Вычисляем итоги
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.qty),
      0
    );
    const discountTotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.unit_price) * Number(item.qty) * Number(item.discount_percent || 0)) /
          100,
      0
    );
    const total = subtotal - discountTotal;

    // Получаем название склада
    const warehouseName = doc.warehouse_from?.name || doc.warehouse?.name || "";
    const warehouseToName = doc.warehouse_to?.name || "";

    return {
      doc_type: doc.doc_type || "SALE",
      document: {
        type: doc.doc_type?.toLowerCase() || "sale_invoice",
        doc_type: doc.doc_type || "SALE",
        title: "Накладная",
        id: doc.id,
        number: doc.number || "",
        date: doc.date || doc.created_at?.split("T")[0] || "",
        datetime: doc.created_at || doc.date || "",
        created_at: doc.created_at || "",
        discount_percent: 0,
      },
      seller,
      buyer,
      items,
      totals: {
        subtotal: String(subtotal.toFixed(2)),
        discount_total: String(discountTotal.toFixed(2)),
        tax_total: "0.00",
        total: String(total.toFixed(2)),
      },
      warehouse: warehouseName,
      warehouse_to: warehouseToName,
    };
  };

  // Вспомогательная функция для скачивания blob
  const downloadBlob = (blob, filename) => {
    if (typeof window === "undefined" || !window.URL || !window.document) {
      throw new Error("Браузерное окружение недоступно");
    }
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    // Если данные уже переданы, используем их
    if (initialInvoiceData) {
      setInvoiceData(initialInvoiceData);
      setLoading(false);
      return;
    }

    // Если передан документ из warehouse API, преобразуем его
    if (initialDocument) {
      const transformed = transformWarehouseDocument(initialDocument);
      setInvoiceData(transformed);
      setLoading(false);
      return;
    }

    // Иначе загружаем данные через новый warehouse API
    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dispatch(getWarehouseDocumentById(invoiceId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          const transformed = transformWarehouseDocument(result.payload);
          setInvoiceData(transformed);
        } else {
          setError("Не удалось загрузить накладную");
        }
      } catch (err) {
        console.error("Ошибка при загрузке накладной:", err);
        setError("Ошибка при загрузке накладной");
      } finally {
        setLoading(false);
      }
    };

    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId, initialInvoiceData, initialDocument, dispatch, company]);

  const handlePrint = async () => {
    if (!invoiceId && !invoiceData) return;

    setPrinting(true);
    try {
      // Берём уже загруженные данные
      let data = invoiceData;

      // Если по какой-то причине данных нет — подгружаем
      if (!data && invoiceId) {
        const result = await dispatch(getWarehouseDocumentById(invoiceId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          data = transformWarehouseDocument(result.payload);
          setInvoiceData(data);
        } else {
          throw new Error("Не удалось загрузить накладную");
        }
      }

      if (!data) throw new Error("Нет данных для генерации PDF");

      // Генерация PDF из JSON
      const blob = await pdf(<InvoicePdfDocument data={data} />).toBlob();

      const fileName = `invoice_${data?.document?.number || invoiceId}.pdf`;
      downloadBlob(blob, fileName);
    } catch (printError) {
      console.error("Ошибка при генерации PDF:", printError);
      alert(
        "Ошибка при генерации PDF: " +
          (printError.message || "Неизвестная ошибка")
      );
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
      <div className="invoice-preview-modal-overlay" onClick={onClose}>
        <div
          className="invoice-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="invoice-preview-modal__loading">
            Загрузка накладной...
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="invoice-preview-modal-overlay" onClick={onClose}>
        <div
          className="invoice-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="invoice-preview-modal__error">
            {error || "Накладная не найдена"}
          </div>
          <div className="invoice-preview-modal__actions">
            <button
              className="invoice-preview-modal__close-btn"
              onClick={onClose}
            >
              ЗАКРЫТЬ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Нормализация данных из нового формата API (как в PDF)
  const items = Array.isArray(invoiceData?.items)
    ? invoiceData.items.map((it) => {
        const qty = Number(it.qty || it.quantity || 0);
        const unit = Number(it.unit_price ?? it.price ?? 0);
        const total = Number(it.total ?? qty * unit);

        // Скидка на уровне товара
        const itemDiscountPercent = Number(it.discount_percent ?? 0);

        // Цена без скидки товара
        let priceNoDiscount = Number(
          it.original_price ??
            it.price_before_discount ??
            it.price_without_discount ??
            0
        );

        // Если цена без скидки не указана, вычисляем её
        if (priceNoDiscount === 0 || priceNoDiscount === unit) {
          if (itemDiscountPercent > 0) {
            priceNoDiscount = unit / (1 - itemDiscountPercent / 100);
          } else {
            priceNoDiscount = unit;
          }
        }

        return {
          id: it.id,
          name: it.name || it.product_name || "Товар",
          qty,
          unit_price: unit,
          price_no_discount: priceNoDiscount,
          discount: itemDiscountPercent,
          total,
          unit: it.unit || "ШТ",
          article: it.article || "",
        };
      })
    : [];

  const subtotal = parseFloat(invoiceData?.totals?.subtotal || 0);
  const discount = parseFloat(invoiceData?.totals?.discount_total || 0);
  const total = parseFloat(invoiceData?.totals?.total || 0);

  // Данные компании (продавец) из seller
  const seller = invoiceData?.seller || {};
  const companyName = seller.name || "";
  const companyInn = seller.inn || "";
  const companyOkpo = seller.okpo || "";
  const companyScore = seller.score || "";
  const companyBik = seller.bik || "";
  const companyAddress = seller.address || "";
  const companyPhone = seller.phone || "";

  // Данные клиента (покупатель) из buyer
  const buyer = invoiceData?.buyer || null;
  const clientName = buyer?.name || "";
  const clientInn = buyer?.inn || "";
  const clientOkpo = buyer?.okpo || "";
  const clientScore = buyer?.score || "";
  const clientBik = buyer?.bik || "";
  const clientAddress = buyer?.address || "";
  const clientPhone = buyer?.phone || "";

  // Номер накладной из document
  const document = invoiceData?.document || {};
  const invoiceNumber = document.number || "";
  const invoiceDate = document.datetime || document.date || "";

  return (
    <div className="invoice-preview-modal-overlay" onClick={onClose}>
      <div
        className="invoice-preview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invoice-preview-modal__header">
          <h2 className="invoice-preview-modal__title">
            Предварительный просмотр накладной
          </h2>
          <button className="invoice-preview-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="invoice-preview-modal__content">
          <div className="invoice-preview-modal__invoice">
            {/* Дата и время создания */}
            <div className="invoice-preview-modal__created-date">
              {formatDateTime(new Date().toISOString())}
            </div>

            {/* Заголовок накладной */}
            <div className="invoice-preview-modal__invoice-header">
              <div className="invoice-preview-modal__invoice-title">
                {(() => {
                  const docType = invoiceData?.doc_type || invoiceData?.document?.doc_type || "SALE";
                  const titles = {
                    SALE: "Расходная накладная",
                    PURCHASE: "Приходная накладная",
                    SALE_RETURN: "Расходная накладная на возврат",
                    PURCHASE_RETURN: "Приходная накладная на возврат",
                    INVENTORY: "Бланк инвентаризации",
                    RECEIPT: "Оприходование",
                    WRITE_OFF: "Списание",
                    TRANSFER: "Накладная на перемещение",
                  };
                  return titles[docType] || "Накладная";
                })()}{" "}
                № {invoiceNumber || "—"} от {formatDate(invoiceDate)}
              </div>
            </div>

            {/* Поставщик и Покупатель */}
            <div className="invoice-preview-modal__parties">
              <div className="invoice-preview-modal__party">
                <span className="invoice-preview-modal__party-label">
                  Поставщик:{" "}
                </span>
                <span className="invoice-preview-modal__party-value">
                  {seller?.name || "—"}
                </span>
                {seller?.address && (
                  <span className="invoice-preview-modal__party-value">
                    {" "}
                    {seller.address}
                  </span>
                )}
              </div>
              <div className="invoice-preview-modal__party">
                <span className="invoice-preview-modal__party-label">
                  Покупатель:{" "}
                </span>
                <span className="invoice-preview-modal__party-value">
                  {buyer ? buyer.name || buyer.full_name || "—" : "—"}
                </span>
              </div>
            </div>

            {/* Склад */}
            {invoiceData?.warehouse && (
              <div className="invoice-preview-modal__warehouse">
                Склад: «{invoiceData.warehouse}»
              </div>
            )}

            {/* Таблица товаров */}
            <div className="invoice-preview-modal__table">
              {/* Заголовок таблицы */}
              <div className="invoice-preview-modal__table-header">
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--no">
                  №
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--name">
                  Наименование
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--article">
                  Арт.
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--unit">
                  Ед. изм.
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--qty">
                  Кол-во
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price-no-discount">
                  Цена без скидки
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--discount">
                  Скидка
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price">
                  Цена
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--sum">
                  Сумма
                </div>
              </div>

              {/* Строки товаров */}
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="invoice-preview-modal__table-row"
                  >
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--no">
                      {index + 1}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--name">
                      {item.name}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--article">
                      {item.article || "—"}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--unit">
                      {item.unit || "ШТ"}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--qty">
                      {formatMoney(item.qty)}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price-no-discount">
                      {formatMoney(item.price_no_discount)}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--discount">
                      {item.discount > 0 ? `${formatMoney(item.discount)}%` : "—"}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price">
                      {formatMoney(item.unit_price)}
                    </div>
                    <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--sum">
                      {formatMoney(item.total)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="invoice-preview-modal__table-row">
                  <div
                    className="invoice-preview-modal__table-col invoice-preview-modal__table-col--name"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    Нет товаров
                  </div>
                </div>
              )}

              {/* Строка "Итого:" */}
              <div className="invoice-preview-modal__table-row invoice-preview-modal__table-row--total">
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--no"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--name">
                  Итого:
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--article"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--unit"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--qty">
                  {formatMoney(items.reduce((sum, it) => sum + it.qty, 0))}
                </div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price-no-discount"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--discount"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--price"></div>
                <div className="invoice-preview-modal__table-col invoice-preview-modal__table-col--sum">
                  {formatMoney(total)}
                </div>
              </div>
            </div>

            {/* Итоги */}
            <div className="invoice-preview-modal__totals">
              <div className="invoice-preview-modal__total-row invoice-preview-modal__total-row--bold">
                <span>ИТОГО:</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>

            {/* Текст с количеством наименований и суммой */}
            <div className="invoice-preview-modal__items-info">
              Всего наименований {items.length}, на сумму {formatMoney(total)}{" "}
              KGS
            </div>

            {/* Подписи */}
            <div className="invoice-preview-modal__signatures">
              <div className="invoice-preview-modal__signature">
                <div className="invoice-preview-modal__signature-label">
                  Отпустил
                </div>
                <div className="invoice-preview-modal__signature-line"></div>
              </div>
              <div className="invoice-preview-modal__signature">
                <div className="invoice-preview-modal__signature-label">
                  Получил
                </div>
                <div className="invoice-preview-modal__signature-line"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="invoice-preview-modal__actions">
          <button
            className="invoice-preview-modal__print-btn"
            onClick={handlePrint}
            disabled={printing}
          >
            <Printer size={20} />
            {printing ? "Печать..." : "ПЕЧАТАТЬ"}
          </button>
          <button
            className="invoice-preview-modal__close-btn"
            onClick={onClose}
          >
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
