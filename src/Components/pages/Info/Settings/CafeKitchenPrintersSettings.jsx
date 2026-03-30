import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import {
  choosePrinterByDialog,
  getSavedPrinters,
  listAuthorizedPrinters,
  parsePrinterBinding,
  printOrderReceiptJSONViaUSB,
  printViaWiFiSimple,
  setActivePrinterByKey,
} from "../../../Sectors/cafe/Orders/OrdersPrintService";

const safeName = (p) => p?.name || "USB Printer";
const listFrom = (res) => res?.data?.results || res?.data || [];

function readKitchenPrinterMap() {
  try {
    const raw = localStorage.getItem("kitchen_printer_map");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeKitchenPrinterMap(obj) {
  try {
    localStorage.setItem("kitchen_printer_map", JSON.stringify(obj || {}));
  } catch {}
}

export default function CafeKitchenPrintersSettings({ showAlert }) {
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [kitchens, setKitchens] = useState([]);

  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    try {
      return localStorage.getItem("cafe_auto_kitchen_print") === "true";
    } catch {
      return false;
    }
  });

  const [loadingUsb, setLoadingUsb] = useState(false);
  const [authorized, setAuthorized] = useState([]);
  const [saved, setSaved] = useState([]);

  const [drafts, setDrafts] = useState(() => ({})); // kid -> { device, ipPort, usbKey }

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
      console.error("CafeKitchenPrintersSettings refreshUsb error:", e);
    } finally {
      setLoadingUsb(false);
    }
  }, []);

  const refreshKitchens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/cafe/kitchens/");
      const list = listFrom(res) || [];
      setKitchens(Array.isArray(list) ? list : []);

      // Initialize drafts from backend value or local fallback map
      const map = readKitchenPrinterMap();
      setDrafts((prev) => {
        const next = { ...prev };
        for (const k of list) {
          const kid = String(k?.id ?? "");
          if (!kid) continue;
          if (next[kid]) continue;

          const raw =
            String(
              k?.printer ||
              k?.printer_key ||
              k?.printerKey ||
              k?.printer_id ||
              k?.printerId ||
              ""
            ).trim() || String(map?.[kid] || "").trim();
          const parsed = parsePrinterBinding(raw);
          if (parsed.kind === "usb") {
            next[kid] = { device: "usb", usbKey: parsed.usbKey || "", ipPort: "" };
          } else if (parsed.kind === "ip") {
            next[kid] = { device: "wifi", ipPort: parsed.port === 9100 ? parsed.ip : `${parsed.ip}:${parsed.port}`, usbKey: "" };
          } else {
            next[kid] = { device: "wifi", ipPort: "", usbKey: "" };
          }
        }
        return next;
      });
    } catch (e) {
      console.error("CafeKitchenPrintersSettings refreshKitchens error:", e);
      showAlert?.("error", "Не удалось загрузить кухни");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    refreshKitchens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kitchenLabel = useCallback((k) => {
    const title = String(k?.title || k?.name || "Кухня").trim();
    const number = k?.number;
    return `${title}${number !== undefined && number !== null && number !== "" ? ` №${number}` : ""}`;
  }, []);

  const getCurrentBinding = useCallback(
    (k) => {
      const kid = String(k?.id ?? "");
      if (!kid) return "";
      const map = readKitchenPrinterMap();
      return String(
        k?.printer ||
        k?.printer_key ||
        k?.printerKey ||
        k?.printer_id ||
        k?.printerId ||
        map?.[kid] ||
        ""
      ).trim();
    },
    []
  );

  const setDraft = useCallback((kid, patch) => {
    setDrafts((prev) => ({ ...prev, [kid]: { ...(prev?.[kid] || {}), ...patch } }));
  }, []);

  const saveOne = useCallback(
    async (kitchen) => {
      const kid = String(kitchen?.id ?? "");
      if (!kid) return;
      const d = drafts?.[kid] || { device: "wifi", ipPort: "", usbKey: "" };

      let printer = "";
      if (d.device === "wifi") {
        const parsed = parsePrinterBinding(`ip/${d.ipPort || ""}`);
        if (parsed.kind !== "ip") {
          showAlert?.("error", `Кухня «${kitchenLabel(kitchen)}»: укажите IP:порт`);
          return;
        }
        printer = parsed.port === 9100 ? `ip/${parsed.ip}` : `ip/${parsed.ip}:${parsed.port}`;
      } else {
        if (!String(d.usbKey || "").trim()) {
          showAlert?.("error", `Кухня «${kitchenLabel(kitchen)}»: выберите USB‑принтер`);
          return;
        }
        printer = `usb/${String(d.usbKey).trim()}`;
      }

      try {
        await api.patch(`/cafe/kitchens/${kid}/`, { printer });

        // update local fallback map too
        const map = readKitchenPrinterMap();
        map[kid] = printer;
        writeKitchenPrinterMap(map);

        showAlert?.("success", `Сохранено: ${kitchenLabel(kitchen)}`);
        await refreshKitchens();
      } catch (e) {
        console.error("Kitchen printer save error:", e);
        showAlert?.("error", `Не удалось сохранить принтер кухни «${kitchenLabel(kitchen)}»`);
      }
    },
    [drafts, kitchenLabel, refreshKitchens, showAlert]
  );

  const saveAll = useCallback(async () => {
    if (!kitchens?.length) return;
    setSavingAll(true);
    try {
      for (const k of kitchens) {
        // sequential to keep server happy and errors readable
        // eslint-disable-next-line no-await-in-loop
        await saveOne(k);
      }
    } finally {
      setSavingAll(false);
    }
  }, [kitchens, saveOne]);

  const testKitchen = useCallback(
    async (k) => {
      const kid = String(k?.id ?? "");
      if (!kid) return;
      const binding = getCurrentBinding(k);
      const parsed = parsePrinterBinding(binding);
      if (!binding || parsed.kind === "" || parsed.kind === "unknown") {
        showAlert?.("warning", `Кухня «${kitchenLabel(k)}»: сначала настройте и сохраните принтер`);
        return;
      }

      const payload = {
        company: localStorage.getItem("company_name") || "КУХНЯ",
        doc_no: `${kitchenLabel(k)} • ТЕСТ`,
        created_at: new Date().toLocaleString("ru-RU"),
        cashier_name: "TEST",
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        kitchen_id: Number(kid) || kid,
        items: [{ name: "Тест кухни", qty: 1, price: 0 }],
      };

      try {
        if (parsed.kind === "ip") {
          await printViaWiFiSimple(payload, parsed.ip, parsed.port);
        } else if (parsed.kind === "usb") {
          await setActivePrinterByKey(parsed.usbKey);
          await printOrderReceiptJSONViaUSB(payload);
        }
        showAlert?.("success", `Тест отправлен: ${kitchenLabel(k)}`);
      } catch (e) {
        console.error("Kitchen test print error:", e);
        showAlert?.("error", `Не удалось отправить тест: ${kitchenLabel(k)}`);
      }
    },
    [getCurrentBinding, kitchenLabel, showAlert]
  );

  const chooseUsb = useCallback(
    async (kid) => {
      setLoadingUsb(true);
      try {
        const picked = await choosePrinterByDialog();
        await refreshUsb();
        if (picked?.key) setDraft(kid, { device: "usb", usbKey: picked.key });
        showAlert?.("success", "USB‑принтер выбран");
      } catch (e) {
        console.error("CafeKitchenPrintersSettings chooseUsb error:", e);
        showAlert?.("error", "Не удалось выбрать USB‑принтер");
      } finally {
        setLoadingUsb(false);
      }
    },
    [refreshUsb, setDraft, showAlert]
  );

  return (
    <div className="settings__section">
      <div className="settings__sectionHeadRow">
        <h2 className="settings__section-title" style={{ margin: 0 }}>
          <span className="settings__emoji">🍳</span> Кафе • Принтеры кухонь
        </h2>

        <div className="settings__sectionHeadBtns">
          <button type="button" className="settings__btnSmall settings__btnSmall--secondary" onClick={refreshKitchens} disabled={loading}>
            Обновить
          </button>
          <button type="button" className="settings__btnSmall settings__btnSmall--secondary" onClick={refreshUsb} disabled={loadingUsb}>
            USB список
          </button>
          <button type="button" className="settings__btnSmall settings__btnSmall--primary" onClick={saveAll} disabled={savingAll || loading}>
            {savingAll ? "Сохранение…" : "Сохранить всё"}
          </button>
        </div>
      </div>

      <p className="settings__mutedText" style={{ marginTop: 10 }}>
        Позиции заказа печатаются на ту кухню, которая указана в меню. Здесь можно централизованно привязать принтер к каждой кухне.
      </p>

      <div className="settings__form-group" style={{ marginTop: 6 }}>
        <label className="settings__label settings__checkboxRow">
          <input
            type="checkbox"
            className="settings__checkbox"
            checked={autoPrintEnabled}
            onChange={(e) => {
              const v = e.target.checked;
              setAutoPrintEnabled(v);
              try {
                localStorage.setItem("cafe_auto_kitchen_print", String(v));
              } catch {}
              showAlert?.("success", v ? "Автопечать включена" : "Автопечать выключена");
            }}
          />
          <span>Автопечать на кухни при создании заказа (WebSocket)</span>
        </label>
        <p className="settings__mutedText settings__mutedText--indent">
          Включайте на устройстве, с которого идёт печать (агент печати или printer‑bridge; тот же bridge URL, что и для кассы).
        </p>
      </div>

      {loading ? <div className="settings__mutedText">Загрузка…</div> : null}
      {!loading && kitchens.length === 0 ? <div className="settings__mutedText">Кухни не найдены.</div> : null}

      <div className="settings__cardsGrid">
        {kitchens.map((k) => {
          const kid = String(k?.id ?? "");
          const d = drafts?.[kid] || { device: "wifi", ipPort: "", usbKey: "" };
          const current = getCurrentBinding(k);
          const parsed = parsePrinterBinding(current);
          const currentText =
            parsed.kind === "ip"
              ? `Wi‑Fi: ${parsed.ip}:${parsed.port}`
              : parsed.kind === "usb"
              ? `USB: ${parsed.usbKey}`
              : current
              ? current
              : "— не настроено —";

          return (
            <div key={kid} className="settings__card">
              <div className="settings__cardHead">
                <div className="settings__cardTitle">{kitchenLabel(k)}</div>
                <div className="settings__chip">{currentText}</div>
              </div>

              <div className="settings__form-group" style={{ marginBottom: 12 }}>
                <div className="settings__label">Тип подключения</div>
                <div className="settings__segmented">
                  <button
                    type="button"
                    className={`settings__segBtn ${d.device === "wifi" ? "settings__segBtn--active" : ""}`}
                    onClick={() => setDraft(kid, { device: "wifi" })}
                  >
                    Wi‑Fi
                  </button>
                  <button
                    type="button"
                    className={`settings__segBtn ${d.device === "usb" ? "settings__segBtn--active" : ""}`}
                    onClick={() => {
                      setDraft(kid, { device: "usb" });
                      refreshUsb();
                    }}
                  >
                    USB
                  </button>
                </div>
              </div>

              {d.device === "wifi" ? (
                <div className="settings__form-group" style={{ marginBottom: 12 }}>
                  <label className="settings__label">IP:порт</label>
                  <div className="settings__input-wrapper">
                    <input
                      className="settings__input settings__input--plain"
                      placeholder="192.168.1.200:9100"
                      value={d.ipPort || ""}
                      onChange={(e) => setDraft(kid, { ipPort: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : (
                <div className="settings__form-group" style={{ marginBottom: 12 }}>
                  <label className="settings__label">USB‑принтер</label>
                  <div className="settings__usbRow">
                    <select
                      className="settings__select"
                      value={d.usbKey || ""}
                      onChange={(e) => setDraft(kid, { usbKey: e.target.value })}
                      disabled={loadingUsb}
                    >
                      <option value="">— Выберите принтер —</option>
                      {mergedUsb.map((p) => (
                        <option key={p.key} value={p.key}>
                          {safeName(p)} ({p.key})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="settings__btnSmall settings__btnSmall--secondary"
                      onClick={refreshUsb}
                      disabled={loadingUsb}
                      title="Обновить список USB принтеров"
                    >
                      Обновить
                    </button>
                    <button
                      type="button"
                      className="settings__btnSmall settings__btnSmall--primary"
                      onClick={() => chooseUsb(kid)}
                      disabled={loadingUsb}
                      title="Открыть WebUSB диалог и выбрать принтер"
                    >
                      Выбрать
                    </button>
                  </div>
                </div>
              )}

              <div className="settings__cardActions">
                <button type="button" className="settings__btnSmall settings__btnSmall--primary" onClick={() => saveOne(k)}>
                  Сохранить
                </button>
                <button type="button" className="settings__btnSmall settings__btnSmall--secondary" onClick={() => testKitchen(k)}>
                  Тест
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

