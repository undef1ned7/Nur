import React from "react";
import { FaTimes } from "react-icons/fa";

const StockItemModal = ({
  editingId,
  form,
  setForm,
  onClose,
  onSubmit,
  sanitizeDecimalInput,
}) => {
  const isCreate = editingId == null;

  return (
    <div className="stock__modal-overlay" onClick={onClose}>
      <div className="stock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock__modal-header">
          <h3 className="stock__modal-title">
            {isCreate ? "Новый товар" : "Изменить товар"}
          </h3>
          <button className="stock__icon-btn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <form className="stock__form" onSubmit={onSubmit}>
          <div className="stock__form-grid">
            <div className="stock__field">
              <label className="stock__label">Название</label>
              <input
                className="stock__input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={255}
                placeholder="Введите название"
              />
            </div>

            <div className="stock__field">
              <label className="stock__label">Ед. изм.</label>
              <input
                className="stock__input"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                required
                maxLength={255}
                placeholder="Например: кг, шт, л"
              />
            </div>

            <div className="stock__field">
              <label className="stock__label">Кол-во</label>
              <input
                type="text"
                inputMode="decimal"
                className="stock__input"
                value={form.remainder}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    remainder: sanitizeDecimalInput(e.target.value),
                  }))
                }
                required
                placeholder="Введите количество"
              />
            </div>

            {/* FIX: минимум должен быть и при создании, и при редактировании */}
            <div className="stock__field">
              <label className="stock__label">Минимум</label>
              <input
                type="text"
                inputMode="decimal"
                className="stock__input"
                value={form.minimum}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    minimum: sanitizeDecimalInput(e.target.value),
                  }))
                }
                required
                placeholder="Введите минимум"
              />
            </div>

            {/* Создание: обязательно указать сумму расхода */}
            {isCreate && (
              <div className="stock__field" style={{ gridColumn: "1/-1" }}>
                <label className="stock__label">Сумма (сом) для расхода</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="stock__input"
                  value={form.expense}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      expense: sanitizeDecimalInput(e.target.value),
                    }))
                  }
                  required
                  placeholder="Введите сумму"
                />
              </div>
            )}
          </div>

          <div className="stock__form-actions">
            <button
              type="button"
              className="stock__btn stock__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="stock__btn stock__btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StockMoveModal = ({
  moveItem,
  moveQty,
  setMoveQty,
  moveSum,
  setMoveSum,
  onClose,
  onSubmit,
  sanitizeDecimalInput,
}) => {
  return (
    <div className="stock__modal-overlay" onClick={onClose}>
      <div className="stock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock__modal-header">
          <h3 className="stock__modal-title">Приход: {moveItem.title}</h3>
          <button className="stock__icon-btn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <form className="stock__form" onSubmit={onSubmit}>
          <div className="stock__form-grid">
            <div className="stock__field">
              <label className="stock__label">
                Количество ({moveItem.unit})
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="stock__input"
                value={moveQty}
                onChange={(e) => setMoveQty(sanitizeDecimalInput(e.target.value))}
                required
                placeholder="Введите количество"
              />
            </div>

            <div className="stock__field">
              <label className="stock__label">Сумма (сом) для расхода</label>
              <input
                type="text"
                inputMode="decimal"
                className="stock__input"
                value={moveSum}
                onChange={(e) => setMoveSum(sanitizeDecimalInput(e.target.value))}
                required
                placeholder="Введите сумму"
              />
              <div className="stock__hint">
                Эта сумма будет записана как <b>расход</b> в выбранную кассу.
              </div>
            </div>
          </div>

          <div className="stock__form-actions">
            <button
              type="button"
              className="stock__btn stock__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="stock__btn stock__btn--primary">
              Применить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StockDeleteModal = ({ deleteItem, onClose, onConfirm }) => {
  return (
    <div className="stock__modal-overlay" onClick={onClose}>
      <div className="stock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="stock__modal-header">
          <h3 className="stock__modal-title">Удалить товар</h3>
          <button className="stock__icon-btn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <div className="stock__hint" style={{ marginTop: 4 }}>
          Точно удалить позицию склада: <b>{deleteItem.title}</b>?
        </div>

        <div className="stock__form-actions" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="stock__btn stock__btn--secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="stock__btn stock__btn--danger"
            onClick={onConfirm}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export { StockItemModal, StockMoveModal, StockDeleteModal };
