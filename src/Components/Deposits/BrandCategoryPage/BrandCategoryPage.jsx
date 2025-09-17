// src/pages/catalog/BrandCategoryPage.jsx
// Компонент выводит **бренды** и **категории** на одной странице.
// Полностью повторяет стили employee (employee__*) и использует modals edit-modal / add-modal.
// Требует redux‑thunk'и: fetchBrandsAsync, createBrandAsync, updateBrandAsync, deleteBrandAsync
// и fetchCategoriesAsync, createCategoryAsync, updateCategoryAsync, deleteCategoryAsync, уже описанные ранее.

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
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
const Section = ({
  title,
  items,
  loading,
  error,
  onCreate,
  onEdit,
  search,
  setSearch,
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
                <td>{idx + 1}</td>
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
  </div>
);

/* ------------------------------------------------------------------ */
export default function BrandCategoryPage() {
  const dispatch = useDispatch();
  const {
    brands,
    categories,
    loadingBrands,
    loadingCategories,
    errorBrands,
    errorCategories,
    creating,
    updating,
    deleting,
  } = useSelector((s) => s.product); // предположительно brands & categories лежат в productSlice

  /* local state */
  const [modalCfg, setModalCfg] = useState(null); // { type: 'brand'|'category', mode: 'add'|'edit', item?: obj }
  const [searchBrand, setSearchBrand] = useState("");
  const [searchCat, setSearchCat] = useState("");

  /* fetch */
  useEffect(() => {
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
  }, [dispatch, creating, updating, deleting]);

  /* helpers */
  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchBrand.toLowerCase())
  );
  const filteredCats = categories.filter((c) =>
    c.name.toLowerCase().includes(searchCat.toLowerCase())
  );

  // modal submit
  const handleSubmit = async (name) => {
    const { type, mode, item } = modalCfg;
    if (!name.trim()) return alert("Введите название");
    try {
      if (type === "brand") {
        if (mode === "add") await dispatch(createBrandAsync({ name })).unwrap();
        else
          await dispatch(
            updateBrandAsync({ brandId: item.id, updatedData: { name } })
          ).unwrap();
      } else {
        if (mode === "add")
          await dispatch(createCategoryAsync({ name })).unwrap();
        else
          await dispatch(
            updateCategoryAsync({ categoryId: item.id, updatedData: { name } })
          ).unwrap();
      }
      setModalCfg(null);
    } catch (e) {
      alert("Ошибка сохранения");
      console.error(e);
    }
  };
  const handleDelete = async () => {
    const { type, item } = modalCfg;
    if (!window.confirm("Удалить?")) return;
    try {
      if (type === "brand") await dispatch(deleteBrandAsync(item.id)).unwrap();
      else await dispatch(deleteCategoryAsync(item.id)).unwrap();
      setModalCfg(null);
    } catch (e) {
      alert("Ошибка удаления");
    }
  };
  const [activeTab, setActiveTab] = useState(1);

  const tabs = [
    {
      label: "Бренды",
      content: (
        <Section
          title="Бренды"
          items={filteredBrands}
          loading={loadingBrands}
          error={errorBrands}
          search={searchBrand}
          setSearch={setSearchBrand}
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
          items={filteredCats}
          loading={loadingCategories}
          error={errorCategories}
          search={searchCat}
          setSearch={setSearchCat}
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
      <div className="vitrina__header" style={{ marginBottom: "15px" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => {
            return (
              <span
                className={`vitrina__tab ${
                  index === activeTab && "vitrina__tab--active"
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
              // <button onClick={() => setActiveTab(index)}>{tab.label}</button>
            );
          })}
        </div>
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
