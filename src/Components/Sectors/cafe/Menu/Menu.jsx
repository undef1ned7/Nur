// src/Components/Sectors/cafe/Menu/Menu.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaListUl, FaThLarge } from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

import MenuHeader from "./components/MenuHeader";
import MenuItemsTab from "./components/MenuItemsTab";
import MenuCategoriesTab from "./components/MenuCategoriesTab";
import MenuItemModal from "./components/MenuItemModal";
import MenuCategoryModal from "./components/MenuCategoryModal";

/* ===== helpers ===== */
const toNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (value) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const numberToString = (value) => {
  const n = toNumber(value);
  const fixed = Math.max(0, n).toFixed(2);
  return String(fixed).replace(",", ".");
};

const normalizeDecimalValue = (value) => {
  const cleaned = String(value ?? "").replace(",", ".");
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : null;
};

const unitToLower = (u) => String(u || "").trim().toLowerCase();

// UI ввод: граммы/мл -> API: кг/л
const uiToApiAmount = (amountUi, unit) => {
  const n = Math.max(0, toNumber(amountUi));
  const u = unitToLower(unit);

  if (u === "kg" || u === "кг") return n / 1000;
  if (u === "l" || u === "л") return n / 1000;
  return n;
};

// API кг/л -> UI граммы/мл
const apiToUiAmount = (amountApi, unit) => {
  const n = Math.max(0, toNumber(amountApi));
  const u = unitToLower(unit);

  if (u === "kg" || u === "кг") return n * 1000;
  if (u === "l" || u === "л") return n * 1000;
  return n;
};

const prettyNumber = (n, maxDigits = 3) => {
  const v = Number.isFinite(n) ? n : 0;
  return String(Number(v.toFixed(maxDigits))).replace(",", ".");
};

const fetchAllPages = async (url) => {
  const out = [];
  let nextUrl = url;

  while (nextUrl) {
    const res = await api.get(nextUrl);
    const data = res?.data || {};
    const chunk = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    out.push(...chunk);
    nextUrl = data?.next || null;
  }

  return out;
};

