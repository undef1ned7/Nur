import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaPrint, FaSyncAlt } from "react-icons/fa";
import {
  listAuthorizedPrinters,
  choosePrinterByDialog,
  getSavedPrinters,
  getActivePrinterKey,
  setActivePrinterByKey,
} from "../OrdersPrintService";
import "./PrinterSelect.scss";

const safeName = (p) => p?.name || "USB Printer";

const PrinterSelect = () => {
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState([]);
  const [saved, setSaved] = useState([]);
  const [activeKey, setActiveKey] = useState(getActivePrinterKey());
  const [selectedKey, setSelectedKey] = useState(getActivePrinterKey());

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
      const a = getActivePrinterKey();
      setActiveKey(a);
      setSelectedKey((prev) => prev || a);
    } catch (e) {
      console.error("Printer refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPick = async () => {
    setLoading(true);
    try {
      await choosePrinterByDialog();
      await refresh();
    } catch (e) {
      console.error("Choose printer error:", e);
    } finally {
      setLoading(false);
    }
  };

  const onSetActive = async () => {
    if (!selectedKey) return;
    setLoading(true);
    try {
      await setActivePrinterByKey(selectedKey);
      const a = getActivePrinterKey();
      setActiveKey(a);
    } catch (e) {
      console.error("Set active printer error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cafeOrdersPrinterSelect">
      <div className="cafeOrdersPrinterSelect__row">
        <select
          className="cafeOrdersPrinterSelect__select"
          value={selectedKey || ""}
          onChange={(e) => setSelectedKey(e.target.value)}
          disabled={loading}
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
          className="cafeOrdersPrinterSelect__btn cafeOrdersPrinterSelect__btn--ghost"
          onClick={refresh}
          disabled={loading}
          title="Обновить список"
        >
          <FaSyncAlt />
        </button>

        <button
          type="button"
          className="cafeOrdersPrinterSelect__btn cafeOrdersPrinterSelect__btn--secondary"
          onClick={onPick}
          disabled={loading}
          title="Открыть диалог WebUSB и выбрать принтер"
        >
          <FaPrint /> Выбрать
        </button>

        <button
          type="button"
          className="cafeOrdersPrinterSelect__btn cafeOrdersPrinterSelect__btn--primary"
          onClick={onSetActive}
          disabled={loading || !selectedKey}
          title="Сделать выбранный принтер активным"
        >
          Активный
        </button>
      </div>
    </div>
  );
};

export default PrinterSelect;
