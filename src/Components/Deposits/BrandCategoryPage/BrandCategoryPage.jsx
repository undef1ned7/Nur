// src/pages/catalog/BrandCategoryPage.jsx
// Компонент выводит **бренды** и **категории** на одной странице.
// Полностью повторяет стили employee (employee__*) и использует modals edit-modal / add-modal.
// Требует redux‑thunk'и: fetchBrandsAsync, createBrandAsync, updateBrandAsync, deleteBrandAsync
// и fetchCategoriesAsync, createCategoryAsync, updateCategoryAsync, deleteCategoryAsync, уже описанные ранее.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Search, MoreVertical, Plus, X } from "lucide-react";
import {
  fetchBrandsAsync,
  createBrandAsync,
  updateBrandAsync,
  deleteBrandAsync,
  fetchCategoriesAsync,
  createCategoryAsync,
  updateCategoryAsync,
  deleteCategoryAsync,
} from "../../../store/creators/productCreators"; // поправьте путь при необходимости
import "./Employ.scss"; // ⚠️ тот же файл стилей
import { useAlert, useConfirm } from "../../../hooks/useDialog";
import { useDebouncedValue } from "../../../hooks/useDebounce";
import { validateResErrors } from "../../../../tools/validateResErrors";

/* ------------------------------------------------------------------ */
// Универсальный модал (создание / редактирование)
const TextModal = ({
  title,
  initial,
  onSubmit,
  onClose,
  deleting,
  onDelete,
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
          <input value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="edit-modal__footer cbp">
          {initial && (
            <button onClick={onDelete} disabled={deleting}>
              {deleting ? "Удаление…" : "Удалить"}
            </button>
          )}
          <button onClick={() => onSubmit(value)}>
            {initial ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
const PAGE_SIZE_OPTIONS = [50, 75, 100, 200];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

const Section = ({
  title,
  items,
  loading,
  error,
  onCreate,
  onEdit,
  search,
  setSearch,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}) => (
  <div className="employee__card">
    <div className="employee__card-header">
      <h4>{title}</h4>
      <button className="employee__add" onClick={onCreate}>
        <Plus size={14} style={{ marginRight: 4 }} />
        Добавить
      </button>
      <div className="employee__search" style={{ marginBottom: 8 }}>
        <Search size={16} className="employee__search-icon" />
        <input
          className="cbp employee__search-input"
          placeholder="Поиск"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <X
            size={16}
            className="employee__clear-search"
            onClick={() => setSearch("")}
          />
        )}
      </div>
    </div>

    {loading ? (
      <p className="employee__loading-message">Загрузка…</p>
    ) : error ? (
      <p className="employee__error-message">{String(error)}</p>
    ) : items.length === 0 ? (
      <p className="employee__no-employees-message">Нет элементов.</p>
    ) : (
      <div className="table-wrapper">
        <table className="employee__table small">
          <thead>
            <tr>
              <th>№</th>
              <th>Название</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id}>
                <td>{(page - 1) * pageSize + idx + 1}</td>
                <td className="employee__name">{it.name}</td>
                <td>
                  <MoreVertical
                    size={18}
                    style={{ cursor: "pointer" }}
                    onClick={() => onEdit(it)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {!loading && !error && totalCount > 0 && (
      <div className="employee__pagination">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          На странице:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{ padding: "4px 8px" }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ←
          </button>
          <span>
            {page} из {Math.max(1, Math.ceil(totalCount / pageSize))} (всего:{" "}
            {totalCount})
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= Math.ceil(totalCount / pageSize)}
          >
            →
          </button>
        </span>
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
export default function BrandCategoryPage() {
  const dispatch = useDispatch();
  const {
    brands,
    categories,
    brandsCount,
    categoriesCount,
    brandsLoading,
    categoriesLoading,
    brandsError,
    categoriesError,
    deleting,
  } = useSelector((s) => s.product); // brands & categories лежат в productSlice

  const confirm = useConfirm();
  const alert = useAlert();
  /* local state */
  const [modalCfg, setModalCfg] = useState(null); // { type: 'brand'|'category', mode: 'add'|'edit', item?: obj }
  const [searchBrand, setSearchBrand] = useState("");
  const [searchCat, setSearchCat] = useState("");
  const debouncedSearchBrand = useDebouncedValue(searchBrand, 500);
  const debouncedSearchCat = useDebouncedValue(searchCat, 500);

  /* пагинация и активный таб — через URL params */
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "brands" ? 0 : 1;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const rawPageSize = Number(searchParams.get("page_size"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;

  const updateParams = useCallback(
    (updates) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setActiveTab = (index) =>
    updateParams({ tab: index === 0 ? "brands" : "categories", page: 1 });
  const setPage = (nextPage) => updateParams({ page: Math.max(1, nextPage) });
  const setPageSize = (size) => updateParams({ page_size: size, page: 1 });

  const refreshBrands = useCallback(() => {
    const params = {
      search: debouncedSearchBrand,
      page,
      page_size: pageSize,
    };
    dispatch(fetchBrandsAsync(params));
  }, [dispatch, debouncedSearchBrand, page, pageSize]);

  const refreshCategories = useCallback(() => {
    const params = {
      search: debouncedSearchCat,
      page,
      page_size: pageSize,
    };
    dispatch(fetchCategoriesAsync(params));
  }, [dispatch, debouncedSearchCat, page, pageSize]);
  /* fetch */




  /* helpers */


  // modal submit
  const handleSubmit = async (name) => {
    const { type, mode, item } = modalCfg;
    if (!name.trim()) return alert("Введите название");
    try {
      if (type === "brand") {
        if (mode === "add") {
          await dispatch(createBrandAsync({ name })).unwrap();
          refreshBrands();
        }
        else
          await dispatch(
            updateBrandAsync({ brandId: item.id, updatedData: { name } })
          ).unwrap();
        refreshBrands();
      } else {
        if (mode === "add") {
          await dispatch(createCategoryAsync({ name })).unwrap();
          refreshCategories();
        }
        else
          await dispatch(
            updateCategoryAsync({ categoryId: item.id, updatedData: { name } })
          ).unwrap();
        refreshCategories();
      }
      setModalCfg(null);
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка при сохранении. ")
      alert(errorMessage);
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
        const errorMessage = validateResErrors(e, "Ошибка при удалении. ")
        alert(errorMessage);
      }

    });
  };
  // При смене поиска возвращаемся на 1-ю страницу (без лишнего запроса со старой страницей)
  const prevBrandSearchRef = useRef(debouncedSearchBrand);
  useEffect(() => {
    if (activeTab !== 0) return;
    const searchChanged = prevBrandSearchRef.current !== debouncedSearchBrand;
    prevBrandSearchRef.current = debouncedSearchBrand;
    if (searchChanged && page !== 1) {
      setPage(1);
      return;
    }
    refreshBrands();
  }, [debouncedSearchBrand, activeTab, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevCatSearchRef = useRef(debouncedSearchCat);
  useEffect(() => {
    if (activeTab !== 1) return;
    const searchChanged = prevCatSearchRef.current !== debouncedSearchCat;
    prevCatSearchRef.current = debouncedSearchCat;
    if (searchChanged && page !== 1) {
      setPage(1);
      return;
    }
    refreshCategories();
  }, [debouncedSearchCat, activeTab, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    {
      label: "Бренды",
      content: (
        <Section
          title="Бренды"
          items={brands}
          loading={brandsLoading}
          error={brandsError}
          search={searchBrand}
          setSearch={setSearchBrand}
          page={page}
          pageSize={pageSize}
          totalCount={brandsCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onCreate={() => setModalCfg({ type: "brand", mode: "add" })}
          onEdit={(item) => setModalCfg({ type: "brand", mode: "edit", item })}
        />
      ),
    },
    {
      label: "Категории",
      content: (
        <Section
          title="Категории"
          items={categories}
          loading={categoriesLoading}
          error={categoriesError}
          search={searchCat}
          setSearch={setSearchCat}
          page={page}
          pageSize={pageSize}
          totalCount={categoriesCount}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onCreate={() => setModalCfg({ type: "category", mode: "add" })}
          onEdit={(item) =>
            setModalCfg({ type: "category", mode: "edit", item })
          }
        />
      ),
    },
  ];
  const [activeFlowType, setActiveFlowType] = useState("all"); // 'all', 'income', 'expense'

  return (
    <div className="employee grid-two-cols brandSection">
      <div className="bcp-tabs" role="tablist" aria-label="Бренды и категории">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={index === activeTab}
            className={`bcp-tabs__tab ${
              index === activeTab ? "bcp-tabs__tab--active" : ""
            }`}
            onClick={() => setActiveTab(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[activeTab].content}
      {/* переисп. контейнер */}
      {/* Бренды */}
      {/* Категории */}
      {modalCfg && (
        <TextModal
          title={
            modalCfg.mode === "add"
              ? modalCfg.type === "brand"
                ? "Новый бренд"
                : "Новая категория"
              : "Редактирование"
          }
          initial={modalCfg.item}
          onSubmit={handleSubmit}
          onClose={() => setModalCfg(null)}
          deleting={deleting}
          onDelete={modalCfg.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- */
// Доп. замечания:
// 1. Предполагается, что productSlice держит состояния:
//    - brands (array)
//    - categories (array)
//    - loadingBrands, loadingCategories, errorBrands, errorCategories, creating, updating, deleting
//    Если ваши имена другие — замените.
// 2. grid-two-cols — просто CSS‑utility (display:grid; grid-template-columns:1fr 1fr; gap:24px;)
// 3. Используются те же стилевые классы, что и у Employee: employee__, edit-modal, add-modal.
