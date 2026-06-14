import React, { useEffect, useMemo, useState } from "react";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";
import KitchenCreateModal from "../../Cook/components/KitchenCreateModal";

const safeStr = (value) => String(value ?? "");

const formatDecimalInput = (value) => {
  const cleaned = String(value ?? "").replace(",", ".");
  if (cleaned === "") return "";
  const numbers = cleaned.replace(/[^\d.]/g, "");
  const parts = numbers.split(".");
  return parts.length <= 2 ? numbers : `${parts[0]}.${parts.slice(1).join("")}`;
};

const MenuItemModal = ({
  isOpen,
  onClose,
  editingId,
  form,
  setForm,
  categories,
  kitchens,
  warehouse,
  onSubmit,
  imageFile,
  imagePreview,
  onPickImage,
  addIngredientRow,
  changeIngredientRow,
  removeIngredientRow,
  onKitchenCreated,
}) => {
  const [kitchenCreateOpen, setKitchenCreateOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) setKitchenCreateOpen(false);
  }, [isOpen]);

  // Опции для select'ов
  const categoryOptions = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .map((cat) => ({ value: String(cat.id), label: safeStr(cat.title) }))
      .filter((opt) => opt.value && opt.label);
  }, [categories]);

  const kitchenOptions = useMemo(() => {
    const baseOptions = (Array.isArray(kitchens) ? kitchens : [])
      .map((kitchen) => {
        const title = safeStr(
          kitchen.title || kitchen.name || kitchen.kitchen_title,
        );
        const number = kitchen.number ?? kitchen.kitchen_number;
        const label = `${title || "Кухня"}${
          number !== undefined && number !== null && number !== ""
            ? ` №${number}`
            : ""
        }`;
        return { value: String(kitchen.id), label: safeStr(label) };
      })
      .filter((opt) => opt.value && opt.label);

    return [{ value: "", label: "Без кухни" }, ...baseOptions];
  }, [kitchens]);

  const productOptions = useMemo(() => {
    return (Array.isArray(warehouse) ? warehouse : [])
      .map((product) => ({
        value: String(product.id),
        label: `${safeStr(product.title)}${
          safeStr(product.unit) ? ` (${safeStr(product.unit)})` : ""
        }`,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [warehouse]);

  const updateField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  if (!isOpen) return null;

  const titleValue = safeStr(form?.title);
  const priceValue = formatDecimalInput(form?.price);
  const categoryValue = String(form?.category ?? "");
  const kitchenValue = String(form?.kitchen ?? "");

  const imageSrc = imagePreview || "";

  const handlePriceChange = (e) =>
    updateField({ price: formatDecimalInput(e.target.value) });

  return (
    <>
      <div className="cafeMenuModal__overlay" onClick={onClose}>
        <div
          className="cafeMenuModal__card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cafeMenuModal__header">
            <div className="cafeMenuModal__headLeft">
              <h3 className="cafeMenuModal__title">
                {editingId == null ? "Новая позиция" : "Изменить позицию"}
              </h3>
              <div className="cafeMenuModal__sub">Позиция меню и рецептура</div>
            </div>

            <button
              type="button"
              className="cafeMenuModal__close"
              onClick={onClose}
              aria-label="Закрыть"
              title="Закрыть"
            >
              <FaTimes />
            </button>
          </div>

          <form className="cafeMenu__form" onSubmit={onSubmit}>
            {/* Превью и основная информация */}
            <div className="cafeMenuModal__grid">
              <div className="cafeMenuModal__preview">
                {imageSrc ? (
                  <img src={imageSrc} alt="Превью" />
                ) : (
                  <div className="cafeMenuModal__previewEmpty">Фото</div>
                )}
              </div>

              <div className="cafeMenuModal__fields">
                <div className="cafeMenuModal__fieldsGrid">
                  {/* Название */}
                  <div className="cafeMenu__field">
                    <label className="cafeMenu__label">Название</label>
                    <input
                      className="cafeMenu__input"
                      value={titleValue}
                      onChange={(e) => updateField({ title: e.target.value })}
                      required
                      maxLength={255}
                      type="text"
                      autoComplete="off"
                      placeholder="Название блюда"
                    />
                  </div>

                  {/* Категория */}
                  <div className="cafeMenu__field">
                    <label className="cafeMenu__label">Категория</label>
                    <SearchableCombobox
                      value={categoryValue}
                      onChange={(val) => updateField({ category: String(val) })}
                      options={categoryOptions}
                      placeholder="Поиск категории…"
                      disabled={!categoryOptions.length}
                      classNamePrefix="cafeMenuCombo"
                    />
                  </div>

                  {/* Цена */}
                  <div className="cafeMenu__field">
                    <label className="cafeMenu__label">Цена, сом</label>
                    <input
                      className="cafeMenu__input"
                      value={priceValue}
                      onChange={handlePriceChange}
                      placeholder="Например: 250"
                      type="text"
                      inputMode="decimal"
                      onFocus={(e) => {
                        if (e?.currentTarget?.value == 0) {
                          updateField({ price: "" });
                        }
                      }}
                      autoComplete="off"
                      required
                    />
                  </div>

                  {/* Фото */}
                  <div className="cafeMenu__field">
                    <label className="cafeMenu__label">
                      Фото (jpg/png/webp)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      className="cafeMenu__input"
                      onChange={onPickImage}
                    />
                  </div>

                  {/* Кухня и Активно */}
                  <div className="cafeMenuModal__row2">
                    <div className="cafeMenu__field cafeMenuModal__kitchen">
                      <div className="cafeMenuModal__kitchenHeader justify-between w-full">
                        <label className="cafeMenu__label">Кухня</label>
                      </div>
                      <SearchableCombobox
                        value={kitchenValue}
                        onChange={(val) =>
                          updateField({ kitchen: String(val) })
                        }
                        options={kitchenOptions}
                        placeholder="Выберите кухню…"
                        classNamePrefix="cafeMenuCombo"
                      />
                    </div>

                    <div className="cafeMenu__field cafeMenuModal__active">
                      <button
                        type="button"
                        className="cafeMenu__btn cafeMenu__btn--secondary cafeMenuModal__kitchenCreate ml-auto"
                        onClick={() => setKitchenCreateOpen(true)}
                      >
                        <FaPlus /> Новая кухня
                      </button>
                      <label className="cafeMenu__check">
                        <input
                          type="checkbox"
                          checked={!!form?.is_active}
                          onChange={(e) =>
                            updateField({ is_active: e.target.checked })
                          }
                        />
                        <span>Активно</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ингредиенты */}
            <div className="cafeMenu__recipeBlock">
              <div className="cafeMenu__ingList">
                {(form?.ingredients || []).map((row, idx) => (
                  <div
                    key={`${row?.product || "new"}-${idx}`}
                    className="cafeMenu__ingRow"
                  >
                    <div className="cafeMenu__ingCol">
                      <label className="cafeMenu__label cafeMenu__label--sm">
                        Товар
                      </label>
                      <SearchableCombobox
                        value={String(row?.product ?? "")}
                        onChange={(val) =>
                          changeIngredientRow(idx, "product", String(val))
                        }
                        options={productOptions}
                        placeholder="Поиск товара…"
                        classNamePrefix="cafeMenuCombo"
                      />
                    </div>

                    <div className="cafeMenu__ingCol cafeMenu__ingCol--amount">
                      <label className="cafeMenu__label cafeMenu__label--sm">
                        Норма
                      </label>
                      <input
                        className="cafeMenu__input"
                        value={formatDecimalInput(row?.amount)}
                        onChange={(e) =>
                          changeIngredientRow(
                            idx,
                            "amount",
                            formatDecimalInput(e.target.value),
                          )
                        }
                        placeholder="1"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                      />
                    </div>

                    <div className="cafeMenu__ingCol cafeMenu__ingCol--trash">
                      <label className="cafeMenu__label cafeMenu__label--sm">
                        &nbsp;
                      </label>
                      <button
                        type="button"
                        className="cafeMenu__iconBtn cafeMenu__iconBtn--danger"
                        onClick={() => removeIngredientRow(idx)}
                        aria-label="Удалить"
                        title="Удалить ингредиент"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--secondary"
                onClick={addIngredientRow}
              >
                <FaPlus /> Добавить ингредиент
              </button>
            </div>

            {/* Фискальные коды */}
            <details style={{ marginTop: 16 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  userSelect: "none",
                  marginBottom: 10,
                }}
              >
                Фискальные коды (ккм)
              </summary>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                  marginTop: 10,
                }}
              >
                <div className="cafeMenu__field">
                  <label className="cafeMenu__label">Код НДС (vat)</label>
                  <input
                    className="cafeMenu__input"
                    type="number"
                    min="0"
                    placeholder="Напр.: 12 (VAT_12) или 0"
                    value={form?.fiscal_vat_code ?? ""}
                    onChange={(e) =>
                      updateField({
                        fiscal_vat_code:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="cafeMenu__field">
                  <label className="cafeMenu__label">Код НСП (st)</label>
                  <input
                    className="cafeMenu__input"
                    type="number"
                    min="0"
                    placeholder="0–5"
                    value={form?.fiscal_st_code ?? ""}
                    onChange={(e) =>
                      updateField({
                        fiscal_st_code:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="cafeMenu__field">
                  <label className="cafeMenu__label">
                    Признак предмета расчёта
                  </label>
                  <input
                    className="cafeMenu__input"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={form?.fiscal_calc_item_attr_code ?? ""}
                    onChange={(e) =>
                      updateField({
                        fiscal_calc_item_attr_code:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="cafeMenu__field">
                  <label className="cafeMenu__label">
                    Единица измерения
                  </label>
                  <input
                    className="cafeMenu__input"
                    type="text"
                    placeholder="шт"
                    maxLength={20}
                    value={form?.fiscal_measure ?? ""}
                    onChange={(e) =>
                      updateField({ fiscal_measure: e.target.value })
                    }
                  />
                </div>

                <div className="cafeMenu__field" style={{ gridColumn: "1 / -1" }}>
                  <label className="cafeMenu__label">
                    ТНВЭД / Маркировка (sgtin)
                  </label>
                  <input
                    className="cafeMenu__input"
                    type="text"
                    placeholder="Необязательно"
                    maxLength={100}
                    value={form?.fiscal_sgtin ?? ""}
                    onChange={(e) =>
                      updateField({ fiscal_sgtin: e.target.value || null })
                    }
                  />
                </div>
              </div>

              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                Если поля не заполнены — бэк подставит дефолтные коды из настроек
                фискальной кассы.
              </p>
            </details>

            {/* Кнопки действий */}
            <div className="cafeMenu__formActions">
              <button
                type="button"
                className="cafeMenu__btn cafeMenu__btn--secondary"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="cafeMenu__btn cafeMenu__btn--primary"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>

      <KitchenCreateModal
        open={kitchenCreateOpen}
        onClose={() => setKitchenCreateOpen(false)}
        onCreated={(created) => {
          onKitchenCreated?.(created);
          setKitchenCreateOpen(false);
        }}
      />
    </>
  );
};

export default MenuItemModal;
