// src/components/Bar/Bar.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import api from "../../../../api";
import "./Bar.scss";

/* =========================
 * helpers
 * ========================= */
const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) +
  " с";

/* нормализация ответа корзины (cart/sale) к единому виду */
function normalizeCart(raw) {
  if (!raw) return { id: "", status: "new", items: [], total: 0 };
  const id = raw.id || raw.uuid || "";
  const status = raw.status || "new";

  const items = Array.isArray(raw.items)
    ? raw.items.map((it, i) => {
        const productId = it.product || it.product_id || `p-${i}`;
        const itemId = it.id || it.item_id || `${productId}-row`;
        const name =
          it.product_name ||
          it.name_snapshot ||
          it.name ||
          (it.product && it.product.name) ||
          "—";
        const barcode =
          it.barcode ||
          it.barcode_snapshot ||
          (it.product && it.product.barcode) ||
          "";
        const price = Number(it.unit_price ?? it.price ?? 0) || 0;
        const qty = Number(it.quantity ?? it.qty ?? 0) || 0;
        const lineTotal =
          Number(it.line_total) ||
          (Number(it.unit_price ?? it.price ?? 0) || 0) * qty;

        return {
          itemId,
          productId,
          name,
          barcode,
          price,
          qty,
          total: lineTotal,
        };
      })
    : [];

  const total =
    Number(raw.total) ||
    items.reduce(
      (s, it) =>
        s +
        (Number(it.total) || (Number(it.price) || 0) * (Number(it.qty) || 0)),
      0
    );

  return { id, status, items, total };
}

/* генерируем штрих-код (18 цифр) */
function genBarcode() {
  const base = Date.now().toString();
  const rnd = Math.floor(1e5 + Math.random() * 9e5).toString();
  return (base + rnd).slice(0, 18);
}

/* =========================
 * component
 * ========================= */
