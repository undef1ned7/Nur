import { X } from "lucide-react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { pdf } from "@react-pdf/renderer";
// import "./Sklad.scss";

import {
  getProductCheckout,
  getInvoiceJson,
  historySellObjectDetail,
  historySellProductDetail,
} from "../../../store/creators/saleThunk";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";
import InvoicePdfDocument from "../../Sectors/Market/Documents/components/InvoicePdfDocument";
import { de } from "date-fns/locale";

/* ============================================================
   A) WebUSB + ESC/POS helpers (автоподключение + печать PDF)
   ============================================================ */

// Глобальное состояние, чтобы не открывать устройство каждый раз
// src/Components/pages/Sell/SellDetail.jsx

/* ============================================================
   A) WebUSB + ESC/POS helpers (автоподключение, JSON и PDF)
   ============================================================ */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

// ====== 0) НАСТРОЙКИ БУМАГИ 72 мм ======
// ====== 72 мм (80мм принтер) ======
const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);

// Шрифт: 'A' (крупнее) или 'B' (мельче). По умолчанию B — ниже строка.
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();

// ширина символа в точках (Font A ~12, Font B ~9)
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;

// межстрочный интервал в точках (уменьшаем высоту строк)
const LINE_DOT_HEIGHT = Number(
  localStorage.getItem("escpos_line") || (FONT === "B" ? 22 : 24)
);

// ширина строки в символах исходя из выбранного шрифта
const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") ||
    Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
);

// Быстрые тюнеры из консоли:
function setEscposDotsPerLine(n) {
  localStorage.setItem("escpos_dpl", String(n));
}
function setEscposCharsPerLine(n) {
  localStorage.setItem("escpos_cpl", String(n));
}
function setEscposLineHeight(n) {
  localStorage.setItem("escpos_line", String(n));
}
function setEscposFont(ch) {
  localStorage.setItem("escpos_font", String(ch).toUpperCase());
}

const ESC = (...b) => new Uint8Array(b);
const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

/* ---------- Кодовые страницы и энкодеры ---------- */
// По вашей самотест-ленте: 66 — PC866 (Cyrillic#2), 73 — WCP1251 (Cyrillic)
const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
function setEscposCodepage(n) {
  localStorage.setItem("escpos_cp", String(n));
}

// поддерживаем оба номера и их «альтернативы» некоторых прошивок
const CP866_CODES = new Set([66, 18]); // 18 встречается у части Xprinter
const CP1251_CODES = new Set([73, 22]); // 22 иногда тоже = 1251

function encodeCP1251(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) {
      out.push(c);
    } else if (c === 0x0401) {
      out.push(0xa8); // Ё
    } else if (c === 0x0451) {
      out.push(0xb8); // ё
    } else if (c >= 0x0410 && c <= 0x042f) {
      out.push(0xc0 + (c - 0x0410)); // А..Я
    } else if (c >= 0x0430 && c <= 0x044f) {
      out.push(0xe0 + (c - 0x0430)); // а..я
    } else if (c === 0x2116) {
      out.push(0xb9); // №
    } else {
      out.push(0x3f);
    }
  }
  return new Uint8Array(out);
}

function encodeCP866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) {
      out.push(c);
    } else if (c >= 0x0410 && c <= 0x042f) {
      out.push(0x80 + (c - 0x0410)); // А..Я
    } else if (c >= 0x0430 && c <= 0x044f) {
      out.push(0xa0 + (c - 0x0430)); // а..я
    } else if (c === 0x0401) {
      out.push(0xf0); // Ё
    } else if (c === 0x0451) {
      out.push(0xf1); // ё
    } else if (c === 0x2116) {
      out.push(0xfc); // №
    } else {
      out.push(0x3f);
    }
  }
  return new Uint8Array(out);
}

const getEncoder = (n) =>
  CP866_CODES.has(n)
    ? encodeCP866
    : CP1251_CODES.has(n)
    ? encodeCP1251
    : encodeCP1251;

