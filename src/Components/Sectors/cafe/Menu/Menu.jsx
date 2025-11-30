import { useEffect, useMemo, useState } from "react";
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

const Menu = () => {
  const [activeTab, setActiveTab] = useState("items");

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
    setImageFile(null);
    setImagePreview(item.image_url || "");
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

  const saveItem = async (e) => {
    e.preventDefault();
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      price: String(Math.max(0, Number(form.price) || 0)),
      is_active: !!form.is_active,
      ingredients: (form.ingredients || [])
        .filter((r) => r && r.product && (Number(r.amount) || 0) > 0)
        .map((r) => ({
          product: r.product,
          amount: String(Math.max(0, Number(r.amount) || 0)),
        })),
    };
    if (!payload.title || !payload.category) return;

    const fd = new FormData();
    fd.append("title", payload.title);
    fd.append("category", payload.category);
    fd.append("price", payload.price);
    fd.append("is_active", payload.is_active ? "true" : "false");
    fd.append("ingredients", JSON.stringify(payload.ingredients));
    if (imageFile) {
      fd.append("image", imageFile);
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
      console.error("Ошибка удаления категории:", e);
    }
  };

  return (
    <section className="menu">
      <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />

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
