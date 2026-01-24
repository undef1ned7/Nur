// src/Components/Sectors/cafe/Menu/components/MenuItemModal.jsx
import React, { useEffect, useMemo } from "react";
import { FaTimes } from "react-icons/fa";

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^0-9.,-]/g, "")
    .replace(",", ".");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const unitToLower = (u) => String(u || "").trim().toLowerCase();

// UI ввод: граммы/мл -> API: кг/л
const uiToApiAmount = (amountUi, unit) => {
  const n = toNumber(amountUi);
  const u = unitToLower(unit);

  if (u === "kg" || u === "кг") return n / 1000;
  if (u === "l" || u === "л") return n / 1000;
  return n;
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

  warehouseTitle,
  warehouseUnit,
  uiUnitLabel,

  getWarehouseUnitPrice,
  formatMoney,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const titleText = editingId ? "Редактирование блюда" : "Новое блюдо";

  const update = (field) => (e) => {
    const value = e?.target?.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [field]: value }));
  };

  const onDecimalField = (field) => (e) => {
    const v = e.target.value;
    const norm = String(v ?? "").replace(",", ".");
    if (/^\d*\.?\d*$/.test(norm)) setForm((p) => ({ ...p, [field]: norm }));
  };

  const ingredientsRows = Array.isArray(form.ingredients) ? form.ingredients : [];

  // ===== Расчёт стоимости строк (сом) =====
  const rowsCost = useMemo(() => {
    return ingredientsRows.map((row) => {
      const pid = row?.product;
      const unit = warehouseUnit(pid);

      const apiAmount = uiToApiAmount(row?.amount, unit); // кг/л/шт
      const unitPriceRaw = getWarehouseUnitPrice?.(pid);
      const unitPrice = Math.max(0, toNumber(unitPriceRaw)); // сом за 1 кг/л/шт
      const cost = apiAmount * unitPrice;

      return {
        unit,
        unitPrice,
        cost: Number.isFinite(cost) ? cost : 0,
        hasPrice: unitPrice > 0,
      };
    });
  }, [ingredientsRows, warehouseUnit, getWarehouseUnitPrice]);

  const ingredientsCost = useMemo(() => {
    return rowsCost.reduce((sum, r) => sum + (Number.isFinite(r.cost) ? r.cost : 0), 0);
  }, [rowsCost]);

  // Прочие расходы (отображаем, но прибыль считаем не по ним)
  const otherExpenses = toNumber(form.other_expenses);

  // Цена (у тебя авто в Menu.jsx)
  const totalPrice = toNumber(form.price);

  // ВАЖНО: прибыль = цена - ингредиенты (может быть + / - / 0)
  const profit = totalPrice - ingredientsCost;

  const formatSignedMoney = (v) => {
    const n = toNumber(v);
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${formatMoney(Math.abs(n))} сом`;
  };

  const profitClass =
    profit > 0
      ? "cafeMenu__summaryValue--plus"
      : profit < 0
        ? "cafeMenu__summaryValue--minus"
        : "cafeMenu__summaryValue--zero";

  if (!isOpen) return null;

  return (
    <div className="cafeMenuModal__overlay" onClick={onClose}>
      <div className="cafeMenuModal__card" onClick={(e) => e.stopPropagation()}>
        <div className="cafeMenuModal__header">
          <div className="cafeMenuModal__headLeft">
            <h3 className="cafeMenuModal__title">{titleText}</h3>
            <div className="cafeMenuModal__sub">Цена считается автоматически</div>
          </div>

          <button
            type="button"
            className="cafeMenuModal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="cafeMenu__form" onSubmit={onSubmit}>
          <div className="cafeMenuModal__grid">
            <div className="cafeMenuModal__preview">
              {imagePreview ? (
                <img src={imagePreview} alt="preview" />
              ) : (
                <div className="cafeMenuModal__previewEmpty">Нет фото</div>
              )}
            </div>

            <div className="cafeMenuModal__fields">
              <div className="cafeMenuModal__fieldsGrid">
                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Название *</div>
                  <input
                    className="cafeMenu__input"
                    value={form.title || ""}
                    onChange={update("title")}
                    placeholder="Например: Лагман"
                    required
                  />
                </div>

                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Категория *</div>
                  <select
                    className="cafeMenu__input"
                    value={form.category || ""}
                    onChange={update("category")}
                    required
                  >
                    <option value="" disabled>
                      Выберите категорию
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Кухня</div>
                  <select
                    className="cafeMenu__input"
                    value={form.kitchen || ""}
                    onChange={update("kitchen")}
                  >
                    <option value="">—</option>
                    {kitchens.map((k) => {
                      const t = k.title || k.name || k.kitchen_title || "Кухня";
                      const n = k.number ?? k.kitchen_number;
                      const label = `${t}${n !== undefined && n !== null && n !== "" ? ` №${n}` : ""}`;
                      return (
                        <option key={k.id} value={k.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Цена</div>
                  <input className="cafeMenu__input" value={String(form.price ?? "0.00")} readOnly />
                  <div className="cafeMenu__hint">Авто: {formatMoney(totalPrice)} сом</div>
                </div>

                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Прочие расходы</div>
                  <input
                    className="cafeMenu__input"
                    value={form.other_expenses || ""}
                    onChange={onDecimalField("other_expenses")}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>

                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">НДС, %</div>
                  <input
                    className="cafeMenu__input"
                    value={form.vat_percent || ""}
                    onChange={onDecimalField("vat_percent")}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                  <div className="cafeMenu__hint">Не влияет на цену, только для отчётов</div>
                </div>

                {/* Изображение (левая колонка) */}
                <div className="cafeMenu__field">
                  <div className="cafeMenu__label">Изображение</div>
                  <input className="cafeMenu__input" type="file" accept="image/*" onChange={onPickImage} />
                  {imageFile ? <div className="cafeMenu__hint">Выбрано: {imageFile.name}</div> : null}
                </div>

                {/* Активно (правая колонка) */}
                <div className="cafeMenu__field cafeMenuModal__activeField">
                  <div className="cafeMenu__label">&nbsp;</div>
                  <label className="cafeMenu__check cafeMenuModal__check">
                    <input type="checkbox" checked={!!form.is_active} onChange={update("is_active")} />
                    <span>Активно в продаже</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Ингредиенты */}
          <div className="cafeMenu__recipeBlock">
            <div className="cafeMenu__label cafeMenu__label--sm">Ингредиенты</div>
            <div className="cafeMenu__hint">
              Норма вводится в <b>г/мл</b>, если товар на складе в <b>кг/л</b>.
            </div>

            <div className="cafeMenu__ingList">
              {ingredientsRows.map((row, idx) => {
                const pid = row?.product;
                const unit = warehouseUnit(pid);
                const uiUnit = uiUnitLabel(unit);
                const rowInfo = rowsCost[idx] || { unitPrice: 0, cost: 0, hasPrice: false };

                return (
                  <div className="cafeMenu__ingRow" key={`${pid || "p"}-${idx}`}>
                    <div className="cafeMenu__ingCol">
                      <div className="cafeMenu__label">Товар со склада *</div>
                      <select
                        className="cafeMenu__input"
                        value={pid || ""}
                        onChange={(e) => changeIngredientRow(idx, "product", e.target.value)}
                      >
                        <option value="">Выберите товар</option>
                        {warehouse.map((w) => (
                          <option key={w.id} value={w.id}>
                            {warehouseTitle(w.id) || w.title || "Товар"}
                          </option>
                        ))}
                      </select>

                      {pid ? (
                        <div className="cafeMenu__hint">
                          {rowInfo.hasPrice ? (
                            <>
                              Закуп: {formatMoney(rowInfo.unitPrice)} сом / {unit || "ед."}
                            </>
                          ) : (
                            <>Закупочная цена не задана</>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="cafeMenu__ingCol">
                      <div className="cafeMenu__label">Норма {uiUnit ? `(${uiUnit})` : ""} *</div>
                      <input
                        className="cafeMenu__input"
                        value={row.amount || ""}
                        onChange={(e) => changeIngredientRow(idx, "amount", e.target.value)}
                        placeholder="Например: 200"
                        inputMode="decimal"
                      />

                      {pid ? (
                        <div className="cafeMenu__hint">Стоимость строки: {formatMoney(rowInfo.cost)} сом</div>
                      ) : null}
                    </div>

                    <div className="cafeMenu__ingCol cafeMenu__ingCol--trash">
                      <button
                        type="button"
                        className="cafeMenu__iconBtn cafeMenu__iconBtn--danger"
                        onClick={() => removeIngredientRow(idx)}
                        aria-label="Удалить ингредиент"
                        title="Удалить"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="cafeMenu__btn cafeMenu__btn--secondary" onClick={addIngredientRow}>
              Добавить ингредиент
            </button>

            {/* Итоги */}
            <div className="cafeMenu__summary">
              <div className="cafeMenu__summaryRow">
                <span className="cafeMenu__summaryLabel">Ингредиенты</span>
                <b className="cafeMenu__summaryValue">{formatMoney(ingredientsCost)} сом</b>
              </div>

              <div className="cafeMenu__summaryRow">
                <span className="cafeMenu__summaryLabel">Прочие расходы</span>
                <b className="cafeMenu__summaryValue">{formatMoney(otherExpenses)} сом</b>
              </div>

              <div className="cafeMenu__summaryRow cafeMenu__summaryRow--total">
                <span className="cafeMenu__summaryLabel">Прибыль</span>
                <b className={`cafeMenu__summaryValue ${profitClass}`}>{formatSignedMoney(profit)}</b>
              </div>
            </div>
          </div>

          <div className="cafeMenu__formActions">
            <button type="button" className="cafeMenu__btn cafeMenu__btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="cafeMenu__btn cafeMenu__btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuItemModal;
