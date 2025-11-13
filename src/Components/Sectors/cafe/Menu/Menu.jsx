import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaUtensils,
  FaTag,
  FaTrash,
  FaEdit,
} from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

const Menu = () => {
  // tabs
  const [activeTab, setActiveTab] = useState("items"); // items | categories

  // справочники
  const [categories, setCategories] = useState([]); // {id,title}
  const [warehouse, setWarehouse] = useState([]); // {id,title,unit,...}

  // список
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  // поиск
  const [queryItems, setQueryItems] = useState("");
  const [queryCats, setQueryCats] = useState("");

  // модалка блюда
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: 0,
    is_active: true,
    ingredients: [], // { product: uuid, amount: number }
  });

  // фото (загрузка + превью)
  const [imageFile, setImageFile] = useState(null); // File | null
  const [imagePreview, setImagePreview] = useState(""); // string (blob url или image_url)

  // модалка категории
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catTitle, setCatTitle] = useState("");

  // maps
  const categoriesMap = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c.title));
    return m;
  }, [categories]);

  const warehouseMap = useMemo(() => {
    const m = new Map();
    warehouse.forEach((w) => m.set(w.id, w));
    return m;
  }, [warehouse]);

  const categoryTitle = (id) => categoriesMap.get(id) || "Без категории";
  const productTitle = (id) => warehouseMap.get(id)?.title || id || "";
  const productUnit = (id) => warehouseMap.get(id)?.unit || "";

  /* ===== загрузка ===== */
  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
        const cats = await api.get("/cafe/categories/");
        setCategories(listFrom(cats));
      } catch (e) {
        console.error("Ошибка категорий:", e);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const wh = await api.get("/cafe/warehouse/");
        setWarehouse(listFrom(wh));
      } catch (e) {
        console.error("Ошибка склада:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        const res = await api.get("/cafe/menu-items/");
        setItems(listFrom(res));
      } catch (e) {
        console.error("Ошибка меню:", e);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  // cleanup blob preview
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  /* ===== фильтры ===== */
  const filteredItems = useMemo(() => {
    const q = queryItems.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const title = (m.title || "").toLowerCase();
      const cat = categoryTitle(m.category).toLowerCase();
      return title.includes(q) || cat.includes(q);
    });
  }, [items, queryItems, categoriesMap]);

  const filteredCats = useMemo(() => {
    const q = queryCats.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [categories, queryCats]);

  /* ===== CRUD: блюдо ===== */
  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      category: categories[0]?.id || "",
      price: 0,
      is_active: true,
      ingredients: [],
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      category: item.category || categories[0]?.id || "",
      price: toNum(item.price),
      is_active: !!item.is_active,
      ingredients: Array.isArray(item.ingredients)
        ? item.ingredients.map((ing) => ({
            product: ing.product,
            amount: toNum(ing.amount),
          }))
        : [],
    });
    // текущая картинка из API
    setImageFile(null);
    setImagePreview(item.image_url || "");
    setModalOpen(true);
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // сбрасываем старый blob-url, если был
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveItem = async (e) => {
    e.preventDefault();
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      price: String(Math.max(0, Number(form.price) || 0)), // decimal string
      is_active: !!form.is_active,
      ingredients: (form.ingredients || [])
        .filter((r) => r && r.product && (Number(r.amount) || 0) > 0)
        .map((r) => ({
          product: r.product,
          amount: String(Math.max(0, Number(r.amount) || 0)),
        })),
    };
    if (!payload.title || !payload.category) return;

    // отправляем как multipart/form-data (для image)
    const fd = new FormData();
    fd.append("title", payload.title);
    fd.append("category", payload.category);
    fd.append("price", payload.price);
    fd.append("is_active", payload.is_active ? "true" : "false");
    fd.append("ingredients", JSON.stringify(payload.ingredients));
    if (imageFile) {
      fd.append("image", imageFile); // бек вернет readOnly image_url
    }

    try {
      if (editingId == null) {
        const res = await api.post("/cafe/menu-items/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setItems((prev) => [...prev, res.data]);
      } else {
        const res = await api.put(`/cafe/menu-items/${editingId}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setItems((prev) =>
          prev.map((m) => (m.id === editingId ? res.data : m))
        );
      }
      setModalOpen(false);
      // очистка превью
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      console.error("Ошибка сохранения блюда:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить позицию меню?")) return;
    try {
      await api.delete(`/cafe/menu-items/${id}/`);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Ошибка удаления позиции меню:", err);
    }
  };

  // ингредиенты (форма)
  const addIngredientRow = () =>
    setForm((f) => ({
      ...f,
      ingredients: [...(f.ingredients || []), { product: "", amount: 1 }],
    }));

  const changeIngredientRow = (idx, field, value) => {
    setForm((f) => {
      const rows = [...(f.ingredients || [])];
      const row = { ...(rows[idx] || {}) };
      if (field === "product") row.product = value;
      if (field === "amount") row.amount = Math.max(0, Number(value) || 0);
      rows[idx] = row;
      return { ...f, ingredients: rows };
    });
  };

  const removeIngredientRow = (idx) =>
    setForm((f) => ({
      ...f,
      ingredients: (f.ingredients || []).filter((_, i) => i !== idx),
    }));

  /* ===== CRUD: категория ===== */
  const openCreateCat = () => {
    setCatEditId(null);
    setCatTitle("");
    setCatModalOpen(true);
  };

  const openEditCat = (row) => {
    setCatEditId(row.id);
    setCatTitle(row.title || "");
    setCatModalOpen(true);
  };

  const saveCat = async (e) => {
    e.preventDefault();
    const payload = { title: (catTitle || "").trim() };
    if (!payload.title) return;
    try {
      if (catEditId) {
        const res = await api.put(`/cafe/categories/${catEditId}/`, payload);
        setCategories((prev) =>
          prev.map((c) => (c.id === catEditId ? res.data : c))
        );
      } else {
        const res = await api.post("/cafe/categories/", payload);
        setCategories((prev) => [...prev, res.data]);
      }
      setCatModalOpen(false);
    } catch (e2) {
      console.error("Ошибка сохранения категории:", e2);
    }
  };

  const removeCat = async (id) => {
    if (!window.confirm("Удалить категорию?")) return;
    try {
      await api.delete(`/cafe/categories/${id}/`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      // если FK — бэкенд может запретить удаление
      console.error("Ошибка удаления категории:", e);
    }
  };

  /* ===== render ===== */
  return (
    <section className="menu">
      <div className="menu__header">
        <div>
          <h2 className="menu__title">Меню</h2>
          <div className="menu__subtitle">Позиции, категории и рецептуры.</div>
        </div>

        <div className="menu__actions">
          <button
            className={`menu__btn ${
              activeTab === "items"
                ? "menu__btn--primary"
                : "menu__btn--secondary"
            }`}
            onClick={() => setActiveTab("items")}
          >
            <FaUtensils /> Позиции
          </button>
          <button
            className={`menu__btn ${
              activeTab === "categories"
                ? "menu__btn--primary"
                : "menu__btn--secondary"
            }`}
            onClick={() => setActiveTab("categories")}
          >
            <FaTag /> Категории
          </button>
        </div>
      </div>

      {/* ===== ВКЛАДКА: БЛЮДА ===== */}
      {activeTab === "items" && (
        <>
          <div className="menu__actions" style={{ marginTop: -6 }}>
            <div className="menu__search">
              <FaSearch className="menu__searchIcon" aria-hidden />
              <input
                className="menu__searchInput"
                placeholder="Поиск: блюдо или категория…"
                value={queryItems}
                onChange={(e) => setQueryItems(e.target.value)}
              />
            </div>

            <button
              className="menu__btn menu__btn--primary"
              onClick={openCreate}
              disabled={!categories.length}
              title={!categories.length ? "Сначала добавьте категорию" : ""}
            >
              <FaPlus /> Новая позиция
            </button>
          </div>

          <div className="menu__list">
            {loadingItems && <div className="menu__alert">Загрузка…</div>}

            {!loadingItems &&
              filteredItems.map((m) => (
                <article key={m.id} className="menu__card">
                  <div className="menu__cardLeft">
                    <div className="menu__avatar" aria-hidden>
                      {m.image_url ? (
                        <img src={m.image_url} alt={m.title || "Фото блюда"} />
                      ) : (
                        <FaUtensils />
                      )}
                    </div>
                    <div>
                      <h3 className="menu__name">{m.title}</h3>
                      <div className="menu__meta">
                        <span className="menu__muted">
                          <FaTag /> &nbsp;{categoryTitle(m.category)}
                        </span>
                        <span className="menu__muted">
                          Цена: {fmtMoney(m.price)} сом
                        </span>
                        <span
                          className={`menu__status ${
                            m.is_active
                              ? "menu__status--on"
                              : "menu__status--off"
                          }`}
                        >
                          {m.is_active ? "Активно" : "Скрыто"}
                        </span>
                      </div>

                      {Array.isArray(m.ingredients) &&
                        m.ingredients.length > 0 && (
                          <ul className="menu__recipeMini">
                            {m.ingredients.slice(0, 4).map((ing, i) => (
                              <li
                                key={`${ing.id || ing.product}-${i}`}
                                className="menu__muted"
                              >
                                •{" "}
                                {ing.product_title || productTitle(ing.product)}{" "}
                                — {toNum(ing.amount)}{" "}
                                {ing.product_unit || productUnit(ing.product)}
                              </li>
                            ))}
                            {m.ingredients.length > 4 && (
                              <li className="menu__muted">…</li>
                            )}
                          </ul>
                        )}
                    </div>
                  </div>

                  <div className="menu__rowActions">
                    <button
                      className="menu__btn menu__btn--secondary"
                      onClick={() => openEdit(m)}
                    >
                      <FaEdit /> Изменить
                    </button>
                    <button
                      className="menu__btn menu__btn--danger"
                      onClick={() => handleDelete(m.id)}
                    >
                      <FaTrash /> Удалить
                    </button>
                  </div>
                </article>
              ))}

            {!loadingItems && !filteredItems.length && (
              <div className="menu__alert">
                Ничего не найдено по «{queryItems}».
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== ВКЛАДКА: КАТЕГОРИИ ===== */}
      {activeTab === "categories" && (
        <>
          <div className="menu__actions" style={{ marginTop: -6 }}>
            <div className="menu__search">
              <FaSearch className="menu__searchIcon" aria-hidden />
              <input
                className="menu__searchInput"
                placeholder="Поиск категории…"
                value={queryCats}
                onChange={(e) => setQueryCats(e.target.value)}
              />
            </div>

            <button
              className="menu__btn menu__btn--primary"
              onClick={openCreateCat}
            >
              <FaPlus /> Новая категория
            </button>
          </div>

          <div className="menu__list">
            {loadingCats && <div className="menu__alert">Загрузка…</div>}

            {!loadingCats &&
              filteredCats.map((c) => (
                <article key={c.id} className="menu__card">
                  <div className="menu__cardLeft">
                    <div className="menu__avatar" aria-hidden>
                      <FaTag />
                    </div>
                    <div>
                      <h3 className="menu__name">{c.title}</h3>
                    </div>
                  </div>

                  <div className="menu__rowActions">
                    <button
                      className="menu__btn menu__btn--secondary"
                      onClick={() => openEditCat(c)}
                    >
                      <FaEdit /> Изменить
                    </button>
                    <button
                      className="menu__btn menu__btn--danger"
                      onClick={() => removeCat(c.id)}
                    >
                      <FaTrash /> Удалить
                    </button>
                  </div>
                </article>
              ))}

            {!loadingCats && !filteredCats.length && (
              <div className="menu__alert">
                Ничего не найдено по «{queryCats}».
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== МОДАЛКА: БЛЮДО ===== */}
      {modalOpen && (
        <div
          className="menu-modal__overlay"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="menu-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-modal__header">
              <h3 className="menu-modal__title">
                {editingId == null ? "Новая позиция" : "Изменить позицию"}
              </h3>
              <button
                className="menu-modal__close"
                onClick={() => setModalOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="menu__form" onSubmit={saveItem}>
              {/* Превью фото */}
              {(imagePreview || imageFile) && (
                <div
                  className="menu__field menu__field--full"
                  style={{ marginBottom: 8 }}
                >
                  <label className="menu__label">Превью</label>
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid var(--c-border, #e5e7eb)",
                    }}
                  >
                    <img
                      src={imagePreview}
                      alt="Превью"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="menu__formGrid">
                <div className="menu__field">
                  <label className="menu__label">Название</label>
                  <input
                    className="menu__input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>

                <div className="menu__field">
                  <label className="menu__label">Категория</label>
                  <select
                    className="menu__input"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="menu__field">
                  <label className="menu__label">Цена, сом</label>
                  <input
                    type="number"
                    min={0}
                    className="menu__input"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        price: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    required
                  />
                </div>

                {/* Поле выбора фото */}
                <div className="menu__field">
                  <label className="menu__label">Фото (jpg/png/webp)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="menu__input"
                    onChange={onPickImage}
                  />
                </div>

                <div className="menu__field menu__field--full">
                  <label className="menu__label">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
                      style={{ marginRight: 8 }}
                    />
                    Активно в продаже
                  </label>
                </div>
              </div>

              <div className="menu__recipeBlock">
                <div className="menu__subtitle">Ингредиенты (на 1 блюдо)</div>

                {(form.ingredients || []).map((row, idx) => (
                  <div key={idx} className="menu__formGrid">
                    <div className="menu__field">
                      <label className="menu__label">Товар со склада</label>
                      <select
                        className="menu__input"
                        value={row.product || ""}
                        onChange={(e) =>
                          changeIngredientRow(idx, "product", e.target.value)
                        }
                        required
                      >
                        <option value="">— Выберите товар —</option>
                        {warehouse.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title} ({w.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="menu__field">
                      <label className="menu__label">
                        Норма (в ед. товара)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="menu__input"
                        value={row.amount ?? 0}
                        onChange={(e) =>
                          changeIngredientRow(idx, "amount", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="menu__field">
                      <label className="menu__label">&nbsp;</label>
                      <button
                        type="button"
                        className="menu__btn menu__btn--danger"
                        onClick={() => removeIngredientRow(idx)}
                      >
                        <FaTrash /> Удалить ингредиент
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="menu__btn menu__btn--secondary"
                  onClick={addIngredientRow}
                >
                  <FaPlus /> Добавить ингредиент
                </button>
              </div>

              <div className="menu__formActions">
                <button
                  type="button"
                  className="menu__btn menu__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="menu__btn menu__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== МОДАЛКА: КАТЕГОРИЯ ===== */}
      {catModalOpen && (
        <div
          className="menu-modal__overlay"
          onClick={() => setCatModalOpen(false)}
        >
          <div
            className="menu-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-modal__header">
              <h3 className="menu-modal__title">
                {catEditId ? "Редактировать категорию" : "Новая категория"}
              </h3>
              <button
                className="menu-modal__close"
                onClick={() => setCatModalOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="menu__form" onSubmit={saveCat}>
              <div className="menu__field menu__field--full">
                <label className="menu__label">Название категории</label>
                <input
                  className="menu__input"
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="Например: Горячее, Супы, Десерты"
                  required
                  maxLength={100}
                />
              </div>

              <div className="menu__formActions">
                <button
                  type="button"
                  className="menu__btn menu__btn--secondary"
                  onClick={() => setCatModalOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="menu__btn menu__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Menu;
