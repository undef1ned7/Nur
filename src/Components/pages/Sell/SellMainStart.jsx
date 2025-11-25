// src/Components/pages/Sell/SellMainStart.jsx
import { Minus, Pencil, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  doSearch,
  manualFilling,
  productCheckout,
  startSale,
  updateManualFilling,
  addCustomItem,
  createDeal,
  getProductCheckout, // будем получать PDF/JSON для печати
  deleteProductInCart,
} from "../../../store/creators/saleThunk";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useUser } from "../../../store/slices/userSlice";
import UniversalModal from "../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";
import AlertModal from "../../common/AlertModal/AlertModal";
import { useProducts } from "../../../store/slices/productSlice";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { useSale } from "../../../store/slices/saleSlice";
import useBarcodeToCart from "./useBarcodeToCart";
import { createDebt } from "./Sell";

const cx = (...args) => args.filter(Boolean).join(" ");
const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Определение доступного остатка по товару
function getAvailableQtyForProduct(productOrId, productsList) {
  if (!productOrId) return 0;
  if (typeof productOrId === "object") {
    const p = productOrId;
    // Приоритет: qty_on_hand, затем quantity
    if (p.qty_on_hand != null) return Number(p.qty_on_hand) || 0;
    if (p.quantity != null) return Number(p.quantity) || 0;
    if (p.id) {
      const found = (productsList || []).find((x) => x.id === p.id);
      if (found) return getAvailableQtyForProduct(found, productsList);
    }
    return 0;
  }
  const found = (productsList || []).find((x) => x.id === productOrId);
  if (!found) return 0;
  return getAvailableQtyForProduct(found, productsList);
}

// Текущее количество товара в корзине
function getCartQtyForProduct(productOrId, cartItems) {
  const pid =
    typeof productOrId === "object"
      ? productOrId.id || productOrId.product
      : productOrId;
  if (!pid) return 0;
  const items = Array.isArray(cartItems) ? cartItems : [];
  let sum = 0;
  for (const it of items) {
    const itPid = it.product || it.id;
    if (String(itPid) === String(pid)) {
      sum += Number(it.quantity) || 0;
    }
  }
  return sum;
}

/* ============================================================
   A) WebUSB + ESC/POS helpers (автоподключение, JSON и PDF)
   ============================================================ */

// Глобальное состояние USB
const usbState = { dev: null, opening: null };

// ====== 0) НАСТРОЙКИ БУМАГИ 72 мм (80мм принтер) ======
const DOTS_PER_LINE = Number(localStorage.getItem("escpos_dpl") || 576);
// Шрифт: 'A' или 'B'
const FONT = (localStorage.getItem("escpos_font") || "B").toUpperCase();
// ширина символа в точках (Font A ~12, Font B ~9)
const CHAR_DOT_WIDTH = FONT === "B" ? 9 : 12;
// межстрочный интервал
const LINE_DOT_HEIGHT = Number(
  localStorage.getItem("escpos_line") || (FONT === "B" ? 22 : 24)
);
// ширина строки в символах
const CHARS_PER_LINE = Number(
  localStorage.getItem("escpos_cpl") ||
    Math.floor(DOTS_PER_LINE / CHAR_DOT_WIDTH)
);

// Быстрые тюнеры (пригодятся в консоли):
export function setEscposDotsPerLine(n) {
  localStorage.setItem("escpos_dpl", String(n));
}
export function setEscposCharsPerLine(n) {
  localStorage.setItem("escpos_cpl", String(n));
}
export function setEscposLineHeight(n) {
  localStorage.setItem("escpos_line", String(n));
}
export function setEscposFont(ch) {
  localStorage.setItem("escpos_font", String(ch).toUpperCase());
}

const ESC = (...b) => new Uint8Array(b);
const chunkBytes = (u8, size = 12 * 1024) => {
  const out = [];
  for (let i = 0; i < u8.length; i += size) out.push(u8.subarray(i, i + size));
  return out;
};

/* ---------- Кодовые страницы и энкодеры ---------- */
// 66 — PC866, 73 — CP1251 (часто встречается у Xprinter)
const CODEPAGE = Number(localStorage.getItem("escpos_cp") ?? 73);
export function setEscposCodepage(n) {
  localStorage.setItem("escpos_cp", String(n));
}
const CP866_CODES = new Set([66, 18]);
const CP1251_CODES = new Set([73, 22]);

function encodeCP1251(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c === 0x0401) out.push(0xa8);
    else if (c === 0x0451) out.push(0xb8);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0xc0 + (c - 0x0410));
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xe0 + (c - 0x0430));
    else if (c === 0x2116) out.push(0xb9);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
function encodeCP866(s = "") {
  const out = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c <= 0x7f) out.push(c);
    else if (c >= 0x0410 && c <= 0x042f) out.push(0x80 + (c - 0x0410));
    else if (c >= 0x0430 && c <= 0x044f) out.push(0xa0 + (c - 0x0430));
    else if (c === 0x0401) out.push(0xf0);
    else if (c === 0x0451) out.push(0xf1);
    else if (c === 0x2116) out.push(0xfc);
    else out.push(0x3f);
  }
  return new Uint8Array(out);
}
const getEncoder = (n) =>
  CP866_CODES.has(n)
    ? encodeCP866
    : CP1251_CODES.has(n)
    ? encodeCP1251
    : encodeCP1251;

/* ---------- PDF → растер ---------- */
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

  // компактная подача + рез
  const feedAndCut = new Uint8Array([0x1b, 0x64, 0x01, 0x1d, 0x56, 0x00]);

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

/* ---------- JSON → ESC/POS ---------- */
const money = (n) => Number(n || 0).toFixed(2);
function lr(left, right, width = 32) {
  const L = String(left ?? "");
  const R = String(right ?? "");
  const spaces = Math.max(1, width - L.length - R.length);
  return L + " ".repeat(spaces) + R;
}
function buildReceiptFromJSON(payload, opts = {}) {
  const width = opts.width || CHARS_PER_LINE;
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
  chunks.push(ESC(0x1b, 0x74, CODEPAGE)); // кодовая страница

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

  chunks.push(ESC(0x1b, 0x45, 0x01)); // bold on
  chunks.push(enc(lr("ИТОГО:", money(total), width) + "\n"));
  chunks.push(ESC(0x1b, 0x45, 0x00)); // bold off

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
  chunks.push(ESC(0x1d, 0x56, 0x00)); // полный рез
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
    // не PDF и не JSON — сохраним как файл (фолбэк)
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

  // печатаем на ширину принтера
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

  const parts = buildReceiptFromJSON(payload, { width: CHARS_PER_LINE });
  for (const data of parts) {
    for (const chunk of chunkBytes(data)) {
      await dev.transferOut(outEP, chunk);
    }
  }
}

/* ============================================================
   B) Компонент SellMainStart
   ============================================================ */

