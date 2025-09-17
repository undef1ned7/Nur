import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaBoxes,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import api from "../../../../api";
import "./stock.scss";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const numStr = (n) => String(Number(n) || 0).replace(",", ".");

const Stock = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // кассы
  const [boxes, setBoxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  // модалка товара
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    unit: "",
    remainder: 0,
    minimum: 0,
    expense: 0, // сумма расхода при создании
  });

  // модалка движения (приход)
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveQty, setMoveQty] = useState(1);
  const [moveSum, setMoveSum] = useState(0); // сумма денег для расхода

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [rStock, rBoxes] = await Promise.all([
          api.get("/cafe/warehouse/"),
          api.get("/construction/cashboxes/").catch(() => ({ data: [] })),
        ]);
        setItems(listFrom(rStock));
        const bx = listFrom(rBoxes) || [];
        setBoxes(bx);
        setCashboxId(bx[0]?.id || bx[0]?.uuid || "");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.unit || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const isLow = (s) => toNum(s.remainder) <= toNum(s.minimum);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", unit: "", remainder: 0, minimum: 0, expense: 0 });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      unit: row.unit || "",
      remainder: toNum(row.remainder),
      minimum: toNum(row.minimum),
      expense: 0, // при редактировании не используем расход
    });
    setModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      unit: form.unit.trim(),
      remainder: numStr(Math.max(0, Number(form.remainder) || 0)),
      minimum: numStr(Math.max(0, Number(form.minimum) || 0)),
    };
    if (!payload.title || !payload.unit) return;

    try {
      if (editingId == null) {
        // Создание товара
        if (!cashboxId) {
          alert("Создайте/выберите кассу, чтобы записать расход.");
          return;
        }
        if (!(Number(form.expense) > 0)) {
          alert("Укажите сумму для расхода.");
          return;
        }

        const res = await api.post("/cafe/warehouse/", payload);
        setItems((prev) => [...prev, res.data]);

        // Расход в кассу
        try {
          await api.post("/construction/cashflows/", {
            cashbox: cashboxId,
            type: "expense",
            name: `Новый товар: ${payload.title} (ввод ${payload.remainder} ${payload.unit})`,
            amount: numStr(form.expense),
          });
        } catch (err) {
          console.error("Не удалось записать расход в кассу:", err);
          alert("Товар создан, но расход в кассу записать не удалось.");
        }

        setModalOpen(false);
      } else {
        // Редактирование товара (без записи расхода)
        const res = await api.put(`/cafe/warehouse/${editingId}/`, payload);
        setItems((prev) =>
          prev.map((s) => (s.id === editingId ? res.data : s))
        );
        setModalOpen(false);
      }
    } catch (err) {
      console.error("Ошибка сохранения товара:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить позицию склада?")) return;
    try {
      await api.delete(`/cafe/warehouse/${id}/`);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Ошибка удаления товара:", err);
    }
  };

  const openMove = (item) => {
    setMoveItem(item);
    setMoveQty(1);
    setMoveSum(0);
    setMoveOpen(true);
  };

  const applyMove = async (e) => {
    e.preventDefault();
    if (!moveItem || moveQty <= 0) return;

    if (!cashboxId) {
      alert("Выберите кассу для записи расхода.");
      return;
    }
    if (!(Number(moveSum) > 0)) {
      alert("Укажите сумму (сом) для расхода.");
      return;
    }

    const current = toNum(moveItem.remainder);
    const nextQty = current + moveQty; // только приход

    const payload = {
      title: moveItem.title,
      unit: moveItem.unit,
      remainder: numStr(nextQty),
      minimum: numStr(toNum(moveItem.minimum)),
    };

    try {
      // 1) Обновляем склад (приход)
      const res = await api.put(`/cafe/warehouse/${moveItem.id}/`, payload);
      setItems((prev) =>
        prev.map((s) => (s.id === moveItem.id ? res.data : s))
      );

      // 2) Пишем расход в кассу
      try {
        await api.post("/construction/cashflows/", {
          cashbox: cashboxId,
          type: "expense",
          name: `Приход на склад: ${moveItem.title} (${moveQty} ${moveItem.unit})`,
          amount: numStr(moveSum),
        });
      } catch (err) {
        console.error("Не удалось записать расход в кассу:", err);
        alert("Приход применён, но расход в кассу записать не удалось.");
      }

      setMoveOpen(false);
    } catch (err) {
      console.error("Ошибка применения движения:", err);
    }
  };

  return (
    <section className="stock">
      <div className="stock__header">
        <div>
          <h2 className="stock__title">Склад</h2>
        </div>

        <div className="stock__actions">
          <div className="stock__search">
            <FaSearch className="stock__search-icon" />
            <input
              className="stock__search-input"
              placeholder="Поиск ингредиента…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* выбор кассы для записи расхода */}
          <select
            className="stock__select"
            value={cashboxId}
            onChange={(e) => setCashboxId(e.target.value)}
            title="Касса для записи расхода"
          >
            {boxes.map((b) => (
              <option key={b.id || b.uuid} value={b.id || b.uuid}>
                {b.department_name || b.name || "Касса"}
              </option>
            ))}
          </select>

          <button className="stock__btn stock__btn--secondary">Экспорт</button>
          <button
            className="stock__btn stock__btn--primary"
            onClick={openCreate}
          >
            <FaPlus /> Новый товар
          </button>
        </div>
      </div>

      <div className="stock__list">
        {loading && <div className="stock__alert">Загрузка…</div>}
        {!loading &&
          filtered.map((s) => (
            <article key={s.id} className="stock__card">
              <div className="stock__card-left">
                <div className="stock__avatar">
                  <FaBoxes />
                </div>
                <div>
                  <h3 className="stock__name">{s.title}</h3>
                  <div className="stock__meta">
                    <span className="stock__muted">
                      Остаток: {toNum(s.remainder)} {s.unit}
                    </span>
                    <span
                      className={`stock__status ${
                        isLow(s) ? "stock__status--low" : "stock__status--ok"
                      }`}
                    >
                      {isLow(s) ? "Мало" : "Ок"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="stock__rowActions">
                <button
                  className="stock__btn stock__btn--success"
                  onClick={() => openMove(s)}
                >
                  Приход
                </button>
                <button
                  className="stock__btn stock__btn--secondary"
                  onClick={() => openEdit(s)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="stock__btn stock__btn--danger"
                  onClick={() => handleDelete(s.id)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}
        {!loading && !filtered.length && (
          <div className="stock__alert">Ничего не найдено по «{query}».</div>
        )}
      </div>

      {/* модалка товара */}
      {modalOpen && (
        <div
          className="stock__modal-overlay"
          onClick={() => setModalOpen(false)}
        >
          <div className="stock__modal" onClick={(e) => e.stopPropagation()}>
            <div className="stock__modal-header">
              <h3 className="stock__modal-title">
                {editingId == null ? "Новый товар" : "Изменить товар"}
              </h3>
              <button
                className="stock__icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="stock__form" onSubmit={saveItem}>
              <div className="stock__form-grid">
                <div className="stock__field">
                  <label className="stock__label">Название</label>
                  <input
                    className="stock__input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>
                <div className="stock__field">
                  <label className="stock__label">Ед. изм.</label>
                  <input
                    className="stock__input"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>
                <div className="stock__field">
                  <label className="stock__label">Кол-во</label>
                  <input
                    type="number"
                    min={0}
                    className="stock__input"
                    value={form.remainder}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        remainder: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    required
                  />
                </div>

                {/* Создание: обязательно указать сумму расхода */}
                {editingId == null ? (
                  <div className="stock__field">
                    <label className="stock__label">
                      Сумма (сом) для расхода
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="stock__input"
                      value={form.expense}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          expense: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      required
                    />
                    <div className="stock__hint">
                      Эта сумма будет записана как <b>расход</b> в выбранную
                      кассу.
                    </div>
                  </div>
                ) : (
                  <div className="stock__field">
                    <label className="stock__label">Минимум</label>
                    <input
                      type="number"
                      min={0}
                      className="stock__input"
                      value={form.minimum}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          minimum: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      required
                    />
                  </div>
                )}
              </div>

              <div className="stock__form-actions">
                <button
                  type="button"
                  className="stock__btn stock__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="stock__btn stock__btn--primary"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* модалка приход */}
      {moveOpen && moveItem && (
        <div
          className="stock__modal-overlay"
          onClick={() => setMoveOpen(false)}
        >
          <div className="stock__modal" onClick={(e) => e.stopPropagation()}>
            <div className="stock__modal-header">
              <h3 className="stock__modal-title">Приход: {moveItem.title}</h3>
              <button
                className="stock__icon-btn"
                onClick={() => setMoveOpen(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="stock__form" onSubmit={applyMove}>
              <div className="stock__form-grid">
                <div className="stock__field">
                  <label className="stock__label">
                    Количество ({moveItem.unit})
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="stock__input"
                    value={moveQty}
                    onChange={(e) =>
                      setMoveQty(Math.max(1, Number(e.target.value) || 1))
                    }
                    required
                  />
                </div>

                <div className="stock__field">
                  <label className="stock__label">
                    Сумма (сом) для расхода
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="stock__input"
                    value={moveSum}
                    onChange={(e) =>
                      setMoveSum(Math.max(0, Number(e.target.value) || 0))
                    }
                    required
                  />
                  <div className="stock__hint">
                    Эта сумма будет записана как <b>расход</b> в выбранную
                    кассу.
                  </div>
                </div>
              </div>

              <div className="stock__form-actions">
                <button
                  type="button"
                  className="stock__btn stock__btn--secondary"
                  onClick={() => setMoveOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="stock__btn stock__btn--primary"
                >
                  Применить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Stock;
