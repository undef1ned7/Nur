// src/.../KitchenModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import api from "../../../../api";
import PrinterPicker from "./PrinterPicker";

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const nextKitchenNumber = (kitchens) => {
  const arr = Array.isArray(kitchens) ? kitchens : [];
  const max = arr.reduce((m, k) => Math.max(m, Math.floor(toNum(k?.number) || 0)), 0);
  return Math.max(1, max + 1);
};

const humanApiError = (ex) => {
  const d = ex?.response?.data;
  if (d?.detail) return String(d.detail);
  if (typeof d === "string") return d;

  if (d && typeof d === "object") {
    try {
      const parts = Object.entries(d).map(([k, v]) => {
        const msg = Array.isArray(v) ? v.join(", ") : String(v);
        return `${k}: ${msg}`;
      });
      return parts.join("\n");
    } catch {
      // ignore
    }
  }

  return ex?.message ? String(ex.message) : "Не удалось создать кухню.";
};

const KitchenModal = ({ open, onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [printerKey, setPrinterKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  const overlayRef = useRef(null);

  const canSave = useMemo(() => {
    const t = title.trim();
    return t.length >= 1 && !!printerKey && !saving;
  }, [title, printerKey, saving]);

  const closeSafe = useCallback(() => {
    if (saving) return;
    onClose?.();
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") closeSafe();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeSafe]);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPrinterKey("");
    setSaving(false);
    setSuccess(false);
    setErr("");
  }, [open]);

  const onOverlayMouseDown = useCallback(
    (e) => {
      if (e.target === overlayRef.current) closeSafe();
    },
    [closeSafe]
  );

  const onSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      if (!canSave) return;

      setErr("");
      setSaving(true);
      setSuccess(false);

      try {
        // 1) number обязателен в текущем Swagger → делаем авто-number
        const r = await api.get("/cafe/kitchens/");
        const kitchens = r?.data?.results || r?.data || [];
        const number = nextKitchenNumber(kitchens);

        // 2) отправляем привязку принтера
        // ВАЖНО: поле printer_key должно быть в сериализаторе Kitchen на бэке.
        const payload = {
          title: title.trim(),
          number,
          printer_key: printerKey,
        };

        await api.post("/cafe/kitchens/", payload);

        setSuccess(true);
        onCreated?.();
      } catch (ex) {
        console.error("Kitchen create error:", ex);
        setErr(humanApiError(ex));
      } finally {
        setSaving(false);
      }
    },
    [canSave, title, printerKey, onCreated]
  );

  if (!open) return null;

  return (
    <div
      className="cookModal"
      role="dialog"
      aria-modal="true"
      aria-label="Создать кухню"
      ref={overlayRef}
      onMouseDown={onOverlayMouseDown}
    >
      <div className="cookModal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cookModal__head">
          <div className="cookModal__titleBlock">
            <div className="cookModal__title">Создать кухню</div>
            <div className="cookModal__subtitle">
              Выберите чековый аппарат — он будет закреплён за этой кухней.
            </div>
          </div>

          <button
            type="button"
            className="cookModal__close"
            onClick={closeSafe}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="cookModal__body" onSubmit={onSubmit}>
          <div className="cookModal__grid cookModal__grid--kitchen">
            <label className="cookModal__field">
              <span className="cookModal__label">Кухня</span>
              <input
                className="cookModal__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Основная кухня"
                type="text"
                autoComplete="off"
                disabled={saving}
              />
            </label>

            <div className="cookModal__field cookModal__field--wide">
              <PrinterPicker
                value={printerKey}
                onChange={setPrinterKey}
                disabled={saving}
                label="Чековый аппарат"
              />
            </div>
          </div>

          {err ? (
            <div className="cookModal__alert cookModal__alert--error">{err}</div>
          ) : null}

          {success ? (
            <div className="cookModal__alert cookModal__alert--ok">
              Кухня успешно создана и принтер привязан.
            </div>
          ) : null}

          <div className="cookModal__actions">
            <button
              type="button"
              className="cookModal__btn cookModal__btn--ghost"
              onClick={closeSafe}
              disabled={saving}
            >
              Закрыть
            </button>

            <button
              type="submit"
              className="cookModal__btn cookModal__btn--primary"
              disabled={!canSave}
              title="Создать кухню"
            >
              <FaPlus />
              {saving ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KitchenModal;
