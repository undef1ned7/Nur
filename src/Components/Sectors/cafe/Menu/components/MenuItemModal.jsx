// src/Components/Sectors/cafe/Menu/components/MenuItemModal.jsx
import React, { useMemo } from "react";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import SearchableCombobox from "./SearchableCombobox";

const safeStr = (v) => String(v ?? "").trim();

const asTextNumber = (v) => {
  const s = String(v ?? "").replace(",", ".");
  if (s === "") return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
};

const MenuItemModal = ({
  isOpen,
  onClose,
  editingId,
  form,
  setForm,
  categories,
  warehouse,
  onSubmit,
  imageFile,
  imagePreview,
  onPickImage,
  addIngredientRow,
  changeIngredientRow,
  removeIngredientRow,
}) => {
  const categoryOptions = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .map((c) => ({ value: String(c.id), label: safeStr(c.title) }))
      .filter((o) => o.value && o.label);
  }, [categories]);

  const productOptions = useMemo(() => {
    return (Array.isArray(warehouse) ? warehouse : [])
      .map((w) => ({
        value: String(w.id),
        label: `${safeStr(w.title)}${safeStr(w.unit) ? ` (${safeStr(w.unit)})` : ""}`,
      }))
      .filter((o) => o.value && o.label);
  }, [warehouse]);

  if (!isOpen) return null;

  const setField = (patch) => setForm((f) => ({ ...f, ...patch }));

  const titleValue = safeStr(form?.title);
  const priceValue = asTextNumber(form?.price);
  const categoryValue = String(form?.category ?? "");

  const previewSrc = imagePreview || "";

  const onChangePrice = (e) => setField({ price: asTextNumber(e.target.value) });

  return (
    <div className="menu-modal__overlay" onMouseDown={onClose}>
      <div className="menu-modal__card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="menu-modal__header">
          <div className="menu-modal__headLeft">
            <h3 className="menu-modal__title">{editingId == null ? "Новая позиция" : "Изменить позицию"}</h3>
            <div className="menu-modal__sub">Позиция меню и рецептура.</div>
          </div>

          <button type="button" className="menu-modal__close" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>

        <form className="menu__form" onSubmit={onSubmit}>
          <div className="menu-modal__grid">
            <div className="menu-modal__preview">
              {previewSrc ? (
                <img src={previewSrc} alt="Превью" />
              ) : (
                <div className="menu-modal__previewEmpty">Фото</div>
              )}
            </div>

            <div className="menu-modal__fields">
              <div className="menu-modal__fieldsGrid">
                <div className="menu__field">
                  <label className="menu__label">Название</label>
                  <input
                    className="menu__input"
                    value={titleValue}
                    onChange={(e) => setField({ title: e.target.value })}
                    required
                    maxLength={255}
                    type="text"
                    autoComplete="off"
                  />
                </div>

                <div className="menu__field">
                  <label className="menu__label">Категория</label>
                  <SearchableCombobox
                    value={categoryValue}
                    onChange={(v) => setField({ category: String(v) })}
                    options={categoryOptions}
                    placeholder="Поиск категории…"
                    disabled={!categoryOptions.length}
                  />
                </div>

                <div className="menu__field">
                  <label className="menu__label">Цена, сом</label>
                  <input
                    className="menu__input"
                    value={priceValue}
                    onChange={onChangePrice}
                    placeholder="Например: 250"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="menu__field">
                  <label className="menu__label">Фото (jpg/png/webp)</label>
                  <input type="file" accept="image/*" className="menu__input" onChange={onPickImage} />
                </div>

                <div className="menu__field menu-modal__active">
                  <label className="menu__check">
                    <input
                      type="checkbox"
                      checked={!!form?.is_active}
                      onChange={(e) => setField({ is_active: e.target.checked })}
                    />
                    <span>Активно</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="menu__recipeBlock">

            <div className="menu__ingList">
              {(form?.ingredients || []).map((row, idx) => (
                <div key={`${row?.product || "row"}-${idx}`} className="menu__ingRow">
                  <div className="menu__ingCol">
                    <label className="menu__label menu__label--sm">Товар</label>
                    <SearchableCombobox
                      value={String(row?.product ?? "")}
                      onChange={(v) => changeIngredientRow(idx, "product", String(v))}
                      options={productOptions}
                      placeholder="Поиск товара…"
                    />
                  </div>

                  <div className="menu__ingCol menu__ingCol--amount">
                    <label className="menu__label menu__label--sm">Норма</label>
                    <input
                      className="menu__input"
                      value={asTextNumber(row?.amount)}
                      onChange={(e) => changeIngredientRow(idx, "amount", asTextNumber(e.target.value))}
                      placeholder="1"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div className="menu__ingCol menu__ingCol--trash">
                    <label className="menu__label menu__label--sm">&nbsp;</label>
                    <button
                      type="button"
                      className="menu__iconBtn menu__iconBtn--danger"
                      onClick={() => removeIngredientRow(idx)}
                      aria-label="Удалить"
                      title="Удалить"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="menu__btn menu__btn--secondary" onClick={addIngredientRow}>
              <FaPlus /> Добавить ингредиент
            </button>
          </div>

          <div className="menu__formActions">
            <button type="button" className="menu__btn menu__btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="menu__btn menu__btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuItemModal;
