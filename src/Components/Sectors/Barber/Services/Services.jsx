import React, { useEffect, useMemo, useState } from "react";
import { FaPlus, FaThLarge, FaList, FaSearch, FaFilter, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import BarberSelect from "../common/BarberSelect";
import { ServiceModal, CategoryModal, Pager } from "./components";
import {
  PAGE_SIZE,
  fmtMoney,
  mapService,
  mapCategory,
  categorySorter,
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

  const [services, setServices] = useState([]);
  const [pageError, setPageError] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("table"); // "cards" | "table"

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setPageError("");
      const { data } = await api.get("/barbershop/services/");
      const listRaw = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setServices(listRaw.map(mapService));
    } catch (e) {
      setPageError(
        e?.response?.data?.detail || "Не удалось загрузить услуги."
      );
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCategoriesError("");
      const { data } = await api.get("/barbershop/service-categories/");
      const listRaw = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];
      setCategories(listRaw.map(mapCategory));
    } catch (e) {
      setCategoriesError(
        e?.response?.data?.detail || "Не удалось загрузить категории услуг."
      );
      console.error(e);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, services.length, mainTab, categoryFilter, sortBy]);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Все категории" },
      ...categories.map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    ],
    [categories]
  );

  const sortServices = (arr, sortKey) => {
    const sorted = [...arr];
    switch (sortKey) {
      case "name_asc":
        return sorted.sort((a, b) => 
          (a.name || "").localeCompare(b.name || "", "ru")
        );
      case "name_desc":
        return sorted.sort((a, b) => 
          (b.name || "").localeCompare(a.name || "", "ru")
        );
      case "price_asc":
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case "price_desc":
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      case "oldest":
        return sorted.sort((a, b) => {
          const ad = new Date(a.createdAt || 0).getTime();
          const bd = new Date(b.createdAt || 0).getTime();
          return ad - bd;
        });
      case "newest":
      default:
        return sorted.sort((a, b) => {
          const ad = new Date(a.createdAt || 0).getTime();
          const bd = new Date(b.createdAt || 0).getTime();
          return bd - ad;
        });
    }
  };

  const servicesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = services;

    if (categoryFilter !== "all") {
      base = base.filter(
        (s) => String(s.categoryId) === String(categoryFilter)
      );
    }

    const arr = q
      ? base.filter((s) => {
          const catLabel = (s.categoryName || "").toLowerCase();
          return (
            (s.name || "").toLowerCase().includes(q) ||
            String(s.price).toLowerCase().includes(q) ||
            (s.time || "").toLowerCase().includes(q) ||
            catLabel.includes(q)
          );
        })
      : base.slice();

    return sortServices(arr, sortBy);
  }, [services, search, categoryFilter, sortBy]);

  const categoriesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = q
      ? categories.filter((c) => (c.name || "").toLowerCase().includes(q))
      : categories.slice();

    arr.sort(categorySorter);
    return arr;
  }, [categories, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(servicesFiltered.length / PAGE_SIZE)
  );
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const pageSlice = servicesFiltered.slice(startIdx, startIdx + PAGE_SIZE);

  const isServicesTab = mainTab === "services";

  const activeServicesCount = services.filter(s => s.active).length;
  const counterText = isServicesTab
    ? `${activeServicesCount} активных из ${services.length}`
    : `${categories.length} категорий`;

  // Считаем активные фильтры
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
    closeServiceModal();
  };

  const handleServiceDeleted = () => {
    fetchServices();
    closeServiceModal();
  };

  const handleCategorySaved = () => {
    fetchCategories();
    closeCategoryModal();
  };

  const handleCategoryDeleted = () => {
    fetchCategories();
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
          {pageSlice.map((s) => (
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {pageError && !serviceModalOpen && isServicesTab && (
        <div className="barberservices__alert">{pageError}</div>
      )}
      {categoriesError && !categoryModalOpen && !isServicesTab && (
        <div className="barberservices__alert">{categoriesError}</div>
      )}

      {isServicesTab && (
        <>
          {loading ? (
            <div className="barberservices__skeletonList" aria-hidden="true">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="barberservices__skeletonCard" />
              ))}
            </div>
          ) : servicesFiltered.length === 0 ? (
            <div className="barberservices__empty">
              {search || categoryFilter !== "all"
                ? "Ничего не найдено"
                : "Нет услуг. Добавьте первую!"}
            </div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div className="barberservices__list">
                  {pageSlice.map(renderServiceCard)}
                </div>
              ) : (
                renderServiceTable()
              )}

              <Pager
                filteredCount={servicesFiltered.length}
                page={pageSafe}
                totalPages={totalPages}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      {!isServicesTab && (
        <>
          {loading ? (
            <div className="barberservices__skeletonList" aria-hidden="true">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="barberservices__skeletonCard" />
              ))}
            </div>
          ) : categoriesFiltered.length === 0 ? (
            <div className="barberservices__empty">
              {search ? "Ничего не найдено" : "Нет категорий. Добавьте первую!"}
            </div>
          ) : (
            <div className="barberservices__list">
              {categoriesFiltered.map((c) => (
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
                    <div className="barberservices__meta">
                      <span className="barberservices__catCount">
                        {services.filter(s => String(s.categoryId) === String(c.id)).length} услуг
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {serviceModalOpen && (
        <ServiceModal
          isOpen={serviceModalOpen}
          currentService={currentService}
          categories={categories}
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
