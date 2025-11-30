import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";

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
  if (!isOpen) return null;

  return (
    <div className="menu-modal__overlay" onClick={onClose}>
      <div
        className="menu-modal__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-modal__header">
          <h3 className="menu-modal__title">
            {editingId == null ? "Новая позиция" : "Изменить позицию"}
          </h3>
          <button
            className="menu-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="menu__form" onSubmit={onSubmit}>
          {(imagePreview || imageFile) && (
            <div
              className="menu__field menu__field--full"
              style={{ marginBottom: 8 }}
            >
              <label className="menu__label">Превью</label>
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--c-border, #e5e7eb)",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Превью"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            </div>
          )}

          <div className="menu__formGrid">
            <div className="menu__field">
              <label className="menu__label">Название</label>
              <input
                className="menu__input"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                maxLength={255}
              />
            </div>

            <div className="menu__field">
              <label className="menu__label">Категория</label>
              <select
                className="menu__input"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="menu__field">
              <label className="menu__label">Цена, сом</label>
              <input
                type="number"
                min={0}
                className="menu__input"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    price: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                required
              />
            </div>

            <div className="menu__field">
              <label className="menu__label">Фото (jpg/png/webp)</label>
              <input
                type="file"
                accept="image/*"
                className="menu__input"
                onChange={onPickImage}
              />
            </div>

            <div className="menu__field menu__field--full">
              <label className="menu__label">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  style={{ marginRight: 8 }}
                />
                Активно в продаже
              </label>
            </div>
          </div>

          <div className="menu__recipeBlock">
            <div className="menu__subtitle">Ингредиенты (на 1 блюдо)</div>

            {(form.ingredients || []).map((row, idx) => (
              <div key={idx} className="menu__formGrid">
                <div className="menu__field">
                  <label className="menu__label">Товар со склада</label>
                  <select
                    className="menu__input"
                    value={row.product || ""}
                    onChange={(e) =>
                      changeIngredientRow(idx, "product", e.target.value)
                    }
                    required
                  >
                    <option value="">— Выберите товар —</option>
                    {warehouse.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title} ({w.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="menu__field">
                  <label className="menu__label">
                    Норма (в ед. товара)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="menu__input"
                    value={row.amount ?? 0}
                    onChange={(e) =>
                      changeIngredientRow(idx, "amount", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="menu__field">
                  <label className="menu__label">&nbsp;</label>
                  <button
                    type="button"
                    className="menu__btn menu__btn--danger"
                    onClick={() => removeIngredientRow(idx)}
                  >
                    <FaTrash /> Удалить ингредиент
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="menu__btn menu__btn--secondary"
              onClick={addIngredientRow}
            >
              <FaPlus /> Добавить ингредиент
            </button>
          </div>

          <div className="menu__formActions">
            <button
              type="button"
              className="menu__btn menu__btn--secondary"
              onClick={onClose}
            >
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
