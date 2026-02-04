import { useState, useEffect, useMemo } from "react";
import { X, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import api from "../../../../../api";
import "./ReconciliationModal.scss";
import ReconciliationPdfDocument from "./ReconciliationPdfDocument";
import WarehouseReconciliationPdfDocument from "../../../Warehouse/Documents/components/ReconciliationPdfDocument";
import { useUser } from "../../../../../store/slices/userSlice";

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
  const { company } = useUser();
  const isWarehouseSector = useMemo(() => {
    const sectorName = company?.sector?.name?.toLowerCase().trim();
    if (!sectorName) return false;
    return sectorName === "склад" || sectorName.includes("склад") || sectorName.includes("warehouse");
  }, [company?.sector?.name]);

  const partyLabel = isWarehouseSector ? "Контрагент" : "Клиент";
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    partyId: "",
    source: "both",
    currency: "KGS",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [parties, setParties] = useState([]);
  const [partiesLoading, setPartiesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadParties();
    }
  }, [open, isWarehouseSector]);

  const loadParties = async () => {
    setPartiesLoading(true);
    try {
      const res = isWarehouseSector
        ? await api.get("/warehouse/crud/counterparties/")
        : await api.get("/main/clients/");
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setParties(list);
    } catch (e) {
      console.error("Ошибка при загрузке контрагентов/клиентов:", e);
    } finally {
      setPartiesLoading(false);
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
    if (!filters.partyId) {
      setErr(`Выберите ${partyLabel.toLowerCase()}`);
      return;
    }
    if (isWarehouseSector && (!filters.start || !filters.end)) {
      setErr("Укажите период (дата с и дата по)");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const params = {};
      if (filters.start) params.start = filters.start;
      if (filters.end) params.end = filters.end;
      if (!isWarehouseSector) {
        params.source = filters.source || "both";
      }
      params.currency = filters.currency || "KGS";

      const res = await api.get(
        isWarehouseSector
          ? `/warehouse/counterparties/${filters.partyId}/reconciliation/json/`
          : `/main/clients/${filters.partyId}/reconciliation/json/`,
        { params, headers: { Accept: "application/json" } }
      );

      const data = res?.data;

      const party = parties.find(
        (c) => String(c.id) === String(filters.partyId)
      );
      const partyName =
        party?.name ||
        party?.full_name ||
        party?.fio ||
        `${partyLabel} ${filters.partyId}`;

      const PdfDoc = isWarehouseSector
        ? WarehouseReconciliationPdfDocument
        : ReconciliationPdfDocument;
      const blob = await pdf(
        <PdfDoc
          data={data}
          meta={{
            start: filters.start,
            end: filters.end,
            currency: filters.currency,
            ...(isWarehouseSector
              ? { counterpartyName: partyName }
              : { clientName: partyName, companyName: data?.company?.name }),
          }}
        />
      ).toBlob();

      const filename = `reconciliation_${filters.partyId}_${
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

  return (
    <div className="reconciliation-modal-overlay" onClick={onClose}>
      <div
        className="reconciliation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reconciliation-modal__header">
          <h2 className="reconciliation-modal__title">
            Акт сверки с {partyLabel.toLowerCase()}
          </h2>
          <button className="reconciliation-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="reconciliation-modal__content">
          {err && <div className="reconciliation-modal__error">{err}</div>}

          <div className="reconciliation-modal__form-group">
            <label className="reconciliation-modal__label">{partyLabel}</label>
            <select
              className="reconciliation-modal__input"
              value={filters.partyId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, partyId: e.target.value }))
              }
              disabled={partiesLoading}
            >
              <option value="">Выберите {partyLabel.toLowerCase()}</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name ||
                    party.full_name ||
                    party.fio ||
                    `${partyLabel} ${party.id}`}
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
            {!isWarehouseSector && (
              <div className="reconciliation-modal__form-group">
                <label className="reconciliation-modal__label">Источник</label>
                <select
                  className="reconciliation-modal__input"
                  value={filters.source}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, source: e.target.value }))
                  }
                >
                  <option value="both">Оба</option>
                  <option value="sales">Продажи</option>
                  <option value="deals">Сделки</option>
                </select>
              </div>
            )}
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
              !filters.partyId ||
              (isWarehouseSector && (!filters.start || !filters.end))
            }
          >
            <Download size={18} />
            {loading ? "Загрузка..." : "Загрузить акт"}
          </button>
        </div>
      </div>
    </div>
  );
}
