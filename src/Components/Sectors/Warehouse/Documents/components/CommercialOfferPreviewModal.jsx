import React, { useState, useEffect, useMemo } from "react";
import { X, Printer } from "lucide-react";
import { useDispatch } from "react-redux";
import { pdf } from "@react-pdf/renderer";

import { getWarehouseDocumentById } from "../../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../../store/slices/userSlice";
import CommercialOfferPdfDocument from "./CommercialOfferPdfDocument";

import "./InvoicePreviewModal.scss";
import { useAlert } from "../../../../../hooks/useDialog";

const CommercialOfferPreviewModal = ({
  invoiceId,
  invoiceData: initialInvoiceData,
  document: initialDocument,
  onClose,
}) => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { company } = useUser();
  const [invoiceData, setInvoiceData] = useState(initialInvoiceData);
  const [loading, setLoading] = useState(
    !initialInvoiceData && !initialDocument,
  );
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const transformWarehouseDocument = (doc) => {
    if (!doc) return null;

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

    const buyer =
      doc.counterparty && typeof doc.counterparty === "object"
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
        : doc.counterparty_display_name
          ? {
              id: String(doc.counterparty || ""),
              name: doc.counterparty_display_name || "",
              inn: "",
              okpo: "",
              score: "",
              bik: "",
              address: "",
              phone: null,
              email: null,
            }
          : null;

    const docDiscountPercent = Number(doc.discount_percent || 0);
    const docDiscountAmount = Number(doc.discount_amount || 0);

    const items = Array.isArray(doc.items)
      ? doc.items.map((item) => {
          const price = Number(item.price || 0);
          const qty = Number(item.qty || item.quantity || 0);
          const lineTotal = price * qty;
          return {
            id: item.id,
            product_image_url: item.product_image_url || "",
            image_url: item.product_image_url || item.image_url || "",
            imageDataUrl: item.product_image_url || item.image_url || "",
            name:
              item.product_name ??
              item.product?.name ??
              item.name ??
              item.product?.title ??
              "Товар",
            qty: String(qty),
            unit_price: String(price.toFixed(2)),
            total: String(lineTotal.toFixed(2)),
            unit: item.product?.unit ?? item.unit ?? "ШТ",
            article:
              String(
                item.product?.article ??
                  item.article ??
                  item.product_article ??
                  "",
              ).trim() || "",
            discount_percent: Number(item.discount_percent || 0),
            discount_amount: Number(item.discount_amount || 0),
            price_before_discount: String(price.toFixed(2)),
            description:
              item.product?.characteristics?.description ??
              item.product?.description ??
              item.description ??
              item.product_description ??
              "",
            product_description:
              item.product?.characteristics?.description ??
              item.product?.description ??
              item.description ??
              item.product_description ??
              "",
            product_characteristics:
              item.product_characteristics ??
              item.product?.product_characteristics ??
              item.product?.characteristics ??
              item.characteristics ??
              null,
            characteristics:
              item.product_characteristics ??
              item.product?.characteristics ??
              item.characteristics ??
              null,
          };
        })
      : [];

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.qty),
      0,
    );
    const itemsDiscountTotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.unit_price) *
          Number(item.qty) *
          Number(item.discount_percent || 0)) /
          100,
      0,
    );
    const totalDiscount = itemsDiscountTotal + docDiscountAmount;
    const total = Number(doc.total) || subtotal - totalDiscount;

    const warehouseName = doc.warehouse_from?.name || doc.warehouse?.name || "";
    const warehouseToName = doc.warehouse_to?.name || "";

    return {
      doc_type: "COMMERCIAL_OFFER",
      document: {
        type: "commercial_offer",
        doc_type: "COMMERCIAL_OFFER",
        title: "Коммерческое предложение",
        id: doc.id,
        number: doc.number || "",
        date: doc.date || doc.created_at?.split("T")[0] || "",
        datetime: doc.created_at || doc.date || "",
        created_at: doc.created_at || "",
        discount_percent: docDiscountPercent,
        discount_amount: docDiscountAmount,
        discount_total: docDiscountAmount,
        comment: doc.comment ?? "",
      },
      seller,
      buyer,
      items,
      totals: {
        subtotal: String(subtotal.toFixed(2)),
        discount_total: String(totalDiscount.toFixed(2)),
        tax_total: "0.00",
        total: String(total.toFixed(2)),
      },
      warehouse: warehouseName,
      warehouse_to: warehouseToName,
    };
  };

  const prepareItemsWithImages = async (items) => {
    return Promise.all(
      items.map(async (item) => {
        const rawSrc = item.product_image_url || item.image_url || "";
        if (!rawSrc) return { ...item, imageDataUrl: "" };

        try {
          const dataUrl = await new Promise((resolve) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                canvas.getContext("2d").drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.85));
              } catch (e) {
                resolve("");
              }
            };
            img.onerror = () => resolve("");
            img.src = rawSrc;
          });
          return {
            ...item,
            imageDataUrl:
              typeof dataUrl === "string" && dataUrl.startsWith("data:")
                ? dataUrl
                : "",
          };
        } catch (e) {
          return { ...item, imageDataUrl: "" };
        }
      }),
    );
  };

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

  const previewSourceData = useMemo(() => {
    if (initialInvoiceData) return initialInvoiceData;
    if (invoiceData) return invoiceData;
    if (initialDocument) return transformWarehouseDocument(initialDocument);
    return null;
  }, [initialInvoiceData, invoiceData, initialDocument]);

  useEffect(() => {
    if (initialInvoiceData) {
      setInvoiceData(initialInvoiceData);
      setLoading(false);
      return;
    }

    if (initialDocument) {
      const transformed = transformWarehouseDocument(initialDocument);
      setInvoiceData(transformed);
      setLoading(false);
      return;
    }

    const loadInvoice = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await dispatch(getWarehouseDocumentById(invoiceId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          const transformed = transformWarehouseDocument(result.payload);
          setInvoiceData(transformed);
        } else {
          setError("Не удалось загрузить коммерческое предложение");
        }
      } catch (err) {
        console.error("Ошибка при загрузке коммерческого предложения:", err);
        setError("Ошибка при загрузке коммерческого предложения");
      } finally {
        setLoading(false);
      }
    };

    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId, initialInvoiceData, initialDocument, dispatch, company]);

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";

    const buildPreview = async () => {
      if (!previewSourceData) {
        setPreviewUrl("");
        return;
      }

      try {
        const itemsWithImages = await prepareItemsWithImages(
          previewSourceData.items || [],
        );
        const dataWithImages = { ...previewSourceData, items: itemsWithImages };
        const blob = await pdf(
          <CommercialOfferPdfDocument data={dataWithImages} />,
        ).toBlob();
        objectUrl = window.URL.createObjectURL(blob);
        if (mounted) {
          setPreviewUrl(objectUrl);
        }
      } catch (previewError) {
        console.error(
          "Ошибка при генерации превью коммерческого предложения:",
          previewError,
        );
        if (mounted) {
          setPreviewUrl("");
          setError("Не удалось сформировать предпросмотр");
        }
      }
    };

    buildPreview();

    return () => {
      mounted = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewSourceData]);

  const handlePrint = async () => {
    if (!invoiceId && !invoiceData) return;

    setPrinting(true);
    try {
      let data = invoiceData;

      if (!data && invoiceId) {
        const result = await dispatch(getWarehouseDocumentById(invoiceId));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          data = transformWarehouseDocument(result.payload);
          setInvoiceData(data);
        } else {
          throw new Error("Не удалось загрузить коммерческое предложение");
        }
      }

      if (!data) throw new Error("Нет данных для генерации PDF");

      const itemsWithImages = await prepareItemsWithImages(data.items || []);
      const dataWithImages = { ...data, items: itemsWithImages };
      const blob = await pdf(
        <CommercialOfferPdfDocument data={dataWithImages} />,
      ).toBlob();

      const fileName = `commercial_offer_${data?.document?.number || invoiceId}.pdf`;
      downloadBlob(blob, fileName);
    } catch (printError) {
      console.error("Ошибка при генерации PDF:", printError);
      alert(
        "Ошибка при генерации PDF: " +
          (printError.message || "Неизвестная ошибка"),
      );
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="invoice-preview-modal-overlay" onClick={onClose}>
        <div
          className="invoice-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="invoice-preview-modal__loading">
            Загрузка коммерческого предложения...
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
            {error || "Коммерческое предложение не найдено"}
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

  return (
    <div className="invoice-preview-modal-overlay" onClick={onClose}>
      <div
        className="invoice-preview-modal h-full!"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invoice-preview-modal__header">
          <h2 className="invoice-preview-modal__title">
            Предварительный просмотр коммерческого предложения
          </h2>
          <button className="invoice-preview-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="invoice-preview-modal__content">
          {previewUrl ? (
            <iframe
              title="Предпросмотр коммерческого предложения"
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div className="invoice-preview-modal__loading">
              Формируем предпросмотр...
            </div>
          )}
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

export default CommercialOfferPreviewModal;
