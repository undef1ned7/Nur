import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import api from "../../../../../api";
import "./ReconciliationModal.scss";

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
  const [filters, setFilters] = useState({ start: "", end: "", clientId: "" });
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
      const params = new URLSearchParams();
      if (filters.start) params.append("start", filters.start);
      if (filters.end) params.append("end", filters.end);

      const res = await api.get(
        `/main/clients/${filters.clientId}/reconciliation/`,
        {
          params,
          responseType: "blob",
          headers: { Accept: "application/pdf, application/json" },
        }
      );

      const ct = (res.headers?.["content-type"] || "").toLowerCase();

      if (ct.includes("application/pdf")) {
        const filename = nameFromCD(
          res.headers?.["content-disposition"],
          `reconciliation_${filters.clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
        );
        downloadBlob(res.data, filename);
        return;
      }

      if (ct.includes("application/json") || ct.includes("text/json")) {
        const text = await res.data.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Неверный формат ответа при загрузке акта сверки");
        }

        if (json.url) {
          const pdfResp = await fetch(json.url);
          const pdfBlob = await pdfResp.blob();
          downloadBlob(
            pdfBlob,
            `reconciliation_${filters.clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
          );
          return;
        }

        if (json.pdf_base64) {
          const byteChars = atob(json.pdf_base64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
          }
          const pdfBlob = new Blob([new Uint8Array(byteNums)], {
            type: "application/pdf",
          });
          downloadBlob(
            pdfBlob,
            `reconciliation_${filters.clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
          );
          return;
        }

        console.log("reconciliation json", json);
        return;
      }

      const fallbackBlob = new Blob([res.data], { type: "application/pdf" });
      downloadBlob(
        fallbackBlob,
        `reconciliation_${filters.clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
      );
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
          {err && (
            <div className="reconciliation-modal__error">{err}</div>
          )}

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