function Bar() {
  // ===== контекст приложения (склад/каталоги)
  const ctx = useOutletContext() || {};
  const {
    products: ctxProducts = [],
    setProducts: ctxSetProducts,
    categories = [],
    brands = [],
  } = ctx;

  // локальный fallback, если нет сеттера/данных в контексте
  const [localProducts, setLocalProducts] = useState([]);
  const products =
    (ctxProducts && ctxProducts.length ? ctxProducts : localProducts) || [];
  const setProducts =
    typeof ctxSetProducts === "function" ? ctxSetProducts : setLocalProducts;

  // ===== состояние склада
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsErr, setProductsErr] = useState("");

  async function loadProducts() {
    try {
      setProductsLoading(true);
      setProductsErr("");
      const { data } = await api.get("/main/products/list/");
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setProducts(list);
      setLocalProducts(list);
    } catch (e) {
      console.error(e);
      setProductsErr("Не удалось загрузить склад");
    } finally {
      setProductsLoading(false);
    }
  }

  // ===== состояние корзины
  const [sale, setSale] = useState({
    id: "",
    status: "new",
    items: [],
    total: 0,
  });
  const [saleErr, setSaleErr] = useState("");
  const [loadingSale, setLoadingSale] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  // стабильный порядок строк
  const [itemOrder, setItemOrder] = useState([]);

  // модалка продажи
  const [isSellOpen, setIsSellOpen] = useState(false);

  // карты имён каталога
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const brMap = useMemo(
    () => new Map(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  const catName = (p) =>
    p?.category_name ??
    (p?.category ? catMap.get(p.category) : undefined) ??
    "—";
  const brName = (p) =>
    p?.brand_name ?? (p?.brand ? brMap.get(p.brand) : undefined) ?? "—";

  // применяем нормализацию и сохраняем порядок
  function applySale(serverData) {
    const norm = normalizeCart(serverData);
    setSale((prev) => {
      const sameCart = prev.id && prev.id === norm.id;
      const baseOrder = sameCart ? itemOrder : [];
      const index = new Map(baseOrder.map((id, i) => [id, i]));
      const known = [];
      const newcomers = [];
      for (const it of norm.items) {
        if (index.has(it.productId)) known.push(it);
        else newcomers.push(it);
      }
      known.sort((a, b) => index.get(a.productId) - index.get(b.productId));
      const ordered = [...known, ...newcomers];
      setItemOrder(ordered.map((x) => x.productId));
      return { ...norm, items: ordered };
    });
  }

  // API: старт/получение активной корзины
  async function startSale() {
    try {
      setSaleErr("");
      setLoadingSale(true);
      const { data } = await api.post("/main/pos/sales/start/");
      applySale(data);
    } catch (e) {
      console.error(e);
      setSale({ id: "", status: "new", items: [], total: 0 });
      setItemOrder([]);
      setSaleErr("Не удалось создать/получить корзину");
    } finally {
      setLoadingSale(false);
    }
  }

  // API: актуализировать корзину
  async function refreshSale() {
    if (!sale.id) return;
    try {
      const { data } = await api.get(`/main/pos/carts/${sale.id}/`);
      applySale(data);
    } catch (e) {
      console.error(e);
      setSaleErr("Не удалось обновить корзину");
    }
  }

  // API: добавить по штрих-коду
  async function scanBarcode(barcode) {
    if (!sale.id || !barcode) return;
    try {
      setScanBusy(true);
      setSaleErr("");
      const { data } = await api.post(`/main/pos/sales/${sale.id}/scan/`, {
        barcode,
      });
      applySale(data);
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.detail || "Не удалось добавить товар по штрих-коду";
      setSaleErr(msg);
    } finally {
      setScanBusy(false);
    }
  }

  // API: оформить чек
  async function checkout() {
    if (!sale.id || !sale.items.length) return;
    try {
      setCheckoutBusy(true);
      setSaleErr("");
      await api.post(`/main/pos/sales/${sale.id}/checkout/`, {});
      await startSale(); // новая пустая корзина
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || "Оформление не удалось";
      setSaleErr(msg);
    } finally {
      setCheckoutBusy(false);
    }
  }

  // API: изменить количество
  async function changeQty(productId, nextQty) {
    if (!sale.id || !productId) return;
    try {
      if (nextQty <= 0) {
        await api.delete(`/main/pos/carts/${sale.id}/items/${productId}/`);
      } else {
        await api.patch(`/main/pos/carts/${sale.id}/items/${productId}/`, {
          quantity: String(nextQty),
        });
      }
      await refreshSale();
    } catch (e) {
      console.error(e);
      setSaleErr("Не удалось изменить количество");
    }
  }

  // API: удалить позицию
  async function removeItem(productId) {
    if (!sale.id || !productId) return;
    try {
      await api.delete(`/main/pos/carts/${sale.id}/items/${productId}/`);
      await refreshSale();
    } catch (e) {
      console.error(e);
      setSaleErr("Не удалось удалить позицию");
    }
  }

  // загрузка склада + старт корзины при монтировании
  useEffect(() => {
    loadProducts();
    startSale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // сумма по корзине (если сервер не прислал total)
  const computedTotal = useMemo(
    () =>
      sale.items.reduce(
        (s, it) =>
          s +
          (Number(it.total) || (Number(it.price) || 0) * (Number(it.qty) || 0)),
        0
      ),
    [sale.items]
  );
  const total = Number(sale.total) || computedTotal;

  return (
    <section className="bar">
      {/* ===== Заголовок (без описания) ===== */}
      <header className="bar__header">
        <div>
          <h2 className="bar__title">Бар</h2>
        </div>
        <div className="bar__actions">
          <button
            className="bar__btn bar__btn--secondary"
            onClick={startSale}
            disabled={loadingSale || scanBusy || checkoutBusy}
          >
            Создать/обновить корзину
          </button>
          <button
            className="bar__btn bar__btn--primary"
            onClick={() => setIsSellOpen(true)}
          >
            Открыть продажу
          </button>
        </div>
      </header>

      {(saleErr || productsErr) && (
        <div className="bar__error">{saleErr || productsErr}</div>
      )}

      {/* ===== Текущая корзина ===== */}
      <section className="bar__panel">
        <div className="bar__panelHead">
          <div className="bar__panelTitle">Текущая корзина</div>
          {/* строка с ID/«• Позиции: 0» удалена */}
        </div>

        {loadingSale ? (
          <div className="bar__skeletonRow">
            <div className="bar__skeleton" />
            <div className="bar__skeleton" />
            <div className="bar__skeleton" />
          </div>
        ) : (
          <>
            <ScanForm
              disabled={!sale.id || scanBusy || checkoutBusy}
              onScan={scanBarcode}
              busy={scanBusy}
            />

            <div className="bar__tableWrap">
              <table className="bar__table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Штрих-код</th>
                    <th style={{ width: 160, textAlign: "center" }}>Кол-во</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.length ? (
                    sale.items.map((it) => (
                      <tr key={it.productId}>
                        <td className="ellipsis" title={it.name}>
                          {it.name}
                        </td>
                        <td className="ellipsis" title={it.barcode || "—"}>
                          {it.barcode || "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="bar__qtyCtrls">
                            <button
                              className="bar__qtyBtn"
                              disabled={scanBusy || checkoutBusy}
                              onClick={() =>
                                changeQty(
                                  it.productId,
                                  (Number(it.qty) || 0) - 1
                                )
                              }
                              aria-label="Уменьшить"
                            >
                              −
                            </button>
                            <span className="bar__qty">
                              {Number(it.qty) || 0}
                            </span>
                            <button
                              className="bar__qtyBtn"
                              disabled={scanBusy || checkoutBusy}
                              onClick={() =>
                                changeQty(
                                  it.productId,
                                  (Number(it.qty) || 0) + 1
                                )
                              }
                              aria-label="Увеличить"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td>{fmtMoney(it.price)}</td>
                        <td>
                          {fmtMoney(
                            Number(it.total) ||
                              (Number(it.price) || 0) * (Number(it.qty) || 0)
                          )}
                        </td>
                        <td>
                          <button
                            className="bar__btn bar__btn--secondary"
                            onClick={() => removeItem(it.productId)}
                            disabled={scanBusy || checkoutBusy}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="bar__empty" colSpan={6}>
                        Корзина пуста
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="bar__tfootLabel" colSpan={4}>
                      Итого
                    </td>
                    <td className="bar__tfootValue">{fmtMoney(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="bar__footer">
              <button
                className="bar__btn bar__btn--primary"
                onClick={checkout}
                disabled={!sale.items.length || checkoutBusy || scanBusy}
                title={
                  !sale.items.length ? "Корзина пуста" : "Оформить продажу"
                }
              >
                {checkoutBusy ? "Оформление…" : "Оформить продажу"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ===== Модалка продажи (скан + выбор из склада) ===== */}
      {isSellOpen && (
        <SellModal
          onClose={() => setIsSellOpen(false)}
          sale={sale}
          startSale={startSale}
          scanBarcode={scanBarcode}
          scanBusy={scanBusy}
          checkout={checkout}
          checkoutBusy={checkoutBusy}
          products={products}
          setProducts={setProducts}
          catName={catName}
          brName={brName}
        />
      )}

      {productsLoading && <div className="bar__muted">Загрузка склада…</div>}
    </section>
  );
}

/* =========================
 * формы/модалки
 * ========================= */
function ScanForm({ disabled, onScan, busy }) {
  const [code, setCode] = useState("");
  const ref = useRef(null);

  function submit(e) {
    e.preventDefault();
    const b = code.trim();
    if (!b) return;
    onScan(b);
    setCode("");
    ref.current && ref.current.focus();
  }

  return (
    <form className="bar__scan" onSubmit={submit}>
      <div className="bar__search">
        <span className="bar__searchIcon">#</span>
        <input
          ref={ref}
          className="bar__searchInput"
          placeholder="Сканируйте или введите штрих-код…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={disabled}
        />
      </div>
      <button type="submit" className="bar__btn" disabled={disabled || busy}>
        {busy ? "Добавление…" : "Добавить"}
      </button>
    </form>
  );
}

function SellModal({
  onClose,
  sale,
  startSale,
  scanBarcode,
  scanBusy,
  checkout,
  checkoutBusy,
  products,
  setProducts,
  catName,
  brName,
}) {
  const [q, setQ] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const available = useMemo(
    () => (products || []).filter((p) => (Number(p.quantity) || 0) > 0),
    [products]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return available;
    return available.filter((p) => `${p.name || ""}`.toLowerCase().includes(s));
  }, [available, q]);

  async function addByPick(p) {
    if (!sale.id) {
      alert("Сначала создайте корзину (кнопка сверху).");
      return;
    }
    if (!p) return;
    try {
      let barcode = p.barcode;
      if (!barcode) {
        barcode = genBarcode();
        const payload = {
          barcode,
          price: String(Number(p.price || 0).toFixed(2)),
          quantity: Number(p.quantity) || 0,
        };
        await api.put(`/main/products/${p.id}/`, payload);
        setProducts((prev = []) =>
          (prev || []).map((x) => (x.id === p.id ? { ...x, barcode } : x))
        );
      }
      await scanBarcode(barcode);
    } catch (e) {
      console.error(e);
      alert("Не удалось добавить товар. Проверьте права/данные.");
    }
  }

  const [code, setCode] = useState("");
  function onScanSubmit(e) {
    e.preventDefault();
    const b = code.trim();
    if (!b || !sale.id) return;
    scanBarcode(b);
    setCode("");
  }

  return createPortal(
    <div className="bar__modalOverlay" onClick={onClose}>
      <div
        className="bar__modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="bar__modalHeader">
          <div className="bar__modalTitle">Продажа</div>
          <button
            className="bar__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {/* панель действий */}
        <div className="bar__modalTopRow">
          <button className="bar__btn bar__btn--secondary" onClick={startSale}>
            {sale.id ? "Обновить корзину" : "Создать корзину"}
          </button>

          <form className="bar__scan" onSubmit={onScanSubmit}>
            <div className="bar__search">
              <span className="bar__searchIcon">#</span>
              <input
                className="bar__searchInput"
                placeholder="Сканируйте или введите штрих-код…"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={scanBusy || checkoutBusy}
              />
            </div>
            <button
              type="submit"
              className="bar__btn"
              disabled={!sale.id || scanBusy || checkoutBusy}
            >
              {scanBusy ? "Добавление…" : "Добавить"}
            </button>
          </form>
        </div>

        {/* выбор из склада */}
        <div className="bar__picker">
          <div className="bar__pickerHead">
            <div className="bar__pickerTitle">Склад</div>
            <div className="bar__search">
              <span className="bar__searchIcon">🔎</span>
              <input
                className="bar__searchInput"
                placeholder="Поиск по названию…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="bar__list">
            {filtered.length ? (
              filtered.map((p) => (
                <button
                  key={p.id}
                  className="bar__item"
                  title={`Остаток: ${p.quantity || 0}`}
                  onClick={() => addByPick(p)}
                  disabled={!sale.id || scanBusy || checkoutBusy}
                >
                  <div className="bar__itemName" title={p.name}>
                    {p.name}
                  </div>
                  <div className="bar__itemMeta">
                    <span className="bar__badge">Категория: {catName(p)}</span>
                    <span className="bar__badge">Бренд: {brName(p)}</span>
                    <span className="bar__badge">
                      Цена: {fmtMoney(p.price)}
                    </span>
                    <span className="bar__badge">
                      Остаток: {Number(p.quantity) || 0}
                    </span>
                    <span className="bar__badge">ШК: {p.barcode || "—"}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="bar__hint">Нет подходящих товаров</div>
            )}
          </div>
        </div>

        {/* текущая корзина внутри модалки */}
        <div className="bar__tableWrap">
          <table className="bar__table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Штрих-код</th>
                <th style={{ width: 160, textAlign: "center" }}>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.length ? (
                sale.items.map((it) => (
                  <tr key={it.productId}>
                    <td className="ellipsis" title={it.name}>
                      {it.name}
                    </td>
                    <td className="ellipsis" title={it.barcode || "—"}>
                      {it.barcode || "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="bar__qtyCtrls">
                        <span className="bar__qty">{Number(it.qty) || 0}</span>
                      </div>
                    </td>
                    <td>{fmtMoney(it.price)}</td>
                    <td>
                      {fmtMoney(
                        Number(it.total) ||
                          (Number(it.price) || 0) * (Number(it.qty) || 0)
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="bar__empty" colSpan={5}>
                    Корзина пуста
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="bar__tfootLabel" colSpan={4}>
                  Итого
                </td>
                <td className="bar__tfootValue">
                  {fmtMoney(
                    Number(sale.total) ||
                      sale.items.reduce(
                        (sum, it) =>
                          sum +
                          (Number(it.total) ||
                            (Number(it.price) || 0) * (Number(it.qty) || 0)),
                        0
                      )
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bar__modalFooter">
          <button
            className="bar__btn bar__btn--primary"
            onClick={checkout}
            disabled={!sale.items.length || checkoutBusy || scanBusy}
          >
            {checkoutBusy ? "Оформление…" : "Оформить продажу"}
          </button>
          <button className="bar__btn bar__btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Bar;
