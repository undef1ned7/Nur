import React, { useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { getObjects } from "../../../../store/creators/saleThunk";
import { useSale } from "../../../../store/slices/saleSlice";

/* ================= helpers ================= */

const API_URL = "https://app.nurcrm.kg/api/main/object-items/";

// Достаём токен из localStorage, если он есть
const getAuthHeaders = () => {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Универсальный fetch c обработкой ошибок
async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      res.statusText ||
      "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// список может прийти как results[], так и сразу как массив
const listFrom = (data) =>
  data && (data.results || data) && Array.isArray(data.results || data)
    ? data.results || data
    : [];

/* =============== AddModal: POST /object-items/ =============== */

const AddModal = ({ onClose, onSaveSuccess }) => {
  const today = new Date().toISOString().split("T")[0];

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "", // строка
    date: today, // YYYY-MM-DD
    quantity: "", // число
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      // quantity — целое, price — оставляем в виде строки (API ждёт string)
      if (name === "quantity") {
        setForm((p) => ({ ...p, [name]: value === "" ? "" : Number(value) }));
      } else {
        setForm((p) => ({ ...p, [name]: value })); // price оставляем строкой
      }
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    setCreateError("");

    const { name, description, price, date, quantity } = form;

    if (!name || price === "" || !date || quantity === "") {
      alert(
        "Пожалуйста, заполните обязательные поля: Наименование, Цена, Дата, Количество."
      );
      return;
    }

    const payload = {
      name: String(name).trim(),
      description: String(description || "").trim(),
      price: String(price), // API ждёт строку
      date, // YYYY-MM-DD
      quantity: Number(quantity),
    };

    try {
      setCreating(true);
      await httpJson(API_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSaveSuccess?.(); // родителю — перезагрузить список
      onClose();
    } catch (err) {
      console.error(err);
      setCreateError(
        err?.data
          ? JSON.stringify(err.data)
          : err?.message || "Ошибка при добавлении"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление объекта</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {createError && (
          <p className="add-modal__error-message">Ошибка: {createError}</p>
        )}

        <div className="add-modal__section">
          <label>Наименование *</label>
          <input
            type="text"
            name="name"
            placeholder="Например, Объект А"
            className="add-modal__input"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Описание</label>
          <textarea
            name="description"
            placeholder="Краткое описание"
            className="add-modal__input"
            value={form.description}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="add-modal__section">
          <label>Цена *</label>
          <input
            type="number"
            name="price"
            placeholder="999.99"
            className="add-modal__input"
            value={form.price}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
          />
          <div className="hint">API ожидает цену строкой — это учтено.</div>
        </div>

        <div className="add-modal__section">
          <label>Дата *</label>
          <input
            type="date"
            name="date"
            className="add-modal__input"
            value={form.date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="add-modal__section">
          <label>Количество *</label>
          <input
            type="number"
            name="quantity"
            placeholder="1"
            className="add-modal__input"
            value={form.quantity}
            onChange={handleChange}
            min="0"
            step="1"
            required
          />
        </div>

        <div className="add-modal__footer">
          <button
            className="add-modal__cancel"
            onClick={onClose}
            disabled={creating}
          >
            Отмена
          </button>
          <button
            className="add-modal__save"
            onClick={handleSubmit}
            disabled={creating}
          >
            {creating ? "Добавление..." : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================ Главный список ============================ */

const Objects = () => {
  // const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState("");
  const { objects: items, error, loading } = useSale();
  const dispatch = useDispatch();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // const load = async () => {
  //   setError("");
  //   setLoading(true);
  //   try {
  //     const data = await httpJson(API_URL, { method: "GET" });
  //     const list = listFrom(data);
  //     setItems(list);
  //     setCount(
  //       typeof data?.count === "number"
  //         ? data.count
  //         : Array.isArray(list)
  //         ? list.length
  //         : 0
  //     );
  //   } catch (err) {
  //     console.error(err);
  //     setError(
  //       err?.data
  //         ? JSON.stringify(err.data)
  //         : err?.message || "Не удалось загрузить список"
  //     );
  //     setItems([]);
  //     setCount(0);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  useEffect(() => {
    dispatch(getObjects());
  }, []);

  // Простейшая локальная фильтрация по наименованию/описанию
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => {
      const name = String(it.name || "").toLowerCase();
      const desc = String(it.description || "").toLowerCase();
      return name.includes(s) || desc.includes(s);
    });
  }, [items, search]);

  return (
    <div className="objects">
      <div className="sklad__header">
        <div className="sklad__left">
          <input
            type="text"
            placeholder="Поиск по наименованию или описанию"
            className="sklad__search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="sklad__center">
            <span>Всего: {count ?? "-"}</span>
            <span>Найдено: {filtered.length}</span>
            <button
              className="sklad__reset"
              onClick={() => dispatch(getObjects())}
              style={{ marginLeft: 12 }}
            >
              Обновить
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button className="sklad__add" onClick={() => setShowAdd(true)}>
            <Plus size={16} style={{ marginRight: "4px" }} /> Добавить объект
          </button>
        </div>
      </div>

      {error && <p className="sklad__error-message">Ошибка: {error}</p>}

      {loading ? (
        <p className="sklad__loading-message">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <p className="sklad__no-products-message">Нет записей.</p>
      ) : (
        <div className="table-wrapper">
          <table className="sklad__table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" />
                </th>
                <th></th>
                <th>№</th>
                <th>Наименование</th>
                <th>Описание</th>
                <th>Цена</th>
                <th>Кол-во</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={item.id ?? `${item.name}-${index}`}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <MoreVertical size={16} style={{ cursor: "pointer" }} />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.description ?? "-"}</td>
                  <td>{item.price}</td>
                  <td>{item.quantity}</td>
                  <td>{item.date ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaveSuccess={() => {
            setShowAdd(false);
            dispatch(getObjects()); // перезагружаем список после успешного создания
          }}
        />
      )}
    </div>
  );
};

export default Objects;