/* ---------- Рендер PDF в растр (резерв) ---------- */
async function ensurePdfJs() {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Не удалось загрузить pdf.js"));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}

async function pdfBlobToCanvas(pdfBlob, targetWidth = 384) {
  const pdfjsLib = await ensurePdfJs();
  const ab = await pdfBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport.width;
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas;
}

function canvasToRasterBytes(canvas, threshold = 180) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h).data;
  const bytesPerLine = Math.ceil(w / 8);
  const raster = new Uint8Array(bytesPerLine * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = img[i],
        g = img[i + 1],
        b = img[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < threshold)
        raster[y * bytesPerLine + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { raster, w, h, bytesPerLine };
}

function buildEscPosForRaster(raster, bytesPerLine, h) {
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = h & 0xff;
  const yH = (h >> 8) & 0xff;

  const init = ESC(0x1b, 0x40);
  const alignLeft = ESC(0x1b, 0x61, 0x00);
  const header = ESC(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  // было: \n\n\n + full cut — это даёт много пустоты
  // стало: одна строка и рез
  const feedAndCut = new Uint8Array([
    0x1b,
    0x64,
    0x01, // ESC d n  -> подача на 1 строку
    0x1d,
    0x56,
    0x00, // GS V 0  -> полный отрез
  ]);

  const total = new Uint8Array(
    init.length +
      alignLeft.length +
      header.length +
      raster.length +
      feedAndCut.length
  );
  let o = 0;
  total.set(init, o);
  o += init.length;
  total.set(alignLeft, o);
  o += alignLeft.length;
  total.set(header, o);
  o += header.length;
  total.set(raster, o);
  o += raster.length;
  total.set(feedAndCut, o);
  return total;
}

/* ---------- JSON → ESC/POS (кириллица) ---------- */
const money = (n) => Number(n || 0).toFixed(2);
function lr(left, right, width = 32) {
  const L = String(left ?? "");
  const R = String(right ?? "");
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}

function buildReceiptFromJSON(payload, opts = {}) {
  const width = opts.width || CHARS_PER_LINE; // <-- так
  const divider = "-".repeat(width);
  const enc = getEncoder(CODEPAGE);

  const company = payload.company ?? "";
  const docNo = payload.doc_no ?? "";
  const dt = payload.created_at ?? "";
  const cashier = payload.cashier_name ?? "";

  const items = Array.isArray(payload.items) ? payload.items : [];
  const discount = Number(payload.discount || 0);
  const tax = Number(payload.tax || 0);
  const paidCash = Number(payload.paid_cash || 0);
  const paidCard = Number(payload.paid_card || 0);
  const change = Number(payload.change || 0);

  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.price || 0),
    0
  );
  const total = subtotal - discount + tax;

  const chunks = [];
  chunks.push(ESC(0x1b, 0x40)); // init
  chunks.push(ESC(0x1b, 0x52, 0x07)); // International: Russia
  chunks.push(ESC(0x1b, 0x74, CODEPAGE)); // Codepage: 66 (PC866) или 73 (WCP1251)

  chunks.push(ESC(0x1b, 0x61, 0x01)); // center
  if (company) chunks.push(enc(company + "\n"));
  if (docNo) chunks.push(enc(`ЧЕК № ${docNo}\n`));
  chunks.push(enc(divider + "\n"));

  chunks.push(ESC(0x1b, 0x61, 0x00)); // left
  if (dt) chunks.push(enc(`Дата: ${dt}\n`));
  if (cashier) chunks.push(enc(`Кассир: ${cashier}\n`));
  chunks.push(enc(divider + "\n"));

  for (const it of items) {
    const name = String(it.name ?? "");
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    chunks.push(enc(name + "\n"));
    chunks.push(
      enc(lr(`${qty} x ${money(price)}`, money(qty * price), width) + "\n")
    );
  }

  chunks.push(enc(divider + "\n"));
  chunks.push(enc(lr("Промежуточный итог:", money(subtotal), width) + "\n"));
  if (discount)
    chunks.push(enc(lr("Скидка:", "-" + money(discount), width) + "\n"));
  if (tax) chunks.push(enc(lr("Налог:", money(tax), width) + "\n"));

  chunks.push(ESC(0x1b, 0x45, 0x01));
  chunks.push(enc(lr("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00));

  const havePayments = paidCash || paidCard || change;
  if (havePayments) {
    chunks.push(enc(divider + "\n"));
    if (paidCash)
      chunks.push(enc(lr("Наличными:", money(paidCash), width) + "\n"));
    if (paidCard)
      chunks.push(enc(lr("Картой:", money(paidCard), width) + "\n"));
    if (change) chunks.push(enc(lr("Сдача:", money(change), width) + "\n"));
  }

  chunks.push(enc(divider + "\n"));
  chunks.push(ESC(0x1b, 0x61, 0x01));
  chunks.push(enc("Спасибо за покупку!\n\n"));
  chunks.push(ESC(0x1d, 0x56, 0x00));
  chunks.push(ESC(0x0a, 0x0a, 0x0a));
  return chunks;
}

/* ---------- Определение формата ответа (PDF/JSON/base64) ---------- */
async function looksLikePdf(blob) {
  if (!(blob instanceof Blob)) return false;
  try {
    const head = await blob.slice(0, 8).text();
    return head.startsWith("%PDF-");
  } catch {
    return false;
  }
}

async function tryParseJsonFromBlob(blob) {
  try {
    const text = await blob.text();
    if (text.startsWith("data:application/pdf;base64,")) {
      const b64 = text.split(",")[1];
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return { pdfBlob: new Blob([bin], { type: "application/pdf" }) };
    }
    const json = JSON.parse(text);
    if (json && Array.isArray(json.items)) return { json };
    return null;
  } catch {
    return null;
  }
}

async function handleCheckoutResponseForPrinting(res) {
  if (
    res &&
    typeof res === "object" &&
    !(res instanceof Blob) &&
    Array.isArray(res.items)
  ) {
    await printReceiptJSONViaUSB(res);
    return;
  }
  if (res instanceof Blob) {
    if (await looksLikePdf(res)) {
      await printReceiptFromPdfUSB(res);
      return;
    }
    const parsed = await tryParseJsonFromBlob(res);
    if (parsed?.json) {
      await printReceiptJSONViaUSB(parsed.json);
      return;
    }
    if (parsed?.pdfBlob && (await looksLikePdf(parsed.pdfBlob))) {
      await printReceiptFromPdfUSB(parsed.pdfBlob);
      return;
    }
    const url = URL.createObjectURL(res);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt.pdf";
    a.click();
    URL.revokeObjectURL(url);
    throw new Error("Получен невалидный PDF и не JSON: сохранён как файл.");
  }
  if (res && typeof res === "object" && Array.isArray(res.items)) {
    await printReceiptJSONViaUSB(res);
    return;
  }
  throw new Error("Неизвестный формат ответа для печати");
}

/* ---------- WebUSB ---------- */
function saveVidPidToLS(dev) {
  try {
    localStorage.setItem("escpos_vid", dev.vendorId.toString(16));
    localStorage.setItem("escpos_pid", dev.productId.toString(16));
  } catch {}
}

async function tryUsbAutoConnect() {
  if (!("usb" in navigator)) throw new Error("Браузер не поддерживает WebUSB");
  const savedVid = parseInt(localStorage.getItem("escpos_vid") || "", 16);
  const savedPid = parseInt(localStorage.getItem("escpos_pid") || "", 16);
  const devs = await navigator.usb.getDevices();
  return (
    devs.find(
      (d) =>
        (!savedVid || d.vendorId === savedVid) &&
        (!savedPid || d.productId === savedPid)
    ) || null
  );
}

async function requestUsbDevice() {
  const filters = [{ classCode: 0x07 }, { classCode: 0xff }];
  return await navigator.usb.requestDevice({ filters });
}

async function openUsbDevice(dev) {
  if (!dev) throw new Error("USB устройство не найдено");
  if (!dev.opened) await dev.open();
  if (dev.configuration == null) {
    await dev.selectConfiguration(1).catch(() => {});
    if (dev.configuration == null && dev.configurations?.length) {
      const cfgNum = dev.configurations[0]?.configurationValue ?? 1;
      await dev.selectConfiguration(cfgNum).catch(() => {});
    }
  }
  const cfg = dev.configuration;
  if (!cfg) throw new Error("Нет активной USB-конфигурации");

  for (const intf of cfg.interfaces) {
    for (const alt of intf.alternates) {
      const out = (alt.endpoints || []).find(
        (e) => e.direction === "out" && e.type === "bulk"
      );
      if (!out) continue;

      try {
        await dev.claimInterface(intf.interfaceNumber);
      } catch {
        continue;
      }
      const needAlt = alt.alternateSetting ?? 0;
      try {
        await dev.selectAlternateInterface(intf.interfaceNumber, needAlt);
      } catch {
        try {
          await dev.releaseInterface(intf.interfaceNumber);
        } catch {}
        continue;
      }
      return {
        iface: intf.interfaceNumber,
        alt: needAlt,
        outEP: out.endpointNumber,
      };
    }
  }
  throw new Error(
    "Не удалось захватить интерфейс с bulk OUT. На Windows установите WinUSB (Zadig) и закройте другие приложения принтера."
  );
}

async function ensureUsbReadyAuto() {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  if (usbState.dev) return usbState;
  if (!usbState.opening) {
    usbState.opening = (async () => {
      const dev = await tryUsbAutoConnect();
      if (!dev) return null;
      await openUsbDevice(dev);
      usbState.dev = dev;
      return usbState;
    })().finally(() => (usbState.opening = null));
  }
  await usbState.opening;
  return usbState.dev ? usbState : null;
}

function attachUsbListenersOnce() {
  if (!("usb" in navigator)) return;
  if (attachUsbListenersOnce._did) return;
  attachUsbListenersOnce._did = true;

  navigator.usb.addEventListener("connect", async (e) => {
    try {
      const savedVid = parseInt(localStorage.getItem("escpos_vid") || "", 16);
      const savedPid = parseInt(localStorage.getItem("escpos_pid") || "", 16);
      if (!savedVid || !savedPid) return;
      if (e.device.vendorId !== savedVid || e.device.productId !== savedPid)
        return;
      await openUsbDevice(e.device);
      usbState.dev = e.device;
    } catch (err) {
      console.warn("USB auto-connect failed:", err);
    }
  });

  navigator.usb.addEventListener("disconnect", (e) => {
    if (usbState.dev && e.device === usbState.dev) {
      usbState.dev = null;
    }
  });
}

/* ---------- Печать ---------- */
async function printReceiptFromPdfUSB(pdfBlob) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // ВАЖНО: для 72 мм печатаем на всю ширину принтера
  const canvas = await pdfBlobToCanvas(pdfBlob, DOTS_PER_LINE);
  const { raster, bytesPerLine, h } = canvasToRasterBytes(canvas);
  const escpos = buildEscPosForRaster(raster, bytesPerLine, h);

  for (const part of chunkBytes(escpos)) {
    await dev.transferOut(outEP, part);
  }
}

async function printReceiptJSONViaUSB(payload) {
  if (!("usb" in navigator)) throw new Error("WebUSB не поддерживается");
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);

  // ВАЖНО: width = CHARS_PER_LINE (обычно 48 для 576 dots)
  const parts = buildReceiptFromJSON(payload, { width: CHARS_PER_LINE });

  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

// Диагностическая печать страниц 66/73
async function printCyrPagesTest() {
  if (!("usb" in navigator)) return;
  await ensureUsbReadyAuto();
  let dev = usbState.dev;
  if (!dev) {
    dev = await requestUsbDevice();
    saveVidPidToLS(dev);
  }
  const { outEP } = await openUsbDevice(dev);
  for (const n of [66, 73]) {
    const enc = getEncoder(n);
    const data = [
      ESC(0x1b, 0x40),
      ESC(0x1b, 0x52, 0x07),
      ESC(0x1b, 0x74, n),
      enc(`Кодовая страница ${n}: ТЕСТ Ёжик Яя №\n`),
      enc("-".repeat(32) + "\n\n"),
    ];
    for (const d of data) await dev.transferOut(outEP, d);
  }
}
/* ============================================================
   B) Компонент SellDetail
   ============================================================ */

const SellDetail = ({ onClose, id }) => {
  const dispatch = useDispatch();
  const { historyDetail: item, historyObjectDetail } = useSale();
  const { company } = useUser();

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "возвращенный",
  };

  const filterField = isStartPlan
    ? item
    : isBuildingCompany
    ? historyObjectDetail
    : item;

  useEffect(() => {
    dispatch(historySellProductDetail(id));
    dispatch(historySellObjectDetail(id));
  }, [id, dispatch]);

  // Автоподключение USB при монтировании
  useEffect(() => {
    attachUsbListenersOnce();
    ensureUsbReadyAuto().catch(() => {});
  }, []);

  const handlePrintReceipt = async () => {
    try {
      const res = await dispatch(getProductCheckout(item?.id)).unwrap();
      await handleCheckoutResponseForPrinting(res);
    } catch (e) {
      console.error("Печать чека не удалась:", e);
      alert(
        "Не удалось распечатать чек. Проверьте WinUSB и формат ответа (JSON/PDF)."
      );
    }
  };

  const handleDownloadInvoice = async () => {
    if (!item?.id) {
      alert("ID продажи не найден");
      return;
    }

    try {
      // Получаем JSON данные накладной
      const result = await dispatch(getInvoiceJson(item.id));
      if (getInvoiceJson.fulfilled.match(result)) {
        const invoiceData = result.payload;

        if (!invoiceData) {
          throw new Error("Нет данных для генерации PDF");
        }

        // Генерируем PDF из JSON используя InvoicePdfDocument
        const blob = await pdf(
          <InvoicePdfDocument data={invoiceData} />
        ).toBlob();

        const fileName = `invoice_${
          invoiceData?.document?.number || item.id
        }.pdf`;

        // Скачиваем файл
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        throw new Error("Не удалось загрузить данные накладной");
      }
    } catch (err) {
      console.error("Скачивание накладной не удалось:", err);
      alert(
        err?.message ||
          err?.detail ||
          "Не удалось скачать накладную. Попробуйте позже."
      );
    }
  };

  return (
    <div className="sellDetail add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content" style={{ width: "700px" }}>
        <div className="add-modal__header">
          <h3>Детали продажи</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="sellDetail__content">
          <div className="sell__box">
            <p className="receipt__title">Клиент: {filterField?.client_name}</p>
            <p className="receipt__title">
              Статус:{" "}
              {kindTranslate[filterField?.status] || filterField?.status}
            </p>
            <p className="receipt__title">
              Дата:{" "}
              {filterField?.created_at
                ? new Date(filterField.created_at).toLocaleString()
                : "-"}
            </p>
          </div>

          <div className="receipt">
            {filterField?.items?.map((product, idx) => (
              <div className="receipt__item" key={idx}>
                <p className="receipt__item-name">
                  {idx + 1}. {product.product_name ?? product.object_name}
                </p>
                <div>
                  <p>{product.tax_total}</p>
                  <p className="receipt__item-price">
                    {product.quantity} x {product.unit_price} ≡{" "}
                    {product.quantity * product.unit_price}
                  </p>
                </div>
              </div>
            ))}

            <div className="receipt__total">
              <b>ИТОГО</b>
              <div
                style={{ gap: "10px", display: "flex", alignItems: "center" }}
              >
                <p>Общая скидка {filterField?.discount_total} </p>
                <p>Налог {filterField?.tax_total}</p>
                <b>≡ {filterField?.total}</b>
              </div>
            </div>

            <div className="receipt__row">
              <button className="receipt__row-btn" onClick={handlePrintReceipt}>
                Чек
              </button>
              <button
                className="receipt__row-btn"
                onClick={handleDownloadInvoice}
              >
                Накладной
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellDetail;
