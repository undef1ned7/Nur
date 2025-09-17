import React, { useEffect, useMemo, useState } from "react";
import "./Purchasing.scss";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaTruck,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import api from "../../../../api";

// Универсально достаём список из пагинированного/непагинированного ответа
const listFrom = (res) => res?.data?.results || res?.data || [];

// Безопасный парс числовых строк (в т.ч. "12,3")
const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Формат суммы для вывода
const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

export default function CafePurchasing() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");

  // Модалка создать/редактировать
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    supplier: "",
    positions: 0,
    price: 0,
  });

  // ===== Загрузка списка =====
  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const res = await api.get("/cafe/purchases/");
        setItems(listFrom(res));
      } catch (err) {
        console.error("Ошибка загрузки закупок:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, []);

  // ===== Поиск =====
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const sup = (p.supplier || "").toLowerCase();
      const pos = String(p.positions || "").toLowerCase();
      const pr = String(p.price || "").toLowerCase();
      return sup.includes(q) || pos.includes(q) || pr.includes(q);
    });
  }, [items, query]);

  // ===== CRUD =====
  const openCreate = () => {
    setEditingId(null);
    setForm({ supplier: "", positions: 0, price: 0 });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      supplier: row.supplier || "",
      positions: toNum(row.positions),
      price: toNum(row.price),
    });
    setModalOpen(true);
  };

  const savePO = async (e) => {
    e.preventDefault();
    const payload = {
      supplier: form.supplier.trim(),
      positions: String(Math.max(0, Number(form.positions) || 0)), // -> string по сваггеру
      price: String(Math.max(0, Number(form.price) || 0)), // -> string($decimal)
    };
    if (!payload.supplier) return;

    try {
      if (editingId == null) {
        const res = await api.post("/cafe/purchases/", payload);
        setItems((prev) => [...prev, res.data]);
      } else {
        const res = await api.put(`/cafe/purchases/${editingId}/`, payload);
        setItems((prev) =>
          prev.map((p) => (p.id === editingId ? res.data : p))
        );
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Ошибка сохранения закупки:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить закупку?")) return;
    try {
      await api.delete(`/cafe/purchases/${id}/`);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Ошибка удаления закупки:", err);
    }
  };

  // ===== RENDER =====
  return (
    <section className="purchasing">
      <div className="purchasing__header">
        <div>
          <h2 className="purchasing__title">Закупки</h2>
          <div className="purchasing__subtitle">Заказы поставщикам.</div>
        </div>

        <div className="purchasing__actions">
          <div className="purchasing__search">
            <FaSearch className="purchasing__search-icon" />
            <input
              className="purchasing__search-input"
              placeholder="Поиск: поставщик, позиции, сумма…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="purchasing__btn purchasing__btn--secondary">
            Экспорт
          </button>
          <button
            className="purchasing__btn purchasing__btn--primary"
            onClick={openCreate}
          >
            <FaPlus /> Новая закупка
          </button>
        </div>
      </div>

      <div className="purchasing__list">
        {loading && <div className="purchasing__alert">Загрузка…</div>}

        {!loading &&
          filtered.map((p) => (
            <article key={p.id} className="purchasing__card">
              <div className="purchasing__card-left">
                <div className="purchasing__avatar">
                  <FaTruck />
                </div>
                <div>
                  {/* Раньше был number/status — в API их нет, поэтому заголовок = поставщик */}
                  <h3 className="purchasing__name">{p.supplier}</h3>
                  <div className="purchasing__meta">
                    <span className="purchasing__muted">
                      Позиций: {toNum(p.positions)}
                    </span>
                    <span className="purchasing__muted">
                      Сумма: {fmtMoney(p.price)} сом
                    </span>
                  </div>
                </div>
              </div>

              <div className="purchasing__rowActions">
                <button
                  className="purchasing__btn purchasing__btn--secondary"
                  onClick={() => openEdit(p)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="purchasing__btn purchasing__btn--danger"
                  onClick={() => handleDelete(p.id)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loading && !filtered.length && (
          <div className="purchasing__alert">
            Ничего не найдено по «{query}».
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="purchasing__modal-overlay"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="purchasing__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchasing__modal-header">
              <h3 className="purchasing__modal-title">
                {editingId == null ? "Новая закупка" : "Изменить закупку"}
              </h3>
              <button
                className="purchasing__icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form className="purchasing__form" onSubmit={savePO}>
              <div className="purchasing__form-grid">
                <div className="purchasing__field">
                  <label className="purchasing__label">Поставщик</label>
                  <input
                    className="purchasing__input"
                    value={form.supplier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplier: e.target.value }))
                    }
                    required
                    maxLength={255}
                  />
                </div>

                <div className="purchasing__field">
                  <label className="purchasing__label">Позиций</label>
                  <input
                    type="number"
                    min={0}
                    className="purchasing__input"
                    value={form.positions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        positions: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    required
                  />
                </div>

                <div className="purchasing__field">
                  <label className="purchasing__label">Сумма, сом</label>
                  <input
                    type="number"
                    min={0}
                    className="purchasing__input"
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
              </div>

              <div className="purchasing__form-actions">
                <button
                  type="button"
                  className="purchasing__btn purchasing__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="purchasing__btn purchasing__btn--primary"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