const SellMainStart = ({ show, setShow }) => {
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { start, foundProduct } = useSale();
  const { list: products } = useProducts();
  const { list: clients = [] } = useClient();
  // Автодобавление товара по сканеру штрих‑кода
  const { error: barcodeScanError } = useBarcodeToCart(start?.id, {
    onError: (msg) =>
      setAlert({
        open: true,
        type: "error",
        message: msg || "Нет такого товара",
      }),
  });

  const [clientId, setClientId] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [submitTried, setSubmitTried] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");

  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null); // "cash" или "card"
  const [cashPaymentConfirmed, setCashPaymentConfirmed] = useState(false); // флаг подтверждения оплаты в модалке
  const [customService, setCustomService] = useState({
    name: "",
    price: "",
    quantity: "1",
  });
  const [alert, setAlert] = useState({
    open: false,
    type: "success",
    message: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    source_cashbox_flow_id: "",
    source_business_operation_id: "Продажа",
    status:
      company?.subscription_plan?.name === "Старт" ? "approved" : "pending",
  });
  const dispatch = useDispatch();
  const run = (thunk) => dispatch(thunk).unwrap();
  const [selectClient, setSelectClient] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(() => {
    return (start?.items || []).find((i) => i.id === selectedId) || null;
  }, [start?.items, selectedId]);

  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client"
      ),
    [clients]
  );
  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  const [state, setState] = useState({
    phone: "",
    dueDate: "",
  });

  const [qty, setQty] = useState("");
  const [itemQuantities, setItemQuantities] = useState({});

  // Автоматическое заполнение телефона при выборе клиента в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickClient?.phone) {
      setState((prev) => ({ ...prev, phone: pickClient.phone }));
    }
  }, [clientId, pickClient, company?.subscription_plan?.name]);

  useEffect(() => {
    if (selectedItem) setQty(String(selectedItem.quantity ?? ""));
    else setQty("");
  }, [selectedItem]);

  const debouncedDiscount = useDebounce((v) => {
    dispatch(
      manualFilling({
        id: start.id,
        productId: selectedItem.id,
        discount_total: v,
        quantity: 2,
      })
    );
  }, 600);
  const onProductDiscountChange = (e) => debouncedDiscount(e.target.value);

  const debouncedSearch = useDebounce((v) => {
    dispatch(doSearch({ search: v }));
  }, 600);
  const onChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
    setShowDropdown(value.length > 0);
  };

  const onChange2 = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const debouncedDiscount1 = useDebounce((v) => {
    dispatch(startSale(v));
  }, 600);
  const onDiscountChange = (e) => debouncedDiscount1(e.target.value);

  const debouncedQtyUpdate = useDebounce(
    async (newQty, currentSelectedItem, currentStartId) => {
      if (!currentSelectedItem || !currentStartId) return;
      let qtyNum = Math.max(0, toNum(newQty));
      const productId = currentSelectedItem.product || currentSelectedItem.id;
      const available = getAvailableQtyForProduct(productId, products);
      if (available && qtyNum > available) {
        qtyNum = available;
        setAlert({
          open: true,
          type: "error",
          message: "Введено больше доступного количества. Значение ограничено",
        });
        setQty(String(qtyNum));
      }

      try {
        await dispatch(
          updateManualFilling({
            id: currentStartId,
            productId: currentSelectedItem.id,
            quantity: qtyNum,
          })
        ).unwrap();
        onRefresh();
      } catch (error) {
        console.error("Ошибка при обновлении количества:", error);
      }
    },
    600
  );

  const onRefresh = () => {
    dispatch(startSale());
  };

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    dispatch(doSearch());
    dispatch(fetchProductsAsync());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
        setCashData((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, selectCashBox]);

  // Проверка подключения принтера
  useEffect(() => {
    const checkPrinterConnection = async () => {
      if (!("usb" in navigator)) {
        setIsPrinterConnected(false);
        return;
      }
      try {
        const state = await ensureUsbReadyAuto();
        setIsPrinterConnected(state !== null && usbState.dev !== null);
      } catch {
        setIsPrinterConnected(false);
      }
    };

    // Автоподключение USB при монтировании
    attachUsbListenersOnce();

    // Проверяем при монтировании
    checkPrinterConnection();

    // Проверяем периодически (каждые 2 секунды)
    const interval = setInterval(checkPrinterConnection, 2000);

    // Слушаем события подключения/отключения USB
    const handleConnect = async () => {
      // Небольшая задержка, чтобы устройство успело подключиться
      setTimeout(checkPrinterConnection, 500);
    };
    const handleDisconnect = () => {
      setIsPrinterConnected(false);
    };

    if ("usb" in navigator) {
      navigator.usb.addEventListener("connect", handleConnect);
      navigator.usb.addEventListener("disconnect", handleDisconnect);
    }

    return () => {
      clearInterval(interval);
      if ("usb" in navigator) {
        navigator.usb.removeEventListener("connect", handleConnect);
        navigator.usb.removeEventListener("disconnect", handleDisconnect);
      }
    };
  }, []);

  // Управление видимостью дропдауна на основе результатов поиска
  useEffect(() => {
    if (foundProduct && Array.isArray(foundProduct)) {
      if (foundProduct.length > 0 && searchQuery.length > 0) {
        setShowDropdown(true);
      } else if (foundProduct.length === 0 && searchQuery.length === 0) {
        setShowDropdown(false);
      }
    }
  }, [foundProduct, searchQuery]);

  const handleRowClick = (item) => {
    setSelectedId(item.id);
  };

  const handleSelectProduct = async (product) => {
    const available = getAvailableQtyForProduct(product, products);
    const pid = product.id || product.product;
    const inCart = getCartQtyForProduct(pid, start?.items);
    if (available <= 0 || inCart >= available) {
      setAlert({
        open: true,
        type: "error",
        message:
          available > 0
            ? `Нельзя добавить больше, чем есть на складе (доступно: ${available})`
            : "Товара нет в наличии",
      });
      return;
    }
    if (!start?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина не инициализирована. Пожалуйста, подождите...",
      });
      return;
    }
    try {
      await dispatch(
        manualFilling({
          id: start.id,
          productId: product.id || product.product,
        })
      ).unwrap();
      dispatch(startSale());
      setSearchQuery("");
      setShowDropdown(false);
    } catch (error) {
      console.error("Ошибка при добавлении товара:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при добавлении товара",
      });
    }
  };

  const incQty = async () => {
    if (!selectedItem) return;
    const productId = selectedItem.product || selectedItem.id;
    const available = getAvailableQtyForProduct(productId, products);
    const currentQty = Number(selectedItem.quantity) || 0;
    if (available && currentQty >= available) {
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя добавить больше, чем есть на складе",
      });
      return;
    }
    const newQty = (toNum(qty) || 0) + 1;
    setQty(String(newQty));

    await dispatch(
      manualFilling({ id: start.id, productId: selectedItem.product })
    ).unwrap();
    onRefresh();
  };

  const decQty = async () => {
    if (!selectedItem) return;
    const next = Math.max(0, (toNum(qty) || 0) - 1);
    setQty(String(next));

    await dispatch(
      updateManualFilling({
        id: start.id,
        productId: selectedItem.id,
        quantity: next,
      })
    ).unwrap();
    onRefresh();
  };

  // Функции для работы с товарами в таблице
  const handleIncreaseQty = async (item) => {
    if (!start?.id) return;
    const productId = item.product || item.id;
    const available = getAvailableQtyForProduct(productId, products);
    const currentQty = Number(item.quantity) || 0;

    if (available && currentQty >= available) {
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя добавить больше, чем есть на складе",
      });
      return;
    }

    try {
      await dispatch(
        manualFilling({ id: start.id, productId: item.product || item.id })
      ).unwrap();
      onRefresh();
      // Обновляем локальное состояние после обновления
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(currentQty + 1),
      }));
    } catch (error) {
      console.error("Ошибка при увеличении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при увеличении количества",
      });
    }
  };

  const handleDecreaseQty = async (item) => {
    if (!start?.id) return;
    const currentQty = Number(item.quantity) || 0;
    const next = Math.max(0, currentQty - 1);

    if (next === 0) {
      // Если количество становится 0, удаляем товар
      await handleRemoveItem(item);
      return;
    }

    try {
      await dispatch(
        updateManualFilling({
          id: start.id,
          productId: item.id,
          quantity: next,
        })
      ).unwrap();
      onRefresh();
      // Обновляем локальное состояние после обновления
      setItemQuantities((prev) => ({
        ...prev,
        [item.id]: String(next),
      }));
    } catch (error) {
      console.error("Ошибка при уменьшении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при уменьшении количества",
      });
    }
  };

  const handleRemoveItem = async (item) => {
    if (!start?.id) return;

    try {
      await dispatch(
        deleteProductInCart({
          id: start.id,
          productId: item.id,
        })
      ).unwrap();
      onRefresh();

      // Если удаляемый товар был выбран, сбрасываем выбор
      if (selectedId === item.id) {
        setSelectedId(null);
      }
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при удалении товара",
      });
    }
  };

  // Обработчик изменения количества через инпут
  const handleItemQtyChange = (item, value) => {
    setItemQuantities((prev) => ({
      ...prev,
      [item.id]: value,
    }));
  };

  // Обработчик потери фокуса инпута количества
  const handleItemQtyBlur = async (item) => {
    if (!start?.id) return;
    const inputValue = itemQuantities[item.id] || "";
    let qtyNum;

    if (inputValue === "" || inputValue === "0") {
      qtyNum = item.quantity || 0;
    } else {
      qtyNum = Math.max(0, toNum(inputValue));
    }

    const productId = item.product || item.id;
    const available = getAvailableQtyForProduct(productId, products);
    if (available && qtyNum > available) {
      qtyNum = available;
      setAlert({
        open: true,
        type: "error",
        message: "Нельзя установить количество больше остатка",
      });
    }

    setItemQuantities((prev) => ({
      ...prev,
      [item.id]: String(qtyNum),
    }));

    if (qtyNum === 0) {
      await handleRemoveItem(item);
      return;
    }

    try {
      await dispatch(
        updateManualFilling({
          id: start.id,
          productId: item.id,
          quantity: qtyNum,
        })
      ).unwrap();
      onRefresh();
    } catch (error) {
      console.error("Ошибка при обновлении количества:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при обновлении количества",
      });
    }
  };

  const validate = (f) => {
    const e = {};
    if (!f.full_name.trim()) e.full_name = "Это поле не может быть пустым.";
    const ph = f.phone.trim();
    if (!ph) e.phone = "Это поле не может быть пустым.";
    else if (!/^\+?\d[\d\s\-()]{5,}$/.test(ph))
      e.phone = "Неверный формат телефона.";
    return e;
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name] || submitTried) {
      const ve = validate(next);
      setErrors(ve);
    }
  };
  const handleBlur = (e) => {
    const { name } = e.target;
    const nextTouched = { ...touched, [name]: true };
    setTouched(nextTouched);
    setErrors(validate(form));
  };

  const filterData = products;
  const currentCart = start;
  const currentItems = start?.items || [];
  const currentSubtotal = start?.subtotal;
  const currentDiscount = start?.order_discount_total;
  const currentTotal = start?.total;

  // Инициализация локальных значений количества для элементов таблицы
  useEffect(() => {
    const items = start?.items || [];
    const quantities = {};
    items.forEach((item) => {
      quantities[item.id] = String(item.quantity ?? "");
    });
    setItemQuantities(quantities);
  }, [start?.items]);

  const handleAddCustomService = async () => {
    try {
      if (!customService.name.trim()) {
        setAlert({
          open: true,
          type: "error",
          message: "Введите название услуги",
        });
        return;
      }
      if (!customService.price.trim() || Number(customService.price) <= 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Введите корректную цену услуги",
        });
        return;
      }
      if (!start?.id) {
        setAlert({
          open: true,
          type: "error",
          message: "Корзина не инициализирована. Пожалуйста, подождите...",
        });
        return;
      }
      await dispatch(
        addCustomItem({
          id: start.id,
          name: customService.name.trim(),
          price: customService.price.trim(),
          quantity: Number(customService.quantity) || 1,
        })
      ).unwrap();
      onRefresh();
      setCustomService({ name: "", price: "", quantity: "1" });
      setShowCustomServiceModal(false);
      setAlert({
        open: true,
        type: "success",
        message: "Дополнительная услуга успешно добавлена!",
      });
    } catch (error) {
      console.error("Ошибка при добавлении дополнительной услуги:", error);
      setAlert({
        open: true,
        type: "error",
        message:
          error?.data?.detail ||
          error?.message ||
          "Ошибка при добавлении дополнительной услуги",
      });
    }
  };

  // Обработка оплаты наличными
  const handleCashPayment = async () => {
    const received = Number(cashReceived);
    const total = Number(currentTotal);

    if (!received || received <= 0) {
      setAlert({
        open: true,
        type: "error",
        message: "Введите сумму, полученную от покупателя",
      });
      return;
    }

    if (received < total) {
      setAlert({
        open: true,
        type: "error",
        message: `Недостаточно средств. К оплате: ${total.toFixed(2)} сом`,
      });
      return;
    }

    // Устанавливаем способ оплаты и закрываем модалку
    // cashReceived сохраняется для использования при checkout
    setPaymentMethod("cash");
    setCashPaymentConfirmed(true); // помечаем, что оплата подтверждена
    setShowCashModal(false);
    // Оплата будет выполнена через кнопки "Печать чека" или "Без чека"
  };

  // Ключевая функция: checkout + ПЕЧАТЬ
  const performCheckout = async (withReceipt, paymentType = null) => {
    // Используем выбранный способ оплаты, если не передан явно
    const finalPaymentType = paymentType || paymentMethod || "card";
    try {
      if (!cashData.cashbox) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите кассу для проведения операции",
        });
        return;
      }

      if (debt === "Долги") {
        if (!clientId) return alert("Выберите клиента");
        if (!state.dueDate && company.subscription_plan.name === "Старт")
          return alert("Выберите дату");
        if (!state.phone && company.subscription_plan.name === "Старт")
          return alert("Введите номер телефона");
        if (company.subscription_plan.name === "Старт") {
          await createDebt({
            name: pickClient?.full_name,
            phone: state.phone,
            due_date: state.dueDate,
            amount: start?.total,
          });
        }
      }

      const itemsToCheck = start?.items;
      if (itemsToCheck?.length === 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Добавьте товар для проведения операции",
        });
        return;
      }
      if (debt && !clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите клиента для долговой операции",
        });
        return;
      }
      if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректную сумму предоплаты",
          });
          return;
        }
        const totalToCheck = start?.total;
        if (Number(amount) > Number(totalToCheck)) {
          setAlert({
            open: true,
            type: "error",
            message: "Сумма предоплаты не может превышать общую сумму",
          });
          return;
        }
        if (!debtMonths || Number(debtMonths) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректный срок долга (в месяцах)",
          });
          return;
        }
      }
      if (debt === "Долги") {
        if (!debtMonths || Number(debtMonths) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректный срок долга (в месяцах)",
          });
          return;
        }
      }

      if (clientId) {
        const totalForDeal = start?.total;
        await dispatch(
          createDeal({
            clientId: clientId,
            title: `${debt || "Продажа"} ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalForDeal,
            prepayment: debt === "Предоплата" ? Number(amount) : undefined,
            debtMonths:
              debt === "Долги" || debt === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          })
        ).unwrap();
      }

      // Валидация для оплаты наличными
      if (finalPaymentType === "cash") {
        if (!cashReceived || Number(cashReceived) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите сумму, полученную от покупателя",
          });
          return;
        }
        const total = Number(currentTotal);
        const received = Number(cashReceived);
        if (received < total) {
          setAlert({
            open: true,
            type: "error",
            message: `Недостаточно средств. К оплате: ${total.toFixed(2)} сом`,
          });
          return;
        }
      }

      // Формируем параметры для checkout
      const checkoutParams = {
        id: start?.id,
        bool: withReceipt,
        clientId: clientId,
      };

      // Если оплата наличными, обязательно добавляем payment_method и cash_received
      if (finalPaymentType === "cash") {
        checkoutParams.payment_method = "cash";
        checkoutParams.cash_received = Number(cashReceived).toFixed(2);
      } else if (finalPaymentType === "card") {
        // При переводе отправляем payment_method="transfer"
        checkoutParams.payment_method = "transfer";
      }

      const result = await run(productCheckout(checkoutParams));

      const amountForCash = debt === "Предоплата" ? amount : start.total;
      if (debt !== "Долги") {
        await run(
          addCashFlows({
            ...cashData,
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: amountForCash,
            source_cashbox_flow_id: result?.sale_id,
            type: finalPaymentType === "cash" ? "income" : "income",
          })
        );
      }

      // setShow(false); // Убрано: компонент больше не закрывается после checkout

      // === РАЗНИЦА: если withReceipt — получаем ответ бэка и ПЕЧАТАЕМ ЧЕРЕЗ USB ===
      if (withReceipt && result?.sale_id) {
        try {
          const resp = await run(getProductCheckout(result.sale_id));
          await handleCheckoutResponseForPrinting(resp);
        } catch (e) {
          console.error("Печать чека не удалась:", e);
          alert(
            "Не удалось распечатать чек. Проверьте WinUSB и формат ответа (JSON/PDF)."
          );
        }
      }

      setAlert({
        open: true,
        type: "success",
        message: "Операция успешно выполнена!",
      });

      // Сбрасываем способ оплаты после успешной операции
      setPaymentMethod(null);
      setCashReceived("");
      setCashPaymentConfirmed(false);

      dispatch(startSale());
    } catch (e) {
      setAlert({
        open: true,
        type: "error",
        message: `Что то пошло не так.\n\n${
          e?.data?.detail
            ?.replace("у агента:", "товара")
            ?.replace("Нужно 2, доступно 0.", "") ||
          e?.message ||
          ""
        }`,
      });
    }
  };

  return (
    <section className="sell start">
      <div className="sell__header">
        <div className="sell__header-left">
          <div className="sell__header-input" style={{ position: "relative" }}>
            <input
              onChange={onChange}
              onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              value={searchQuery}
              type="text"
              placeholder="Введите название товара"
            />
            <span>
              <Search size={15} color="#91929E" />
            </span>
            {showDropdown && foundProduct && foundProduct.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  zIndex: 1000,
                  maxHeight: "300px",
                  overflowY: "auto",
                  marginTop: "4px",
                }}
              >
                {foundProduct.map((product) => (
                  <div
                    key={product.id || product.product}
                    onClick={() => handleSelectProduct(product)}
                    style={{
                      padding: "10px 15px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f5f5f5")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "white")
                    }
                  >
                    <div style={{ fontWeight: "500" }}>
                      {product.product_name || product.name} {product.quantity}{" "}
                      шт
                    </div>
                    {product.unit_price && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginTop: "4px",
                        }}
                      >
                        Цена: {product.unit_price}
                        {product.qty_on_hand !== undefined && (
                          <span style={{ marginLeft: "10px" }}>
                            Остаток: {product.qty_on_hand}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showDropdown &&
              searchQuery.length > 0 &&
              (!foundProduct ||
                (Array.isArray(foundProduct) && foundProduct.length === 0)) && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    zIndex: 1000,
                    padding: "15px",
                    textAlign: "center",
                    color: "#666",
                    marginTop: "4px",
                  }}
                >
                  Нет такого товара
                </div>
              )}
          </div>

          <select
            onChange={(e) => {
              setClientId(e.target.value);
              setSelectClient(e.target.value);
            }}
            value={clientId}
            className="sell__header-input"
          >
            <option value="">Выберите клиента</option>
            {filterClient.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <button
            className="sell__header-plus"
            onClick={() => setShowNewClientModal(true)}
          >
            <span>
              {/* плюс */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 11H13V5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5V11H5C4.73478 11 4.48043 11.1054 4.29289 11.2929C4.10536 11.4804 4 11.7348 4 12C4 12.2652 4.10536 12.5196 4.29289 12.7071C4.4804 12.8946 4.73478 13 5 13H11V19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19V13H19C19.2652 13 19.5196 12.8946 19.7071 12.7071C19.8946 12.5196 20 12.2652 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"
                  fill="#CCCCCC"
                />
              </svg>
            </span>
          </button>
        </div>

        <div className="sell__header-left"></div>
      </div>

      <div className="start__body">
        <div className="col-8 start__body-column">
          <div className="start__body-column">
            {/* <div className="sell__body-header">
              <h2 className="start__body-title">
                {selectedItem?.product_name}
              </h2>

              <div className="start__actions">
                <div className="start__actions-left">
                  <input
                    type="text"
                    className="start__actions-input"
                    value={
                      selectedItem?.unit_price * selectedItem?.quantity || ""
                    }
                    readOnly
                  />

                  <div className="start__actions-row">
                    <button
                      className="start__actions-btn"
                      onClick={incQty}
                      disabled={!selectedItem}
                      title="Увеличить количество"
                    >
                      <Plus />
                    </button>

                    <input
                      style={{ width: 100 }}
                      type="text"
                      min={0}
                      className="start__actions-input"
                      value={qty}
                      placeholder="Кол-во"
                      onChange={(e) => {
                        const newQty = e.target.value;
                        setQty(newQty);
                        if (selectedItem && newQty !== "" && start?.id) {
                          debouncedQtyUpdate(newQty, selectedItem, start.id);
                        }
                      }}
                      onBlur={(e) => {
                        if (selectedItem && start?.id) {
                          const inputValue = e.target.value;
                          let qtyNum;

                          if (inputValue === "" || inputValue === "0") {
                            qtyNum = selectedItem.quantity || 0;
                          } else {
                            qtyNum = Math.max(0, toNum(inputValue));
                          }

                          const productId =
                            selectedItem.product || selectedItem.id;
                          const available = getAvailableQtyForProduct(
                            productId,
                            products
                          );
                          if (available && qtyNum > available) {
                            qtyNum = available;
                            setAlert({
                              open: true,
                              type: "error",
                              message:
                                "Нельзя установить количество больше остатка",
                            });
                          }

                          setQty(String(qtyNum));

                          dispatch(
                            updateManualFilling({
                              id: start.id,
                              productId: selectedItem.id,
                              quantity: qtyNum,
                            })
                          )
                            .unwrap()
                            .then(() => onRefresh());
                        }
                      }}
                      disabled={!selectedItem}
                    />

                    <button
                      className="start__actions-btn"
                      onClick={decQty}
                      disabled={!selectedItem}
                      title="Уменьшить количество"
                    >
                      <Minus />
                    </button>
                  </div>

                  <input
                    type="text"
                    className="start__actions-input"
                    placeholder="Скидка на позицию"
                    onChange={onProductDiscountChange}
                    disabled={!selectedItem}
                  />
                </div>

                <input
                  type="text"
                  className="start__actions-input"
                  placeholder="Общ скидка"
                  onChange={onDiscountChange}
                />
              </div>
            </div> */}
            <div className="start__body-wrapper">
              <div className="start__body-wrapper">
                <table className="start__body-table">
                  <tbody>
                    {currentItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={cx(selectedId === item.id && "active")}
                        onClick={() => handleRowClick(item)}
                        style={{ cursor: "pointer" }}
                        title="Выбрать позицию"
                      >
                        <td>{idx + 1}.</td>
                        <td>{item.product_name ?? item.display_name}</td>
                        <td>{item.unit_price}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              className="start__table-btn start__table-btn--minus"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDecreaseQty(item);
                              }}
                              title="Уменьшить количество"
                            >
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={
                                itemQuantities[item.id] ?? item.quantity ?? ""
                              }
                              onChange={(e) => {
                                e.stopPropagation();
                                handleItemQtyChange(item, e.target.value);
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                handleItemQtyBlur(item);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: "60px",
                                textAlign: "center",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "14px",
                              }}
                              title="Редактировать количество"
                            />
                            <span style={{ fontSize: "14px", color: "#666" }}>
                              шт
                            </span>
                            <button
                              className="start__table-btn start__table-btn--plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIncreaseQty(item);
                              }}
                              title="Увеличить количество"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {Number(item.unit_price) * Number(item.quantity)}
                        </td>
                        <td>
                          <button
                            className="start__table-btn start__table-btn--delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item);
                            }}
                            title="Удалить товар"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="start__products">
            <button
              className="start__products-add orange"
              onClick={() => setShowCustomServiceModal(true)}
              title="Добавить дополнительную услугу"
            >
              Доп. услуги
            </button>

            {products?.map((product) => (
              <button
                key={product.id || product.name}
                className={cx(
                  "start__products-add",
                  selectedItem?.product_name == product.name && "active"
                )}
                onClick={async () => {
                  const available = getAvailableQtyForProduct(
                    product,
                    products
                  );
                  const pid = product.id || product.product;
                  const inCart = getCartQtyForProduct(pid, start?.items);
                  if (available <= 0 || inCart >= available) {
                    setAlert({
                      open: true,
                      type: "error",
                      message:
                        available > 0
                          ? `Нельзя добавить больше, чем есть на складе (доступно: ${available})`
                          : "Товара нет в наличии",
                    });
                    return;
                  }
                  await dispatch(
                    manualFilling({
                      id: start.id,
                      productId: product.id,
                    })
                  ).unwrap();
                  dispatch(startSale());
                }}
                title="Добавить 1 шт"
              >
                {product.name}
              </button>
            ))}
          </div>
        </div>

        <div className="col-4">
          <div className="start__total">
            <div className="start__total-top">
              <div className="start__total-row">
                <b>Без скидок</b>
                <p>{currentSubtotal}</p>
              </div>
              <div
                className="start__total-row"
                style={{ position: "relative" }}
              >
                <b>Скидка</b>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <p>{currentDiscount || 0}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountValue(currentDiscount || "");
                      setShowDiscountModal(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#007bff",
                      fontSize: "14px",
                    }}
                    title="Изменить скидку"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </div>
              <div className="start__total-row">
                <b>ИТОГО</b>
                <h4>{currentTotal}</h4>
              </div>
            </div>

            <div className="start__total-bottom">
              <button
                className="start__total-debt"
                onClick={() => setShowDebtModal(true)}
              >
                Долг
              </button>

              <div className="start__total-row1">
                <button
                  className={`start__total-pay ${
                    paymentMethod === "cash" ? "active" : ""
                  }`}
                  onClick={() => {
                    if (paymentMethod === "cash") {
                      // Отмена выбора наличных
                      setPaymentMethod(null);
                      setCashReceived("");
                      setCashPaymentConfirmed(false);
                    } else {
                      // Открываем модалку для выбора наличных
                      setShowCashModal(true);
                    }
                  }}
                  disabled={!start?.id}
                  style={{
                    backgroundColor:
                      paymentMethod === "cash" ? "#f7d617" : undefined,
                    border:
                      paymentMethod === "cash" ? "2px solid #000" : undefined,
                  }}
                  title={
                    paymentMethod === "cash"
                      ? "Нажмите, чтобы отменить выбор"
                      : "Оплата наличными"
                  }
                >
                  Наличными
                </button>
                <button
                  className={`start__total-pay ${
                    paymentMethod === "card" ? "active" : ""
                  }`}
                  onClick={() => {
                    if (paymentMethod === "card") {
                      // Отмена выбора перевода
                      setPaymentMethod(null);
                    } else {
                      // Выбираем перевод
                      setPaymentMethod("card");
                    }
                  }}
                  disabled={!start?.id}
                  style={{
                    backgroundColor:
                      paymentMethod === "card" ? "#f7d617" : undefined,
                    border:
                      paymentMethod === "card" ? "2px solid #000" : undefined,
                  }}
                  title={
                    paymentMethod === "card"
                      ? "Нажмите, чтобы отменить выбор"
                      : "Оплата переводом"
                  }
                >
                  Переводом
                </button>
              </div>

              {paymentMethod && (
                <div
                  className="start__total-row1"
                  style={{ marginTop: "10px" }}
                >
                  <button
                    className="start__total-pay"
                    onClick={() => performCheckout(true)}
                    disabled={!start?.id || !isPrinterConnected}
                    title={
                      !isPrinterConnected
                        ? "Принтер не подключен. Подключите принтер для печати чека."
                        : "Оформить и напечатать чек"
                    }
                  >
                    Печать чека
                  </button>
                  <button
                    className="start__total-pay"
                    onClick={() => performCheckout(false)}
                    disabled={!start?.id}
                  >
                    Без чека
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNewClientModal && (
        <UniversalModal
          onClose={() => setShowNewClientModal(false)}
          title={"Добавить клиента"}
        >
          <form
            className="start__clientForm"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitTried(true);
              const ve = validate(form);
              setErrors(ve);
              if (Object.keys(ve).length) return;
              (async () => {
                try {
                  await dispatch(createClientAsync(form)).unwrap();
                  setAlert({
                    open: true,
                    type: "success",
                    message: "Клиент успешно создан!",
                  });
                  dispatch(fetchClientsAsync());
                  setShowNewClientModal(false);
                  setForm({
                    full_name: "",
                    phone: "",
                    email: "",
                    date: new Date().toISOString().split("T")[0],
                    type: "client",
                    llc: "",
                    inn: "",
                    okpo: "",
                    score: "",
                    bik: "",
                    address: "",
                  });
                  setTouched({});
                  setSubmitTried(false);
                  setErrors({});
                } catch (e) {
                  console.log(e);
                }
              })();
            }}
          >
            <div>
              <label>ФИО</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.full_name || submitTried) &&
                    errors.full_name &&
                    "error"
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.full_name}
                type="text"
                placeholder="ФИО"
                name="full_name"
              />
              {(touched.full_name || submitTried) && errors.full_name && (
                <p className="sell__header-necessarily">{errors.full_name}</p>
              )}
            </div>
            <div>
              <label>ОсОО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.llc}
                type="text"
                name="llc"
                placeholder="ОсОО"
              />
            </div>
            <div>
              <label>ИНН</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.inn}
                type="text"
                name="inn"
                placeholder="ИНН"
              />
            </div>
            <div>
              <label>ОКПО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.okpo}
                type="text"
                name="okpo"
                placeholder="ОКПО"
              />
            </div>
            <div>
              <label>З/СЧЕТ</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.score}
                type="text"
                name="score"
                placeholder="Р/СЧЁТ"
              />
            </div>
            <div>
              <label>БИК</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.bik}
                type="text"
                name="bik"
                placeholder="БИК"
              />
            </div>
            <div>
              <label>Адрес</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.address}
                type="text"
                name="address"
                placeholder="Адрес"
              />
            </div>
            <div>
              <label>Телефон</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.phone || submitTried) && errors.phone && "error"
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.phone}
                type="text"
                name="phone"
                placeholder="Телефон"
              />
              {(touched.phone || submitTried) && errors.phone && (
                <p className="sell__header-necessarily">{errors.phone}</p>
              )}
            </div>
            <div>
              <label>Email</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.email}
                type="email"
                name="email"
                placeholder="Почта"
              />
            </div>
            <div
              style={{
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowNewClientModal(false)}
              >
                Отмена
              </button>
              <button className="start__total-pay" style={{ width: "auto" }}>
                Создать
              </button>
            </div>
          </form>
        </UniversalModal>
      )}

      {showDebtModal && (
        <UniversalModal onClose={() => setShowDebtModal(false)} title={"Долг"}>
          <div className="start__debt">
            <p className="start__debt-amount">
              Cумма долга: <b>{currentTotal}</b>
            </p>
            {clientId === "" && (
              <>
                <p
                  style={{ margin: "5px 0" }}
                  className="sell__header-necessarily"
                >
                  Выберите клиента!
                </p>
                <select
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setSelectClient(e.target.value);
                  }}
                  value={clientId}
                  className="sell__header-input"
                >
                  <option value="">Выберите клиента</option>
                  {filterClient.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {company?.subscription_plan?.name === "Старт" && (
              <>
                <label>Телефон</label>
                <input
                  type="text"
                  className="sell__header-input"
                  onChange={onChange2}
                  name="phone"
                  value={state.phone}
                />
                <label>Дата оплаты</label>
                <input
                  type="date"
                  className="sell__header-input"
                  onChange={onChange2}
                  name="dueDate"
                />
              </>
            )}
            <label>Тип оплаты</label>
            <select
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
              className="sell__header-input"
              name=""
            >
              <option value="">Тип оплаты</option>
              <option value="Предоплата">Предоплата</option>
              <option value="Долги">Долг</option>
            </select>
            {debt === "Предоплата" && (
              <>
                <label htmlFor="">Сумма предоплаты</label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <label htmlFor="">Срок долга (мес.) </label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                />
              </>
            )}
            {debt === "Долги" && (
              <>
                <label htmlFor="">Срок долга (мес.) </label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                />
              </>
            )}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Сохранить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showCustomServiceModal && (
        <UniversalModal
          onClose={() => {
            setShowCustomServiceModal(false);
            setCustomService({ name: "", price: "", quantity: "1" });
          }}
          title={"Дополнительная услуга"}
        >
          <div className="start__custom-service">
            <div>
              <label>Название</label>
              <input
                className="sell__header-input"
                value={customService.name}
                onChange={(e) =>
                  setCustomService((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                type="text"
                placeholder="Введите название услуги"
              />
            </div>
            <div>
              <label>Сумма</label>
              <input
                className="sell__header-input"
                value={customService.price}
                onChange={(e) =>
                  setCustomService((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                type="text"
                placeholder="Введите цену услуги"
              />
            </div>
            <div>
              <label>Количество</label>
              <input
                className="sell__header-input"
                value={customService.quantity}
                onChange={(e) =>
                  setCustomService((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                type="text"
                placeholder="Введите количество товара"
              />
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => {
                  setShowCustomServiceModal(false);
                  setCustomService({ name: "", price: "", quantity: "1" });
                }}
              >
                Отменить
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={handleAddCustomService}
              >
                Добавить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showDiscountModal && (
        <UniversalModal
          onClose={() => {
            setShowDiscountModal(false);
            setDiscountValue("");
          }}
          title={"Общая скидка"}
        >
          <div className="start__discount" style={{ width: "379px" }}>
            <div>
              <label>Сумма скидки</label>
              <input
                className="sell__header-input"
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="Введите сумму скидки"
                autoFocus
              />
              {currentSubtotal && (
                <p
                  style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}
                >
                  Сумма без скидки: {currentSubtotal}
                </p>
              )}
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => {
                  setShowDiscountModal(false);
                  setDiscountValue("");
                }}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={() => {
                  const discount =
                    discountValue.trim() === "" ? "0" : discountValue;
                  onDiscountChange({ target: { value: discount } });
                  setShowDiscountModal(false);
                  setDiscountValue("");
                }}
              >
                Применить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showCashModal && (
        <UniversalModal
          onClose={() => {
            // Если оплата не была подтверждена (закрыли через клик вне модалки или крестик), очищаем
            if (!cashPaymentConfirmed) {
              setCashReceived("");
              setPaymentMethod(null);
            }
            setCashPaymentConfirmed(false); // сбрасываем флаг
            setShowCashModal(false);
          }}
          title={"Оплата наличными"}
        >
          <div className="start__cash-payment" style={{ width: "400px" }}>
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                К оплате: {currentTotal} сом
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 500,
                }}
              >
                Сумма от покупателя
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Введите сумму"
                className="sell__header-input"
                style={{ width: "100%" }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const received = Number(cashReceived);
                    const total = Number(currentTotal);
                    if (received >= total) {
                      handleCashPayment();
                    } else {
                      setAlert({
                        open: true,
                        type: "error",
                        message: `Недостаточно средств. К оплате: ${total.toFixed(
                          2
                        )} сом`,
                      });
                    }
                  }
                }}
              />
            </div>
            {cashReceived && Number(cashReceived) > 0 && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>Получено:</span>
                  <span style={{ fontWeight: 600 }}>
                    {Number(cashReceived).toFixed(2)} сом
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>К оплате:</span>
                  <span style={{ fontWeight: 600 }}>
                    {Number(currentTotal).toFixed(2)} сом
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "10px",
                    borderTop: "2px solid #ddd",
                    fontSize: "18px",
                    fontWeight: 700,
                    color:
                      Number(cashReceived) >= Number(currentTotal)
                        ? "#22c55e"
                        : "#ef4444",
                  }}
                >
                  <span>Сдача:</span>
                  <span>
                    {(Number(cashReceived) - Number(currentTotal)).toFixed(2)}{" "}
                    сом
                  </span>
                </div>
                {Number(cashReceived) < Number(currentTotal) && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px",
                      backgroundColor: "#fee2e2",
                      color: "#b42318",
                      borderRadius: "4px",
                      fontSize: "14px",
                      textAlign: "center",
                    }}
                  >
                    Недостаточно средств
                  </div>
                )}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => {
                  // При отмене очищаем сумму и способ оплаты
                  setCashReceived("");
                  setPaymentMethod(null);
                  setCashPaymentConfirmed(false);
                  setShowCashModal(false);
                }}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={handleCashPayment}
                disabled={
                  !cashReceived ||
                  Number(cashReceived) < Number(currentTotal) ||
                  Number(cashReceived) <= 0
                }
              >
                Оплатить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      <AlertModal
        open={alert.open}
        type={alert.type}
        message={alert.message}
        okText="Ok"
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </section>
  );
};

export default SellMainStart;

// import { Minus, Plus, Search } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { useDispatch } from "react-redux";
// import { useDebounce, useDebouncedAction } from "../../../hooks/useDebounce";
// import {
//   doSearch,
//   manualFilling,
//   productCheckout,
//   startSale,
//   updateManualFilling,
//   addCustomItem,
// } from "../../../store/creators/saleThunk";
// import {
//   createClientAsync,
//   fetchClientsAsync,
// } from "../../../store/creators/clientCreators";
// import {
//   createDeal,
//   getProductCheckout,
// } from "../../../store/creators/saleThunk";
// import { useSale } from "../../../store/slices/saleSlice";
// import {
//   addCashFlows,
//   getCashBoxes,
//   useCash,
// } from "../../../store/slices/cashSlice";
// import { useClient } from "../../../store/slices/ClientSlice";
// import { useUser } from "../../../store/slices/userSlice";
// import UniversalModal from "../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";
// import { DEAL_STATUS_RU } from "./Sell";
// import AlertModal from "../../common/AlertModal/AlertModal";
// import axios from "axios";
// import api from "../../../api";
// import { useProducts } from "../../../store/slices/productSlice";
// import { fetchProductsAsync } from "../../../store/creators/productCreators";

// const cx = (...args) => args.filter(Boolean).join(" ");

// const toNum = (v) => {
//   const n = Number(String(v).replace(",", "."));
//   return Number.isFinite(n) ? n : 0;
// };

// const SellMainStart = ({ show, setShow }) => {
//   const { company } = useUser();
//   const { list: cashBoxes } = useCash();
//   const { start, foundProduct } = useSale();
//   const { list: products } = useProducts();
//   const { list: clients = [] } = useClient();
//   const [clientId, setClientId] = useState("");
//   const [debtMonths, setDebtMonths] = useState("");
//   const [form, setForm] = useState({
//     full_name: "",
//     phone: "",
//     email: "",
//     date: new Date().toISOString().split("T")[0],
//     type: "client",
//     llc: "",
//     inn: "",
//     okpo: "",
//     score: "",
//     bik: "",
//     address: "",
//   });
//   const [submitTried, setSubmitTried] = useState(false);
//   const [touched, setTouched] = useState({});
//   const [errors, setErrors] = useState({});
//   const [debt, setDebt] = useState("");
//   const [amount, setAmount] = useState("");
//   const [showNewClientModal, setShowNewClientModal] = useState(false);
//   const [showDebtModal, setShowDebtModal] = useState(false);
//   const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
//   const [customService, setCustomService] = useState({
//     name: "",
//     price: "",
//     quantity: "1",
//   });
//   const [alert, setAlert] = useState({
//     open: false,
//     type: "success",
//     message: "",
//   });
//   const [cashData, setCashData] = useState({
//     cashbox: "",
//     type: "income",
//     name: "",
//     amount: "",
//     status: company?.subscription_plan?.name === "Старт" ? true : false,
//   });
//   const dispatch = useDispatch();
//   const run = (thunk) => dispatch(thunk).unwrap();
//   const [selectClient, setSelectClient] = useState("");
//   const [selectCashBox, setSelectCashBox] = useState("");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [showDropdown, setShowDropdown] = useState(false);

//   const [selectedId, setSelectedId] = useState(null);
//   const selectedItem = useMemo(() => {
//     return (start?.items || []).find((i) => i.id === selectedId) || null;
//   }, [start?.items, selectedId]);
//   const filterClient = useMemo(
//     () =>
//       (Array.isArray(clients) ? clients : []).filter(
//         (c) => c.type === "client"
//       ),
//     [clients]
//   );
//   const pickClient = useMemo(
//     () => filterClient.find((x) => String(x.id) === String(clientId)),
//     [filterClient, clientId]
//   );

//   const [qty, setQty] = useState("");

//   useEffect(() => {
//     if (selectedItem) {
//       setQty(String(selectedItem.quantity ?? ""));
//     } else {
//       setQty("");
//     }
//   }, [selectedItem]);

//   const debouncedDiscount = useDebounce((v) => {
//     dispatch(
//       manualFilling({
//         id: start.id,
//         productId: selectedItem.id,
//         discount_total: v,
//         quantity: 2,
//       })
//     );
//   }, 600);

//   const onProductDiscountChange = (e) => debouncedDiscount(e.target.value);

//   const debouncedSearch = useDebounce((v) => {
//     dispatch(doSearch({ search: v }));
//   }, 600);

//   const onChange = (e) => {
//     const value = e.target.value;
//     setSearchQuery(value);
//     debouncedSearch(value);
//     setShowDropdown(value.length > 0);
//   };
//   const onDiscountChange = (e) => debouncedDiscount1(e.target.value);
//   const debouncedDiscount1 = useDebounce((v) => {
//     dispatch(startSale(v));
//   }, 600);

//   const debouncedQtyUpdate = useDebounce(
//     async (newQty, currentSelectedItem, currentStartId) => {
//       if (!currentSelectedItem || !currentStartId) return;
//       const qtyNum = Math.max(0, toNum(newQty));

//       try {
//         await dispatch(
//           updateManualFilling({
//             id: currentStartId,
//             productId: currentSelectedItem.id,
//             quantity: qtyNum,
//           })
//         ).unwrap();
//         onRefresh();
//       } catch (error) {
//         console.error("Ошибка при обновлении количества:", error);
//       }
//     },
//     600
//   );

//   const onRefresh = () => {
//     dispatch(startSale());
//   };

//   useEffect(() => {
//     dispatch(fetchClientsAsync());
//     dispatch(getCashBoxes());
//     dispatch(doSearch());
//     dispatch(fetchProductsAsync());
//   }, [dispatch]);

//   // Управление видимостью дропдауна на основе результатов поиска
//   useEffect(() => {
//     if (foundProduct && Array.isArray(foundProduct)) {
//       if (foundProduct.length > 0 && searchQuery.length > 0) {
//         setShowDropdown(true);
//       } else if (foundProduct.length === 0 && searchQuery.length === 0) {
//         setShowDropdown(false);
//       }
//     }
//   }, [foundProduct, searchQuery]);

//   const handleRowClick = (item) => {
//     setSelectedId(item.id);
//   };

//   const handleSelectProduct = async (product) => {
//     if (!start?.id) {
//       setAlert({
//         open: true,
//         type: "error",
//         message: "Корзина не инициализирована. Пожалуйста, подождите...",
//       });
//       return;
//     }
//     try {
//       await dispatch(
//         manualFilling({
//           id: start.id,
//           productId: product.id || product.product,
//         })
//       ).unwrap();
//       dispatch(startSale());
//       setSearchQuery("");
//       setShowDropdown(false);
//     } catch (error) {
//       console.error("Ошибка при добавлении товара:", error);
//       setAlert({
//         open: true,
//         type: "error",
//         message: error?.data?.detail || "Ошибка при добавлении товара",
//       });
//     }
//   };

//   const incQty = async () => {
//     if (!selectedItem) return;
//     const newQty = (toNum(qty) || 0) + 1;
//     setQty(String(newQty));

//     await dispatch(
//       manualFilling({ id: start.id, productId: selectedItem.product })
//     ).unwrap();
//     onRefresh();
//   };

//   const decQty = async () => {
//     if (!selectedItem) return;
//     const next = Math.max(0, (toNum(qty) || 0) - 1);
//     setQty(String(next));

//     await dispatch(
//       updateManualFilling({
//         id: start.id,
//         productId: selectedItem.id,
//         quantity: next,
//       })
//     ).unwrap();
//     onRefresh();
//   };

//   const validate = (f) => {
//     const e = {};
//     if (!f.full_name.trim()) e.full_name = "Это поле не может быть пустым.";
//     const ph = f.phone.trim();
//     if (!ph) e.phone = "Это поле не может быть пустым.";
//     else if (!/^\+?\d[\d\s\-()]{5,}$/.test(ph))
//       e.phone = "Неверный формат телефона.";
//     return e;
//   };
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     const next = { ...form, [name]: value };
//     setForm(next);
//     if (touched[name] || submitTried) {
//       const ve = validate(next);
//       setErrors(ve);
//     }
//   };
//   const handleBlur = (e) => {
//     const { name } = e.target;
//     const nextTouched = { ...touched, [name]: true };
//     setTouched(nextTouched);
//     setErrors(validate(form));
//   };

//   const filterData = products;
//   const currentCart = start;
//   const currentItems = start?.items || [];
//   const currentSubtotal = start?.subtotal;
//   const currentDiscount = start?.order_discount_total;
//   const currentTotal = start?.total;
//   // console.log(foundProduct);

//   const handleAddCustomService = async () => {
//     try {
//       // Валидация
//       if (!customService.name.trim()) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Введите название услуги",
//         });
//         return;
//       }

//       if (!customService.price.trim() || Number(customService.price) <= 0) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Введите корректную цену услуги",
//         });
//         return;
//       }

//       if (!start?.id) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Корзина не инициализирована. Пожалуйста, подождите...",
//         });
//         return;
//       }

//       // Добавление дополнительной услуги
//       await dispatch(
//         addCustomItem({
//           id: start.id,
//           name: customService.name.trim(),
//           price: customService.price.trim(),
//           quantity: Number(customService.quantity) || 1,
//         })
//       ).unwrap();

//       // Обновление корзины
//       onRefresh();

//       // Сброс формы и закрытие модального окна
//       setCustomService({
//         name: "",
//         price: "",
//         quantity: "1",
//       });
//       setShowCustomServiceModal(false);

//       // Показ сообщения об успехе
//       setAlert({
//         open: true,
//         type: "success",
//         message: "Дополнительная услуга успешно добавлена!",
//       });
//     } catch (error) {
//       console.error("Ошибка при добавлении дополнительной услуги:", error);
//       setAlert({
//         open: true,
//         type: "error",
//         message:
//           error?.data?.detail ||
//           error?.message ||
//           "Ошибка при добавлении дополнительной услуги",
//       });
//     }
//   };

//   const onSubmit = async (e) => {
//     e.preventDefault();
//     setSubmitTried(true);
//     const ve = validate(form);
//     setErrors(ve);
//     if (Object.keys(ve).length) return;
//     try {
//       await dispatch(createClientAsync(form)).unwrap();
//       setAlert({
//         open: true,
//         type: "success",
//         message: "Клиент успешно создан!",
//       });
//       dispatch(fetchClientsAsync());
//       setShowNewClientModal(false);
//       setForm({
//         full_name: "",
//         phone: "",
//         email: "",
//         date: new Date().toISOString().split("T")[0],
//         type: "client",
//         llc: "",
//         inn: "",
//         okpo: "",
//         score: "",
//         bik: "",
//         address: "",
//       });
//       setTouched({});
//       setSubmitTried(false);
//       setErrors({});
//     } catch (e) {
//       console.log(e);
//     }
//   };

//   const performCheckout = async (withReceipt) => {
//     try {
//       // Валидация обязательных полей
//       if (!cashData.cashbox) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Выберите кассу для проведения операции",
//         });
//         return;
//       }

//       const itemsToCheck = start?.items;
//       if (itemsToCheck?.length === 0) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Добавьте товар для проведения операции",
//         });
//         return;
//       }

//       // Валидация для долговых операций
//       if (debt && !clientId) {
//         setAlert({
//           open: true,
//           type: "error",
//           message: "Выберите клиента для долговой операции",
//         });
//         return;
//       }

//       // Валидация суммы предоплаты
//       if (debt === "Предоплата") {
//         if (!amount || Number(amount) <= 0) {
//           setAlert({
//             open: true,
//             type: "error",
//             message: "Введите корректную сумму предоплаты",
//           });
//           return;
//         }
//         const totalToCheck = start?.total;
//         if (Number(amount) > Number(totalToCheck)) {
//           setAlert({
//             open: true,
//             type: "error",
//             message: "Сумма предоплаты не может превышать общую сумму",
//           });
//           return;
//         }
//         if (!debtMonths || Number(debtMonths) <= 0) {
//           setAlert({
//             open: true,
//             type: "error",
//             message: "Введите корректный срок долга (в месяцах)",
//           });
//           return;
//         }
//       }

//       // Валидация для обычных долгов
//       if (debt === "Долги") {
//         if (!debtMonths || Number(debtMonths) <= 0) {
//           setAlert({
//             open: true,
//             type: "error",
//             message: "Введите корректный срок долга (в месяцах)",
//           });
//           return;
//         }
//       }

//       if (clientId) {
//         const totalForDeal = start?.total;
//         await dispatch(
//           createDeal({
//             clientId: clientId,
//             title: `${debt || "Продажа"} ${pickClient?.full_name}`,
//             statusRu: debt,
//             amount: totalForDeal,
//             prepayment: debt === "Предоплата" ? Number(amount) : undefined,
//             debtMonths:
//               debt === "Долги" || debt === "Предоплата"
//                 ? Number(debtMonths)
//                 : undefined,
//           })
//         ).unwrap();
//       }

//       let result;
//       result = await run(
//         productCheckout({
//           id: start?.id,
//           bool: withReceipt,
//           clientId: clientId,
//         })
//       );

//       const amountForCash = debt === "Предоплата" ? amount : start.total;

//       if (debt !== "Долги") {
//         await run(
//           addCashFlows({
//             ...cashData,
//             name: cashData.name === "" ? "Продажа" : cashData.name,
//             amount: amountForCash,
//           })
//         );
//       }

//       setShow(false);
//       if (withReceipt && result?.sale_id) {
//         const pdfBlob = await run(getProductCheckout(result.sale_id));
//         const dl = (blob, name) => {
//           const url = URL.createObjectURL(blob);
//           const a = document.createElement("a");
//           a.href = url;
//           a.download = name;
//           a.click();
//           URL.revokeObjectURL(url);
//         };
//         dl(pdfBlob, "receipt.pdf");
//       }
//       setAlert({
//         open: true,
//         type: "success",
//         message: "Операция успешно выполнена!",
//       });
//     } catch (e) {
//       setAlert({
//         open: true,
//         type: "error",
//         message: `Что то пошло не так.\n\n
//         ${e.data.detail
//           .replace("у агента:", "товара")
//           .replace("Нужно 2, доступно 0.", "")}`,
//       });
//     }
//   };

//   return (
//     <section className="sell start">
//       <div className="sell__header">
//         <div className="sell__header-left">
//           <div className="sell__header-input" style={{ position: "relative" }}>
//             <input
//               onChange={onChange}
//               onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
//               onBlur={() => {
//                 // Закрываем дропдаун с небольшой задержкой, чтобы успел обработаться клик
//                 setTimeout(() => setShowDropdown(false), 200);
//               }}
//               value={searchQuery}
//               type="text"
//               placeholder="Введите название товара"
//             />
//             <span>
//               <Search size={15} color="#91929E" />
//             </span>
//             {showDropdown && foundProduct && foundProduct.length > 0 && (
//               <div
//                 style={{
//                   position: "absolute",
//                   top: "100%",
//                   left: 0,
//                   right: 0,
//                   backgroundColor: "white",
//                   border: "1px solid #ddd",
//                   borderRadius: "4px",
//                   boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
//                   zIndex: 1000,
//                   maxHeight: "300px",
//                   overflowY: "auto",
//                   marginTop: "4px",
//                 }}
//               >
//                 {foundProduct.map((product) => (
//                   <div
//                     key={product.id || product.product}
//                     onClick={() => handleSelectProduct(product)}
//                     style={{
//                       padding: "10px 15px",
//                       cursor: "pointer",
//                       borderBottom: "1px solid #f0f0f0",
//                       transition: "background-color 0.2s",
//                     }}
//                     onMouseEnter={(e) =>
//                       (e.target.style.backgroundColor = "#f5f5f5")
//                     }
//                     onMouseLeave={(e) =>
//                       (e.target.style.backgroundColor = "white")
//                     }
//                   >
//                     <div style={{ fontWeight: "500" }}>
//                       {product.product_name || product.name}
//                     </div>
//                     {product.unit_price && (
//                       <div
//                         style={{
//                           fontSize: "12px",
//                           color: "#666",
//                           marginTop: "4px",
//                         }}
//                       >
//                         Цена: {product.unit_price}
//                         {product.qty_on_hand !== undefined && (
//                           <span style={{ marginLeft: "10px" }}>
//                             Остаток: {product.qty_on_hand}
//                           </span>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 ))}
//               </div>
//             )}
//             {showDropdown &&
//               searchQuery.length > 0 &&
//               (!foundProduct ||
//                 (Array.isArray(foundProduct) && foundProduct.length === 0)) && (
//                 <div
//                   style={{
//                     position: "absolute",
//                     top: "100%",
//                     left: 0,
//                     right: 0,
//                     backgroundColor: "white",
//                     border: "1px solid #ddd",
//                     borderRadius: "4px",
//                     boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
//                     zIndex: 1000,
//                     padding: "15px",
//                     textAlign: "center",
//                     color: "#666",
//                     marginTop: "4px",
//                   }}
//                 >
//                   Нет такого товара
//                 </div>
//               )}
//           </div>

//           <select
//             onChange={(e) => {
//               setClientId(e.target.value);
//               setSelectClient(e.target.value);
//             }}
//             value={clientId}
//             className="sell__header-input"
//           >
//             <option value="">Выберите клиента</option>
//             {filterClient.map((client) => (
//               <option key={client.id} value={client.id}>
//                 {client.full_name}
//               </option>
//             ))}
//           </select>

//           <button
//             className="sell__header-plus"
//             onClick={() => setShowNewClientModal(true)}
//           >
//             <span>
//               <svg
//                 width="24"
//                 height="24"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 xmlns="http://www.w3.org/2000/svg"
//               >
//                 <path
//                   d="M19 11H13V5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5V11H5C4.73478 11 4.48043 11.1054 4.29289 11.2929C4.10536 11.4804 4 11.7348 4 12C4 12.2652 4.10536 12.5196 4.29289 12.7071C4.4804 12.8946 4.73478 13 5 13H11V19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19V13H19C19.2652 13 19.5196 12.8946 19.7071 12.7071C19.8946 12.5196 20 12.2652 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"
//                   fill="#CCCCCC"
//                 />
//               </svg>
//             </span>
//           </button>
//           <select
//             value={selectCashBox}
//             onChange={(e) => {
//               const v = e.target.value;
//               setSelectCashBox(v);
//               setCashData((prev) => ({ ...prev, cashbox: v }));
//             }}
//             className="sell__header-input"
//           >
//             <option value="">Выберите кассу</option>
//             {cashBoxes?.map((c) => (
//               <option key={c.id} value={c.id}>
//                 {c.name ?? c.department_name}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div className="sell__header-left"></div>
//       </div>

//       <div className="start__body">
//         <div className="col-8">
//           <div className="start__body-column">
//             <div className="sell__body-header">
//               <h2 className="start__body-title">
//                 {selectedItem?.product_name}
//               </h2>

//               <div className="start__actions">
//                 <div className="start__actions-left">
//                   <input
//                     type="text"
//                     className="start__actions-input"
//                     value={
//                       selectedItem?.unit_price * selectedItem?.quantity || ""
//                     }
//                     readOnly
//                   />

//                   <div className="start__actions-row">
//                     <button
//                       className="start__actions-btn"
//                       onClick={incQty}
//                       disabled={!selectedItem}
//                       title="Увеличить количество"
//                     >
//                       <Plus />
//                     </button>

//                     <input
//                       style={{ width: 100 }}
//                       type="text"
//                       min={0}
//                       className="start__actions-input"
//                       value={qty}
//                       placeholder="Кол-во"
//                       onChange={(e) => {
//                         const newQty = e.target.value;
//                         setQty(newQty);
//                         if (selectedItem && newQty !== "" && start?.id) {
//                           debouncedQtyUpdate(newQty, selectedItem, start.id);
//                         }
//                       }}
//                       onBlur={(e) => {
//                         // Обновляем сразу при потере фокуса
//                         if (selectedItem && start?.id) {
//                           const inputValue = e.target.value;
//                           let qtyNum;

//                           if (inputValue === "" || inputValue === "0") {
//                             // Если пустое или 0, устанавливаем текущее количество товара
//                             qtyNum = selectedItem.quantity || 0;
//                           } else {
//                             qtyNum = Math.max(0, toNum(inputValue));
//                           }

//                           setQty(String(qtyNum));

//                           dispatch(
//                             updateManualFilling({
//                               id: start.id,
//                               productId: selectedItem.id,
//                               quantity: qtyNum,
//                             })
//                           )
//                             .unwrap()
//                             .then(() => onRefresh());
//                         }
//                       }}
//                       disabled={!selectedItem}
//                     />

//                     <button
//                       className="start__actions-btn"
//                       onClick={decQty}
//                       disabled={!selectedItem}
//                       title="Уменьшить количество"
//                     >
//                       <Minus />
//                     </button>
//                   </div>

//                   <input
//                     type="text"
//                     className="start__actions-input"
//                     placeholder="Скидка на позицию"
//                     onChange={onProductDiscountChange}
//                     disabled={!selectedItem}
//                   />
//                 </div>

//                 <input
//                   type="text"
//                   className="start__actions-input"
//                   placeholder="Общ скидка"
//                   onChange={onDiscountChange}
//                 />
//               </div>
//             </div>
//             <div className="start__body-wrapper">
//               <div className="start__body-wrapper">
//                 <table className="start__body-table">
//                   <tbody>
//                     {currentItems.map((item, idx) => (
//                       <tr
//                         key={item.id}
//                         className={cx(selectedId === item.id && "active")}
//                         onClick={() => handleRowClick(item)}
//                         style={{ cursor: "pointer" }}
//                         title="Выбрать позицию"
//                       >
//                         <td>{idx + 1}.</td>
//                         <td>{item.product_name ?? item.display_name}</td>
//                         <td>{item.unit_price}</td>
//                         <td>{item.quantity} шт</td>
//                         <td>
//                           {Number(item.unit_price) * Number(item.quantity)}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           </div>

//           <div className="start__products">
//             <button
//               className="start__products-add orange"
//               onClick={() => setShowCustomServiceModal(true)}
//               title="Добавить дополнительную услугу"
//             >
//               Доп. услуги
//             </button>
//             {products?.slice(0, 10).map((product) => (
//               <button
//                 key={product.name}
//                 className={cx(
//                   "start__products-add",
//                   selectedItem?.product_name == product.name && "active"
//                 )}
//                 onClick={async () => {
//                   await dispatch(
//                     manualFilling({
//                       id: start.id,
//                       productId: product.id,
//                     })
//                   ).unwrap();
//                   dispatch(startSale());
//                 }}
//                 title="Добавить 1 шт"
//               >
//                 {product.name}
//               </button>
//             ))}
//           </div>
//         </div>

//         <div className="col-4">
//           <div className="start__total">
//             <div className="start__total-top">
//               <div className="start__total-row">
//                 <b>Без скидок</b>
//                 <p>{currentSubtotal}</p>
//               </div>
//               <div className="start__total-row">
//                 <b>Скидка</b>
//                 <p>{currentDiscount}</p>
//               </div>
//               <div className="start__total-row">
//                 <b>ИТОГО</b>
//                 <h4>{currentTotal}</h4>
//               </div>
//             </div>

//             <div className="start__total-bottom">
//               <button
//                 className="start__total-debt"
//                 onClick={() => setShowDebtModal(true)}
//               >
//                 Долг
//               </button>

//               <div className="start__total-row1">
//                 <button
//                   className="start__total-pay"
//                   onClick={() => performCheckout(true)}
//                   disabled={!start?.id}
//                 >
//                   Печать чека
//                 </button>
//                 <button
//                   className="start__total-pay"
//                   onClick={() => performCheckout(false)}
//                   disabled={!start?.id}
//                 >
//                   Без чека
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {showNewClientModal && (
//         <UniversalModal
//           onClose={() => setShowNewClientModal(false)}
//           title={"Добавить клиента"}
//         >
//           <form className="start__clientForm" onSubmit={onSubmit}>
//             <div>
//               <label>ФИО</label>
//               <input
//                 className={cx(
//                   "sell__header-input",
//                   (touched.full_name || submitTried) &&
//                     errors.full_name &&
//                     "error"
//                 )}
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.full_name}
//                 type="text"
//                 placeholder="ФИО"
//                 name="full_name"
//               />
//               {(touched.full_name || submitTried) && errors.full_name && (
//                 <p className="sell__header-necessarily">{errors.full_name}</p>
//               )}
//             </div>
//             <div>
//               <label>ОсОО</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.llc}
//                 type="text"
//                 name="llc"
//                 placeholder="ОсОО"
//               />
//             </div>
//             <div>
//               <label>ИНН</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.inn}
//                 type="text"
//                 name="inn"
//                 placeholder="ИНН"
//               />
//             </div>
//             <div>
//               <label>ОКПО</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.okpo}
//                 type="text"
//                 name="okpo"
//                 placeholder="ОКПО"
//               />
//             </div>
//             <div>
//               <label>З/СЧЕТ</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.score}
//                 type="text"
//                 name="score"
//                 placeholder="Р/СЧЁТ"
//               />
//             </div>
//             <div>
//               <label>БИК</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.bik}
//                 type="text"
//                 name="bik"
//                 placeholder="БИК"
//               />
//             </div>
//             <div>
//               <label>Адрес</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.address}
//                 type="text"
//                 name="address"
//                 placeholder="Адрес"
//               />
//             </div>
//             <div>
//               <label>Телефон</label>
//               <input
//                 className={cx(
//                   "sell__header-input",
//                   (touched.phone || submitTried) && errors.phone && "error"
//                 )}
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.phone}
//                 type="text"
//                 name="phone"
//                 placeholder="Телефон"
//               />
//               {(touched.phone || submitTried) && errors.phone && (
//                 <p className="sell__header-necessarily">{errors.phone}</p>
//               )}
//             </div>
//             <div>
//               <label>Email</label>
//               <input
//                 className="sell__header-input"
//                 onChange={handleChange}
//                 onBlur={handleBlur}
//                 value={form.email}
//                 type="email"
//                 name="email"
//                 placeholder="Почта"
//               />
//             </div>
//             <div
//               style={{
//                 display: "flex",
//                 columnGap: "10px",
//                 justifyContent: "end",
//               }}
//             >
//               <button
//                 className="sell__reset"
//                 type="button"
//                 onClick={() => setShowNewClientModal(false)}
//               >
//                 Отмена
//               </button>
//               <button className="start__total-pay" style={{ width: "auto" }}>
//                 Создать
//               </button>
//             </div>
//           </form>
//         </UniversalModal>
//       )}
//       {showDebtModal && (
//         <UniversalModal onClose={() => setShowDebtModal(false)} title={"Долг"}>
//           <div className="start__debt">
//             <p className="start__debt-amount">
//               Cумма долга: <b>{currentTotal}</b>
//             </p>
//             {clientId === "" && (
//               <>
//                 <p
//                   style={{ margin: "5px 0" }}
//                   className="sell__header-necessarily"
//                 >
//                   Выберите клиента!
//                 </p>
//                 <select
//                   onChange={(e) => {
//                     setClientId(e.target.value);
//                     setSelectClient(e.target.value);
//                   }}
//                   value={clientId}
//                   className="sell__header-input"
//                 >
//                   <option value="">Выберите клиента</option>
//                   {filterClient.map((client) => (
//                     <option key={client.id} value={client.id}>
//                       {client.full_name}
//                     </option>
//                   ))}
//                 </select>
//               </>
//             )}
//             <label>Тип оплаты</label>
//             <select
//               value={debt}
//               onChange={(e) => setDebt(e.target.value)}
//               className="sell__header-input"
//               name=""
//             >
//               <option value="">Тип оплаты</option>
//               <option value="Предоплата">Предоплата</option>
//               <option value="Долги">Долг</option>
//             </select>
//             {debt === "Предоплата" && (
//               <>
//                 <label htmlFor="">Сумма предоплаты</label>
//                 <input
//                   type="text"
//                   className="sell__header-input"
//                   value={amount}
//                   onChange={(e) => setAmount(e.target.value)}
//                 />
//                 <label htmlFor="">Срок долга (мес.) </label>
//                 <input
//                   type="text"
//                   className="sell__header-input"
//                   value={debtMonths}
//                   onChange={(e) => setDebtMonths(e.target.value)}
//                 />
//               </>
//             )}
//             {debt === "Долги" && (
//               <>
//                 <label htmlFor="">Срок долга (мес.) </label>
//                 <input
//                   type="text"
//                   className="sell__header-input"
//                   value={debtMonths}
//                   onChange={(e) => setDebtMonths(e.target.value)}
//                 />
//               </>
//             )}
//             <div
//               style={{
//                 marginTop: "20px",
//                 display: "flex",
//                 columnGap: "10px",
//                 justifyContent: "end",
//               }}
//             >
//               <button
//                 className="sell__reset"
//                 type="button"
//                 onClick={() => setShowDebtModal(false)}
//               >
//                 Отмена
//               </button>
//               <button
//                 className="start__total-pay"
//                 style={{ width: "auto" }}
//                 type="button"
//                 onClick={() => setShowDebtModal(false)}
//               >
//                 Сохранить
//               </button>
//             </div>
//           </div>
//         </UniversalModal>
//       )}

//       {showCustomServiceModal && (
//         <UniversalModal
//           onClose={() => {
//             setShowCustomServiceModal(false);
//             setCustomService({
//               name: "",
//               price: "",
//               quantity: "1",
//             });
//           }}
//           title={"Дополнительная услуга"}
//         >
//           <div className="start__custom-service">
//             <div>
//               <label>Название</label>
//               <input
//                 className="sell__header-input"
//                 value={customService.name}
//                 onChange={(e) =>
//                   setCustomService((prev) => ({
//                     ...prev,
//                     name: e.target.value,
//                   }))
//                 }
//                 type="text"
//                 placeholder="Введите название услуги"
//               />
//             </div>
//             <div>
//               <label>Сумма</label>
//               <input
//                 className="sell__header-input"
//                 value={customService.price}
//                 onChange={(e) =>
//                   setCustomService((prev) => ({
//                     ...prev,
//                     price: e.target.value,
//                   }))
//                 }
//                 type="text"
//                 placeholder="Введите цену услуги"
//               />
//             </div>
//             <div>
//               <label>Количество</label>
//               <input
//                 className="sell__header-input"
//                 value={customService.quantity}
//                 onChange={(e) =>
//                   setCustomService((prev) => ({
//                     ...prev,
//                     quantity: e.target.value,
//                   }))
//                 }
//                 type="text"
//                 placeholder="Введите количество товара"
//               />
//             </div>
//             <div
//               style={{
//                 marginTop: "20px",
//                 display: "flex",
//                 columnGap: "10px",
//                 justifyContent: "end",
//               }}
//             >
//               <button
//                 className="sell__reset"
//                 type="button"
//                 onClick={() => {
//                   setShowCustomServiceModal(false);
//                   setCustomService({
//                     name: "",
//                     price: "",
//                     quantity: "1",
//                   });
//                 }}
//               >
//                 Отменить
//               </button>
//               <button
//                 className="start__total-pay"
//                 style={{ width: "auto" }}
//                 type="button"
//                 onClick={handleAddCustomService}
//               >
//                 Добавить
//               </button>
//             </div>
//           </div>
//         </UniversalModal>
//       )}

//       <AlertModal
//         open={alert.open}
//         type={alert.type}
//         message={alert.message}
//         okText="Ok"
//         onClose={() => setAlert((a) => ({ ...a, open: false }))}
//       />
//     </section>
//   );
// };

// export default SellMainStart;
