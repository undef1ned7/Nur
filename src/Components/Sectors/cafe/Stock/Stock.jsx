// src/page/homePage/components/Stock.jsx (или твой путь)
import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaPlus, FaBoxes, FaEdit, FaTrash } from "react-icons/fa";
import api from "../../../../api";
import "./stock.scss";
import { StockItemModal, StockMoveModal, StockDeleteModal } from "./StockModals";

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

  // кассы
  const [boxes, setBoxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  // модалка товара
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    unit: "",
    remainder: "",
    minimum: "",
    expense: "",
  });

  // модалка движения (приход)
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveSum, setMoveSum] = useState("");

  // модалка подтверждения удаления
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

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
      } catch (err) {
        console.error("Ошибка загрузки склада/касс:", err);
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
      expense: "",
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
      expense: "", // при редактировании расход не используем
    });
    setModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();

    const title = String(form.title || "").trim();
    const unit = String(form.unit || "").trim();

    const remainderNum = toNum(form.remainder);
    const minimumNum = toNum(form.minimum);
    const expenseNum = toNum(form.expense);

    if (!title || !unit) return;

    const payload = {
      title,
      unit,
      remainder: numStr(Math.max(0, remainderNum)),
      minimum: numStr(Math.max(0, minimumNum)),
    };

    try {
      if (editingId == null) {
        // Создание товара
        if (!cashboxId) {
          alert("Создайте/выберите кассу, чтобы записать расход.");
          return;
        }
        if (!(expenseNum > 0)) {
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
            amount: numStr(expenseNum),
          });
        } catch (err) {
          console.error("Не удалось записать расход в кассу:", err);
          alert("Товар создан, но расход в кассу записать не удалось.");
        }

        setModalOpen(false);
      } else {
        // Редактирование товара (без записи расхода)
        const res = await api.put(`/cafe/warehouse/${editingId}/`, payload);
        setItems((prev) => prev.map((s) => (s.id === editingId ? res.data : s)));
        setModalOpen(false);
      }
    } catch (err) {
      console.error("Ошибка сохранения товара:", err);
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
      console.error("Ошибка удаления товара:", err);
    }
  };

  const openMove = (item) => {
    setMoveItem(item);
    setMoveQty("");
    setMoveSum("");
    setMoveOpen(true);
  };

  const applyMove = async (e) => {
    e.preventDefault();

    if (!moveItem) return;

    const qtyNum = toNum(moveQty);
    const sumNum = toNum(moveSum);

    if (!(qtyNum > 0)) return;

    if (!cashboxId) {
      alert("Выберите кассу для записи расхода.");
      return;
    }
    if (!(sumNum > 0)) {
      alert("Укажите сумму (сом) для расхода.");
      return;
    }

    const current = toNum(moveItem.remainder);
    const nextQty = current + qtyNum; // только приход

    const payload = {
      title: moveItem.title,
      unit: moveItem.unit,
      remainder: numStr(nextQty),
      minimum: numStr(toNum(moveItem.minimum)),
    };

    try {
      // 1) Обновляем склад (приход)
      const res = await api.put(`/cafe/warehouse/${moveItem.id}/`, payload);
      setItems((prev) => prev.map((s) => (s.id === moveItem.id ? res.data : s)));

      // 2) Пишем расход в кассу
      try {
        await api.post("/construction/cashflows/", {
          cashbox: cashboxId,
          type: "expense",
          name: `Приход на склад: ${moveItem.title} (${numStr(qtyNum)} ${moveItem.unit})`,
          amount: numStr(sumNum),
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

          <button className="stock__btn stock__btn--secondary" type="button">
            Экспорт
          </button>

          <button
            className="stock__btn stock__btn--primary"
            onClick={openCreate}
            type="button"
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
                  type="button"
                >
                  Приход
                </button>
                <button
                  className="stock__btn stock__btn--secondary"
                  onClick={() => openEdit(s)}
                  type="button"
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="stock__btn stock__btn--danger"
                  onClick={() => openDelete(s)}
                  type="button"
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
          moveSum={moveSum}
          setMoveSum={setMoveSum}
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
