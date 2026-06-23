import { useContext, useState } from "react";
import { FileSpreadsheet, X, Download } from "lucide-react";
import { msgFromError } from "../clientDetails.helpers";
import api from "../../../../../api";
import { ThemeModeContext } from "../../../../../theme/ThemeModeProvider";
import "../ClientModals.redesign.scss";

export default function ReconciliationModal({ open, clientId, onClose }) {
  const { mode } = useContext(ThemeModeContext);
  const [filters, setFilters] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!open || !clientId) return null;

  const downloadBlob = (blob, suggestedName = "reconciliation.pdf") => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams();
      if (filters.start) params.append("start", filters.start);
      if (filters.end) params.append("end", filters.end);

      const res = await api.get(`/main/clients/${clientId}/reconciliation/`, {
        params,
        responseType: "blob",
        headers: { Accept: "application/pdf, application/json" },
      });

      const ct = (res.headers?.["content-type"] || "").toLowerCase();

      if (ct.includes("application/pdf")) {
        const filename = nameFromCD(
          res.headers?.["content-disposition"],
          `reconciliation_${clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
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
            `reconciliation_${clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
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
            `reconciliation_${clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
          );
          return;
        }

        console.log("reconciliation json", json);
        return;
      }

      const fallbackBlob = new Blob([res.data], { type: "application/pdf" });
      downloadBlob(
        fallbackBlob,
        `reconciliation_${clientId}_${filters.start || ""}_${filters.end || ""}.pdf`
      );
    } catch (e) {
      console.error(e);
      setErr(msgFromError(e, "Не удалось загрузить акт сверки"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cmx__overlay" data-theme={mode} onClick={onClose}>
      <div
        className="cmx__dialog cmx__dialog--sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cmx__header">
          <div className="cmx__heading">
            <span className="cmx__heading-icon">
              <FileSpreadsheet />
            </span>
            <div className="cmx__heading-text">
              <h3 className="cmx__title">Акт сверки с клиентом</h3>
              <p className="cmx__subtitle">
                Выберите период и выгрузите PDF
              </p>
            </div>
          </div>
          <button className="cmx__close" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </div>

        <div className="cmx__body">
          <div className="cmx__grid">
            <label className="cmx__field">
              <span className="cmx__label">Дата с</span>
              <input
                className="cmx__input"
                type="date"
                value={filters.start}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </label>
            <label className="cmx__field">
              <span className="cmx__label">Дата по</span>
              <input
                className="cmx__input"
                type="date"
                value={filters.end}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </label>
          </div>

          {err && <div className="cmx__alert">{err}</div>}
        </div>

        <div className="cmx__footer">
          <div className="cmx__footer-left">
            <button className="cmx__btn cmx__btn--ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
          <div className="cmx__footer-right">
            <button
              className="cmx__btn cmx__btn--primary"
              onClick={fetchReconciliation}
              disabled={loading}
            >
              <Download />
              {loading ? "Загрузка..." : "Загрузить акт"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
