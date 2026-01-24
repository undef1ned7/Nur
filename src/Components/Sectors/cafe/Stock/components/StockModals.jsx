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
    <div className="cafeStock__modalOverlay" onClick={onClose}>
      <div className="cafeStock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeStock__modalHeader">
          <h3 className="cafeStock__modalTitle">
            {isCreate ? "Новый товар" : "Изменить товар"}
          </h3>
          <button className="cafeStock__iconBtn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <form className="cafeStock__form" onSubmit={onSubmit}>
          <div className="cafeStock__formGrid">
            <div className="cafeStock__field">
              <label className="cafeStock__label">Название</label>
              <input
                className="cafeStock__input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={255}
                placeholder="Введите название"
              />
            </div>

            <div className="cafeStock__field">
              <label className="cafeStock__label">Ед. изм.</label>
              <input
                className="cafeStock__input"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                required
                maxLength={255}
                placeholder="Например: кг, шт, л"
              />
            </div>

            <div className="cafeStock__field">
              <label className="cafeStock__label">Кол-во</label>
              <input
                type="text"
                inputMode="decimal"
                className="cafeStock__input"
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

            <div className="cafeStock__field">
              <label className="cafeStock__label">Минимум</label>
              <input
                type="text"
                inputMode="decimal"
                className="cafeStock__input"
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
          </div>

          <div className="cafeStock__formActions">
            <button
              type="button"
              className="cafeStock__btn cafeStock__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="cafeStock__btn cafeStock__btn--primary">
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
  onClose,
  onSubmit,
  sanitizeDecimalInput,
}) => {
  return (
    <div className="cafeStock__modalOverlay" onClick={onClose}>
      <div className="cafeStock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeStock__modalHeader">
          <h3 className="cafeStock__modalTitle">Приход: {moveItem.title}</h3>
          <button className="cafeStock__iconBtn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <form className="cafeStock__form" onSubmit={onSubmit}>
          <div className="cafeStock__formGrid">
            <div className="cafeStock__field cafeStock__field--full">
              <label className="cafeStock__label">
                Количество ({moveItem.unit})
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="cafeStock__input"
                value={moveQty}
                onChange={(e) => setMoveQty(sanitizeDecimalInput(e.target.value))}
                required
                placeholder="Введите количество"
              />
            </div>
          </div>

          <div className="cafeStock__formActions">
            <button
              type="button"
              className="cafeStock__btn cafeStock__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="cafeStock__btn cafeStock__btn--primary">
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
    <div className="cafeStock__modalOverlay" onClick={onClose}>
      <div className="cafeStock__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeStock__modalHeader">
          <h3 className="cafeStock__modalTitle">Удалить товар</h3>
          <button className="cafeStock__iconBtn" onClick={onClose} type="button">
            <FaTimes />
          </button>
        </div>

        <div className="cafeStock__hint" style={{ marginTop: 4 }}>
          Точно удалить позицию склада: <b>{deleteItem.title}</b>?
        </div>

        <div className="cafeStock__formActions" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="cafeStock__btn cafeStock__btn--secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="cafeStock__btn cafeStock__btn--danger"
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
