import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import warehouseAPI from "../../../../../api/warehouse";
import "./ReconciliationModal.scss";
import ReconciliationPdfDocument from "./ReconciliationPdfDocument";

const msgFromError = (e, fallback = "Произошла ошибка") => {
  if (e?.response?.data) {
    const d = e.response.data;
    if (typeof d === "string") return d;
    if (d?.detail) return d.detail;
    if (d?.message) return d.message;
    if (d?.error) return d.error;
  }
  if (e?.message) return e.message;
  return fallback;
};

export default function ReconciliationModal({ open, onClose }) {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    counterpartyId: "",
    currency: "KGS",
  });
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [err, setErr] = useState("");
  const [counterparties, setCounterparties] = useState([]);
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadCounterparties();
    }
  }, [open]);

  const loadCounterparties = async () => {
    setCounterpartiesLoading(true);
    try {
      const data = await warehouseAPI.listCounterparties({ page_size: 500 });
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setCounterparties(list);
    } catch (e) {
      console.error("Ошибка при загрузке контрагентов:", e);
    } finally {
      setCounterpartiesLoading(false);
    }
  };

  if (!open) return null;

  const downloadBlob = (blob, suggestedName = "reconciliation.pdf") => {
    if (typeof window === "undefined" || !window.URL || !window.document) {
      throw new Error("Браузерное окружение недоступно");
    }
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const nameFromCD = (cd, fallback) => {
    if (!cd) return fallback;
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
    const plain = /filename="?([^"]+)"?/i.exec(cd);
    const raw = (star?.[1] || plain?.[1] || "").trim();
    if (!raw) return fallback;
    try {
      return decodeURIComponent(raw.replace(/^['"]|['"]$/g, ""));
    } catch {
      return raw || fallback;
    }
  };

  const fetchReconciliation = async () => {
    if (!filters.counterpartyId) {
      setErr("Выберите контрагента");
      return;
    }
    if (!filters.start || !filters.end) {
      setErr("Укажите период (дата с и дата по)");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const params = {
        start: filters.start,
        end: filters.end,
        currency: filters.currency || "KGS",
      };

      const data = await warehouseAPI.getReconciliationJson(
        filters.counterpartyId,
        params
      );

      const counterparty = counterparties.find(
        (c) => String(c.id) === String(filters.counterpartyId)
      );
      const counterpartyName =
        counterparty?.name ||
        counterparty?.full_name ||
        counterparty?.fio ||
        `Контрагент ${filters.counterpartyId}`;

      const blob = await pdf(
        <ReconciliationPdfDocument
          data={data}
          meta={{
            start: filters.start,
            end: filters.end,
            currency: filters.currency,
            counterpartyName,
          }}
        />
      ).toBlob();

      const filename = `reconciliation_${filters.counterpartyId}_${
        filters.start || ""
      }_${filters.end || ""}.pdf`;
      downloadBlob(blob, filename);
    } catch (e) {
      console.error(e);
      setErr(msgFromError(e, "Не удалось загрузить акт сверки"));
    } finally {
      setLoading(false);
    }
  };

  const fetchReconciliationPdfFromServer = async () => {
    if (!filters.counterpartyId || !filters.start || !filters.end) {
      setErr("Выберите контрагента и укажите период");
      return;
    }
    setLoadingPdf(true);
    setErr("");
    try {
      const params = {
        start: filters.start,
        end: filters.end,
        currency: filters.currency || "KGS",
      };
      const blob = await warehouseAPI.getReconciliationPdf(
        filters.counterpartyId,
        params
      );
      const filename = `reconciliation_${filters.counterpartyId}_${filters.start}_${filters.end}.pdf`;
      downloadBlob(blob, filename);
    } catch (e) {
      console.error(e);
      setErr(msgFromError(e, "Не удалось скачать PDF с сервера"));
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="reconciliation-modal-overlay" onClick={onClose}>
      <div
        className="reconciliation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reconciliation-modal__header">
          <h2 className="reconciliation-modal__title">
            Акт сверки с контрагентом
          </h2>
          <button className="reconciliation-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="reconciliation-modal__content">
          {err && <div className="reconciliation-modal__error">{err}</div>}

          <div className="reconciliation-modal__form-group">
            <label className="reconciliation-modal__label">Контрагент</label>
            <select
              className="reconciliation-modal__input"
              value={filters.counterpartyId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  counterpartyId: e.target.value,
                }))
              }
              disabled={counterpartiesLoading}
            >
              <option value="">Выберите контрагента</option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={counterparty.id}>
                  {counterparty.name ||
                    counterparty.full_name ||
                    counterparty.fio ||
                    `Контрагент ${counterparty.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="reconciliation-modal__form-row">
            <div className="reconciliation-modal__form-group">
              <label className="reconciliation-modal__label">Дата с</label>
              <input
                className="reconciliation-modal__input"
                type="date"
                value={filters.start}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </div>
            <div className="reconciliation-modal__form-group">
              <label className="reconciliation-modal__label">Дата по</label>
              <input
                className="reconciliation-modal__input"
                type="date"
                value={filters.end}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="reconciliation-modal__form-row">
            <div className="reconciliation-modal__form-group">
              <label className="reconciliation-modal__label">Валюта</label>
              <select
                className="reconciliation-modal__input"
                value={filters.currency}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, currency: e.target.value }))
                }
              >
                <option value="KGS">KGS</option>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        <div className="reconciliation-modal__actions">
          <button
            className="reconciliation-modal__cancel-btn"
            onClick={onClose}
          >
            Отменить
          </button>
          <button
            className="reconciliation-modal__download-btn"
            onClick={fetchReconciliation}
            disabled={
              loading ||
              loadingPdf ||
              !filters.counterpartyId ||
              !filters.start ||
              !filters.end
            }
          >
            <Download size={18} />
            {loading ? "Загрузка…" : "Акт (сформировать PDF)"}
          </button>
          <button
            className="reconciliation-modal__download-btn reconciliation-modal__download-btn--secondary"
            onClick={fetchReconciliationPdfFromServer}
            disabled={
              loadingPdf ||
              loading ||
              !filters.counterpartyId ||
              !filters.start ||
              !filters.end
            }
          >
            <Download size={18} />
            {loadingPdf ? "Загрузка…" : "Скачать PDF с сервера"}
          </button>
        </div>
      </div>
    </div>
  );
}
