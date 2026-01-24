// src/Components/Sectors/cafe/Stock/Stock.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaPlus, FaBoxes, FaEdit, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import "./stock.scss";
import { StockItemModal, StockMoveModal, StockDeleteModal } from "./components/StockModals";

/* helpers */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numStr = (n) => {
  const v = Number(n);
  return String(Number.isFinite(v) ? v : 0).replace(",", ".");
};

const sanitizeDecimalInput = (value) => {
  const raw = String(value ?? "").replace(",", ".");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`; // одна точка
};

const Stock = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // модалка товара
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    unit: "",
    remainder: "",
    minimum: "",
    unit_price: "",
  });

  // модалка движения (приход)
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveQty, setMoveQty] = useState("");

  // модалка подтверждения удаления
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const rStock = await api.get("/cafe/warehouse/");
        setItems(listFrom(rStock));
      } catch (err) {
        // Ошибка загрузки склада
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
        String(s.title || "").toLowerCase().includes(q) ||
        String(s.unit || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const isLow = (s) => toNum(s.remainder) <= toNum(s.minimum);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      unit: "",
      remainder: "",
      minimum: "",
      unit_price: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      unit: row.unit || "",
      remainder: String(row.remainder ?? ""),
      minimum: String(row.minimum ?? ""),
      unit_price: String(row.unit_price ?? ""),
    });
    setModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();

    const title = String(form.title || "").trim();
    const unit = String(form.unit || "").trim();

    const remainderNum = toNum(form.remainder);
    const minimumNum = toNum(form.minimum);

    if (!title || !unit) return;

    const unitPriceNum = toNum(form.unit_price);

    const payload = {
      title,
      unit,
      remainder: numStr(Math.max(0, remainderNum)),
      minimum: numStr(Math.max(0, minimumNum)),
      unit_price: unitPriceNum > 0 ? numStr(unitPriceNum) : null,
    };

    try {
      if (editingId == null) {
        // Создание товара
        const res = await api.post("/cafe/warehouse/", payload);
        setItems((prev) => [...prev, res.data]);
        setModalOpen(false);
      } else {
        // Редактирование товара
        const res = await api.put(`/cafe/warehouse/${editingId}/`, payload);
        setItems((prev) => prev.map((s) => (s.id === editingId ? res.data : s)));
        setModalOpen(false);
      }
    } catch (err) {
      // Ошибка сохранения товара
    }
  };

  const openDelete = (row) => {
    setDeleteItem(row);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem?.id) return;
    try {
      await api.delete(`/cafe/warehouse/${deleteItem.id}/`);
      setItems((prev) => prev.filter((s) => s.id !== deleteItem.id));
      setDeleteOpen(false);
      setDeleteItem(null);
    } catch (err) {
      // Ошибка удаления товара
    }
  };

  const openMove = (item) => {
    setMoveItem(item);
    setMoveQty("");
    setMoveOpen(true);
  };

  const applyMove = async (e) => {
    e.preventDefault();

    if (!moveItem) return;

    const qtyNum = toNum(moveQty);

    if (!(qtyNum > 0)) return;

    const current = toNum(moveItem.remainder);
    const nextQty = current + qtyNum;

    const payload = {
      title: moveItem.title,
      unit: moveItem.unit,
      remainder: numStr(nextQty),
      minimum: numStr(toNum(moveItem.minimum)),
      unit_price: moveItem.unit_price || null,
    };

    try {
      const res = await api.put(`/cafe/warehouse/${moveItem.id}/`, payload);
      setItems((prev) => prev.map((s) => (s.id === moveItem.id ? res.data : s)));
      setMoveOpen(false);
    } catch (err) {
      // Ошибка применения движения
    }
  };

  return (
    <section className="cafeStock">
      <div className="cafeStock__header">
        <div>
          <h2 className="cafeStock__title">Склад</h2>
        </div>

        <div className="cafeStock__actions">
          <div className="cafeStock__search">
            <FaSearch className="cafeStock__searchIcon" />
            <input
              className="cafeStock__searchInput"
              placeholder="Поиск ингредиента…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              autoComplete="off"
            />
          </div>

          <button
            className="cafeStock__btn cafeStock__btn--primary"
            onClick={openCreate}
            type="button"
          >
            <FaPlus /> Новый товар
          </button>
        </div>
      </div>

      <div className="cafeStock__list">
        {loading && <div className="cafeStock__alert">Загрузка…</div>}

        {!loading &&
          filtered.map((s) => (
            <article key={s.id} className="cafeStock__card">
              <div className="cafeStock__cardLeft">
                <div className="cafeStock__avatar">
                  <FaBoxes />
                </div>
                <div>
                  <h3 className="cafeStock__name">{s.title}</h3>
                  <div className="cafeStock__meta">
                    <span className="cafeStock__muted">
                      Остаток: {toNum(s.remainder)} {s.unit}
                    </span>
                    {s.unit_price && (
                      <span className="cafeStock__muted">
                        Цена: {toNum(s.unit_price)} ₸/{s.unit}
                      </span>
                    )}
                    <span
                      className={`cafeStock__status ${
                        isLow(s) ? "cafeStock__status--low" : "cafeStock__status--ok"
                      }`}
                    >
                      {isLow(s) ? "Мало" : "Ок"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="cafeStock__rowActions">
                <button
                  className="cafeStock__btn cafeStock__btn--success"
                  onClick={() => openMove(s)}
                  type="button"
                >
                  Приход
                </button>
                <button
                  className="cafeStock__btn cafeStock__btn--secondary"
                  onClick={() => openEdit(s)}
                  type="button"
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="cafeStock__btn cafeStock__btn--danger"
                  onClick={() => openDelete(s)}
                  type="button"
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loading && !filtered.length && (
          <div className="cafeStock__alert">Ничего не найдено по «{query}».</div>
        )}
      </div>

      {/* Модалка товара */}
      {modalOpen && (
        <StockItemModal
          editingId={editingId}
          form={form}
          setForm={setForm}
          onClose={() => setModalOpen(false)}
          onSubmit={saveItem}
          sanitizeDecimalInput={sanitizeDecimalInput}
        />
      )}

      {/* Модалка приход */}
      {moveOpen && moveItem && (
        <StockMoveModal
          moveItem={moveItem}
          moveQty={moveQty}
          setMoveQty={setMoveQty}
          onClose={() => setMoveOpen(false)}
          onSubmit={applyMove}
          sanitizeDecimalInput={sanitizeDecimalInput}
        />
      )}

      {/* Модалка подтверждения удаления */}
      {deleteOpen && deleteItem && (
        <StockDeleteModal
          deleteItem={deleteItem}
          onClose={() => setDeleteOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
};

export default Stock;
