import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import api from "../../../../../api";
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
    clientId: "",
    source: "both",
    currency: "KGS",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadClients();
    }
  }, [open]);

  const loadClients = async () => {
    setClientsLoading(true);
    try {
      const res = await api.get("/main/clients/");
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setClients(list);
    } catch (e) {
      console.error("Ошибка при загрузке клиентов:", e);
    } finally {
      setClientsLoading(false);
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
    if (!filters.clientId) {
      setErr("Выберите клиента");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const params = {};
      if (filters.start) params.start = filters.start;
      if (filters.end) params.end = filters.end;
      params.source = filters.source || "both";
      params.currency = filters.currency || "KGS";

      // Новый эндпойнт "классического" акта сверки:
      // GET /api/main/clients/{client_id}/reconciliation/classic/?start=...&end=...&source=...&currency=KGS
      const res = await api.get(
        `/main/clients/${filters.clientId}/reconciliation/json/`,
        { params, headers: { Accept: "application/json" } }
      );

      const data = res?.data;

      const client = clients.find(
        (c) => String(c.id) === String(filters.clientId)
      );
      const clientName =
        client?.full_name ||
        client?.fio ||
        client?.name ||
        `Клиент ${filters.clientId}`;

      const blob = await pdf(
        <ReconciliationPdfDocument
          data={data}
          meta={{
            start: filters.start,
            end: filters.end,
            currency: filters.currency,
            clientName,
            companyName: data?.company?.name,
          }}
        />
      ).toBlob();

      const filename = `reconciliation_${filters.clientId}_${
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
          <h2 className="reconciliation-modal__title">Акт сверки с клиентом</h2>
          <button className="reconciliation-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="reconciliation-modal__content">
          {err && <div className="reconciliation-modal__error">{err}</div>}

          <div className="reconciliation-modal__form-group">
            <label className="reconciliation-modal__label">Клиент</label>
            <select
              className="reconciliation-modal__input"
              value={filters.clientId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, clientId: e.target.value }))
              }
              disabled={clientsLoading}
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name ||
                    client.fio ||
                    client.name ||
                    `Клиент ${client.id}`}
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
            disabled={loading || !filters.clientId}
          >
            <Download size={18} />
            {loading ? "Загрузка..." : "Загрузить акт"}
          </button>
        </div>
      </div>
    </div>
  );
}
