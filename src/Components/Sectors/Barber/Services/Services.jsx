import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FaPlus, FaThLarge, FaList, FaSearch, FaFilter, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import BarberSelect from "../common/BarberSelect";
import { ServiceModal, CategoryModal, Pager } from "./components";
import Loading from "../../../common/Loading/Loading";
import ConfirmModal from "../../../common/ConfirmModal/ConfirmModal";
import {
  fmtMoney,
  mapService,
  mapCategory,
} from "./BarberServicesUtils";
import "./Services.scss";

const SORT_OPTIONS = [
  { value: "name_asc", label: "Название А-Я" },
  { value: "name_desc", label: "Название Я-А" },
  { value: "price_asc", label: "Цена по возр." },
  { value: "price_desc", label: "Цена по убыв." },
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
];

const Services = () => {
  const [mainTab, setMainTab] = useState("services");

  // Server-side список услуг: состояние query
  const [servicesSearch, setServicesSearch] = useState("");
  const [servicesDebouncedSearch, setServicesDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [servicesPage, setServicesPage] = useState(1);

  // Server-side список услуг: состояние данных
  const [services, setServices] = useState([]);
  const [servicesCount, setServicesCount] = useState(0);
  const [servicesNext, setServicesNext] = useState(null);
  const [servicesPrevious, setServicesPrevious] = useState(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");

  // Server-side список категорий: состояние query
  const [categoriesSearch, setCategoriesSearch] = useState("");
  const [categoriesDebouncedSearch, setCategoriesDebouncedSearch] = useState("");
  const [categoriesSortBy, setCategoriesSortBy] = useState("name_asc");
  const [categoriesPage, setCategoriesPage] = useState(1);

  // Server-side список категорий: состояние данных
  const [categories, setCategories] = useState([]);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [categoriesNext, setCategoriesNext] = useState(null);
  const [categoriesPrevious, setCategoriesPrevious] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  // Категории для фильтра услуг (загружаем все один раз)
  const [categoriesForFilter, setCategoriesForFilter] = useState([]);

  // Refs для отмены запросов и защиты от race conditions
  const servicesAbortRef = useRef(null);
  const servicesRequestIdRef = useRef(0);
  const servicesDebounceTimerRef = useRef(null);

  const categoriesAbortRef = useRef(null);
  const categoriesRequestIdRef = useRef(0);
  const categoriesDebounceTimerRef = useRef(null);

  const [viewMode, setViewMode] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);

  // Маппинг сортировки UI -> API
  const getOrderingForAPI = (sortKey) => {
    switch (sortKey) {
      case "name_asc":
        return "name";
      case "name_desc":
        return "-name";
      case "price_asc":
        return "price";
      case "price_desc":
        return "-price";
      case "oldest":
        return "created_at";
      case "newest":
      default:
        return "-created_at";
    }
  };

  // Debounce для services search (400ms)
  useEffect(() => {
    if (servicesDebounceTimerRef.current) {
      clearTimeout(servicesDebounceTimerRef.current);
    }

    servicesDebounceTimerRef.current = setTimeout(() => {
      setServicesDebouncedSearch(servicesSearch);
    }, 400);

    return () => {
      if (servicesDebounceTimerRef.current) {
        clearTimeout(servicesDebounceTimerRef.current);
      }
    };
  }, [servicesSearch]);

  // Debounce для categories search (400ms)
  useEffect(() => {
    if (categoriesDebounceTimerRef.current) {
      clearTimeout(categoriesDebounceTimerRef.current);
    }

    categoriesDebounceTimerRef.current = setTimeout(() => {
      setCategoriesDebouncedSearch(categoriesSearch);
    }, 400);

    return () => {
      if (categoriesDebounceTimerRef.current) {
        clearTimeout(categoriesDebounceTimerRef.current);
      }
    };
  }, [categoriesSearch]);

  // При изменении search/categoryFilter/sortBy -> сброс на page=1 для услуг
  useEffect(() => {
    setServicesPage(1);
  }, [servicesDebouncedSearch, categoryFilter, sortBy]);

  // При изменении search/sortBy -> сброс на page=1 для категорий
  useEffect(() => {
    setCategoriesPage(1);
  }, [categoriesDebouncedSearch, categoriesSortBy]);

  // Fetch услуг с server-side пагинацией
  const fetchServices = useCallback(async () => {
    // Отменяем предыдущий запрос
    if (servicesAbortRef.current) {
      servicesAbortRef.current.abort();
    }

    const controller = new AbortController();
    servicesAbortRef.current = controller;
    const currentRequestId = ++servicesRequestIdRef.current;

    try {
      setServicesLoading(true);
      setServicesError("");

      const params = new URLSearchParams();
      params.append("page", String(servicesPage));

      if (servicesDebouncedSearch.trim()) {
        params.append("search", servicesDebouncedSearch.trim());
      }

      if (categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }

      const ordering = getOrderingForAPI(sortBy);
      params.append("ordering", ordering);

      const { data } = await api.get(`/barbershop/services/?${params.toString()}`, {
        signal: controller.signal,
      });

      // Race condition защита
      if (currentRequestId !== servicesRequestIdRef.current) {
        return;
      }

      const listRaw = Array.isArray(data?.results) ? data.results : [];
      setServices(listRaw.map(mapService));
      setServicesCount(data?.count || 0);
      setServicesNext(data?.next || null);
      setServicesPrevious(data?.previous || null);
    } catch (e) {
      if (e.name === "CanceledError" || e.code === "ERR_CANCELED") {
        return;
      }

      if (currentRequestId !== servicesRequestIdRef.current) {
        return;
      }

      setServicesError(
        e?.response?.data?.detail || "Не удалось загрузить услуги."
      );
      console.error(e);
    } finally {
      if (currentRequestId === servicesRequestIdRef.current) {
        setServicesLoading(false);
      }
    }
  }, [servicesPage, servicesDebouncedSearch, categoryFilter, sortBy]);

  // Fetch категорий с server-side пагинацией
  const fetchCategories = useCallback(async () => {
    // Отменяем предыдущий запрос
    if (categoriesAbortRef.current) {
      categoriesAbortRef.current.abort();
    }

    const controller = new AbortController();
    categoriesAbortRef.current = controller;
    const currentRequestId = ++categoriesRequestIdRef.current;

    try {
      setCategoriesLoading(true);
      setCategoriesError("");

      const params = new URLSearchParams();
      params.append("page", String(categoriesPage));

      if (categoriesDebouncedSearch.trim()) {
        params.append("search", categoriesDebouncedSearch.trim());
      }

      const ordering = categoriesSortBy === "name_desc" ? "-name" : "name";
      params.append("ordering", ordering);

      const { data } = await api.get(`/barbershop/service-categories/?${params.toString()}`, {
        signal: controller.signal,
      });

      // Race condition защита
      if (currentRequestId !== categoriesRequestIdRef.current) {
        return;
      }

      const listRaw = Array.isArray(data?.results) ? data.results : [];
      setCategories(listRaw.map(mapCategory));
      setCategoriesCount(data?.count || 0);
      setCategoriesNext(data?.next || null);
      setCategoriesPrevious(data?.previous || null);
    } catch (e) {
      if (e.name === "CanceledError" || e.code === "ERR_CANCELED") {
        return;
      }

      if (currentRequestId !== categoriesRequestIdRef.current) {
        return;
      }

      setCategoriesError(
        e?.response?.data?.detail || "Не удалось загрузить категории услуг."
      );
      console.error(e);
    } finally {
      if (currentRequestId === categoriesRequestIdRef.current) {
        setCategoriesLoading(false);
      }
    }
  }, [categoriesPage, categoriesDebouncedSearch, categoriesSortBy]);

  // Fetch категорий для фильтра (все категории, один раз)
  const fetchCategoriesForFilter = useCallback(async () => {
    try {
      const { data } = await api.get("/barbershop/service-categories/?page_size=1000");
      const listRaw = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setCategoriesForFilter(listRaw.map(mapCategory));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Загрузка категорий для фильтра при монтировании
  useEffect(() => {
    fetchCategoriesForFilter();
  }, [fetchCategoriesForFilter]);

  // Загрузка услуг только на вкладке "services"
  useEffect(() => {
    if (mainTab === "services") {
      fetchServices();
    }

    return () => {
      if (servicesAbortRef.current) {
        servicesAbortRef.current.abort();
      }
    };
  }, [mainTab, fetchServices]);

  // Загрузка категорий только на вкладке "categories"
  useEffect(() => {
    if (mainTab === "categories") {
      fetchCategories();
    }

    return () => {
      if (categoriesAbortRef.current) {
        categoriesAbortRef.current.abort();
      }
    };
  }, [mainTab, fetchCategories]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Все категории" },
      ...categoriesForFilter.map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    ],
    [categoriesForFilter]
  );

  const isServicesTab = mainTab === "services";

  const counterText = isServicesTab
    ? servicesCount > 0
      ? `${servicesCount} ${servicesCount === 1 ? "услуга" : servicesCount < 5 ? "услуги" : "услуг"}`
      : "0 услуг"
    : `${categories.length} ${categories.length === 1 ? "категория" : categories.length < 5 ? "категории" : "категорий"}`;

  const activeFiltersCount = [
    categoryFilter !== "all" ? categoryFilter : null,
    sortBy !== "newest" ? sortBy : null,
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setCategoryFilter("all");
    setSortBy("newest");
  };

  const openServiceModal = (service = null) => {
    setCurrentService(service);
    setServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setServiceModalOpen(false);
    setCurrentService(null);
  };

  const openCategoryModal = (category = null) => {
    setCurrentCategory(category);
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setCurrentCategory(null);
  };

  const handleServiceSaved = () => {
    fetchServices();
    fetchCategoriesForFilter();
    closeServiceModal();
  };

  const handleServiceDeleted = () => {
    fetchServices();
    closeServiceModal();
  };

  const handleCategorySaved = () => {
    fetchCategories();
    fetchCategoriesForFilter();
    closeCategoryModal();
  };

  const handleCategoryDeleted = () => {
    fetchCategories();
    fetchCategoriesForFilter();
    closeCategoryModal();
  };

  const formatDuration = (time) => {
    if (!time) return "—";
    const num = parseInt(time, 10);
    if (!isNaN(num) && String(num) === String(time).trim()) {
      return `${num} мин`;
    }
    return time;
  };

  const renderServiceCard = (s) => (
    <article
      key={s.id}
      className={`barberservices__card ${
        s.active
          ? "barberservices__card--active"
          : "barberservices__card--inactive"
      }`}
      onClick={() => openServiceModal(s)}
    >
      <div className="barberservices__info">
        <h4 className="barberservices__name">{s.name}</h4>
        <div className="barberservices__meta">
          <span className="barberservices__price">{fmtMoney(s.price)}</span>
          {s.time && (
            <span className="barberservices__tag">
              {formatDuration(s.time)}
            </span>
          )}
          <span className="barberservices__cat">
            {s.categoryName || "Без категории"}
          </span>
        </div>
      </div>
    </article>
  );

  const renderServiceTable = () => (
    <div className="barberservices__tableWrap">
      <table className="barberservices__table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Цена</th>
            <th>Длительность</th>
            <th>Категория</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr 
              key={s.id} 
              className={`barberservices__row ${!s.active ? "barberservices__row--inactive" : ""}`}
              onClick={() => openServiceModal(s)}
            >
              <td className="barberservices__cellName">{s.name}</td>
              <td className="barberservices__cellPrice">{fmtMoney(s.price)}</td>
              <td>{formatDuration(s.time)}</td>
              <td>{s.categoryName || "Без категории"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="barberservices">
      <div className="barberservices__tabs-wrap">
        <div
          className="barberservices__tabs"
          role="tablist"
          aria-label="Разделы"
        >
          <button
            className={`barberservices__tab ${isServicesTab ? "is-active" : ""}`}
            role="tab"
            aria-selected={isServicesTab}
            onClick={() => setMainTab("services")}
          >
            Услуги
          </button>
          <button
            className={`barberservices__tab ${!isServicesTab ? "is-active" : ""}`}
            role="tab"
            aria-selected={!isServicesTab}
            onClick={() => setMainTab("categories")}
          >
            Категории
          </button>
        </div>
      </div>

      <div className="barberservices__counter">{counterText}</div>

      <div className="barberservices__actions">
        <div className="barberservices__searchWrap">
          <FaSearch className="barberservices__searchIcon" />
          <input
            className="barberservices__searchInput"
            placeholder={isServicesTab ? "Поиск услуги..." : "Поиск категории..."}
            value={isServicesTab ? servicesSearch : categoriesSearch}
            onChange={(e) => isServicesTab ? setServicesSearch(e.target.value) : setCategoriesSearch(e.target.value)}
            aria-label="Поиск"
          />
        </div>

        {isServicesTab && (
          <>
            <div className="barberservices__filtersWrap">
              <button
                type="button"
                className={`barberservices__filtersBtn ${filtersOpen ? "is-open" : ""} ${activeFiltersCount > 0 ? "has-active" : ""}`}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <FaFilter />
                <span>Фильтры</span>
                {activeFiltersCount > 0 && (
                  <span className="barberservices__filtersBadge">{activeFiltersCount}</span>
                )}
              </button>
            </div>

            <div className="barberservices__viewToggle">
              <button
                className={`barberservices__viewBtn ${viewMode === "table" ? "is-active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Таблица"
                aria-label="Вид таблицей"
              >
                <FaList />
              </button>
              <button
                className={`barberservices__viewBtn ${viewMode === "cards" ? "is-active" : ""}`}
                onClick={() => setViewMode("cards")}
                title="Карточки"
                aria-label="Вид карточками"
              >
                <FaThLarge />
              </button>
            </div>
          </>
        )}

        <button
          className="barberservices__btn barberservices__btn--primary barberservices__btn--icon"
          onClick={() => isServicesTab ? openServiceModal() : openCategoryModal()}
          aria-label={isServicesTab ? "Добавить услугу" : "Добавить категорию"}
          title={isServicesTab ? "Добавить услугу" : "Добавить категорию"}
        >
          <FaPlus />
        </button>
      </div>

      {/* Модальное окно фильтров */}
      {filtersOpen && (
        <>
          <div className="barberservices__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barberservices__filtersPanel">
            <div className="barberservices__filtersPanelHeader">
              <span className="barberservices__filtersPanelTitle">Фильтры</span>
              <button
                type="button"
                className="barberservices__filtersPanelClose"
                onClick={() => setFiltersOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberservices__filtersPanelBody">
              <div className="barberservices__filtersPanelRow">
                <label className="barberservices__filtersPanelLabel">Категория</label>
                <BarberSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categoryOptions}
                  placeholder="Все категории"
                />
              </div>

              <div className="barberservices__filtersPanelRow">
                <label className="barberservices__filtersPanelLabel">Сортировка</label>
                <BarberSelect
                  value={sortBy}
                  onChange={setSortBy}
                  options={SORT_OPTIONS}
                  placeholder="Сортировка"
                />
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="barberservices__filtersPanelFooter">
                <button
                  type="button"
                  className="barberservices__filtersPanelClear"
                  onClick={handleClearFilters}
                >
                  Очистить фильтры
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {servicesError && !serviceModalOpen && isServicesTab && (
        <div className="barberservices__alert">{servicesError}</div>
      )}
      {categoriesError && !categoryModalOpen && !isServicesTab && (
        <div className="barberservices__alert">{categoriesError}</div>
      )}

      {isServicesTab && (
        <>
          {servicesLoading ? (
            <Loading message="Загрузка услуг..." />
          ) : services.length === 0 ? (
            <div className="barberservices__empty">
              {servicesDebouncedSearch || categoryFilter !== "all"
                ? "Ничего не найдено"
                : "Нет услуг. Добавьте первую!"}
            </div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div className="barberservices__list">
                  {services.map(renderServiceCard)}
                </div>
              ) : (
                renderServiceTable()
              )}

              <Pager
                count={servicesCount}
                page={servicesPage}
                hasNext={!!servicesNext}
                hasPrevious={!!servicesPrevious}
                onChange={setServicesPage}
              />
            </>
          )}
        </>
      )}

      {!isServicesTab && (
        <>
          {categoriesLoading ? (
            <Loading message="Загрузка категорий..." />
          ) : categories.length === 0 ? (
            <div className="barberservices__empty">
              {categoriesDebouncedSearch
                ? "Ничего не найдено"
                : "Нет категорий. Добавьте первую!"}
            </div>
          ) : (
            <>
              <div className="barberservices__list">
                {categories.map((c) => (
                  <article
                    key={c.id}
                    className={`barberservices__card ${
                      c.active
                        ? "barberservices__card--active"
                        : "barberservices__card--inactive"
                    }`}
                    onClick={() => openCategoryModal(c)}
                  >
                    <div className="barberservices__info">
                      <h4 className="barberservices__name">{c.name}</h4>
                    </div>
                  </article>
                ))}
              </div>

              <Pager
                count={categoriesCount}
                page={categoriesPage}
                hasNext={!!categoriesNext}
                hasPrevious={!!categoriesPrevious}
                onChange={setCategoriesPage}
              />
            </>
          )}
        </>
      )}

      {serviceModalOpen && (
        <ServiceModal
          isOpen={serviceModalOpen}
          currentService={currentService}
          categories={categoriesForFilter}
          services={services}
          onClose={closeServiceModal}
          onSaved={handleServiceSaved}
          onDeleted={handleServiceDeleted}
        />
      )}

      {categoryModalOpen && (
        <CategoryModal
          isOpen={categoryModalOpen}
          currentCategory={currentCategory}
          categories={categories}
          onClose={closeCategoryModal}
          onSaved={handleCategorySaved}
          onDeleted={handleCategoryDeleted}
        />
      )}
    </div>
  );
};

export default Services;
