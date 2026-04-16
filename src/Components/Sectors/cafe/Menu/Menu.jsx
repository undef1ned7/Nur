// src/Components/Sectors/cafe/Menu/Menu.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaListUl, FaThLarge } from "react-icons/fa";
import api from "../../../../api";
import "./Menu.scss";

import MenuHeader from "./components/MenuHeader";
import MenuItemsTab from "./components/MenuItemsTab";
import MenuCategoriesTab from "./components/MenuCategoriesTab";
import MenuCategoryModal from "./components/MenuCategoryModal";
import {
  useAlert,
  useConfirm,
} from "../../../../hooks/useDialog";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { validateResErrors } from "../../../../../tools/validateResErrors";

// Утилиты
const getListFromResponse = (res) => res?.data?.results || res?.data || [];

const PAGE_SIZE = 100;

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

const Menu = () => {
  const confirm = useConfirm();
  const alert = useAlert();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Основное состояние
  const [activeTab, setActiveTab] = useState("items");
  const [viewMode, setViewMode] = useState("cards");

  // Данные из API
  const [categories, setCategories] = useState([]);
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
    [searchParams],
  );

  // Расчет общего количества страниц
  const totalPages = useMemo(
    () => (itemsCount && PAGE_SIZE ? Math.ceil(itemsCount / PAGE_SIZE) : 1),
    [itemsCount],
  );

  const hasNextPage = !!itemsNext;
  const hasPrevPage = !!itemsPrevious;

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

  // Вспомогательные функции для получения данных по ID
  const getCategoryTitle = useCallback(
    (id) => categoriesMap.get(id) || "Без категории",
    [categoriesMap],
  );

  // API методы для загрузки данных
  const fetchCategories = useCallback(async () => {
    const res = await api.get("/cafe/categories/");
    setCategories(getListFromResponse(res));
  }, []);

  const fetchMenuItems = useCallback(async (params = {}) => {
    const res = await api.get("/cafe/menu-items/", {
      params: {
        page: params.page || 1,
        search: params.search || "",
        category: params.category || null,
      },
    });
    const data = res?.data || {};
    setItems(data?.results || (Array.isArray(data) ? data : []));
    setItemsCount(data?.count || data?.length || 0);
    setItemsNext(data?.next || null);
    setItemsPrevious(data?.previous || null);
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
  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage < 1 || (totalPages && newPage > totalPages)) return;
      const params = new URLSearchParams(searchParams);
      if (newPage > 1) {
        params.set("page", newPage.toString());
      } else {
        params.delete("page");
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, totalPages],
  );

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
          category: selectedCategoryFilter || null,
        });
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [
    fetchMenuItems,
    currentPage,
    debouncedItemSearch,
    selectedCategoryFilter,
  ]);

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
      const rootElement = document.getElementById("root");
      if (rootElement) {
        rootElement.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } else {
        // Fallback на window, если root не найден
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    prevItemsRef.current = currentItems;
  }, [items, loadingItems]);

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
    return categories.filter((cat) =>
      (cat.title || "").toLowerCase().includes(query),
    );
  }, [categories, queryCats]);

  const openCreateItemPage = useCallback(() => {
    navigate("/crm/cafe/menu/item/new");
  }, [navigate]);

  const openEditItemPage = useCallback(
    (item) => {
      if (!item?.id) return;
      navigate(`/crm/cafe/menu/item/${encodeURIComponent(String(item.id))}`);
    },
    [navigate],
  );

  const handleDeleteItemSubmit = useCallback((id) => {
    confirm("Вы действительно хотите удалить позицию?", async (result) => {
      if (result) {
        try {
          await api.delete(
            `/cafe/menu-items/${encodeURIComponent(String(id))}/`,
          );
          setItems((prev) => prev.filter((m) => String(m.id) !== String(id)));
        } catch (err) {
          const errorMessage = validateResErrors(
            err,
            "Ошибка при удалении блюда",
          );
          alert(errorMessage, true);
        }
      }
    });
  }, []);

  // Открыть модал подтверждения удаления категории
  const openConfirmDeleteCategory = useCallback((id) => {
    confirm(
      "Вы действительно хотите удалить категорию?\nУбедитесь, что в этой категории нет блюд",
      async (result) => {
        if (result) {
          try {
            await api.delete(
              `/cafe/categories/${encodeURIComponent(String(id))}/`,
            );
            setCategories((prev) =>
              prev.filter((c) => String(c.id) !== String(id)),
            );
          } catch (err) {
            const errorMessage = validateResErrors(
              err,
              "Ошибка при удалении категории",
            );
            alert(errorMessage, true);
          }
        }
      },
    );
  });
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
          payload,
        );
        setCategories((prev) =>
          prev.map((c) => (c.id === catEditId ? res.data : c)),
        );
      } else {
        const res = await api.post("/cafe/categories/", payload);
        setCategories((prev) => [...prev, res.data]);
      }
      setCatModalOpen(false);
    } catch (err) {
      const errorMessage = validateResErrors(
        err,
        "Ошибка при сохранении категории",
      );
      alert(errorMessage, true);
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
          onCreate={openCreateItemPage}
          onEdit={openEditItemPage}
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
