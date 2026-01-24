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

// Утилиты
const getListFromResponse = (res) => res?.data?.results || res?.data || [];

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const num = Number(String(value).replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (value) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const numberToString = (value) => String(Number(value) || 0).replace(",", ".");

const normalizeDecimalValue = (value) => {
  const cleaned = String(value ?? "").replace(",", ".");
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : null;
};

const Menu = () => {
  // Основное состояние
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("cards");

  // Данные из API
  const [categories, setCategories] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [items, setItems] = useState([]);

  // Состояние загрузки
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  // Фильтры и поиск
  const [queryItems, setQueryItems] = useState("");
  const [queryCats, setQueryCats] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Модал для блюд
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    kitchen: "",
    price: "0",
    is_active: true,
    ingredients: [],
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Модал для категорий
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState(null);
  const [catTitle, setCatTitle] = useState("");

  // Модал подтверждения удаления
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState(""); // "item" | "cat"
  const [confirmId, setConfirmId] = useState(null);

  // Memoized maps для быстрого поиска
  const categoriesMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.id, cat.title));
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
      map.set(kitchen.id, label);
    });
    return map;
  }, [kitchens]);

  const warehouseMap = useMemo(() => {
    const map = new Map();
    warehouse.forEach((item) => map.set(item.id, item));
    return map;
  }, [warehouse]);

  // Вспомогательные функции для получения данных по ID
  const getCategoryTitle = (id) => categoriesMap.get(id) || "Без категории";
  const getKitchenTitle = (id) => kitchensMap.get(id) || "";
  const getProductTitle = (id) => warehouseMap.get(id)?.title || id || "";
  const getProductUnit = (id) => warehouseMap.get(id)?.unit || "";

  // API методы для загрузки данных
  const fetchCategories = async () => {
    const res = await api.get("/cafe/categories/");
    setCategories(getListFromResponse(res));
  };

  const fetchKitchens = async () => {
    const res = await api.get("/cafe/kitchens/");
    setKitchens(getListFromResponse(res));
  };

  const fetchWarehouse = async () => {
    const res = await api.get("/cafe/warehouse/");
    setWarehouse(getListFromResponse(res));
  };

  const fetchMenuItems = async () => {
    const res = await api.get("/cafe/menu-items/");
    setItems(getListFromResponse(res));
  };

  const fetchMenuItemDetail = async (id) => {
    if (!id) return null;
    try {
      const res = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      return res?.data || null;
    } catch (err) {
      return null;
    }
  };

  // Загрузка категорий при монтировании
  useEffect(() => {
    (async () => {
      try {
        setLoadingCats(true);
        await fetchCategories();
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  // Загрузка кухонь при монтировании
  useEffect(() => {
    (async () => {
      try {
        await fetchKitchens();
      } catch (err) {
        // Ошибка загрузки кухонь - продолжаем работу
      }
    })();
  }, []);

  // Загрузка склада при монтировании
  useEffect(() => {
    (async () => {
      try {
        await fetchWarehouse();
      } catch (err) {
        // Ошибка загрузки склада - продолжаем работу
      }
    })();
  }, []);

  // Загрузка блюд при монтировании
  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        await fetchMenuItems();
      } finally {
        setLoadingItems(false);
      }
    })();
  }, []);

  // Очистка URL при размонтировании
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Фильтрованные списки
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Фильтр по категории
    if (selectedCategoryFilter) {
      filtered = filtered.filter(
        (item) => String(item?.category || "") === String(selectedCategoryFilter)
      );
    }

    // Фильтр по поисковому запросу
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

  // Открытие модала создания блюда
  const openCreateItemModal = () => {
    setEditingId(null);
    setForm({
      title: "",
      category: categories[0]?.id || "",
      kitchen: "",
      price: "0",
      is_active: true,
      ingredients: [],
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  // Открытие модала редактирования блюда
  const openEditItemModal = async (item) => {
    const baseId = item?.id;
    let fullItem = item;

    if (!Array.isArray(item?.ingredients)) {
      const detail = await fetchMenuItemDetail(baseId);
      if (detail) fullItem = detail;
    }

    setEditingId(fullItem.id);
    setForm({
      title: fullItem.title || "",
      category: fullItem.category || categories[0]?.id || "",
      kitchen: fullItem.kitchen ? String(fullItem.kitchen) : "",
      price: String(fullItem.price ?? "0").replace(",", "."),
      is_active: !!fullItem.is_active,
      ingredients: Array.isArray(fullItem.ingredients)
        ? fullItem.ingredients.map((ing) => ({
            product: ing.product,
            amount: String(ing.amount ?? "").replace(",", "."),
          }))
        : [],
    });

    setImageFile(null);
    setImagePreview(fullItem.image_url || "");
    setModalOpen(true);
  };

  // Выбор изображения
  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Построение payload для сохранения
  const buildFormPayload = () => {
    const payload = {
      title: (form.title || "").trim(),
      category: form.category,
      kitchen: form.kitchen ? form.kitchen : null,
      price: numberToString(
        Math.max(0, Number(String(form.price ?? "0").replace(",", ".")) || 0)
      ),
      is_active: !!form.is_active,
      ingredients: (form.ingredients || [])
        .filter((row) => row && row.product && String(row.amount || "").trim() !== "")
        .map((row) => ({
          product: row.product,
          amount: numberToString(
            Math.max(0, Number(String(row.amount).replace(",", ".")) || 0)
          ),
        })),
    };

    if (!payload.title || !payload.category) return null;
    return payload;
  };

  // Загрузка изображения отдельно
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
      try {
        const payload = buildFormPayload();
        if (!payload) return false;

        const formData2 = new FormData();
        formData2.append("title", payload.title);
        formData2.append("category", payload.category);
        if (payload.kitchen) formData2.append("kitchen", payload.kitchen);
        formData2.append("price", payload.price);
        formData2.append("is_active", payload.is_active ? "true" : "false");
        formData2.append("ingredients", JSON.stringify(payload.ingredients));
        formData2.append("image", imageFile);

        await api.put(`/cafe/menu-items/${encodeURIComponent(String(id))}/`, formData2, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        return true;
      } catch (err2) {
        return false;
      }
    }
  };

  // Сохранение блюда
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

      if (imageFile && savedId) {
        await uploadImage(savedId);
      }

      const fullItem = savedId ? await fetchMenuItemDetail(savedId) : null;
      const finalItem = fullItem || saved;

      if (finalItem?.id) {
        setItems((prev) => {
          const exists = prev.some((m) => String(m.id) === String(finalItem.id));
          if (!exists) return [...prev, finalItem];
          return prev.map((m) => (String(m.id) === String(finalItem.id) ? finalItem : m));
        });
      } else {
        await fetchMenuItems();
      }

      setModalOpen(false);

      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      // Ошибка сохранения
    }
  };

  // Открыть модал подтверждения удаления блюда
  const openConfirmDeleteItem = (id) => {
    setConfirmKind("item");
    setConfirmId(id);
    setConfirmOpen(true);
  };

  // Открыть модал подтверждения удаления категории
  const openConfirmDeleteCategory = (id) => {
    setConfirmKind("cat");
    setConfirmId(id);
    setConfirmOpen(true);
  };

  // Закрыть модал подтверждения
  const closeConfirmModal = () => {
    setConfirmOpen(false);
    setConfirmKind("");
    setConfirmId(null);
  };

  // Выполнить удаление
  const confirmDelete = async () => {
    const id = confirmId;
    const kind = confirmKind;

    closeConfirmModal();
    if (!id || !kind) return;

    try {
      if (kind === "item") {
        await api.delete(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
        setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
        return;
      }

      if (kind === "cat") {
        await api.delete(`/cafe/categories/${encodeURIComponent(String(id))}/`);
        setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
      }
    } catch (err) {
      // Ошибка удаления
    }
  };

  // Управление ингредиентами
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

  // Управление категориями
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
        setCategories((prev) => prev.map((c) => (c.id === catEditId ? res.data : c)));
      } else {
        const res = await api.post("/cafe/categories/", payload);
        setCategories((prev) => [...prev, res.data]);
      }
      setCatModalOpen(false);
    } catch (err) {
      // Ошибка сохранения категории
    }
  };

  const isItemsTab = activeTab === "items";

  return (
    <section className="cafeMenu">
      {/* Верхняя строка: Header + Переключатель видов */}
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

      {/* Вкладка с блюдами */}
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

      {/* Вкладка с категориями */}
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

      {/* Модал для создания/редактирования блюда */}
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
      />

      {/* Модал для создания/редактирования категории */}
      <MenuCategoryModal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        catEditId={catEditId}
        catTitle={catTitle}
        setCatTitle={setCatTitle}
        onSubmit={saveCategoryToAPI}
      />

      {/* Модал подтверждения удаления */}
      {confirmOpen && (
        <div className="cafeMenuconfirm__overlay" onClick={closeConfirmModal}>
          <div className="cafeMenuconfirm__card" onClick={(e) => e.stopPropagation()}>
            <h3 className="cafeMenuconfirm__title">
              {confirmKind === "item" ? "Удалить позицию меню?" : "Удалить категорию?"}
            </h3>
            <p className="cafeMenuconfirm__message">
              {confirmKind === "item"
                ? "Это действие невозможно будет отменить"
                : "Убедитесь, что в этой категории нет блюд"}
            </p>
            <div className="cafeMenuconfirm__actions">
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