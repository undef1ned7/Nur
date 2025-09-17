import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../../../../api";
import "./Warehouse.scss";

/* helpers */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const looksLikeUUID = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );

const genBarcode = () => {
  const base = Date.now().toString();
  const rnd = Math.floor(1e5 + Math.random() * 9e5).toString();
  return (base + rnd).slice(0, 18);
};

/* ====== CASH-EXPENSE: LS и событие ====== */
const EXP_KEY = "nurcrm_cash_expenses_v1";
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const addCashExpenseLS = ({ amount, productId, name, qty, unitPrice }) => {
  try {
    const raw = localStorage.getItem(EXP_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    const rec = {
      id: uuid(),
      ts: new Date().toISOString(),
      amount: Number(amount) || 0,
      product_id: productId || null,
      name: name || "",
      qty: Number(qty) || 0,
      unit_price: Number(unitPrice) || 0,
    };
    const next = [rec, ...list];
    localStorage.setItem(EXP_KEY, JSON.stringify(next));
    // оповестим кассу, если она открыта
    window.dispatchEvent(
      new CustomEvent("nurcrm:cash:expense-added", { detail: rec })
    );
  } catch {}
};
/* ====== /CASH-EXPENSE ====== */

/* нормализация товара */
const normalizeProduct = (p, catMap, brMap) => {
  const brandId =
    p.brand ?? (looksLikeUUID(p.brand_name) ? p.brand_name : null);
  const categoryId =
    p.category ?? (looksLikeUUID(p.category_name) ? p.category_name : null);

  const serverBrandName =
    p.brand_name && !looksLikeUUID(p.brand_name) ? p.brand_name : undefined;
  const serverCategoryName =
    p.category_name && !looksLikeUUID(p.category_name)
      ? p.category_name
      : undefined;

  return {
    id: p.id,
    name: p.name ?? "",
    barcode: p.barcode ?? "",
    price: p.price ?? "0.00",
    quantity: Number(p.quantity ?? 0),
    brand_name:
      serverBrandName ?? (brandId ? brMap.get(brandId) : undefined) ?? "—",
    category_name:
      serverCategoryName ??
      (categoryId ? catMap.get(categoryId) : undefined) ??
      "—",
    brand: p.brand ?? brandId ?? null,
    category: p.category ?? categoryId ?? null,
  };
};

export default function Warehouse() {
  const {
    products = [],
    setProducts,
    categories = [],
    brands = [],
  } = useOutletContext();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const [catsLocal, setCatsLocal] = useState([]);
  const [brandsLocal, setBrandsLocal] = useState([]);
  const cats = categories.length ? categories : catsLocal;
  const brs = brands.length ? brands : brandsLocal;

  const catMap = useMemo(
    () => new Map(cats.map((c) => [c.id, c.name])),
    [cats]
  );
  const brMap = useMemo(() => new Map(brs.map((b) => [b.id, b.name])), [brs]);

  useEffect(() => {
    const needCats = categories.length === 0;
    const needBrs = brands.length === 0;
    const loadRefs = async () => {
      try {
        if (needCats) {
          const r = await api.get("/main/categories/");
          setCatsLocal(asArray(r.data));
        }
        if (needBrs) {
          const r = await api.get("/main/brands/");
          setBrandsLocal(asArray(r.data));
        }
      } catch (e) {
        console.warn("Не удалось загрузить справочники", e);
      }
    };
    if (needCats || needBrs) loadRefs();
  }, [categories.length, brands.length]);

  const fetchMissingRefs = async (rawItems) => {
    const needBrandIds = new Set();
    const needCatIds = new Set();

    rawItems.forEach((p) => {
      const bid =
        p.brand ?? (looksLikeUUID(p.brand_name) ? p.brand_name : null);
      const cid =
        p.category ?? (looksLikeUUID(p.category_name) ? p.category_name : null);
      if (bid && !brMap.has(bid)) needBrandIds.add(bid);
      if (cid && !catMap.has(cid)) needCatIds.add(cid);
    });

    const [brandResults, catResults] = await Promise.all([
      Promise.allSettled(
        Array.from(needBrandIds).map((id) => api.get(`/main/brands/${id}/`))
      ),
      Promise.allSettled(
        Array.from(needCatIds).map((id) => api.get(`/main/categories/${id}/`))
      ),
    ]);

    const brExtra = new Map();
    brandResults.forEach((r) => {
      if (r.status === "fulfilled") {
        const d = r.value?.data;
        if (d?.id && d?.name) brExtra.set(d.id, d.name);
      }
    });

    const catExtra = new Map();
    catResults.forEach((r) => {
      if (r.status === "fulfilled") {
        const d = r.value?.data;
        if (d?.id && d?.name) catExtra.set(d.id, d.name);
      }
    });

    if (brExtra.size) {
      setBrandsLocal((prev) => {
        const have = new Set(prev.map((b) => b.id));
        const add = Array.from(brExtra.entries())
          .filter(([id]) => !have.has(id))
          .map(([id, name]) => ({ id, name }));
        return add.length ? [...prev, ...add] : prev;
      });
    }
    if (catExtra.size) {
      setCatsLocal((prev) => {
        const have = new Set(prev.map((c) => c.id));
        const add = Array.from(catExtra.entries())
          .filter(([id]) => !have.has(id))
          .map(([id, name]) => ({ id, name }));
        return add.length ? [...prev, ...add] : prev;
      });
    }

    return { brExtra, catExtra };
  };

  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      const res = await api.get("/main/products/list/");
      const raw = asArray(res.data);

      const { brExtra, catExtra } = await fetchMissingRefs(raw);
      const mergedBrMap = new Map([...brMap, ...brExtra]);
      const mergedCatMap = new Map([...catMap, ...catExtra]);

      setProducts(
        raw.map((p) => normalizeProduct(p, mergedCatMap, mergedBrMap))
      );
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cats.length && !brs.length) return;
    setProducts((prev) => prev.map((p) => normalizeProduct(p, catMap, brMap)));
  }, [cats, brs, catMap, brMap, setProducts]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      `${p.name || ""} ${p.barcode || ""}`.toLowerCase().includes(s)
    );
  }, [products, q]);

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить этот товар?")) return;
    try {
      await api.delete(`/main/products/${id}/`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  // ===== сохранение (создание/обновление) + CASH-EXPENSE =====
  const handleSave = async (product) => {
    try {
      if (product.id) {
        // UPDATE: считаем «приход на склад» как положительный дельта по количеству
        const prevQty = Number(editProduct?.quantity ?? 0);
        const nextQty = Number(product.quantity ?? prevQty);
        const delta = nextQty - prevQty;
        const unitPrice = Number(product.price ?? editProduct?.price ?? 0);

        // сначала на сервер
        const payload = {
          ...(product.barcode !== undefined
            ? { barcode: product.barcode?.trim() || null }
            : {}),
          ...(product.price !== undefined
            ? { price: String((Number(product.price) || 0).toFixed(2)) }
            : {}),
          ...(product.quantity !== undefined
            ? { quantity: Number(product.quantity) || 0 }
            : {}),
        };

        const { data } = await api.put(
          `/main/products/${product.id}/`,
          payload
        );

        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? normalizeProduct(
                  {
                    ...p,
                    ...data,
                    name: p.name,
                    brand: p.brand,
                    category: p.category,
                  },
                  catMap,
                  brMap
                )
              : p
          )
        );

        // CASH-EXPENSE: если был реальный приход (delta > 0) — запишем расход
        if (delta > 0 && unitPrice > 0) {
          addCashExpenseLS({
            amount: delta * unitPrice,
            productId: product.id,
            name: editProduct?.name || "",
            qty: delta,
            unitPrice,
          });
        }
      } else {
        // CREATE: сервер ждёт ИМЕНА (brand_name/category_name)
        const payload = {
          name: (product.name || "").trim(),
          barcode:
            product.barcode && product.barcode.trim()
              ? product.barcode.trim()
              : genBarcode(),
          price: String((Number(product.price) || 0).toFixed(2)),
          quantity: Number(product.quantity) || 0,
          ...(product.category
            ? { category_name: catMap.get(product.category) || "" }
            : {}),
          ...(product.brand
            ? { brand_name: brMap.get(product.brand) || "" }
            : {}),
        };

        if (!payload.name) {
          alert("Введите название товара");
          return;
        }

        const { data } = await api.post(
          "/main/products/create-manual/",
          payload
        );

        const created = normalizeProduct(
          {
            ...data,
            name: data.name ?? payload.name,
            barcode: data.barcode ?? payload.barcode ?? null,
            price: data.price ?? payload.price ?? "0.00",
            quantity: Number(data.quantity ?? payload.quantity ?? 0),
          },
          catMap,
          brMap
        );

        setProducts((prev) => [created, ...prev]);

        // CASH-EXPENSE: если пришёл товар с количеством > 0
        const qty = Number(created.quantity) || 0;
        const unitPrice = Number(created.price) || 0;
        if (qty > 0 && unitPrice > 0) {
          addCashExpenseLS({
            amount: qty * unitPrice,
            productId: created.id,
            name: created.name,
            qty,
            unitPrice,
          });
        }
      }

      setIsAddOpen(false);
      setEditProduct(null);
    } catch (e) {
      console.error("Save error:", e?.response?.status, e?.response?.data || e);
      alert("Ошибка сохранения товара");
    }
  };

  return (
    <section className="warehouse">
      <header className="warehouse__header">
        <div>
          <h2 className="warehouse__title">Склад</h2>
        </div>
        <div className="warehouse__actions">
          <div className="warehouse__search">
            <span className="warehouse__searchIcon">🔎</span>
            <input
              className="warehouse__searchInput"
              placeholder="Поиск по названию или штрих-коду…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="warehouse__btn warehouse__btn--secondary"
            onClick={load}
            disabled={loading}
          >
            Обновить
          </button>
          <button
            className="warehouse__btn warehouse__btn--primary"
            onClick={() => setIsAddOpen(true)}
          >
            + Товар
          </button>
        </div>
      </header>

      {err && <div className="warehouse__error">{err}</div>}

      <div className="warehouse__list">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="warehouse__skeleton" />
          ))
        ) : rows.length === 0 ? (
          <div className="warehouse__empty">Ничего не найдено</div>
        ) : (
          rows.map((p) => (
            <article key={p.id} className="warehouse__card">
              <div className="warehouse__left">
                <div className="warehouse__name">{p.name}</div>
                <div className="warehouse__meta">
                  <span className="warehouse__badge">
                    ШК: {p.barcode || "—"}
                  </span>
                  <span className="warehouse__badge">
                    Категория: {p.category_name}
                  </span>
                  <span className="warehouse__badge">
                    Бренд: {p.brand_name}
                  </span>
                </div>
                <div className="warehouse__meta">
                  <span className="warehouse__price">
                    {p.price ?? "0.00"} сом
                  </span>
                  <span className="warehouse__dot">•</span>
                  <span className="warehouse__qty">
                    Кол-во: {Number(p.quantity) ?? 0}
                  </span>
                </div>
              </div>

              <div className="warehouse__right">
                <button
                  className="warehouse__btn"
                  onClick={() => setEditProduct(p)}
                >
                  Изменить
                </button>
                <button
                  className="warehouse__btn warehouse__btn--secondary"
                  onClick={() => handleDelete(p.id)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {(isAddOpen || editProduct) && (
        <ProductModal
          product={editProduct}
          categories={cats}
          brands={brs}
          onClose={() => {
            setIsAddOpen(false);
            setEditProduct(null);
          }}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

/* ===== Модалка ===== */
function ProductModal({ product, categories, brands, onClose, onSave }) {
  const isEdit = !!product?.id;

  const [name, setName] = useState(product?.name || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [category, setCategory] = useState(product?.category || "");
  const [brand, setBrand] = useState(product?.brand || "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [quantity, setQuantity] = useState(String(product?.quantity ?? ""));

  const submit = (e) => {
    e.preventDefault();
    if (!isEdit && !name.trim()) {
      alert("Введите название товара");
      return;
    }
    onSave({
      id: product?.id,
      name,
      barcode: isEdit ? barcode : undefined,
      ...(isEdit ? {} : { category: category || null, brand: brand || null }),
      price,
      quantity,
    });
  };

  return (
    <div className="warehouse__modalOverlay" onClick={onClose}>
      <div className="warehouse__modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse__modalHeader">
          <div className="warehouse__modalTitle">
            {isEdit ? "Редактировать товар" : "Добавить товар"}
          </div>
          <button
            className="warehouse__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className="warehouse__form" onSubmit={submit}>
          <div className="warehouse__formGrid">
            <div className="warehouse__field">
              <label className="warehouse__label">
                Название {!isEdit && <span className="warehouse__req">*</span>}
              </label>
              <input
                className="warehouse__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={1}
                required={!isEdit}
                placeholder="Например: Шампунь 500мл"
                disabled={isEdit}
              />
            </div>

            {!isEdit ? (
              <>
                <div className="warehouse__field">
                  <label className="warehouse__label">Категория</label>
                  <select
                    className="warehouse__input"
                    value={category || ""}
                    onChange={(e) => setCategory(e.target.value || "")}
                  >
                    <option value="">Не выбрано</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="warehouse__field">
                  <label className="warehouse__label">Бренд</label>
                  <select
                    className="warehouse__input"
                    value={brand || ""}
                    onChange={(e) => setBrand(e.target.value || "")}
                  >
                    <option value="">Не выбрано</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="warehouse__field">
                  <label className="warehouse__label">Категория</label>
                  <input
                    className="warehouse__input"
                    value={product?.category_name ?? "—"}
                    disabled
                  />
                </div>
                <div className="warehouse__field">
                  <label className="warehouse__label">Бренд</label>
                  <input
                    className="warehouse__input"
                    value={product?.brand_name ?? "—"}
                    disabled
                  />
                </div>
              </>
            )}

            {isEdit && (
              <div className="warehouse__field">
                <label className="warehouse__label">
                  Штрих-код (опционально)
                </label>
                <input
                  className="warehouse__input"
                  value={barcode}
                  maxLength={64}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Оставьте пустым — не менять"
                />
              </div>
            )}

            <div className="warehouse__field">
              <label className="warehouse__label">
                Цена <span className="warehouse__req">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="warehouse__input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="0.00"
              />
            </div>

            <div className="warehouse__field">
              <label className="warehouse__label">
                Кол-во <span className="warehouse__req">*</span>
              </label>
              <input
                type="number"
                min="0"
                className="warehouse__input"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="0"
              />
            </div>
          </div>

          <div className="warehouse__formActions">
            <button type="button" className="warehouse__btn" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="warehouse__btn warehouse__btn--primary"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
