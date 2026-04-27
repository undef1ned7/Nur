import React, { useEffect, useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import { useDispatch } from "react-redux";
import { pdf } from "@react-pdf/renderer";

import { getWarehouseDocumentById } from "../../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../../store/slices/userSlice";
import { numberToWords } from "../../../../../utils/numberToWords";
import Ko1PdfDocument from "./Ko1PdfDocument";
import "./InvoicePreviewModal.scss";

const Ko1PreviewModal = ({ ko1Id, document: initialDocument, onClose }) => {
  const dispatch = useDispatch();
  const { company, profile } = useUser();
  const [doc, setDoc] = useState(initialDocument || null);
  const [loading, setLoading] = useState(!initialDocument);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const getDocumentAmount = (sourceDoc) => {
    if (!sourceDoc) return 0;
    const explicitTotal = Number(sourceDoc.total);
    if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
      return explicitTotal;
    }
    const items = Array.isArray(sourceDoc.items) ? sourceDoc.items : [];
    return items.reduce((sum, item) => {
      const lineTotal = Number(item.line_total ?? item.total);
      if (Number.isFinite(lineTotal) && lineTotal > 0) return sum + lineTotal;
      const price = Number(item.price ?? item.unit_price ?? 0);
      const qty = Number(item.qty ?? 0);
      return sum + price * qty;
    }, 0);
  };

  const ko1Data = useMemo(() => {
    if (!doc) return null;
    const totalAmount = getDocumentAmount(doc);
    return {
      organization: company?.name || "",
      structuralUnit: "",
      documentNumber: String(doc.number || doc.id || ""),
      date: doc.date || doc.created_at?.split("T")[0] || "",
      receivedFrom:
        doc.counterparty?.name ||
        doc.counterparty_display_name ||
        doc.counterparty ||
        "",
      basis: doc.comment || "Оплата по договору",
      amountNumber: totalAmount.toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      amountWords: numberToWords(totalAmount),
      chiefAccountant: profile?.full_name || profile?.name || "",
      cashier: profile?.full_name || profile?.name || "",
    };
  }, [doc, company, profile]);

  useEffect(() => {
    if (initialDocument) {
      setDoc(initialDocument);
      setLoading(false);
      return;
    }

    const loadDocument = async () => {
      if (!ko1Id) return;
      setLoading(true);
      setError(null);
      try {
        const result = await dispatch(getWarehouseDocumentById(ko1Id));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          setDoc(result.payload);
        } else {
          setError("Не удалось загрузить документ КО-1");
        }
      } catch (loadError) {
        console.error("Ошибка загрузки КО-1:", loadError);
        setError("Ошибка при загрузке КО-1");
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [ko1Id, initialDocument, dispatch]);

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";

    const buildPreview = async () => {
      if (!ko1Data) {
        setPreviewUrl("");
        return;
      }
      try {
        const blob = await pdf(<Ko1PdfDocument data={ko1Data} />).toBlob();
        objectUrl = window.URL.createObjectURL(blob);
        if (mounted) {
          setPreviewUrl(objectUrl);
        }
      } catch (previewError) {
        console.error("Ошибка предпросмотра КО-1:", previewError);
        if (mounted) {
          setPreviewUrl("");
          setError("Не удалось сформировать предпросмотр КО-1");
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
  }, [ko1Data]);

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

  const handlePrint = async () => {
    if (!ko1Data) return;
    setPrinting(true);
    try {
      const blob = await pdf(<Ko1PdfDocument data={ko1Data} />).toBlob();
      const fileName = `ko1_${String(ko1Data.documentNumber || ko1Id).replace(/[^\w.-]+/g, "_")}.pdf`;
      downloadBlob(blob, fileName);
    } catch (printError) {
      console.error("Ошибка печати КО-1:", printError);
      setError("Не удалось сформировать PDF КО-1");
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
            Загрузка КО-1...
          </div>
        </div>
      </div>
    );
  }

  if (error || !ko1Data) {
    return (
      <div className="invoice-preview-modal-overlay" onClick={onClose}>
        <div
          className="invoice-preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="invoice-preview-modal__error">
            {error || "КО-1 не найден"}
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
      <div className="invoice-preview-modal h-full!" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-preview-modal__header">
          <h2 className="invoice-preview-modal__title">
            Предварительный просмотр КО-1
          </h2>
          <button className="invoice-preview-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="invoice-preview-modal__content">
          {previewUrl ? (
            <iframe
              title="Предпросмотр КО-1"
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

export default Ko1PreviewModal;
