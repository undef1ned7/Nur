import React, { useState, useEffect } from "react";
import { X, Printer, Download } from "lucide-react";
import { useDispatch } from "react-redux";
import { pdf } from "@react-pdf/renderer";
import { getWarehouseDocumentById } from "../../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../../store/slices/userSlice";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
} from "../../../../pages/Sell/services/printService";
import ReceiptPdfDocument from "./ReceiptPdfDocument";
import "./ReceiptPreviewModal.scss";
import { useAlert, useConfirm } from "../../../../../hooks/useDialog";

const ReceiptPreviewModal = ({
  receiptId,
  receiptData: initialReceiptData,
  document: initialDocument,
  onClose,
  onEdit,
}) => {
  const alert = useAlert();
  const confirm = useConfirm(); 
  const dispatch = useDispatch();
  const { company, profile: userProfile } = useUser();
  const [receiptData, setReceiptData] = useState(initialReceiptData);
  const [loading, setLoading] = useState(!initialReceiptData && !initialDocument);
  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);

  // Функция для преобразования warehouse документа в формат для PDF
  const transformWarehouseDocument = (doc) => {
    if (!doc) return null;

    const companyData = {
      id: company?.id || "",
      name: company?.name || "",
      address: company?.address || "",
      phone: company?.phone || null,
    };

    const cashierData = {
      id: userProfile?.id || "",
      name: userProfile?.full_name || userProfile?.name || "",
    };

    const clientData = doc.counterparty
      ? {
          id: doc.counterparty.id,
          full_name: doc.counterparty.name || "",
        }
      : null;

    const items = Array.isArray(doc.items)
      ? doc.items.map((item) => ({
          id: item.id,
          name: item.product?.name || item.name || "Товар",
          qty: String(item.qty || item.quantity || 0),
          unit_price: String(Number(item.price || 0).toFixed(2)),
          total: String(Number(item.total || item.qty * item.price || 0).toFixed(2)),
          unit: item.product?.unit || item.unit || "ШТ",
        }))
      : [];

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

    return {
      document: {
        type: "receipt",
        title: "Товарный чек",
        id: doc.id,
        number: doc.number || "",
        doc_no: doc.number || "",
        date: doc.date || doc.created_at?.split("T")[0] || "",
        created_at: doc.created_at || "",
      },
      company: companyData,
      cashier: cashierData,
      client: clientData,
      items,
      totals: {
        subtotal: String(subtotal.toFixed(2)),
        discount_total: String(discountTotal.toFixed(2)),
        tax_total: "0.00",
        total: String(total.toFixed(2)),
      },
      payment: {
        method: "cash",
        cash_received: String(total.toFixed(2)),
        change: "0.00",
        paid_at: doc.created_at || new Date().toISOString(),
      },
      warehouse: doc.warehouse_from?.name || doc.warehouse?.name || "",
    };
  };

  useEffect(() => {
    // Если данные уже переданы, используем их
    if (initialReceiptData) {
      setReceiptData(initialReceiptData);
      setLoading(false);
      return;
    }

    // Если передан документ из warehouse API, преобразуем его
    if (initialDocument) {
      const transformed = transformWarehouseDocument(initialDocument);
      setReceiptData(transformed);
      setLoading(false);
      return;
    }

    // Иначе загружаем данные через новый warehouse API
    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dispatch(getWarehouseDocumentById(receiptId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          const transformed = transformWarehouseDocument(result.payload);
          setReceiptData(transformed);
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
  }, [receiptId, initialReceiptData, initialDocument, dispatch, company, userProfile]);

  const handlePrint = async () => {
    if (!receiptData && !receiptId) return;

    // Проверяем подключение принтера
    const isPrinterConnected = await checkPrinterConnection();

    if (!isPrinterConnected) {
      alert(
        "Принтер не подключен. Пожалуйста, подключите принтер перед печатью."
      );
      return;
    }

    setPrinting(true);
    try {
      let dataToPrint = receiptData;

      // Если данных нет, загружаем их заново
      if (!dataToPrint && receiptId) {
        const result = await dispatch(getWarehouseDocumentById(receiptId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          dataToPrint = transformWarehouseDocument(result.payload);
          setReceiptData(dataToPrint);
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
      alert(
        "Ошибка при печати чека: " +
          (printError.message || "Неизвестная ошибка")
      );
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptData && !receiptId) return;

    setDownloadingPdf(true);
    try {
      let dataToDownload = receiptData;

      // Если данных нет, загружаем их заново
      if (!dataToDownload && receiptId) {
        const result = await dispatch(getWarehouseDocumentById(receiptId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          dataToDownload = transformWarehouseDocument(result.payload);
          setReceiptData(dataToDownload);
        } else {
          throw new Error("Не удалось загрузить данные чека");
        }
      }

      if (!dataToDownload) {
        throw new Error("Нет данных для генерации PDF");
      }

      // Генерируем PDF из JSON используя ReceiptPdfDocument
      const blob = await pdf(
        <ReceiptPdfDocument data={dataToDownload} />
      ).toBlob();

      const doc = dataToDownload?.document || dataToDownload?.sale || {};
      const fileName = `receipt_${doc.number || doc.doc_no || receiptId}.pdf`;

      // Скачиваем файл
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      console.error("Ошибка при скачивании PDF:", downloadError);
      alert(
        "Ошибка при скачивании PDF: " +
          (downloadError.message || "Неизвестная ошибка"),
          true
      );
    } finally {
      setDownloadingPdf(false);
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
        <div
          className="receipt-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="receipt-preview-modal__loading">Загрузка чека...</div>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="receipt-preview-modal-overlay" onClick={onClose}>
        <div
          className="receipt-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="receipt-preview-modal__error">
            {error || "Чек не найден"}
          </div>
          <div className="receipt-preview-modal__actions">
            <button
              className="receipt-preview-modal__close-btn"
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
  const companyData = receiptData?.company || {};
  const cashierData = receiptData?.cashier || {};
  const clientData = receiptData?.client || null;

  const subtotal = parseFloat(receiptData?.totals?.subtotal || 0);
  const discount = parseFloat(receiptData?.totals?.discount_total || 0);
  const tax = parseFloat(receiptData?.totals?.tax_total || 0);
  const total = parseFloat(receiptData?.totals?.total || 0);

  const payment = receiptData?.payment || {};
  const paidCash =
    payment.method === "cash" ? parseFloat(payment.cash_received || 0) : 0;
  const paidCard = payment.method === "card" ? parseFloat(total) : 0;
  const change = parseFloat(payment.change || 0);

  return (
    <div className="receipt-preview-modal-overlay" onClick={onClose}>
      <div
        className="receipt-preview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="receipt-preview-modal__header">
          <h2 className="receipt-preview-modal__title">
            Предварительный просмотр чека
          </h2>
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
                ЧЕК №{doc.number || doc.doc_no || ""} от{" "}
                {formatDate(doc.date || doc.created_at)}
              </div>
            </div>

            {/* Информация о продавце */}
            <div className="receipt-preview-modal__company-info">
              <div className="receipt-preview-modal__company-name">
                {companyData?.name || "market"}
              </div>
              {companyData?.address && (
                <div className="receipt-preview-modal__company-address">
                  {companyData.address}
                </div>
              )}
            </div>

            {/* Список товаров */}
            <div className="receipt-preview-modal__items">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="receipt-preview-modal__item"
                  >
                    <div className="receipt-preview-modal__item-row">
                      <div className="receipt-preview-modal__item-name">
                        {item.name}
                      </div>
                      <div className="receipt-preview-modal__item-price">
                        {formatMoney(item.qty)} X {formatMoney(item.price)} ≡
                      </div>
                    </div>
                    <div className="receipt-preview-modal__item-total">
                      {formatMoney(item.total)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="receipt-preview-modal__item">
                  <div className="receipt-preview-modal__item-name">
                    Нет товаров
                  </div>
                </div>
              )}
            </div>

            {/* Пунктирная линия перед итогом */}
            <div className="receipt-preview-modal__divider receipt-preview-modal__divider--dashed"></div>

            {/* Итого */}
            <div className="receipt-preview-modal__total-section">
              <div className="receipt-preview-modal__total-label">ИТОГ</div>
              <div className="receipt-preview-modal__total-amount">
                {formatMoney(total)}
              </div>
            </div>

            {/* Информация о кассире и клиенте */}
            {(cashierData?.name || clientData?.full_name) && (
              <div className="receipt-preview-modal__receipt-info">
                {cashierData?.name && (
                  <div className="receipt-preview-modal__info-row">
                    <span>Кассир:</span>
                    <span>{cashierData.name}</span>
                  </div>
                )}
                {clientData?.full_name && (
                  <div className="receipt-preview-modal__info-row">
                    <span>Покупатель:</span>
                    <span>{clientData.full_name}</span>
                  </div>
                )}
              </div>
            )}

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
            className="receipt-preview-modal__download-btn"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            <Download size={20} />
            {downloadingPdf ? "Скачивание..." : "СКАЧАТЬ PDF"}
          </button>
          <button
            className="receipt-preview-modal__print-btn"
            onClick={handlePrint}
            disabled={printing}
          >
            <Printer size={20} />
            {printing ? "Печать..." : "ПЕЧАТАТЬ"}
          </button>
          <button
            className="receipt-preview-modal__close-btn"
            onClick={onClose}
          >
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreviewModal;
