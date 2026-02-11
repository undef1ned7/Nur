// src/Components/Sectors/cafe/Menu/Menu.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FaListUl, FaThLarge } from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

import MenuHeader from "./components/MenuHeader";
import MenuItemsTab from "./components/MenuItemsTab";
import MenuCategoriesTab from "./components/MenuCategoriesTab";
import MenuItemModal from "./components/MenuItemModal";
import MenuCategoryModal from "./components/MenuCategoryModal";
import { useAlert, useConfirm, useErrorModal } from "../../../../hooks/useDialog";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { validateResErrors } from "../../../../../tools/validateResErrors";

// Утилиты
const getListFromResponse = (res) => res?.data?.results || res?.data || [];

const PAGE_SIZE = 50;

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
  const confirm = useConfirm()
  const alert = useAlert()
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Основное состояние
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("cards");

  // Данные из API
  const [categories, setCategories] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [items, setItems] = useState([]);
  
  // Данные пагинации
  const [itemsCount, setItemsCount] = useState(0);
  const [itemsNext, setItemsNext] = useState(null);
  const [itemsPrevious, setItemsPrevious] = useState(null);
  
  // Refs для отслеживания изменений данных
  const isInitialMountRef = useRef(true);
  const prevItemsRef = useRef([]);

  // Состояние загрузки
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);

  // Фильтры и поиск
  const [queryItems, setQueryItems] = useState("");
  const debouncedItemSearch = useDebouncedValue(queryItems, 400);
  const [queryCats, setQueryCats] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  
  // Получаем текущую страницу из URL
  const currentPage = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );
  
  // Расчет общего количества страниц
  const totalPages = useMemo(
    () => (itemsCount && PAGE_SIZE ? Math.ceil(itemsCount / PAGE_SIZE) : 1),
    [itemsCount]
  );
  
  const hasNextPage = !!itemsNext;
  const hasPrevPage = !!itemsPrevious;

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
      const label = `${title}${number !== undefined && number !== null && number !== "" ? ` №${number}` : ""
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
  const getCategoryTitle = useCallback((id) => categoriesMap.get(id) || "Без категории", [categoriesMap]);
  // const getKitchenTitle = useCallback((id) => kitchensMap.get(id) || "", [kitchensMap]);
  // const getProductTitle = useCallback((id) => warehouseMap.get(id)?.title || id || "", [warehouseMap]);
  // const getProductUnit = useCallback((id) => warehouseMap.get(id)?.unit || "", [warehouseMap]);

  // API методы для загрузки данных
  const fetchCategories = useCallback(async () => {
    const res = await api.get("/cafe/categories/");
    setCategories(getListFromResponse(res));
  }, []);

  const fetchKitchens = useCallback(async () => {
    const res = await api.get("/cafe/kitchens/");
    setKitchens(getListFromResponse(res));
  }, []);

  const fetchWarehouse = useCallback(async () => {
    const res = await api.get("/cafe/warehouse/");
    setWarehouse(getListFromResponse(res));
  }, []);

  const fetchMenuItems = useCallback(async (params = {}) => {
    const res = await api.get("/cafe/menu-items/", {
      params: {
        page: params.page || 1,
        search: params.search || "",
        category: params.category || null,
      }
    });
    const data = res?.data || {};
    setItems(data?.results || (Array.isArray(data) ? data : []));
    setItemsCount(data?.count || data?.length || 0);
    setItemsNext(data?.next || null);
    setItemsPrevious(data?.previous || null);
  }, []);

  const fetchMenuItemDetail = useCallback(async (id) => {
    if (!id) return null;
    try {
      const res = await api.get(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
      return res?.data || null;
    } catch (err) {
      return null;
    }
  }, []);

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

  // Синхронизация URL с состоянием страницы
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    } else {
      params.delete("page");
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams]);

  // Обработчик смены страницы
  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    const params = new URLSearchParams(searchParams);
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, totalPages]);

  // Сброс на первую страницу при изменении поиска или фильтра
  useEffect(() => {
    if (currentPage > 1) {
      const params = new URLSearchParams(searchParams);
      params.delete("page");
      setSearchParams(params, { replace: true });
    }
  }, [debouncedItemSearch, selectedCategoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Загрузка блюд при монтировании и изменении параметров
  useEffect(() => {
    (async () => {
      try {
        setLoadingItems(true);
        await fetchMenuItems({
          page: currentPage,
          search: debouncedItemSearch,
          category: selectedCategoryFilter || null
        });
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [fetchMenuItems, currentPage, debouncedItemSearch, selectedCategoryFilter]);

  // Плавно прокручиваем страницу вверх при изменении данных блюд
  useEffect(() => {
    if (loadingItems) return;
    // Пропускаем первый рендер
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevItemsRef.current = items || [];
      return;
    }

    // Проверяем, что блюда изменились (новый запрос)
    const prevItems = prevItemsRef.current;
    const currentItems = items || [];

    // Сравниваем первые блюда - если они разные, значит новый запрос
    const isNewData =
      prevItems.length > 0 &&
      currentItems.length > 0 &&
      prevItems[0]?.id !== currentItems[0]?.id;

    if (isNewData) {
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        // Fallback на window, если root не найден
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    prevItemsRef.current = currentItems;
  }, [items, loadingItems]);

  // Очистка URL при размонтировании
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Фильтрованные списки
  // const filteredItems = useMemo(() => {
  //   let filtered = items;

  //   // Фильтр по категории
  //   // if (selectedCategoryFilter) {
  //   //   filtered = filtered.filter(
  //   //     (item) => String(item?.category || "") === String(selectedCategoryFilter)
  //   //   );
  //   // }

  //   // Фильтр по поисковому запросу
  //   // const query = queryItems.trim().toLowerCase();
  //   // if (query) {
  //   //   filtered = filtered.filter((item) => {
  //   //     const title = (item.title || "").toLowerCase();
  //   //     const category = getCategoryTitle(item.category).toLowerCase();
  //   //     const kitchen = getKitchenTitle(item.kitchen).toLowerCase();
  //   //     return title.includes(query) || category.includes(query) || kitchen.includes(query);
  //   //   });
  //   // }

  //   return filtered;
  // }, [items, categoriesMap, kitchensMap]);

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
      alert(validateResErrors(err, 'Произошла ошибка при сохранении блюда'), true)
      // Ошибка сохранения
    }
  };

  const handleDeleteItemSubmit = useCallback((id) => {
    confirm('Вы действительно хотите удалить позицию?', async (result) => {
      if (result) {
        try {
          await api.delete(`/cafe/menu-items/${encodeURIComponent(String(id))}/`);
          setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
        } catch (err) {
          console.log(err);
          if (err.status === 404) {
            alert('Не удалось найти такую позицию!', true)
          } else if (rr?.response?.data?.detail) {
            alert(err?.response?.data?.detail, true)
          } else {
            alert(
              'Произошла ошибка при удалении позиции!', true)
          }
        }
      }
    })
  }, [])

  // Открыть модал подтверждения удаления категории
  const openConfirmDeleteCategory = useCallback((id) => {
    confirm('Вы действительно хотите удалить категорию?\nУбедитесь, что в этой категории нет блюд', async (result) => {
      if (result) {
        try {
          await api.delete(`/cafe/categories/${encodeURIComponent(String(id))}/`);
          setCategories((prev) => prev.filter((c) => String(c.id) !== String(id)));
        } catch (err) {
          if (err.status === 404) {
            alert('Не удалось найти такую категорию!', true)
          } else if (err?.response?.data?.detail && err.status < 500) {
            alert(err?.response?.data?.detail, true)
          } else {
            alert(
              'Произошла ошибка при удалении категории!', true)
          }
        }
      }
    })

  });
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
          filteredItems={items}
          queryItems={queryItems}
          setQueryItems={setQueryItems}
          categories={categories}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
          onCreate={openCreateItemModal}
          onEdit={openEditItemModal}
          onDelete={handleDeleteItemSubmit}
          hasCategories={!!categories.length}
          categoryTitle={getCategoryTitle}
          formatMoney={formatMoney}
          toNumber={toNumber}
          viewMode={viewMode}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsCount={itemsCount}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
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
    </section>
  );
};

export default Menu;