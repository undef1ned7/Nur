import React, { useEffect, useMemo, useState } from "react";
import { X, Printer, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import SummaryPdfDocument from "./SummaryPdfDocument";
import "../InvoicePreviewModal.scss";

/**
 * Предпросмотр / печать / скачивание PDF сводки.
 * Повторяет паттерн InvoicePreviewModal (pdf().toBlob() → iframe).
 */
const SummaryPreviewModal = ({ summary, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doc = useMemo(() => <SummaryPdfDocument summary={summary} />, [summary]);

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";
    (async () => {
      try {
        const blob = await pdf(doc).toBlob();
        objectUrl = window.URL.createObjectURL(blob);
        if (mounted) setPreviewUrl(objectUrl);
      } catch (e) {
        console.error("Ошибка генерации предпросмотра сводки:", e);
        if (mounted) setError("Не удалось сформировать предпросмотр");
      }
    })();
    return () => {
      mounted = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  const fileName = `summary_${summary?.number || summary?.id || "doc"}.pdf`;

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("Ошибка скачивания PDF сводки:", e);
      setError("Не удалось скачать PDF");
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    if (!previewUrl) return;
    const w = window.open(previewUrl, "_blank");
    if (w) w.focus();
  };

  return (
    <div className="invoice-preview-modal-overlay" onClick={onClose}>
      <div
        className="invoice-preview-modal h-full!"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invoice-preview-modal__header">
          <h2 className="invoice-preview-modal__title">
            Предпросмотр сводки {summary?.number ? `№ ${summary.number}` : ""}
          </h2>
          <button className="invoice-preview-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="invoice-preview-modal__content">
          {error ? (
            <div className="invoice-preview-modal__error">{error}</div>
          ) : previewUrl ? (
            <iframe
              title="Предпросмотр сводки"
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
            disabled={!previewUrl || busy}
          >
            <Printer size={20} />
            Печать
          </button>
          <button
            className="invoice-preview-modal__print-btn"
            onClick={handleDownload}
            disabled={busy}
          >
            <Download size={20} />
            {busy ? "Скачивание..." : "Скачать PDF"}
          </button>
          <button className="invoice-preview-modal__close-btn" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryPreviewModal;
