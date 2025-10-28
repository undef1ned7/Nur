import {
  Hash,
  ListOrdered,
  Minus,
  MoreVertical,
  Plus,
  Tag,
  Tags,
  Trash,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
// import "./Sklad.scss";

import {
  fetchBrandsAsync,
  fetchCategoriesAsync,
  fetchProductsAsync,
} from "../../../store/creators/productCreators";

import { useNavigate } from "react-router-dom";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../store/creators/clientCreators";
import {
  createDeal,
  deleteProductInCart,
  doSearch,
  getObjects,
  getProductCheckout,
  getProductInvoice,
  historySellObjectDetail,
  historySellObjects,
  historySellProduct,
  historySellProductDetail,
  manualFilling,
  objectCartAddItem,
  productCheckout,
  startSale,
  startSellObjects,
  updateProductInCart,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { clearProducts, useProducts } from "../../../store/slices/productSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { useUser } from "../../../store/slices/userSlice";
import BarcodeScanner from "./BarcodeScanner";
import { useMemo } from "react";
import api from "../../../api";
import SellModal from "./SellModal";
import { t } from "i18next";
import RefundPurchase from "./RefundPurchase";
import AddCashFlowsModal from "../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";

export async function createDebt(payload) {
  const res = await api.post("/main/debts/", payload);
  return res.data;
}

// Если в проекте уже есть эти стили — оставляем ваши классы: add-modal, add-modal__input и т.д.

// Для select сделки

const STATUSES = [
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "canceled", label: "Отменена" },
];

// Для select сделки
export const DEAL_STATUS_RU = ["Продажа", "Долги", "Предоплата"];

const SellBuildingModal = ({ onClose }) => {
  const dispatch = useDispatch();

  // 1) Создание корзины
  const [cartSeed, setCartSeed] = useState({
    client: "",
    status: "new",
    sold_at: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [creatingCart, setCreatingCart] = useState(false);

  // 2) Касса
  const { list: cashBoxes } = useCash();
  const [cashboxId, setCashboxId] = useState("");
  const [prepayment, setPrepayment] = useState("");

  // 3) Добавление товара
  const [objectItemId, setObjectItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  // Тип сделки + срок долга (месяцев) для «Долги»
  const [dealStatus, setDealStatus] = useState("Продажа");
  const [debtMonths, setDebtMonths] = useState("");

  // Данные из слайсов
  const { list: clientsRaw } = useClient();
  const filterClient = useMemo(
    () => clientsRaw.filter((c) => c.type === "client"),
    [clientsRaw]
  );
  const { company } = useUser();

  // Берём startObject и objects из saleSlice
  const {
    startObject: start,
    loading: saleLoading,
    error: saleError,
    objects: objectsList,
  } = useSale();

  // Имя клиента (для кассы)
  const clientFullName = useMemo(() => {
    const c = filterClient.find(
      (x) => String(x.id) === String(cartSeed.client)
    );
    return c?.full_name || "";
  }, [filterClient, cartSeed.client]);

  // Создание клиента (опционально)
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
  });

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await dispatch(createClientAsync(newClient)).unwrap();
      await dispatch(fetchClientsAsync());
      setShowCreateClient(false);
    } catch (err) {
      console.error(err);
      alert("Не удалось создать клиента");
    }
  };

  // Первичная загрузка клиентов и касс
  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Подгрузка объектов, когда корзина создана
  useEffect(() => {
    if (start?.id) {
      dispatch(getObjects());
    }
  }, [dispatch, start?.id]);

  // Шаги
  const step = useMemo(() => {
    if (!start?.id) return 1;
    if (!cashboxId) return 2;
    return 3;
  }, [start?.id, cashboxId]);

  const canCreateCart =
    Boolean(cartSeed.client) &&
    Boolean(cartSeed.status) &&
    Boolean(cartSeed.sold_at);

  const handleCreateCart = async () => {
    if (!canCreateCart) return;
    setCreatingCart(true);
    try {
      const payload = {
        client: cartSeed.client,
        status: cartSeed.status,
        sold_at: cartSeed.sold_at,
        note: cartSeed.note || "",
      };
      await dispatch(startSellObjects(payload)).unwrap();
    } catch (err) {
      console.error("startSellObjects error:", err);
      const msg =
        err?.data?.detail || err?.message || "Не удалось создать корзину";
      alert(msg);
    } finally {
      setCreatingCart(false);
    }
  };
  console.log(1000000000, company?.subscription_plan?.name);

  const addObjectToCart = async () => {
    if (!start?.id) {
      alert("Сначала создайте корзину");
      return;
    }
    if (!cashboxId) {
      alert("Выберите кассу перед добавлением товара");
      return;
    }
    if (!objectItemId || !quantity || !unitPrice) {
      alert("Заполните все поля товара");
      return;
    }
    // если выбран «Долги», требуем срок в месяцах (целое число >=1)
    if (dealStatus === "Долги") {
      const months = Number(debtMonths);
      if (!months || months < 1 || !Number.isFinite(months)) {
        alert("Укажите срок долга в месяцах (целое число ≥ 1)");
        return;
      }
    }

    try {
      // 1) Добавляем товар в корзину
      await dispatch(
        objectCartAddItem({
          id: start.id,
          product: {
            object_item: objectItemId,
            quantity: Number(quantity),
            unit_price: String(unitPrice),
          },
        })
      ).unwrap();

      // Рассчитываем сумму для сделки и кассы
      const amountNum = Number(quantity) * Number(unitPrice || 0);
      const amountStr = amountNum.toFixed(2);

      // 2) Создаём сделку «под капотом»
      // await dispatch(
      //   createDeal({
      //     clientId: cartSeed.client,
      //     title: dealStatus, // заголовок
      //     statusRu: dealStatus, // маппинг в kind внутри thunk
      //     amount: amountNum,
      //     debtMonths: dealStatus === "Долги" ? Number(debtMonths) : undefined,
      //   })
      // ).unwrap();
      const result = await dispatch(
        createDeal({
          clientId: cartSeed.client,
          title: dealStatus, // заголовок
          statusRu: dealStatus, // маппинг в kind внутри thunk
          amount: amountNum,
          // prepayment только при "Предоплата"
          prepayment:
            dealStatus === "Предоплата" ? Number(prepayment) : undefined,
          // debtMonths и для "Долги", и для "Предоплата"
          debtMonths:
            dealStatus === "Долги" || dealStatus === "Предоплата"
              ? Number(debtMonths)
              : undefined,
        })
      ).unwrap();

      // 3) Создаём движение по кассе с выбранной кассой
      if (dealStatus !== "Долги") {
        await dispatch(
          addCashFlows({
            cashbox: cashboxId, // выбранная касса
            type: "income",
            name: clientFullName || String(cartSeed.client),
            amount: dealStatus === "Предоплата" ? result.prepayment : amountStr,
            status: company?.subscription_plan?.name === "Старт" ? true : false,
          })
        ).unwrap();
      }
      onClose();

      // Сбросим поля добавления
      setObjectItemId("");
      setQuantity(1);
      setUnitPrice("");
      if (dealStatus === "Долги") setDebtMonths("");
    } catch (err) {
      console.error("addObjectToCart/createDeal/addCashFlows error:", err);
      const msg =
        err?.data?.detail ||
        err?.message ||
        "Не удалось добавить товар/создать сделку/проводку";
      alert(msg);
    }
  };

  const cartTotals = useMemo(() => {
    const items = start?.items || [];
    const subtotal = items.reduce(
      (acc, it) => acc + Number(it.quantity) * Number(it.unit_price || 0),
      0
    );
    return {
      count: items.length,
      subtotal,
      discount: Number(start?.discount_total || 0),
      tax: Number(start?.tax_total || 0),
      total: Number(start?.total || subtotal),
    };
  }, [start]);

  return (
    <div className="add-modal sellObject">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Продажа квартиры</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Шаги */}
        <div
          className="steps"
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <span className={`badge ${step >= 1 ? "badge--active" : ""}`}>
            1. Корзина
          </span>
          <span className={`badge ${step >= 2 ? "badge--active" : ""}`}>
            2. Касса
          </span>
          <span className={`badge ${step >= 3 ? "badge--active" : ""}`}>
            3. Товары
          </span>
        </div>

        {/* Шаг 1 — создание корзины */}
        {!start?.id && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <label>Клиент *</label>
            <select
              className="add-modal__input"
              value={cartSeed.client}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, client: e.target.value }))
              }
              required
            >
              <option value="">-- Выберите клиента --</option>
              {filterClient.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>

            <button
              className="create-client"
              onClick={() => setShowCreateClient((v) => !v)}
            >
              {showCreateClient ? "Отменить" : "Создать клиента"}
            </button>

            {showCreateClient && (
              <form
                style={{ display: "grid", gap: 10 }}
                onSubmit={handleCreateClient}
              >
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, full_name: e.target.value }))
                  }
                  type="text"
                  placeholder="ФИО"
                  name="full_name"
                  required
                />
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, phone: e.target.value }))
                  }
                  type="text"
                  name="phone"
                  placeholder="Телефон"
                />
                <input
                  className="add-modal__input"
                  onChange={(e) =>
                    setNewClient((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  name="email"
                  placeholder="Почта"
                />
                <button className="create-client">Создать</button>
              </form>
            )}

            <label>Статус *</label>
            <select
              className="add-modal__input"
              value={cartSeed.status}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, status: e.target.value }))
              }
              required
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <label>Дата продажи *</label>
            <input
              type="date"
              className="add-modal__input"
              value={cartSeed.sold_at}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, sold_at: e.target.value }))
              }
              required
            />

            <label>Заметка</label>
            <textarea
              className="add-modal__input"
              rows={3}
              placeholder="Комментарий"
              value={cartSeed.note}
              onChange={(e) =>
                setCartSeed((p) => ({ ...p, note: e.target.value }))
              }
            />

            <button
              className="receipt__row-btn"
              disabled={!canCreateCart || creatingCart}
              onClick={handleCreateCart}
            >
              {creatingCart ? "Создание..." : "Создать корзину"}
            </button>
          </div>
        )}

        {/* Шаг 2 — выбор кассы */}
        {start?.id && !cashboxId && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <h4>Шаг 2. Выберите кассу</h4>
            <select
              className="add-modal__input"
              value={cashboxId}
              onChange={(e) => setCashboxId(e.target.value)}
              required
            >
              <option value="">-- Выберите кассу --</option>
              {cashBoxes.map((box) => (
                <option key={box.id} value={String(box.id)}>
                  {box.name ?? box.department_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Шаг 3 — выбор товара и добавление в корзину */}
        {start?.id && cashboxId && (
          <div
            className="add-modal__section"
            style={{ display: "grid", gap: 12 }}
          >
            <h4>Шаг 3. Добавьте товары</h4>

            {/* Выбор типа сделки */}
            <div style={{ display: "grid", gap: 8 }}>
              <label>Тип сделки</label>
              <select
                className="add-modal__input"
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
              >
                {DEAL_STATUS_RU.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Если «Долги» — спрашиваем срок в месяцах */}
            {dealStatus === "Долги" && (
              <div style={{ display: "grid", gap: 8 }}>
                <label>Срок долга (месяцев)</label>
                <input
                  className="add-modal__input"
                  type="number"
                  min={1}
                  step={1}
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                  placeholder="Например, 6"
                />
              </div>
            )}

            {dealStatus === "Предоплата" && (
              <>
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Предоплата</label>
                  <input
                    className="sale__input"
                    type="number"
                    min={1}
                    step={1}
                    value={prepayment}
                    onChange={(e) => setPrepayment(e.target.value)}
                    placeholder="Сумма предоплаты"
                  />
                </div>
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Срок долга (месяцев)</label>
                  <input
                    className="sale__input"
                    type="number"
                    min={1}
                    step={1}
                    value={debtMonths}
                    onChange={(e) => setDebtMonths(e.target.value)}
                    placeholder="Например, 6"
                  />
                </div>
              </>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <label>Товар (объект)</label>
              <select
                className="add-modal__input"
                value={objectItemId}
                onChange={(e) => {
                  const id = e.target.value;
                  setObjectItemId(id);
                  const obj =
                    objectsList?.find(
                      (o) => String(o.id) === id || String(o.object_item) === id
                    ) || null;
                  if (obj && (obj.price || obj.unit_price)) {
                    setUnitPrice(String(obj.price || obj.unit_price));
                  }
                }}
              >
                <option value="">-- Выберите объект --</option>
                {saleLoading && <option disabled>Загрузка...</option>}
                {!saleLoading &&
                  (objectsList || []).map((o) => (
                    <option
                      key={o.id || o.object_item}
                      value={String(o.id || o.object_item)}
                    >
                      {o.name ||
                        o.title ||
                        o.product_name ||
                        `ID ${o.id || o.object_item}`}
                    </option>
                  ))}
              </select>

              <label>Количество</label>
              <input
                className="add-modal__input"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />

              <label>Цена за единицу</label>
              <input
                className="add-modal__input"
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="999.9"
              />

              <button className="receipt__row-btn" onClick={addObjectToCart}>
                <Plus size={16} style={{ marginRight: 6 }} /> Добавить в корзину
                (и создать сделку)
              </button>
            </div>

            {/* Корзина */}
            {start?.items?.length > 0 && (
              <div className="receipt" style={{ marginTop: 12 }}>
                <h2 className="receipt__title">Корзина</h2>
                {start.items.map((it, idx) => (
                  <div className="receipt__item" key={idx}>
                    <p className="receipt__item-name">
                      {idx + 1}.{" "}
                      {it.product_name ||
                        it.name ||
                        it.object_name ||
                        `Позиция ${idx + 1}`}
                    </p>
                    <div>
                      <p className="receipt__item-price">
                        {it.quantity} x {it.unit_price} ≡{" "}
                        {Number(it.quantity) * Number(it.unit_price || 0)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="receipt__total">
                  <b>ИТОГО</b>
                  <div
                    style={{ gap: 10, display: "flex", alignItems: "center" }}
                  >
                    <p>Общая скидка {cartTotals.discount}</p>
                    <p>Налог {cartTotals.tax}</p>
                    <b>≡ {cartTotals.total}</b>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ошибки */}
        {saleError && (
          <div className="error" style={{ color: "#f00", marginTop: 8 }}>
            {saleError?.data?.detail ||
              saleError?.message ||
              JSON.stringify(saleError)}
          </div>
        )}
      </div>
    </div>
  );
};

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
    canceled: "Отмененный",
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
    try {
      const pdfInvoiceBlob = await dispatch(
        getProductInvoice(item?.id)
      ).unwrap();
      if (pdfInvoiceBlob instanceof Blob) {
        const url = window.URL.createObjectURL(pdfInvoiceBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "invoice.pdf";
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        // если бэк вдруг вернул не Blob — попробуем преобразовать
        const data = new Blob([JSON.stringify(pdfInvoiceBlob, null, 2)], {
          type: "application/octet-stream",
        });
        const url = window.URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = url;
        link.download = "invoice.bin";
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Скачивание накладной не удалось:", err);
      alert(err?.detail || "Не удалось получить накладную");
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

const Sell = () => {
  const dispatch = useDispatch();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { history, start, historyObjects } = useSale();

  const [showDetailSell, setShowDetailSell] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [showBuilding, setShowBuilding] = useState(false);
  const [sellId, setSellId] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectCashBox1, setSelectCashBox1] = useState("");
  const [clearing, setClearing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [itemId, setItemId] = useState({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [error, setError] = useState(null);

  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    cashbox: selectCashBox1,
    type: "expense", // Дефолтный тип для новой операции
  });

  // выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSelectAllOnPage = (items) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
  const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
  const isBuildingCompany = sectorName === "строительная компания";
  const isStartPlan = planName === "старт";

  const filterSell = history.filter((item) => item.status !== "canceled");

  const filterField = isBuildingCompany ? historyObjects : filterSell;

  // поиск по истории (дебаунс)
  const debouncedSearch = useDebounce((v) => {
    dispatch(historySellProduct({ search: v }));
    dispatch(historySellObjects({ search: v }));
  }, 600);
  const onChange = (e) => debouncedSearch(e.target.value);

  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
  }, [dispatch]);

  useEffect(() => {
    if (showSellModal) dispatch(startSale());
  }, [showSellModal, dispatch]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setShowSellModal(false);
        setShowDetailSell(false);
        setShowBuilding(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  const handleSellModal = (id) => {
    setSellId(id);
    setShowDetailSell(true);
  };
  const handleOpen = (id) => {
    setItemId(id);
    setShowRefundModal(true);
  };

  const kindTranslate = {
    new: "Новый",
    paid: "Оплаченный",
    canceled: "Отмененный",
  };

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows({ ...newCashbox, cashbox: selectCashBox1 }));

      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  // массовое удаление выбранных
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные ${selectedIds.size} запись(и)?`))
      return;
    try {
      setBulkDeleting(true);
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            allow_paid: false,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("Выбранные записи удалены");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось удалить: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // очистить ВСЮ историю
  const handleClearAllHistory = async () => {
    if (!window.confirm("Удалить ВСЮ историю? Действие необратимо.")) return;
    try {
      setClearing(true);
      const list = Array.isArray(filterField) ? filterField : [];
      const ids = list.map((i) => i.id);
      if (ids.length === 0) throw new Error("Нечего удалять");
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({ ids, allow_paid: false }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("История удалена");
      dispatch(historySellProduct({ search: "" }));
      dispatch(historySellObjects({ search: "" }));
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "0 0 10px 4px",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={allOnPageChecked}
            onChange={() => toggleSelectAllOnPage(pageItems)}
          />
          <span>Все на странице</span>
        </label>
        {selectedIds.size > 0 && (
          <>
            <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span>
            <button
              className="sklad__add"
              style={{ background: "#e53935" }}
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              title="Массовое удаление выбранных"
            >
              {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
            </button>
            <button
              className="sklad__reset"
              onClick={clearSelection}
              style={{ cursor: "pointer" }}
              title="Снять выбор"
            >
              Сбросить выбор
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по истории"
            className="sklad__search"
            onChange={onChange}
          />
          <div className="sklad__center">
            <span>Найдено: {filterField?.length ?? 0}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {!isBuildingCompany && filterField?.length > 0 && (
            <button
              className="barbermasters__btn barbermasters__btn--secondary"
              onClick={handleClearAllHistory}
              disabled={clearing}
              title="Удалить всю историю"
            >
              <Trash /> {clearing ? "Очищаем..." : "Очистить историю"}
            </button>
          )}

          {isBuildingCompany ? (
            <button
              className="sklad__add"
              onClick={() => setShowBuilding(true)}
            >
              <Plus size={16} style={{ marginRight: 4 }} /> Продать квартиру
            </button>
          ) : (
            <>
              <select
                value={selectCashBox}
                onChange={(e) => setSelectCashBox(e.target.value)}
                className="employee__search-wrapper"
              >
                <option value="" disabled>
                  Выберите кассу
                </option>
                {cashBoxes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.department_name}
                  </option>
                ))}
              </select>
              <button
                className="sklad__add"
                onClick={() => setShowSellModal(true)}
                disabled={!selectCashBox}
                title={!selectCashBox ? "Сначала выберите кассу" : undefined}
              >
                <Plus size={16} style={{ marginRight: 4 }} /> Продать товар
              </button>

              <button
                className="sklad__add"
                onClick={() => setShowAddCashboxModal(true)}
              >
                Прочие расходы
              </button>
            </>
          )}
        </div>
      </div>

      {!!filterField?.length && <SelectionActions pageItems={filterField} />}

      {(filterField?.length ?? 0) === 0 ? (
        <p className="sklad__no-products-message">Нет записей.</p>
      ) : (
        <div className="table-wrapper" style={{ marginBottom: 20 }}>
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      filterField.length > 0 &&
                      filterField.every((i) => selectedIds.has(i.id))
                    }
                    onChange={() => toggleSelectAllOnPage(filterField)}
                  />
                </th>
                <th>№</th>
                <th>Клиент</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filterField.map((item, index) => (
                <tr
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSellId(item.id);
                    setShowDetailSell(true);
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(item.id)}
                      onChange={() => toggleRow(item.id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>{item.client_name || "Нет имени"}</td>
                  <td>{item.total ?? item.subtotal}</td>
                  <td>{kindTranslate[item.status] || item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {company.sector.name === "Магазин" && (
                      <button
                        className="btn edit-btn"
                        onClick={() => handleOpen(item)}
                      >
                        Возврат
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddCashboxModal && (
        <AddCashFlowsModal onClose={() => setShowAddCashboxModal(false)} />
      )}

      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showRefundModal && (
        <RefundPurchase
          item={itemId}
          onClose={() => setShowRefundModal(false)}
          onChanged={() => dispatch(historySellProduct())}
        />
      )}
      {showBuilding && (
        <SellBuildingModal onClose={() => setShowBuilding(false)} />
      )}
      {showDetailSell && (
        <SellDetail onClose={() => setShowDetailSell(false)} id={sellId} />
      )}
    </div>
  );
};

export default Sell;
