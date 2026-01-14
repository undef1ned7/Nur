import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaPlus, FaPrint, FaSyncAlt, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import {
  listAuthorizedPrinters,
  choosePrinterByDialog,
  getSavedPrinters,
  getActivePrinterKey,
  setActivePrinterByKey,
} from "../Orders/OrdersPrintService";
import "./KitchenCreateModal.scss";

const safeName = (p) => p?.name || "USB Printer";
const shortKey = (k) => String(k || "").split(":").slice(0, 2).join(":");

const asListFrom = (res) => res?.data?.results || res?.data || [];

const readKitchenPrinterMap = () => {
  try {
    const raw = localStorage.getItem("kitchen_printer_map");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeKitchenPrinterMap = (obj) => {
  try {
    localStorage.setItem("kitchen_printer_map", JSON.stringify(obj || {}));
  } catch {}
};

const KitchenCreateModal = ({ open, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [authorized, setAuthorized] = useState([]);
  const [saved, setSaved] = useState([]);

  const [activeKey, setActiveKey] = useState(getActivePrinterKey());
  const [selectedKey, setSelectedKey] = useState(getActivePrinterKey());

  const merged = useMemo(() => {
    const map = new Map();
    for (const p of saved) map.set(p.key, p);
    for (const p of authorized) if (!map.has(p.key)) map.set(p.key, p);
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
      console.error("KitchenCreateModal refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    refresh();
  }, [open, refresh]);

  const onPickByDialog = async () => {
    setLoading(true);
    try {
      await choosePrinterByDialog();
      await refresh();
    } catch (e) {
      console.error("KitchenCreateModal choose printer error:", e);
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
      console.error("KitchenCreateModal set active error:", e);
    } finally {
      setLoading(false);
    }
  };

  const computeNextKitchenNumber = async () => {
    try {
      const r = await api.get("/cafe/kitchens/");
      const list = asListFrom(r) || [];
      const maxN = list.reduce((m, k) => Math.max(m, Number(k?.number) || 0), 0);
      return maxN + 1;
    } catch {
      return 1;
    }
  };

  const createKitchen = async () => {
    const t = title.trim();
    if (!t || !selectedKey) return;

    setSaving(true);
    try {
      const nextNumber = await computeNextKitchenNumber();

      let created = null;

      try {
        const r = await api.post("/cafe/kitchens/", {
          title: t,
          printer_key: selectedKey,
        });
        created = r?.data || null;
      } catch (e1) {
        try {
          const r2 = await api.post("/cafe/kitchens/", {
            title: t,
            number: nextNumber,
          });
          created = r2?.data || null;

          if (created?.id) {
            const map = readKitchenPrinterMap();
            map[String(created.id)] = selectedKey;
            writeKitchenPrinterMap(map);
          }
        } catch (e2) {
          throw e2;
        }
      }

      onCreated?.(created);
      onClose?.();
    } catch (e) {
      console.error("Kitchen create error:", e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="kitchen-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="kitchen-modal__card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="kitchen-modal__head">
          <div className="kitchen-modal__headText">
            <div className="kitchen-modal__title">Создать кухню</div>
            <div className="kitchen-modal__subtitle">
              Выберите чековый аппарат — он будет закреплён за этой кухней.
            </div>
          </div>

          <button
            type="button"
            className="kitchen-modal__close"
            onClick={() => (!saving ? onClose?.() : null)}
            aria-label="Закрыть"
            title="Закрыть"
            disabled={saving}
          >
            <FaTimes />
          </button>
        </div>

        <div className="kitchen-modal__body">
          <div className="kitchen-modal__field">
            <div className="kitchen-modal__label">Кухня</div>
            <input
              className="kitchen-modal__input"
              placeholder="Например: Основная кухня"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              autoComplete="off"
            />
          </div>

          <div className="kitchen-modal__field">
            <div className="kitchen-modal__label">Чековый аппарат</div>

            <div className="kitchen-modal__printerRow">
              <select
                className="kitchen-modal__select"
                value={selectedKey || ""}
                onChange={(e) => setSelectedKey(e.target.value)}
                disabled={loading || saving}
                title="Выберите принтер"
              >
                <option value="">— Выберите принтер —</option>
                {merged.map((p) => (
                  <option key={p.key} value={p.key}>
                    {safeName(p)} ({shortKey(p.key)}){p.key === activeKey ? " • активный" : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="kitchen-modal__iconBtn"
                onClick={refresh}
                disabled={loading || saving}
                title="Обновить список"
              >
                <FaSyncAlt />
              </button>

              <button
                type="button"
                className="kitchen-modal__btn kitchen-modal__btn--primary"
                onClick={onPickByDialog}
                disabled={loading || saving}
                title="Открыть диалог WebUSB и выбрать принтер"
              >
                <FaPrint /> Выбрать
              </button>

              <button
                type="button"
                className="kitchen-modal__btn kitchen-modal__btn--ghost"
                onClick={onSetActive}
                disabled={loading || saving || !selectedKey}
                title="Сделать выбранный принтер активным"
              >
                Активный
              </button>
            </div>
          </div>
        </div>

        <div className="kitchen-modal__footer">
          <button
            type="button"
            className="kitchen-modal__btn kitchen-modal__btn--ghost"
            onClick={() => (!saving ? onClose?.() : null)}
            disabled={saving}
          >
            Закрыть
          </button>

          <button
            type="button"
            className="kitchen-modal__btn kitchen-modal__btn--primary"
            onClick={createKitchen}
            disabled={saving || !title.trim() || !selectedKey}
          >
            <FaPlus /> {saving ? "Создаём…" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitchenCreateModal;
