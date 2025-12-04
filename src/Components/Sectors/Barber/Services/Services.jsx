// Services.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Services.scss";
import { FaPlus, FaEdit, FaSearch } from "react-icons/fa";
import api from "../../../../api";
import ServiceModal from "./ServiceModal";
import CategoryModal from "./CategoryModal";

import {
  PAGE_SIZE,
  fmtMoney,
  mapService,
  mapCategory,
  serviceSorter,
  categorySorter,
} from "./BarberServicesUtils";

import BarberServicesSelect from "./BarberServicesSelect";
import BarberServicesPager from "./BarberServicesPager";

const Services = () => {
  const [mainTab, setMainTab] = useState("services"); // "services" | "categories"

  // услуги
  const [services, setServices] = useState([]);
  const [pageError, setPageError] = useState("");

  // категории
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");

  // общие фильтры / поиск
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [categoryFilter, setCategoryFilter] = useState("all"); // all | <categoryId>

  // загрузка
  const [loading, setLoading] = useState(true);

  // пагинация
  const [page, setPage] = useState(1);
  const [lastAddedId, setLastAddedId] = useState(null);

  // модалки
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);

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
        e?.response?.data?.detail ||
          "Не удалось загрузить категории услуг."
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
  }, [search, services.length, mainTab, statusFilter, categoryFilter]);

  const servicesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = services;

    if (statusFilter === "active") base = base.filter((s) => s.active);
    if (statusFilter === "inactive") base = base.filter((s) => !s.active);

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

    arr.sort(serviceSorter(lastAddedId));
    return arr;
  }, [services, search, statusFilter, categoryFilter, lastAddedId]);

  const categoriesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = categories;

    if (statusFilter === "active") base = base.filter((c) => c.active);
    if (statusFilter === "inactive") base = base.filter((c) => !c.active);

    const arr = q
      ? base.filter((c) => (c.name || "").toLowerCase().includes(q))
      : base.slice();

    arr.sort(categorySorter);
    return arr;
  }, [categories, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(servicesFiltered.length / PAGE_SIZE)
  );
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const pageSlice = servicesFiltered.slice(
    startIdx,
    startIdx + PAGE_SIZE
  );

  const isServicesTab = mainTab === "services";

  const counterText = isServicesTab
    ? `${services.length} услуг`
    : `${categories.length} категорий`;

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

  const handleServiceSaved = (createdId = null) => {
    if (createdId) setLastAddedId(createdId);
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

  return (
    <div className="barberservices">
      {/* Табы */}
      <div
        className="barberservices__tabs"
        role="tablist"
        aria-label="Разделы"
      >
        <button
          className={`barberservices__tab ${
            isServicesTab ? "is-active" : ""
          }`}
          role="tab"
          aria-selected={isServicesTab}
          onClick={() => setMainTab("services")}
        >
          Услуга
        </button>
        <button
          className={`barberservices__tab ${
            !isServicesTab ? "is-active" : ""
          }`}
          role="tab"
          aria-selected={!isServicesTab}
          onClick={() => setMainTab("categories")}
        >
          Категория
        </button>
      </div>

      {/* счётчик */}
      <div className="barberservices__counter">{counterText}</div>

      {/* Поиск + фильтры + плюс */}
      <div
        className={`barberservices__actions ${
          isServicesTab ? "barberservices__actions--withCat" : ""
        }`}
      >
        <div className="barberservices__search">
          <FaSearch className="barberservices__searchIcon" />
          <input
            className="barberservices__searchInput"
            placeholder={
              isServicesTab
                ? "Поиск по названию, цене, длит..."
                : "Поиск по названию категории"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск"
          />
        </div>

        {isServicesTab && (
          <div
            className="barberservices__filter"
            aria-label="Фильтр по категории"
          >
            <BarberServicesSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              ariaLabel="Фильтр по категории"
              options={[
                { value: "all", label: "Все категории" },
                ...categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                })),
              ]}
            />
          </div>
        )}

        <div
          className="barberservices__filter"
          aria-label="Фильтр по активности"
        >
          <BarberServicesSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Фильтр по статусу"
            options={[
              { value: "all", label: "Все статусы" },
              { value: "active", label: "Активна" },
              { value: "inactive", label: "Неактивна" },
            ]}
          />
        </div>

        <button
          className="barberservices__btn barberservices__btn--primary barberservices__btn--icon"
          onClick={() =>
            isServicesTab ? openServiceModal() : openCategoryModal()
          }
          aria-label={
            isServicesTab ? "Добавить услугу" : "Добавить категорию"
          }
          title={
            isServicesTab ? "Добавить услугу" : "Добавить категорию"
          }
        >
          <FaPlus />
        </button>
      </div>

      {pageError && !serviceModalOpen && isServicesTab && (
        <div className="barberservices__alert">{pageError}</div>
      )}
      {categoriesError && !categoryModalOpen && !isServicesTab && (
        <div className="barberservices__alert">
          {categoriesError}
        </div>
      )}

      {/* ТАБ: УСЛУГА */}
      {isServicesTab && (
        <>
          {loading ? (
            <div
              className="barberservices__skeletonList"
              aria-hidden="true"
            >
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="barberservices__skeletonCard"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="barberservices__list">
                {pageSlice.map((s) => (
                  <article
                    key={s.id}
                    className={`barberservices__card ${
                      s.active
                        ? "barberservices__card--active"
                        : "barberservices__card--inactive"
                    }`}
                  >
                    <div className="barberservices__info">
                      <h4 className="barberservices__name">
                        {s.name}
                      </h4>
                      <div className="barberservices__meta">
                        <span className="barberservices__price">
                          {fmtMoney(s.price)}
                        </span>
                        {s.time ? (
                          <span className="barberservices__tag">
                            <span className="barberservices__timeIcon">
                              ⏱
                            </span>{" "}
                            {s.time}
                          </span>
                        ) : null}
                        <span className="barberservices__cat">
                          {s.categoryName || "Без категории"}
                        </span>
                        <span
                          className={`barberservices__badge ${
                            s.active
                              ? "barberservices__badge--active"
                              : "barberservices__badge--inactive"
                          }`}
                        >
                          {s.active ? "Активна" : "Неактивна"}
                        </span>
                      </div>
                    </div>

                    <div className="barberservices__cardActions">
                      <button
                        className="barberservices__btn barberservices__btn--secondary barberservices__btn--circle"
                        onClick={() => openServiceModal(s)}
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <BarberServicesPager
                filteredCount={servicesFiltered.length}
                page={pageSafe}
                totalPages={totalPages}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      {/* ТАБ: КАТЕГОРИЯ */}
      {!isServicesTab && (
        <>
          {loading ? (
            <div
              className="barberservices__skeletonList"
              aria-hidden="true"
            >
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="barberservices__skeletonCard"
                />
              ))}
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
                >
                  <div className="barberservices__info">
                    <h4 className="barberservices__name">
                      {c.name}
                    </h4>
                    <div className="barberservices__meta">
                      <span
                        className={`barberservices__badge ${
                          c.active
                            ? "barberservices__badge--active"
                            : "barberservices__badge--inactive"
                        }`}
                      >
                        {c.active ? "Активна" : "Неактивна"}
                      </span>
                    </div>
                  </div>

                  <div className="barberservices__cardActions">
                    <button
                      className="barberservices__btn barberservices__btn--secondary barberservices__btn--circle"
                      onClick={() => openCategoryModal(c)}
                      title="Редактировать категорию"
                      aria-label="Редактировать категорию"
                    >
                      <FaEdit />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* МОДАЛКИ */}
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
