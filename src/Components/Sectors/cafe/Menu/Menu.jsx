import { useEffect, useMemo, useState } from "react";
import { FaListUl, FaThLarge } from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

import MenuHeader from "./components/MenuHeader";
import MenuItemsTab from "./components/MenuItemsTab";
import MenuCategoriesTab from "./components/MenuCategoriesTab";
import MenuItemModal from "./components/MenuItemModal";
import MenuCategoryModal from "./components/MenuCategoryModal";

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

const numStr = (n) => String(Number(n) || 0).replace(",", ".");

const Menu = () => {
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("list"); // "list" | "cards"

  const [categories, setCategories] = useState([]);
  const [warehouse, setWarehouse] = useState([]);

  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  const [queryItems, setQueryItems] = useState("");
  const [queryCats, setQueryCats] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: 0,
    is_active: true,
    ingredients: [],
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catTitle, setCatTitle] = useState("");

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

  const fetchCats = async () => {
    const cats = await api.get("/cafe/categories/");
    setCategories(listFrom(cats));
  };

  const fetchWarehouse = async () => {
    const wh = await api.get("/cafe/warehouse/");
    setWarehouse(listFrom(wh));
  };

  const fetchMenuList = async () => {
    const res = await api.get("/cafe/menu-items/");
    setItems(listFrom(res));
  };

  const fetchMenuDetail = async (id) => {
    if (!id) return null;
    try {
      const r = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      return r?.data || null;
    } catch (e) {
      console.error("Ошибка detail блюда:", e);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
        await fetchCats();
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
        await fetchWarehouse();
      } catch (e) {
        console.error("Ошибка склада:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        await fetchMenuList();
      } catch (e) {
        console.error("Ошибка меню:", e);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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

  const openEdit = async (item) => {
    const baseId = item?.id;
    let full = item;

    if (!Array.isArray(item?.ingredients)) {
      const d = await fetchMenuDetail(baseId);
      if (d) full = d;
    }

    setEditingId(full.id);
    setForm({
      title: full.title || "",
      category: full.category || categories[0]?.id || "",
      price: toNum(full.price),
      is_active: !!full.is_active,
      ingredients: Array.isArray(full.ingredients)
        ? full.ingredients.map((ing) => ({
            product: ing.product,
            amount: toNum(ing.amount),
          }))
        : [],
    });

    setImageFile(null);
    setImagePreview(full.image_url || "");
    setModalOpen(true);
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayload = () => {
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      price: numStr(Math.max(0, Number(form.price) || 0)),
      is_active: !!form.is_active,
      ingredients: (form.ingredients || [])
        .filter((r) => r && r.product && (Number(r.amount) || 0) > 0)
        .map((r) => ({
          product: r.product,
          amount: numStr(Math.max(0, Number(r.amount) || 0)),
        })),
    };

    if (!payload.title || !payload.category) return null;
    return payload;
  };

  const uploadImageIfNeeded = async (id) => {
    if (!id || !imageFile) return true;

    const fd = new FormData();
    fd.append("image", imageFile);

    try {
      await api.patch(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return true;
    } catch (e) {
      try {
        const p = buildPayload();
        if (!p) return false;

        const fd2 = new FormData();
        fd2.append("title", p.title);
        fd2.append("category", p.category);
        fd2.append("price", p.price);
        fd2.append("is_active", p.is_active ? "true" : "false");
        fd2.append("ingredients", JSON.stringify(p.ingredients));
        fd2.append("image", imageFile);

        await api.put(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, fd2, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        return true;
      } catch (e2) {
        console.error("Ошибка загрузки картинки:", e2);
        return false;
      }
    }
  };

  const saveItem = async (e) => {
    e.preventDefault();

    const payload = buildPayload();
    if (!payload) return;

    try {
      let saved = null;

      if (editingId == null) {
        const res = await api.post("/cafe/menu-items/", payload);
        saved = res?.data || null;
      } else {
        const res = await api.put(
          `/cafe/menu-items/${encodeURIComponent(String(editingId))}/`,
          payload
        );
        saved = res?.data || null;
      }

      const savedId = saved?.id || editingId;

      if (imageFile && savedId) {
        const ok = await uploadImageIfNeeded(savedId);
        if (!ok) console.error("Картинка не загрузилась, но блюдо сохранено.");
      }

      const full = savedId ? await fetchMenuDetail(savedId) : null;
      const finalItem = full || saved;

      if (finalItem?.id) {
        setItems((prev) => {
          const exists = prev.some((m) => String(m.id) === String(finalItem.id));
          if (!exists) return [...prev, finalItem];
          return prev.map((m) => (String(m.id) === String(finalItem.id) ? finalItem : m));
        });
      } else {
        await fetchMenuList();
      }

      setModalOpen(false);

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
      await api.delete(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
    } catch (err) {
      console.error("Ошибка удаления позиции меню:", err);
    }
  };

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
        const res = await api.put(`/cafe/categories/${encodeURIComponent(String(catEditId))}/`, payload);
        setCategories((prev) => prev.map((c) => (c.id === catEditId ? res.data : c)));
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
      await api.delete(`/cafe/categories/${encodeURIComponent(String(id))}/`);
      setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
    } catch (e) {
      console.error("Ошибка удаления категории:", e);
    }
  };

  return (
    <section className="menu">
      <div className="menu__topRow">
        <div className="menu__topGrow">
          <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === "items" && (
          <div className="menu__viewToggle" aria-label="Переключение вида">
            <button
              type="button"
              className={`menu__viewBtn ${viewMode === "list" ? "menu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("list")}
              title="Список"
            >
              <FaListUl />
            </button>
            <button
              type="button"
              className={`menu__viewBtn ${viewMode === "cards" ? "menu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Карточки"
            >
              <FaThLarge />
            </button>
          </div>
        )}
      </div>

      {activeTab === "items" && (
        <MenuItemsTab
          loadingItems={loadingItems}
          filteredItems={filteredItems}
          queryItems={queryItems}
          setQueryItems={setQueryItems}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={handleDelete}
          hasCategories={!!categories.length}
          categoryTitle={categoryTitle}
          fmtMoney={fmtMoney}
          toNum={toNum}
          productTitle={productTitle}
          productUnit={productUnit}
          viewMode={viewMode}
        />
      )}

      {activeTab === "categories" && (
        <MenuCategoriesTab
          loadingCats={loadingCats}
          filteredCats={filteredCats}
          queryCats={queryCats}
          setQueryCats={setQueryCats}
          onCreateCat={openCreateCat}
          onEditCat={openEditCat}
          onDeleteCat={removeCat}
        />
      )}

      <MenuItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        setForm={setForm}
        categories={categories}
        warehouse={warehouse}
        onSubmit={saveItem}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onPickImage={onPickImage}
        addIngredientRow={addIngredientRow}
        changeIngredientRow={changeIngredientRow}
        removeIngredientRow={removeIngredientRow}
      />

      <MenuCategoryModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        catEditId={catEditId}
        catTitle={catTitle}
        setCatTitle={setCatTitle}
        onSubmit={saveCat}
      />
    </section>
  );
};

export default Menu;
