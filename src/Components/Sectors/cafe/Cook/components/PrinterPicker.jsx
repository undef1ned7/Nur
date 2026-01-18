// src/.../PrinterPicker.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaPrint, FaSyncAlt } from "react-icons/fa";
import {
  listAuthorizedPrinters,
  choosePrinterByDialog,
  getSavedPrinters,
  getActivePrinterKey,
} from "../../Orders/OrdersPrintService";

const safeName = (p) => p?.name || "USB Printer";

/**
 * Controlled printer picker (NO auto-set active).
 * Purpose: choose a printer key to bind with an entity (Kitchen).
 */
const PrinterPicker = ({ value, onChange, disabled, label = "Чековый аппарат" }) => {
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState([]);
  const [saved, setSaved] = useState([]);

  const merged = useMemo(() => {
    const map = new Map();
    for (const p of saved) map.set(p.key, p);
    for (const p of authorized) {
      if (!map.has(p.key)) map.set(p.key, p);
    }
    return Array.from(map.values());
  }, [saved, authorized]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSaved(getSavedPrinters());
      const list = await listAuthorizedPrinters();
      setAuthorized(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("PrinterPicker refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // если value пустой — аккуратно проставим активный (если он есть)
  useEffect(() => {
    if (value) return;
    const active = getActivePrinterKey();
    if (active) onChange?.(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickByDialog = useCallback(async () => {
    setLoading(true);
    try {
      const picked = await choosePrinterByDialog();
      await refresh();
      if (picked?.key) onChange?.(picked.key);
    } catch (e) {
      console.error("PrinterPicker choose error:", e);
    } finally {
      setLoading(false);
    }
  }, [onChange, refresh]);

  const activeKey = getActivePrinterKey();

  return (
    <div className="cafeCookPpick">
      {label ? <div className="cafeCookPpick__label">{label}</div> : null}

      <div className="cafeCookPpick__row">
        <select
          className="cafeCookPpick__select"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled || loading}
          title="Выберите принтер для печати чеков"
        >
          <option value="">— Выберите принтер —</option>
          {merged.map((p) => (
            <option key={p.key} value={p.key}>
              {safeName(p)} ({p.key}){p.key === activeKey ? " • активный" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cafeCookPpick__btn cafeCookPpick__btn--ghost"
          onClick={refresh}
          disabled={disabled || loading}
          title="Обновить список"
          aria-label="Обновить список"
        >
          <FaSyncAlt />
        </button>

        <button
          type="button"
          className="cafeCookPpick__btn cafeCookPpick__btn--secondary"
          onClick={onPickByDialog}
          disabled={disabled || loading}
          title="Открыть диалог WebUSB и выбрать принтер"
        >
          <FaPrint /> Выбрать
        </button>
      </div>

      <div className="cafeCookPpick__hint">
        Выбранный чековый аппарат будет привязан к этой кухне.
      </div>
    </div>
  );
};

export default PrinterPicker;
