import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import {
  choosePrinterByDialog,
  getSavedPrinters,
  listAuthorizedPrinters,
  formatPrinterBinding,
  parsePrinterBinding,
  printOrderReceiptJSONViaUSB,
  printViaWiFiSimple,
  setActivePrinterByKey,
} from "../../../Sectors/cafe/Orders/OrdersPrintService";

const safeName = (p) => p?.name || "USB Printer";

export default function CafeReceiptPrinterSettings({ showAlert }) {
  const [device, setDevice] = useState("wifi"); // wifi | usb
  const [ipPort, setIpPort] = useState("");
  const [usbKey, setUsbKey] = useState("");
  const [bridgeUrl, setBridgeUrl] = useState("");

  const [loadingUsb, setLoadingUsb] = useState(false);
  const [authorized, setAuthorized] = useState([]);
  const [saved, setSaved] = useState([]);

  const mergedUsb = useMemo(() => {
    const map = new Map();
    for (const p of saved) map.set(p.key, p);
    for (const p of authorized) if (!map.has(p.key)) map.set(p.key, p);
    return Array.from(map.values());
  }, [saved, authorized]);

  const refreshUsb = useCallback(async () => {
    setLoadingUsb(true);
    try {
      setSaved(getSavedPrinters());
      const list = await listAuthorizedPrinters();
      setAuthorized(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("CafeReceiptPrinterSettings refreshUsb error:", e);
    } finally {
      setLoadingUsb(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("cafe_receipt_printer") || "";
    const parsed = parsePrinterBinding(raw);
    if (parsed.kind === "usb") {
      setDevice("usb");
      setUsbKey(parsed.usbKey || "");
    } else if (parsed.kind === "ip") {
      setDevice("wifi");
      setIpPort(parsed.port === 9100 ? parsed.ip : `${parsed.ip}:${parsed.port}`);
    }

    const url = localStorage.getItem("cafe_printer_bridge_url") || "http://127.0.0.1:5179/print";
    setBridgeUrl(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (device !== "usb") return;
    refreshUsb();
  }, [device, refreshUsb]);
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await api.get("/cafe/receipt-printer/");
        const { printer = "", bridge_url = "" } = data || {};
        const parsed = parsePrinterBinding(printer);
        if (parsed.kind === "usb") {
          setDevice("usb");
          setUsbKey(parsed.usbKey || "");
        } else if (parsed.kind === "ip") {
          setDevice("wifi");
          setIpPort(parsed.port === 9100 ? parsed.ip : `${parsed.ip}:${parsed.port}`);
        } else {
          // иначе, сбрасываем в пустые значения (дефолт)
          setDevice("wifi");
          setIpPort("");
          setUsbKey("");
        }
        setBridgeUrl(bridge_url || "http://127.0.0.1:5179/print");
      } catch (e) {
        // если ошибка, оставляем дефолтные значения
        // Можно прижать set* к дефолтам, если нужно сбрасывать
        // console.error("Не удалось получить настройки принтера:", e);
      }
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToBackend = useCallback(async (binding) => {
    if (!binding) return false;
    if (!bridgeUrl.trim()) return false;
    try {
      await api.patch("/cafe/receipt-printer/", { printer: binding, bridge_url: bridgeUrl });
      return true;
    } catch (e) {
      console.error("CafeReceiptPrinterSettings saveToBackend error:", e);
      return false;
    }
  }, [bridgeUrl]);

  const save = useCallback(async () => {
    if (device === "wifi") {
      const binding = formatPrinterBinding({ kind: "ip", ipPort });
      const parsed = parsePrinterBinding(`ip/${ipPort}`);
      if (!binding || parsed.kind !== "ip") {
        showAlert?.("error", "Введите IP:порт (например 192.168.1.200:9100)");
        return;
      }
      localStorage.setItem("cafe_receipt_printer", binding);
      localStorage.setItem("cafe_printer_bridge_url", bridgeUrl || "http://127.0.0.1:5179/print");
      const ok = await saveToBackend(binding);
      if (ok) {
        showAlert?.("success", "Принтер кассы сохранён");
      } else {
        showAlert?.("warning", "Сохранено локально, но сервер не принял принтер");
      }
      return;
    }

    if (!usbKey.trim()) {
      showAlert?.("error", "Выберите USB‑принтер");
      return;
    }
    const binding = formatPrinterBinding({ kind: "usb", usbKey: usbKey.trim() });
    if (!binding) {
      showAlert?.("error", "Некорректный USB‑принтер");
      return;
    }
    localStorage.setItem("cafe_receipt_printer", binding);
    localStorage.setItem("cafe_printer_bridge_url", bridgeUrl || "http://127.0.0.1:5179/print");
    const ok = await saveToBackend(binding);
    if (ok) {
      showAlert?.("success", "Принтер кассы сохранён");
    } else {
      showAlert?.("warning", "Сохранено локально, но сервер не принял принтер");
    }
  }, [device, ipPort, usbKey, bridgeUrl, showAlert, saveToBackend]);

  const chooseUsb = useCallback(async () => {
    setLoadingUsb(true);
    try {
      const picked = await choosePrinterByDialog();
      await refreshUsb();
      if (picked?.key) setUsbKey(picked.key);
      showAlert?.("success", "USB‑принтер выбран");
    } catch (e) {
      console.error("CafeReceiptPrinterSettings chooseUsb error:", e);
      showAlert?.("error", "Не удалось выбрать USB‑принтер");
    } finally {
      setLoadingUsb(false);
    }
  }, [refreshUsb, showAlert]);

  const testPrint = useCallback(async () => {
    const raw = localStorage.getItem("cafe_receipt_printer") || "";
    const parsed = parsePrinterBinding(raw);
    if (!raw || parsed.kind === "" || parsed.kind === "unknown") {
      showAlert?.("warning", "Сначала настройте принтер кассы и нажмите «Сохранить»");
      return;
    }

    const payload = {
      company: localStorage.getItem("company_name") || "КАССА",
      doc_no: "ТЕСТ",
      created_at: new Date().toLocaleString("ru-RU"),
      cashier_name: "TEST",
      discount: 0,
      tax: 0,
      paid_cash: 0,
      paid_card: 0,
      change: 0,
      items: [{ name: "Тестовая печать", qty: 1, price: 0 }],
    };

    try {
      if (parsed.kind === "ip") {
        await printViaWiFiSimple(payload, parsed.ip, parsed.port);
      } else if (parsed.kind === "usb") {
        await setActivePrinterByKey(parsed.usbKey);
        await printOrderReceiptJSONViaUSB(payload);
      }
      showAlert?.("success", "Тест отправлен на печать");
    } catch (e) {
      console.error("CafeReceiptPrinterSettings testPrint error:", e);
      showAlert?.("error", "Не удалось отправить тест на печать");
    }
  }, [showAlert]);

  return (
    <div className="settings__section">
      <h2 className="settings__section-title">
        <span className="settings__emoji">🧾</span> Кафе • Принтер кассы (чековый аппарат)
      </h2>

      <p className="settings__mutedText" style={{ marginTop: -8 }}>
        Этот принтер используется для печати чеков оплаты. Принтеры кухонь настраиваются отдельно при создании кухни.
      </p>

      <div className="settings__form-group">
        <div className="settings__label">Тип подключения</div>
        <div className="settings__segmented">
          <button
            type="button"
            className={`settings__segBtn ${device === "wifi" ? "settings__segBtn--active" : ""}`}
            onClick={() => setDevice("wifi")}
          >
            Wi‑Fi (IP:порт)
          </button>
          <button
            type="button"
            className={`settings__segBtn ${device === "usb" ? "settings__segBtn--active" : ""}`}
            onClick={() => setDevice("usb")}
          >
            USB
          </button>
        </div>
      </div>

      {device === "wifi" ? (
        <>
          <div className="settings__form-group">
            <label className="settings__label" htmlFor="cafeReceiptIpPort">
              IP принтера
            </label>
            <div className="settings__input-wrapper">
              <input
                id="cafeReceiptIpPort"
                className="settings__input settings__input--plain"
                placeholder="192.168.1.200:9100"
                value={ipPort}
                onChange={(e) => setIpPort(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="settings__mutedText" style={{ marginTop: 8 }}>
              Для XPrinter обычно порт: <b>9100</b>.
            </p>
          </div>

          <div className="settings__form-group">
            <label className="settings__label" htmlFor="cafeBridgeUrl">
              Printer‑bridge URL
            </label>
            <div className="settings__input-wrapper">
              <input
                id="cafeBridgeUrl"
                className="settings__input settings__input--plain"
                placeholder="http://127.0.0.1:5179/print"
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="settings__warnBox" style={{ marginTop: 10 }}>
              Нужен агент или bridge на ПК в той же сети, что и браузер кассы (например{" "}
              <code>tools/printer-agent</code> или <code>npm run printer-bridge</code>). В поле URL укажите IP
              этого ПК <b>в той подсети, откуда открыт NurCRM</b> (при одновременном LAN и Wi‑Fi у агента —
              разные строки в окне агента).
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="settings__form-group">
            <div className="settings__label">USB‑принтер</div>
            <div className="settings__usbRow">
              <select
                className="settings__select"
                value={usbKey || ""}
                onChange={(e) => setUsbKey(e.target.value)}
                disabled={loadingUsb}
                title="Выберите USB‑принтер"
              >
                <option value="">— Выберите принтер —</option>
                {mergedUsb.map((p) => (
                  <option key={p.key} value={p.key}>
                    {safeName(p)} ({p.key})
                  </option>
                ))}
              </select>
              <button type="button" className="settings__btnSmall settings__btnSmall--secondary" onClick={refreshUsb} disabled={loadingUsb}>
                Обновить
              </button>
              <button type="button" className="settings__btnSmall settings__btnSmall--primary" onClick={chooseUsb} disabled={loadingUsb}>
                Выбрать
              </button>
            </div>
            <p className="settings__mutedText" style={{ marginTop: 8 }}>
              В Chrome нужен доступ WebUSB. Если “Access denied” — проверьте WinUSB (Zadig).
            </p>
          </div>

          <div className="settings__form-group">
            <label className="settings__label" htmlFor="cafeBridgeUrlUsb">
              Printer‑bridge URL (не обязателен для USB)
            </label>
            <div className="settings__input-wrapper">
              <input
                id="cafeBridgeUrlUsb"
                className="settings__input settings__input--plain"
                placeholder="http://127.0.0.1:5179/print"
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </>
      )}

      <div className="settings__actions">
        <button type="button" className="settings__btn settings__btn--primary" onClick={save}>
          Сохранить
        </button>
        <button type="button" className="settings__btn settings__btn--secondary" onClick={testPrint}>
          Тестовая печать
        </button>
      </div>
    </div>
  );
}

