import React, { useEffect, useMemo, useState } from "react";
import { Plus, MoreVertical, X } from "lucide-react";
import "./clients.scss";

const API_BASE = "https://app.nurcrm.kg/api/building";

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
  const ct = res.headers.get("content-type") || "";
  let data = null;
  if (text) {
    if (ct.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    } else {
      data = { raw: text };
    }
  }

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

const buildUrl = (endpoint, params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null) {
      qs.append(k, v);
    }
  });
  const query = qs.toString();
  return `${API_BASE}${endpoint}${query ? `?${query}` : ""}`;
};

const listFrom = (data) =>
  data && (data.results || data) && Array.isArray(data.results || data)
    ? data.results || data
    : [];

function ClientForm({ value, onChange }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="clients-modal__section">
        <label>
          Имя / название <span className="clients-modal__req">*</span>
        </label>
        <input
          className="clients-modal__input"
          name="name"
          value={value.name}
          onChange={handleChange}
          placeholder="ОсОО Ромашка"
          required
        />
      </div>
      <div className="clients-modal__section">
        <label>Телефон</label>
        <input
          className="clients-modal__input"
          name="phone"
          value={value.phone}
          onChange={handleChange}
          placeholder="+996700000000"
        />
      </div>
      <div className="clients-modal__section">
        <label>Email</label>
        <input
          className="clients-modal__input"
          name="email"
          type="email"
          value={value.email}
          onChange={handleChange}
          placeholder="info@example.com"
        />
      </div>
      <div className="clients-modal__section">
        <label>ИНН</label>
        <input
          className="clients-modal__input"
          name="inn"
          value={value.inn}
          onChange={handleChange}
          placeholder="123456789"
        />
      </div>
      <div className="clients-modal__section">
        <label>Адрес</label>
        <input
          className="clients-modal__input"
          name="address"
          value={value.address}
          onChange={handleChange}
          placeholder="г. Бишкек, ..."
        />
      </div>
      <div className="clients-modal__section">
        <label>Заметки</label>
        <textarea
          className="clients-modal__input clients-modal__textarea"
          name="notes"
          value={value.notes}
          onChange={handleChange}
          placeholder="Постоянный клиент"
          rows={3}
        />
      </div>
      <div className="clients-modal__section clients-modal__checkbox-row">
        <label className="clients-modal__checkbox-label">
          <input
            type="checkbox"
            checked={value.is_active}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, is_active: e.target.checked }))
            }
          />
          Активный клиент
        </label>
      </div>
    </>
  );
}

function CreateClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    inn: "",
    address: "",
    notes: "",
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Имя/название клиента обязательно");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const data = await httpJson(`${API_BASE}/clients/`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated?.(data);
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err?.data ? JSON.stringify(err.data) : err?.message || "Ошибка создания"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="clients__modalOverlay">
      <div className="clients-modal">
        <div className="clients-modal__header">
          <h3 className="clients-modal__title">Новый клиент (строительство)</h3>
          <button
            type="button"
            className="clients-modal__iconBtn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error && <div className="clients-modal__error">{error}</div>}
        <form className="clients-modal__form" onSubmit={handleSubmit}>
          <ClientForm value={form} onChange={setForm} />
          <div className="clients-modal__footer">
            <button
              type="button"
              className="clients-modal__btn"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clients-modal__btn clients-modal__btn--primary"
              disabled={busy}
            >
              {busy ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClientModal({ client, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: client.name || "",
    phone: client.phone || "",
    email: client.email || "",
    inn: client.inn || "",
    address: client.address || "",
    notes: client.notes || "",
    is_active: client.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Имя/название клиента обязательно");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const data = await httpJson(`${API_BASE}/clients/${client.id}/`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      onUpdated?.(data);
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err?.data ? JSON.stringify(err.data) : err?.message || "Ошибка сохранения"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="clients__modalOverlay">
      <div className="clients-modal">
        <div className="clients-modal__header">
          <h3 className="clients-modal__title">Редактирование клиента</h3>
          <button
            type="button"
            className="clients-modal__iconBtn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error && <div className="clients-modal__error">{error}</div>}
        <form className="clients-modal__form" onSubmit={handleSubmit}>
          <ClientForm value={form} onChange={setForm} />
          <div className="clients-modal__footer">
            <button
              type="button"
              className="clients-modal__btn"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clients-modal__btn clients-modal__btn--primary"
              disabled={busy}
            >
              {busy ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BuildingClients() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const loadClients = async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      const url = buildUrl("/clients/", params);
      const data = await httpJson(url);
      setRows(listFrom(data));
    } catch (err) {
      console.error(err);
      setError(
        err?.data ? JSON.stringify(err.data) : err?.message || "Ошибка загрузки"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients({ is_active: true });
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadClients({
      search: search.trim() || undefined,
      is_active: onlyActive ? true : undefined,
    });
  };

  const effectiveRows = useMemo(() => {
    if (!search && !onlyActive) return rows;
    return rows.filter((c) => {
      if (onlyActive && !c.is_active) return false;
      if (!search.trim()) return true;
      const hay = `${c.name || ""} ${c.phone || ""} ${c.email || ""} ${
        c.inn || ""
      }`
        .toLowerCase()
        .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [rows, search, onlyActive]);

  const onCreated = (client) => {
    setRows((prev) => [client, ...prev]);
  };

  const onUpdated = (updated) => {
    setRows((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="building-clients">
      <div className="building-clients__header">
        <div>
          <h1 className="building-clients__title">Клиенты строительства</h1>
          <p className="building-clients__subtitle">
            Список клиентов по объектам строительства с быстрым поиском и
            фильтрами.
          </p>
        </div>
        <button
          className="building-clients__add"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} /> <span>Добавить клиента</span>
        </button>
      </div>

      <div className="building-clients__toolbar">
        <form
          className="building-clients__searchForm"
          onSubmit={handleSearchSubmit}
        >
          <input
            className="building-clients__search"
            placeholder="Поиск по имени, телефону, email, ИНН"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="building-clients__btn building-clients__btn--primary"
          >
            Найти
          </button>
          <button
            type="button"
            className="building-clients__btn"
            onClick={() => {
              setSearch("");
              setOnlyActive(true);
              loadClients({ is_active: true });
            }}
          >
            Сбросить
          </button>
        </form>

        <label className="building-clients__toggle">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          Только активные
        </label>
      </div>

      {error && (
        <div className="building-clients__alert building-clients__alert--error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="building-clients__status">Загрузка...</div>
      ) : effectiveRows.length === 0 ? (
        <div className="building-clients__status">Клиенты не найдены.</div>
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
                <th>Имя / название</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>ИНН</th>
                <th>Адрес</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((c, idx) => (
                <tr key={c.id || idx}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="building-clients__iconBtn"
                      onClick={() => setEditClient(c)}
                      title="Редактировать"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                  <td>{idx + 1}</td>
                  <td>{c.name || "—"}</td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.inn || "—"}</td>
                  <td>{c.address || "—"}</td>
                  <td>{c.is_active ? "Активен" : "Отключён"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateClientModal onClose={() => setCreateOpen(false)} onCreated={onCreated} />
      )}
      {editClient && (
        <EditClientModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}