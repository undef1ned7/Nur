// src/components/Warehouse/Warehouse.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../../../../api";
import s from "./Warehouse.module.scss";

/* ===== helpers ===== */
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
    ...p,
    name: p.name ?? "",
    price: String(p.price ?? "0.00"),
    quantity: Number(p.quantity ?? 0),
    brand_name:
      serverBrandName ??
      (brandId ? catSafeGet(brMap, brandId) : undefined) ??
      "—",
    category_name:
      serverCategoryName ??
      (categoryId ? catSafeGet(catMap, categoryId) : undefined) ??
      "—",
    brand: p.brand ?? brandId ?? null,
    category: p.category ?? categoryId ?? null,
  };
};

const catSafeGet = (map, id) => (map instanceof Map ? map.get(id) : undefined);

export default function MarketWarehouse() {
  // ===== контекст с фоллбеком =====
  const ctx = useOutletContext() || {};
  const {
    products: ctxProducts = [],
    setProducts: ctxSetProducts,
    categories = [],
    brands = [],
  } = ctx;

  const [localProducts, setLocalProducts] = useState([]);
  const products = (ctxProducts?.length ? ctxProducts : localProducts) || [];
  const setProducts =
    typeof ctxSetProducts === "function" ? ctxSetProducts : setLocalProducts;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  // локальные фолбэки справочников
  const [catsLocal, setCatsLocal] = useState([]);
  const [brandsLocal, setBrandsLocal] = useState([]);
  const cats = categories.length ? categories : catsLocal;
  const brs = brands.length ? brands : brandsLocal;

  const catMap = useMemo(
    () => new Map((cats || []).map((c) => [c.id, c.name])),
    [cats]
  );
  const brMap = useMemo(
    () => new Map((brs || []).map((b) => [b.id, b.name])),
    [brs]
  );

  /* ===== справочники (если нет в контексте) ===== */
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

  /* ===== точечная догрузка имён по id ===== */
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
        [...needBrandIds].map((id) => api.get(`/main/brands/${id}/`))
      ),
      Promise.allSettled(
        [...needCatIds].map((id) => api.get(`/main/categories/${id}/`))
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
        const add = [...brExtra]
          .filter(([id]) => !have.has(id))
          .map(([id, name]) => ({ id, name }));
        return add.length ? [...prev, ...add] : prev;
      });
    }
    if (catExtra.size) {
      setCatsLocal((prev) => {
        const have = new Set(prev.map((c) => c.id));
        const add = [...catExtra]
          .filter(([id]) => !have.has(id))
          .map(([id, name]) => ({ id, name }));
        return add.length ? [...prev, ...add] : prev;
      });
    }

    return { brExtra, catExtra };
  };

  /* ===== загрузка товаров ===== */
  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      const res = await api.get("/main/products/list/");
      const raw = asArray(res.data);

      const { brExtra, catExtra } = await fetchMissingRefs(raw);
      const mergedBrMap = new Map([...brMap, ...brExtra]);
      const mergedCatMap = new Map([...catMap, ...catExtra]);

      const enriched = raw.map((p) =>
        normalizeProduct(p, mergedCatMap, mergedBrMap)
      );
      setProducts(enriched);
      setLocalProducts(enriched);
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

  /* ===== пере-нормализация когда справочники догрузились ===== */
  useEffect(() => {
    if (!cats.length && !brs.length) return;
    setProducts((prev = []) =>
      (prev || []).map((p) => normalizeProduct(p, catMap, brMap))
    );
    setLocalProducts((prev = []) =>
      (prev || []).map((p) => normalizeProduct(p, catMap, brMap))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, brs]);

  /* ===== фильтрация ===== */
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      `${p.name || ""} ${p.barcode || ""}`.toLowerCase().includes(s)
    );
  }, [products, q]);

  /* ===== удаление ===== */
  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Удалить этот товар?")) return;
    try {
      await api.delete(`/main/products/${encodeURIComponent(id)}/`);
      setProducts((prev = []) => (prev || []).filter((p) => p.id !== id));
      setLocalProducts((prev = []) => (prev || []).filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  /* ===== сохранение (создание/обновление) ===== */
  const handleSave = async (product) => {
    try {
      if (product.id) {
        // --- UPDATE: отправляем только изменяемые поля (PUT /main/products/{id}/) ---
        const priceNum = Number(product.price);
        const qtyNum = Number(product.quantity);

        const payload = {};
        // barcode: "" => null (очистить), пропущено => не менять
        if ("barcode" in product) {
          const trimmed = (product.barcode ?? "").trim();
          payload.barcode = trimmed === "" ? null : trimmed;
        }
        if ("price" in product) {
          payload.price = String(
            (Number.isFinite(priceNum) ? priceNum : 0).toFixed(2)
          );
        }
        if ("quantity" in product) {
          const qn = Number.isFinite(qtyNum) ? qtyNum : 0;
          payload.quantity = qn < 0 ? 0 : qn;
        }

        await api.put(
          `/main/products/${encodeURIComponent(product.id)}/`,
          payload
        );

        // подтянем актуальные readOnly-поля
        const { data } = await api.get(
          `/main/products/${encodeURIComponent(product.id)}/`
        );
        const updated = normalizeProduct(data, catMap, brMap);

        const applyUpdate = (list = []) =>
          (list || []).map((p) => (p.id === updated.id ? updated : p));

        setProducts(applyUpdate);
        setLocalProducts(applyUpdate);
      } else {
        // --- CREATE: POST /main/products/create-manual/ ---
        const payload = {
          name: (product.name || "").trim(),
          barcode:
            product.barcode && product.barcode.trim()
              ? product.barcode.trim()
              : genBarcode(),
          price: String((Number(product.price) || 0).toFixed(2)),
          quantity: Number(product.quantity) || 0,
          ...(product.category
            ? {
                category_name:
                  catMap.get(product.category) || String(product.category),
              }
            : {}),
          ...(product.brand
            ? { brand_name: brMap.get(product.brand) || String(product.brand) }
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

        setProducts((prev = []) => [created, ...(prev || [])]);
        setLocalProducts((prev = []) => [created, ...(prev || [])]);
      }

      setIsAddOpen(false);
      setEditProduct(null);
    } catch (e) {
      console.error("Save error:", e?.response?.status, e?.response?.data || e);
      alert("Ошибка сохранения товара");
    }
  };

  /* ===== RENDER ===== */
  return (
    <section className={s.warehouse}>
      <header className={s.warehouse__header}>
        <div>
          <h2 className={s.warehouse__title}>Склад</h2>
        </div>
        <div className={s.warehouse__actions}>
          <div className={s.warehouse__search}>
            <span className={s.warehouse__searchIcon}>🔎</span>
            <input
              className={s.warehouse__searchInput}
              placeholder="Поиск по названию или штрих-коду…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className={`${s.warehouse__btn} ${s["warehouse__btn--secondary"]}`}
            onClick={load}
            disabled={loading}
          >
            Обновить
          </button>
          <button
            className={`${s.warehouse__btn} ${s["warehouse__btn--primary"]}`}
            onClick={() => setIsAddOpen(true)}
          >
            + Товар
          </button>
        </div>
      </header>

      {err && <div className={s.warehouse__error}>{err}</div>}

      <div className={s.warehouse__list}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={s.warehouse__skeleton} />
          ))
        ) : rows.length === 0 ? (
          <div className={s.warehouse__empty}>Ничего не найдено</div>
        ) : (
          rows.map((p) => (
            <article key={p.id} className={s.warehouse__card}>
              <div className={s.warehouse__left}>
                <div className={s.warehouse__name}>{p.name}</div>

                <div className={s.warehouse__meta}>
                  <span className={s.warehouse__badge}>
                    ШК: {p.barcode || "—"}
                  </span>
                  <span className={s.warehouse__badge}>
                    Категория: {p.category_name}
                  </span>
                  <span className={s.warehouse__badge}>
                    Бренд: {p.brand_name}
                  </span>
                </div>

                <div className={s.warehouse__meta}>
                  <span className={s.warehouse__price}>
                    {p.price ?? "0.00"} сом
                  </span>
                  <span className={s.warehouse__dot}>•</span>
                  <span className={s.warehouse__qty}>
                    Кол-во: {Number(p.quantity) ?? 0}
                  </span>
                </div>
              </div>

              <div className={s.warehouse__right}>
                <button
                  className={s.warehouse__btn}
                  onClick={() => setEditProduct(p)}
                >
                  Изменить
                </button>
                <button
                  className={`${s.warehouse__btn} ${s["warehouse__btn--secondary"]}`}
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
      // создание — генерим, редактирование — шлём ("" => null)
      barcode: isEdit ? barcode : undefined,
      // brand/category выбираются только при создании
      ...(isEdit ? {} : { category: category || null, brand: brand || null }),
      price,
      quantity,
    });
  };

  return (
    <div className={s.warehouse__modalOverlay} onClick={onClose}>
      <div className={s.warehouse__modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.warehouse__modalHeader}>
          <div className={s.warehouse__modalTitle}>
            {isEdit ? "Редактировать товар" : "Добавить товар"}
          </div>
          <button
            className={s.warehouse__iconBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <form className={s.warehouse__form} onSubmit={submit}>
          <div className={s.warehouse__formGrid}>
            {/* Название (readOnly на бекенде) */}
            <div className={s.warehouse__field}>
              <label className={s.warehouse__label}>
                Название <span className={s.warehouse__req}>*</span>
              </label>
              <input
                className={s.warehouse__input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={1}
                required
                placeholder="Например: Шампунь 500мл"
                disabled={isEdit}
              />
            </div>

            {/* Категория / Бренд: только при создании */}
            {!isEdit ? (
              <>
                <div className={s.warehouse__field}>
                  <label className={s.warehouse__label}>Категория</label>
                  <select
                    className={s.warehouse__input}
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

                <div className={s.warehouse__field}>
                  <label className={s.warehouse__label}>Бренд</label>
                  <select
                    className={s.warehouse__input}
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
                <div className={s.warehouse__field}>
                  <label className={s.warehouse__label}>Категория</label>
                  <input
                    className={s.warehouse__input}
                    value={product?.category_name ?? "—"}
                    disabled
                  />
                </div>
                <div className={s.warehouse__field}>
                  <label className={s.warehouse__label}>Бренд</label>
                  <input
                    className={s.warehouse__input}
                    value={product?.brand_name ?? "—"}
                    disabled
                  />
                </div>
              </>
            )}

            {/* ШК — опционально при редактировании */}
            {isEdit && (
              <div className={s.warehouse__field}>
                <label className={s.warehouse__label}>
                  Штрих-код (опционально)
                </label>
                <input
                  className={s.warehouse__input}
                  value={barcode}
                  maxLength={64}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Пусто — не менять, очистить — удалить ШК"
                />
              </div>
            )}

            {/* Цена */}
            <div className={s.warehouse__field}>
              <label className={s.warehouse__label}>
                Цена <span className={s.warehouse__req}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={s.warehouse__input}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="0.00"
              />
            </div>

            {/* Количество */}
            <div className={s.warehouse__field}>
              <label className={s.warehouse__label}>
                Кол-во <span className={s.warehouse__req}>*</span>
              </label>
              <input
                type="number"
                min="0"
                className={s.warehouse__input}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="0"
              />
            </div>
          </div>

          <div className={s.warehouse__formActions}>
            <button
              type="button"
              className={s.warehouse__btn}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`${s.warehouse__btn} ${s["warehouse__btn--primary"]}`}
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