const Menu = () => {
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("cards");

  const [categories, setCategories] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [items, setItems] = useState([]);

  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  const [queryItems, setQueryItems] = useState("");
  const [queryCats, setQueryCats] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Модал блюда
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // form (как swagger)
  const [form, setForm] = useState({
    title: "",
    category: "",
    kitchen: "",
    price: "0.00", // авто
    is_active: true,

    vat_percent: "0.00",
    other_expenses: "0.00", // влияет на цену

    ingredients: [],

    // вычисляемое (локально для UI; на сервере readOnly)
    cost_price: "0.00",
    ingredients_cost: "0.00",

    vat_amount: "",
    profit: "",
    margin_percent: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Модал категорий
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catTitle, setCatTitle] = useState("");

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState(""); // "item" | "cat"
  const [confirmId, setConfirmId] = useState(null);

  /* ===== maps ===== */
  const categoriesMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(String(cat.id), cat.title));
    return map;
  }, [categories]);

  const kitchensMap = useMemo(() => {
    const map = new Map();
    kitchens.forEach((kitchen) => {
      const title = kitchen.title || kitchen.name || kitchen.kitchen_title || "Кухня";
      const number = kitchen.number ?? kitchen.kitchen_number;
      const label = `${title}${
        number !== undefined && number !== null && number !== "" ? ` №${number}` : ""
      }`;
      map.set(String(kitchen.id), label);
    });
    return map;
  }, [kitchens]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouse.forEach((w) => map.set(String(w.id), w));
    return map;
  }, [warehouse]);

  const getCategoryTitle = (id) => categoriesMap.get(String(id)) || "Без категории";
  const getKitchenTitle = (id) => kitchensMap.get(String(id)) || "";
  const getWarehouseTitle = (id) => warehouseMap.get(String(id))?.title || "";
  const getWarehouseUnit = (id) => warehouseMap.get(String(id))?.unit || "";

  // UI подпись единицы нормы
  const getUiUnitLabel = (unit) => {
    const u = unitToLower(unit);
    if (u === "kg" || u === "кг") return "г";
    if (u === "l" || u === "л") return "мл";
    return unit || "";
  };

  /* ===== unit_price по Swagger ===== */
  const getWarehouseUnitPrice = (productId) => {
    const p = warehouseMap.get(String(productId));
    if (!p) return 0;

    // Swagger: unit_price (decimal)
    const raw = p.unit_price;

    const n = toNumber(raw);
    return n > 0 ? n : 0;
  };

  // Себестоимость ингредиентов (сом)
  const calcIngredientsCost = (ingredients) => {
    const rows = Array.isArray(ingredients) ? ingredients : [];
    return rows.reduce((sum, row) => {
      const productId = row?.product;
      if (!productId) return sum;

      const unit = getWarehouseUnit(productId);
      const apiAmount = uiToApiAmount(row?.amount, unit);
      const unitPrice = getWarehouseUnitPrice(productId);

      const cost = apiAmount * unitPrice;
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
  };

  const calcTotalPrice = (ingredientsCost, otherExpenses) => {
    const total = Math.max(0, toNumber(ingredientsCost)) + Math.max(0, toNumber(otherExpenses));
    return total;
  };

  /* ===== API ===== */
  const fetchCategories = async () => {
    const data = await fetchAllPages("/cafe/categories/");
    setCategories(data);
  };

  const fetchKitchens = async () => {
    const data = await fetchAllPages("/cafe/kitchens/");
    setKitchens(data);
  };

  const fetchWarehouse = async () => {
    const data = await fetchAllPages("/cafe/warehouse/");
    setWarehouse(data);
  };

  const fetchMenuItems = async () => {
    const data = await fetchAllPages("/cafe/menu-items/");
    setItems(data);
  };

  const fetchMenuItemDetail = async (id) => {
    if (!id) return null;
    try {
      const res = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      return res?.data || null;
    } catch (err) {
      console.error("Menu item detail fetch failed:", err);
      return null;
    }
  };

  /* ===== mount загрузки ===== */
  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
        await fetchCategories();
      } catch (err) {
        console.error("Categories fetch failed:", err);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchKitchens();
      } catch (err) {
        console.error("Kitchens fetch failed:", err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchWarehouse();
      } catch (err) {
        console.error("Warehouse fetch failed:", err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        await fetchMenuItems();
      } catch (err) {
        console.error("Menu items fetch failed:", err);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  /* ===== АВТО-РАСЧЁТ ЦЕНЫ И СЕБЕСТОИМОСТИ ===== */
  useEffect(() => {
    if (!modalOpen) return;

    const ingCost = calcIngredientsCost(form.ingredients);
    const total = calcTotalPrice(ingCost, form.other_expenses);

    const nextIngredientsCost = numberToString(ingCost);
    const nextCostPrice = numberToString(ingCost + toNumber(form.other_expenses));
    const nextPrice = numberToString(total);

    setForm((prev) => {
      const changed =
        prev.price !== nextPrice ||
        prev.ingredients_cost !== nextIngredientsCost ||
        prev.cost_price !== nextCostPrice;

      if (!changed) return prev;

      return {
        ...prev,
        price: nextPrice,
        ingredients_cost: nextIngredientsCost,
        cost_price: nextCostPrice,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, form.ingredients, form.other_expenses, warehouse]);

  /* ===== фильтры ===== */
  const filteredItems = useMemo(() => {
    let filtered = items;

    if (selectedCategoryFilter) {
      filtered = filtered.filter(
        (item) => String(item?.category || "") === String(selectedCategoryFilter)
      );
    }

    const query = queryItems.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const category = getCategoryTitle(item.category).toLowerCase();
        const kitchen = getKitchenTitle(item.kitchen).toLowerCase();
        return title.includes(query) || category.includes(query) || kitchen.includes(query);
      });
    }

    return filtered;
  }, [items, queryItems, selectedCategoryFilter, categoriesMap, kitchensMap]);

  const filteredCategories = useMemo(() => {
    const query = queryCats.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((cat) => (cat.title || "").toLowerCase().includes(query));
  }, [categories, queryCats]);

  /* ===== modals ===== */
  const openCreateItemModal = () => {
    setEditingId(null);
    setForm({
      title: "",
      category: categories[0]?.id || "",
      kitchen: "",
      price: "0.00",
      is_active: true,

      vat_percent: "0.00",
      other_expenses: "0.00",

      ingredients: [],

      cost_price: "0.00",
      ingredients_cost: "0.00",

      vat_amount: "",
      profit: "",
      margin_percent: "",
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  const openEditItemModal = async (item) => {
    const baseId = item?.id;
    const detail = await fetchMenuItemDetail(baseId);
    const fullItem = detail || item;

    setEditingId(fullItem.id);

    const ingRows =
      Array.isArray(fullItem.ingredients) && fullItem.ingredients.length
        ? fullItem.ingredients.map((ing) => {
            const unit = getWarehouseUnit(ing.product);
            const uiAmount = apiToUiAmount(ing.amount, unit);
            return {
              product: ing.product,
              amount: prettyNumber(uiAmount, 3),
            };
          })
        : [];

    setForm({
      title: fullItem.title || "",
      category: fullItem.category || categories[0]?.id || "",
      kitchen: fullItem.kitchen ? String(fullItem.kitchen) : "",
      price: String(fullItem.price ?? "0.00").replace(",", "."),
      is_active: !!fullItem.is_active,

      vat_percent: String(fullItem.vat_percent ?? "0.00").replace(",", "."),
      other_expenses: String(fullItem.other_expenses ?? "0.00").replace(",", "."),

      ingredients: ingRows,

      cost_price: String(fullItem.cost_price ?? "0.00").replace(",", "."),
      ingredients_cost: String(fullItem.ingredients_cost ?? "0.00").replace(",", "."),

      vat_amount: fullItem.vat_amount ?? "",
      profit: fullItem.profit ?? "",
      margin_percent: fullItem.margin_percent ?? "",
    });

    setImageFile(null);
    setImagePreview(fullItem.image_url || "");
    setModalOpen(true);
  };

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  /* ===== payload ===== */
  const buildFormPayload = () => {
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      kitchen: form.kitchen ? form.kitchen : null,

      price: numberToString(form.price),
      is_active: !!form.is_active,

      vat_percent: numberToString(form.vat_percent),
      other_expenses: numberToString(form.other_expenses),

      ingredients: (form.ingredients || [])
        .filter((row) => row && row.product && String(row.amount || "").trim() !== "")
        .map((row) => {
          const unit = getWarehouseUnit(row.product);
          const apiAmount = uiToApiAmount(row.amount, unit);
          return {
            product: row.product,
            amount: numberToString(apiAmount),
          };
        }),
    };

    if (!payload.title || !payload.category) return null;
    return payload;
  };

  const uploadImage = async (id) => {
    if (!id || !imageFile) return true;

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      await api.patch(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return true;
    } catch (err) {
      console.error("Image PATCH failed, fallback to PUT multipart:", err);

      try {
        const payload = buildFormPayload();
        if (!payload) return false;

        const formData2 = new FormData();
        formData2.append("title", payload.title);
        formData2.append("category", payload.category);
        if (payload.kitchen) formData2.append("kitchen", payload.kitchen);
        formData2.append("price", payload.price);
        formData2.append("is_active", payload.is_active ? "true" : "false");
        formData2.append("vat_percent", payload.vat_percent);
        formData2.append("other_expenses", payload.other_expenses);
        formData2.append("ingredients", JSON.stringify(payload.ingredients));
        formData2.append("image", imageFile);

        await api.put(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, formData2, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        return true;
      } catch (err2) {
        console.error("Image PUT multipart failed:", err2);
        return false;
      }
    }
  };

  const saveMenuItem = async (e) => {
    e.preventDefault();

    const payload = buildFormPayload();
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

      if (imageFile && savedId) await uploadImage(savedId);

      const fullItem = savedId ? await fetchMenuItemDetail(savedId) : null;
      const finalItem = fullItem || saved;

      if (finalItem?.id) {
        setItems((prev) => {
          const targetId = String(finalItem.id);
          const exists = prev.some((m) => String(m.id) === targetId);
          if (!exists) return [...prev, finalItem];
          return prev.map((m) => (String(m.id) === targetId ? finalItem : m));
        });
      } else {
        await fetchMenuItems();
      }

      setModalOpen(false);

      if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      console.error("Menu item save failed:", err);
    }
  };

  /* ===== delete ===== */
  const openConfirmDeleteItem = (id) => {
    setConfirmKind("item");
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const openConfirmDeleteCategory = (id) => {
    setConfirmKind("cat");
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const closeConfirmModal = () => {
    setConfirmOpen(false);
    setConfirmKind("");
    setConfirmId(null);
  };

  const confirmDelete = async () => {
    const id = confirmId;
    const kind = confirmKind;

    closeConfirmModal();
    if (!id || !kind) return;

    const targetId = String(id);

    try {
      if (kind === "item") {
        setItems((prev) => prev.filter((m) => String(m.id) !== targetId));
        await api.delete(`/cafe/menu-items/${encodeURIComponent(targetId)}/`);
        await fetchMenuItems();
        return;
      }

      if (kind === "cat") {
        setCategories((prev) => prev.filter((c) => String(c.id) !== targetId));
        await api.delete(`/cafe/categories/${encodeURIComponent(targetId)}/`);
        await fetchCategories();
      }
    } catch (err) {
      console.error("Delete failed:", err);
      try {
        if (kind === "item") await fetchMenuItems();
        if (kind === "cat") await fetchCategories();
      } catch (syncErr) {
        console.error("Refetch after delete failed:", syncErr);
      }
    }
  };

  /* ===== ingredients ===== */
  const addIngredientRow = () =>
    setForm((f) => ({
      ...f,
      ingredients: [...(f.ingredients || []), { product: "", amount: "1" }],
    }));

  const updateIngredientRow = (idx, field, value) => {
    setForm((f) => {
      const rows = [...(f.ingredients || [])];
      const row = { ...(rows[idx] || {}) };

      if (field === "product") row.product = value;

      if (field === "amount") {
        const normalized = normalizeDecimalValue(value);
        if (normalized !== null) row.amount = normalized;
      }

      rows[idx] = row;
      return { ...f, ingredients: rows };
    });
  };

  const removeIngredientRow = (idx) =>
    setForm((f) => ({
      ...f,
      ingredients: (f.ingredients || []).filter((_, i) => i !== idx),
    }));

  /* ===== categories ===== */
  const openCreateCategoryModal = () => {
    setCatEditId(null);
    setCatTitle("");
    setCatModalOpen(true);
  };

  const openEditCategoryModal = (cat) => {
    setCatEditId(cat.id);
    setCatTitle(cat.title || "");
    setCatModalOpen(true);
  };

  const saveCategoryToAPI = async (e) => {
    e.preventDefault();
    const payload = { title: (catTitle || "").trim() };
    if (!payload.title) return;

    try {
      if (catEditId) {
        const res = await api.put(
          `/cafe/categories/${encodeURIComponent(String(catEditId))}/`,
          payload
        );
        setCategories((prev) =>
          prev.map((c) => (String(c.id) === String(catEditId) ? res.data : c))
        );
      } else {
        const res = await api.post("/cafe/categories/", payload);
        setCategories((prev) => [...prev, res.data]);
      }
      setCatModalOpen(false);
    } catch (err) {
      console.error("Category save failed:", err);
    }
  };

  const isItemsTab = activeTab === "items";

  return (
    <section className="cafeMenu">
      <div className="cafeMenu__topRow">
        <div className="cafeMenu__topGrow">
          <MenuHeader activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {isItemsTab && (
          <div className="cafeMenu__viewToggle" aria-label="Переключение вида">
            <button
              type="button"
              className={`cafeMenu__viewBtn ${viewMode === "list" ? "cafeMenu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("list")}
              title="Список"
            >
              <FaListUl />
            </button>

            <button
              type="button"
              className={`cafeMenu__viewBtn ${viewMode === "cards" ? "cafeMenu__viewBtn--active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Карточки"
            >
              <FaThLarge />
            </button>
          </div>
        )}
      </div>

      {isItemsTab && (
        <MenuItemsTab
          loadingItems={loadingItems}
          filteredItems={filteredItems}
          queryItems={queryItems}
          setQueryItems={setQueryItems}
          categories={categories}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
          onCreate={openCreateItemModal}
          onEdit={openEditItemModal}
          onDelete={openConfirmDeleteItem}
          hasCategories={!!categories.length}
          categoryTitle={getCategoryTitle}
          formatMoney={formatMoney}
          toNumber={toNumber}
          viewMode={viewMode}
        />
      )}

      {activeTab === "categories" && (
        <MenuCategoriesTab
          loadingCats={loadingCats}
          filteredCats={filteredCategories}
          queryCats={queryCats}
          setQueryCats={setQueryCats}
          onCreateCat={openCreateCategoryModal}
          onEditCat={openEditCategoryModal}
          onDeleteCat={openConfirmDeleteCategory}
        />
      )}

      <MenuItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        setForm={setForm}
        categories={categories}
        kitchens={kitchens}
        warehouse={warehouse}
        onSubmit={saveMenuItem}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onPickImage={handlePickImage}
        addIngredientRow={addIngredientRow}
        changeIngredientRow={updateIngredientRow}
        removeIngredientRow={removeIngredientRow}
        warehouseTitle={getWarehouseTitle}
        warehouseUnit={getWarehouseUnit}
        uiUnitLabel={getUiUnitLabel}
        getWarehouseUnitPrice={getWarehouseUnitPrice}
        formatMoney={formatMoney}
      />

      <MenuCategoryModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        catEditId={catEditId}
        catTitle={catTitle}
        setCatTitle={setCatTitle}
        onSubmit={saveCategoryToAPI}
      />

      {confirmOpen && (
        <div className="cafeMenuConfirm__overlay" onClick={closeConfirmModal}>
          <div className="cafeMenuConfirm__card" onClick={(e) => e.stopPropagation()}>
            <h3 className="cafeMenuConfirm__title">
              {confirmKind === "item" ? "Удалить позицию меню?" : "Удалить категорию?"}
            </h3>
            <p className="cafeMenuConfirm__message">
              {confirmKind === "item"
                ? "Это действие невозможно будет отменить."
                : "Убедитесь, что в этой категории нет блюд."}
            </p>
            <div className="cafeMenuConfirm__actions">
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--secondary"
                onClick={closeConfirmModal}
              >
                Отмена
              </button>
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--danger"
                onClick={confirmDelete}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Menu;
