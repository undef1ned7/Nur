import React, { useState, useEffect } from "react";
import { X, Printer } from "lucide-react";
import { useDispatch } from "react-redux";
import { pdf } from "@react-pdf/renderer";

import { getInvoiceJson } from "../../../../../store/creators/saleThunk";
import InvoicePdfDocument from "./InvoicePdfDocument";

import "./InvoicePreviewModal.scss";

const InvoicePreviewModal = ({
  invoiceId,
  invoiceData: initialInvoiceData,
  onClose,
  onEdit,
}) => {
  const dispatch = useDispatch();
  const [invoiceData, setInvoiceData] = useState(initialInvoiceData);
  const [loading, setLoading] = useState(!initialInvoiceData);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);

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

    // Иначе загружаем данные
    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dispatch(getInvoiceJson(invoiceId));
        if (result.type === "products/getInvoiceJson/fulfilled") {
          setInvoiceData(result.payload);
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
  }, [invoiceId, initialInvoiceData, dispatch]);

  const handlePrint = async () => {
    if (!invoiceId) return;

    setPrinting(true);
    try {
      // Берём уже загруженный JSON
      let data = invoiceData;

      // Если по какой-то причине данных нет — подгружаем
      if (!data) {
        const result = await dispatch(getInvoiceJson(invoiceId));
        if (result.type === "products/getInvoiceJson/fulfilled") {
          data = result.payload;
          setInvoiceData(result.payload);
        } else {
          throw new Error("Не удалось загрузить накладную (JSON)");
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

  // Нормализация данных из нового формата API
  const items = Array.isArray(invoiceData?.items)
    ? invoiceData.items.map((item) => ({
        id: item.id,
        name: item.name || "Товар",
        qty: parseFloat(item.qty || 0),
        price: parseFloat(item.unit_price || 0),
        total: parseFloat(item.total || 0),
      }))
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
            {/* Заголовок накладной */}
            <div className="invoice-preview-modal__invoice-header">
              <div className="invoice-preview-modal__invoice-title">
                НАКЛАДНАЯ № {invoiceNumber}
              </div>
              {invoiceDate && (
                <div className="invoice-preview-modal__invoice-date">
                  от {formatDateTime(invoiceDate)}
                </div>
              )}
            </div>

            {/* Секция КОМПАНИЯ (Продавец) */}
            <div className="flex gap-4">
              <div className="invoice-preview-modal__section w-1/ ">
                <div className="invoice-preview-modal__section-title">
                  КОМПАНИЯ
                </div>
                <div className="invoice-preview-modal__section-content">
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Название:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyName || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      ИНН:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyInn || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      ОКПО:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyOkpo || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      P/c:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyScore || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      БИК:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyBik || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Адрес:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyAddress || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Тел.:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {companyPhone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Секция ПОКУПАТЕЛЬ */}
              <div className="invoice-preview-modal__section w-1/2">
                <div className="invoice-preview-modal__section-title">
                  ПОКУПАТЕЛЬ
                </div>
                <div className="invoice-preview-modal__section-content">
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Название:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientName || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      ИНН:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientInn || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      ОКПО:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientOkpo || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      P/c:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientScore || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      БИК:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientBik || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Адрес:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientAddress || "—"}
                    </span>
                  </div>
                  <div className="invoice-preview-modal__field">
                    <span className="invoice-preview-modal__field-label">
                      Тел.:
                    </span>
                    <span className="invoice-preview-modal__field-value">
                      {clientPhone || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Таблица товаров */}
            <div className="invoice-preview-modal__goods-section">
              <div className="invoice-preview-modal__goods-title">Товар</div>
              <div className="invoice-preview-modal__goods-table">
                <div className="invoice-preview-modal__goods-header">
                  <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--name">
                    Наименование
                  </div>
                  <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--qty">
                    Кол-во
                  </div>
                  <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--price">
                    Цена
                  </div>
                  <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--amount">
                    Сумма
                  </div>
                </div>

                {items.length > 0 ? (
                  items.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="invoice-preview-modal__goods-row"
                    >
                      <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--name">
                        {item.name}
                      </div>
                      <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--qty">
                        {item.qty}
                      </div>
                      <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--price">
                        {formatMoney(item.price)}
                      </div>
                      <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--amount">
                        {formatMoney(item.qty * item.price)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="invoice-preview-modal__goods-row">
                    <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--name">
                      Нет товаров
                    </div>
                    <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--qty">
                      —
                    </div>
                    <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--price">
                      —
                    </div>
                    <div className="invoice-preview-modal__goods-col invoice-preview-modal__goods-col--amount">
                      —
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Итоги */}
            <div className="invoice-preview-modal__totals">
              <div className="invoice-preview-modal__total-row">
                <span>СУММА (без скидок):</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="invoice-preview-modal__total-row invoice-preview-modal__total-row--bold">
                <span>ИТОГО К ОПЛАТЕ:</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>

            {/* Подписи */}
            <div className="invoice-preview-modal__signatures">
              <div className="invoice-preview-modal__signature">
                <div className="invoice-preview-modal__signature-label">
                  Продавец:
                </div>
                <div className="invoice-preview-modal__signature-line"></div>
              </div>
              <div className="invoice-preview-modal__signature">
                <div className="invoice-preview-modal__signature-label">
                  Покупатель:
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
