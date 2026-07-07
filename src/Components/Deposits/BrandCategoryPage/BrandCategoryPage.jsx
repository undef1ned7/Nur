import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  X,
  LayoutGrid,
  Table2,
  Pencil,
  Tag,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchBrandsAsync,
  createBrandAsync,
  updateBrandAsync,
  deleteBrandAsync,
  fetchCategoriesAsync,
  createCategoryAsync,
  updateCategoryAsync,
  deleteCategoryAsync,
} from "../../../store/creators/productCreators";
import "./Employ.scss";
import { useAlert, useConfirm } from "../../../hooks/useDialog";
import { useDebouncedValue } from "../../../hooks/useDebounce";
import { validateResErrors } from "../../../../tools/validateResErrors";

const TABS = {
  BRANDS: "brands",
  CATEGORIES: "categories",
};

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

const VIEW_MODE_STORAGE_KEY = "crm_brand_category_view_mode";
const PAGE_SIZE = 20;

const getInitialViewMode = () => {
  if (typeof window === "undefined") return VIEW_MODES.TABLE;
  const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
  return VIEW_MODES.TABLE;
};

const TextModal = ({
  title,
  initial,
  onSubmit,
  onClose,
  deleting,
  onDelete,
  saving,
}) => {
  const [value, setValue] = useState(initial?.name || "");

  return (
    <div className="edit-modal brand">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content brand-category-page__edit-modal-content">
        <div className="edit-modal__header">
          <h3>{title}</h3>
          <X size={18} className="edit-modal__close-icon" onClick={onClose} />
        </div>
        <div className="edit-modal__section">
          <label>Название *</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введите название"
            autoFocus
          />
        </div>
        <div className="edit-modal__footer">
          {initial && onDelete && (
            <button
              type="button"
              className="edit-modal__reset"
              onClick={onDelete}
              disabled={deleting || saving}
            >
              {deleting ? "Удаление…" : "Удалить"}
            </button>
          )}
          <button
            type="button"
            className="edit-modal__save"
            onClick={() => onSubmit(value)}
            disabled={deleting || saving}
          >
            {saving ? "Сохранение…" : initial ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ItemsTable = ({ items, onEdit, startIndex = 0 }) => (
  <div className="brand-category-page__table-wrap">
    <table className="brand-category-page__table">
      <thead>
        <tr>
          <th>№</th>
          <th>Название</th>
          <th className="brand-category-page__table-actions-col">Действия</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={item.id} onClick={() => onEdit(item)}>
            <td>{startIndex + idx + 1}</td>
            <td>{item.name}</td>
            <td className="brand-category-page__table-actions-col">
              <button
                type="button"
                className="brand-category-page__row-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                aria-label="Редактировать"
              >
                <Pencil size={16} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ItemsCards = ({ items, onEdit, startIndex = 0 }) => (
  <div className="brand-category-page__cards">
    {items.map((item, idx) => (
      <article
        key={item.id}
        className="brand-category-page__card"
        onClick={() => onEdit(item)}
      >
        <span className="brand-category-page__card-index">
          {startIndex + idx + 1}
        </span>
        <h3 className="brand-category-page__card-title">{item.name}</h3>
        <button
          type="button"
          className="brand-category-page__card-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          aria-label="Редактировать"
        >
          <Pencil size={15} />
        </button>
      </article>
    ))}
  </div>
);

const BrandCategoryPagination = ({
  currentPage,
  totalPages,
  totalCount,
  countLabel,
  loading,
  hasNextPage,
  hasPrevPage,
  onPageChange,
}) => {
  if (totalPages <= 1 && !hasNextPage && !hasPrevPage) return null;

  const pages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const result = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) result.push("ellipsis-start");
    for (let p = start; p <= end; p += 1) result.push(p);
    if (end < totalPages - 1) result.push("ellipsis-end");
    result.push(totalPages);

    return result;
  }, [currentPage, totalPages]);

  return (
    <nav
      className="brand-category-page__pagination"
      aria-label="Навигация по страницам"
    >
      <button
        type="button"
        className="brand-category-page__pagination-btn brand-category-page__pagination-btn--nav"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1 || loading || !hasPrevPage}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={18} />
        Назад
      </button>

      <div className="brand-category-page__pagination-pages">
        {pages.map((page) =>
          typeof page === "string" ? (
            <span
              key={page}
              className="brand-category-page__pagination-ellipsis"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`brand-category-page__pagination-page${
                page === currentPage
                  ? " brand-category-page__pagination-page--active"
                  : ""
              }`}
              onClick={() => onPageChange(page)}
              disabled={loading || page === currentPage}
              aria-label={`Страница ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          ),
        )}
      </div>

      <span className="brand-category-page__pagination-info">
        {totalCount > 0 && (
          <>
            {totalCount} {countLabel}
            {" · "}
          </>
        )}
        {currentPage} из {totalPages}
      </span>

      <button
        type="button"
        className="brand-category-page__pagination-btn brand-category-page__pagination-btn--nav"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={loading || !hasNextPage || currentPage >= totalPages}
        aria-label="Следующая страница"
      >
        Вперёд
        <ChevronRight size={18} />
      </button>
    </nav>
  );
};

export default function BrandCategoryPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    brands,
    categories,
    brandsLoading,
    categoriesLoading,
    brandsError,
    categoriesError,
    brandsCount,
    brandsNext,
    brandsPrevious,
    categoriesCount,
    categoriesNext,
    categoriesPrevious,
    creatingBrand,
    creatingCategory,
    updating,
    deleting,
  } = useSelector((s) => s.product);

  const confirm = useConfirm();
  const alert = useAlert();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === TABS.CATEGORIES ? TABS.CATEGORIES : TABS.BRANDS;
  }, [searchParams]);

  const currentPage = useMemo(() => {
    const page = parseInt(searchParams.get("page") || "1", 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }, [searchParams]);

  const [modalCfg, setModalCfg] = useState(null);
  const [searchBrand, setSearchBrand] = useState("");
  const [searchCat, setSearchCat] = useState("");
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const prevDebouncedSearchRef = useRef(null);

  const debouncedSearchBrand = useDebouncedValue(searchBrand, 500);
  const debouncedSearchCat = useDebouncedValue(searchCat, 500);

  const isBrandsTab = activeTab === TABS.BRANDS;
  const items = isBrandsTab ? brands : categories;
  const loading = isBrandsTab ? brandsLoading : categoriesLoading;
  const error = isBrandsTab ? brandsError : categoriesError;
  const totalCount = isBrandsTab ? brandsCount : categoriesCount;
  const hasNextPage = isBrandsTab ? !!brandsNext : !!categoriesNext;
  const hasPrevPage = isBrandsTab ? !!brandsPrevious : !!categoriesPrevious;
  const search = isBrandsTab ? searchBrand : searchCat;
  const setSearch = isBrandsTab ? setSearchBrand : setSearchCat;
  const debouncedSearch = isBrandsTab
    ? debouncedSearchBrand
    : debouncedSearchCat;
  const saving = creatingBrand || creatingCategory || updating;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE)),
    [totalCount],
  );

  const countLabel = isBrandsTab ? "брендов" : "категорий";
  const rowStartIndex = (currentPage - 1) * PAGE_SIZE;

  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage < 1 || newPage > totalPages) return;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (newPage <= 1) next.delete("page");
        else next.set("page", String(newPage));
        return next;
      });
    },
    [setSearchParams, totalPages],
  );

  const setActiveTab = useCallback(
    (tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  const refreshBrands = useCallback(() => {
    dispatch(
      fetchBrandsAsync({
        search: debouncedSearchBrand || undefined,
        page: currentPage,
      }),
    );
  }, [dispatch, debouncedSearchBrand, currentPage]);

  const refreshCategories = useCallback(() => {
    dispatch(
      fetchCategoriesAsync({
        search: debouncedSearchCat || undefined,
        page: currentPage,
      }),
    );
  }, [dispatch, debouncedSearchCat, currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!searchParams.get("tab")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", TABS.BRANDS);
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isBrandsTab) refreshBrands();
    else refreshCategories();
  }, [
    isBrandsTab,
    debouncedSearchBrand,
    debouncedSearchCat,
    currentPage,
    refreshBrands,
    refreshCategories,
  ]);

  useEffect(() => {
    if (prevDebouncedSearchRef.current === null) {
      prevDebouncedSearchRef.current = debouncedSearch;
      return;
    }
    if (prevDebouncedSearchRef.current === debouncedSearch) return;
    prevDebouncedSearchRef.current = debouncedSearch;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, setSearchParams]);

  const handleSubmit = async (name) => {
    const { type, mode, item } = modalCfg;
    if (!name.trim()) return alert("Введите название");
    try {
      if (type === "brand") {
        if (mode === "add") await dispatch(createBrandAsync({ name })).unwrap();
        else
          await dispatch(
            updateBrandAsync({ brandId: item.id, updatedData: { name } }),
          ).unwrap();
        refreshBrands();
      } else {
        if (mode === "add")
          await dispatch(createCategoryAsync({ name })).unwrap();
        else
          await dispatch(
            updateCategoryAsync({ categoryId: item.id, updatedData: { name } }),
          ).unwrap();
        refreshCategories();
      }
      setModalCfg(null);
    } catch (e) {
      alert(validateResErrors(e, "Ошибка при сохранении. "));
      console.error(e);
    }
  };

  const handleDelete = async () => {
    const { type, item } = modalCfg;
    confirm("Удалить?", async (result) => {
      if (!result) return;
      try {
        if (type === "brand") {
          await dispatch(deleteBrandAsync(item.id)).unwrap();
          refreshBrands();
        } else {
          await dispatch(deleteCategoryAsync(item.id)).unwrap();
          refreshCategories();
        }
        setModalCfg(null);
      } catch (e) {
        alert(validateResErrors(e, "Ошибка при удалении. "));
      }
    });
  };

  const handleCreate = () => {
    setModalCfg({
      type: isBrandsTab ? "brand" : "category",
      mode: "add",
    });
  };

  const handleEdit = (item) => {
    setModalCfg({
      type: isBrandsTab ? "brand" : "category",
      mode: "edit",
      item,
    });
  };

  const tabMeta = isBrandsTab
    ? {
        title: "Бренды",
        subtitle: "Справочник брендов для товаров",
        icon: Tag,
        createLabel: "Добавить бренд",
        emptyText: "Брендов пока нет",
        searchPlaceholder: "Поиск по брендам",
      }
    : {
        title: "Категории",
        subtitle: "Справочник категорий для товаров",
        icon: FolderOpen,
        createLabel: "Добавить категорию",
        emptyText: "Категорий пока нет",
        searchPlaceholder: "Поиск по категориям",
      };

  const TabIcon = tabMeta.icon;
  const list = Array.isArray(items) ? items : [];

  return (
    <div className="brand-category-page brandSection">
      <header className="brand-category-page__header">
        <div className="brand-category-page__heading">
          <div className="brand-category-page__icon">
            <TabIcon size={20} />
          </div>
          <div>
            <h1 className="brand-category-page__title">Бренд и категория</h1>
            <p className="brand-category-page__subtitle">{tabMeta.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="brand-category-page__create-btn"
          onClick={handleCreate}
        >
          <Plus size={16} />
          {tabMeta.createLabel}
        </button>
      </header>

      <nav className="brand-category-page__tabs" aria-label="Разделы">
        <button
          type="button"
          className={`brand-category-page__tab${
            isBrandsTab ? " brand-category-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TABS.BRANDS)}
        >
          Бренды
        </button>
        <button
          type="button"
          className={`brand-category-page__tab${
            !isBrandsTab ? " brand-category-page__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TABS.CATEGORIES)}
        >
          Категории
        </button>
      </nav>

      <div className="brand-category-page__toolbar">
        <div className="brand-category-page__search">
          <Search size={16} className="brand-category-page__search-icon" />
          <input
            className="brand-category-page__search-input"
            placeholder={tabMeta.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="brand-category-page__search-clear"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="brand-category-page__toolbar-meta">
          <span className="brand-category-page__count">
            Всего: {totalCount}
          </span>

          <div
            className="brand-category-page__view-toggle"
            role="group"
            aria-label="Режим отображения"
          >
            <button
              type="button"
              className={`brand-category-page__view-btn${
                viewMode === VIEW_MODES.TABLE
                  ? " brand-category-page__view-btn--active"
                  : ""
              }`}
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
            >
              <Table2 size={16} />
              Список
            </button>
            <button
              type="button"
              className={`brand-category-page__view-btn${
                viewMode === VIEW_MODES.CARDS
                  ? " brand-category-page__view-btn--active"
                  : ""
              }`}
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      <section className="brand-category-page__content">
        {loading ? (
          <p className="brand-category-page__status">Загрузка…</p>
        ) : error ? (
          <p className="brand-category-page__status brand-category-page__status--error">
            {String(error?.message || error)}
          </p>
        ) : list.length === 0 ? (
          <div className="brand-category-page__empty">
            <p>{tabMeta.emptyText}</p>
            <button
              type="button"
              className="brand-category-page__empty-btn"
              onClick={handleCreate}
            >
              <Plus size={16} />
              {tabMeta.createLabel}
            </button>
          </div>
        ) : viewMode === VIEW_MODES.TABLE ? (
          <ItemsTable
            items={list}
            onEdit={handleEdit}
            startIndex={rowStartIndex}
          />
        ) : (
          <ItemsCards
            items={list}
            onEdit={handleEdit}
            startIndex={rowStartIndex}
          />
        )}
      </section>

      {!loading && !error && list.length > 0 && (
        <BrandCategoryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          countLabel={countLabel}
          loading={loading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      )}

      {modalCfg && (
        <TextModal
          title={
            modalCfg.mode === "add"
              ? modalCfg.type === "brand"
                ? "Новый бренд"
                : "Новая категория"
              : `Редактирование: ${modalCfg.item?.name || ""}`
          }
          initial={modalCfg.item}
          onSubmit={handleSubmit}
          onClose={() => setModalCfg(null)}
          deleting={deleting}
          saving={saving}
          onDelete={modalCfg.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
