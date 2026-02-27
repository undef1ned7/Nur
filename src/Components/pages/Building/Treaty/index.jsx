import React, { useEffect, useMemo, useState } from "react";
import { Plus, MoreVertical, X } from "lucide-react";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import "./treaty.scss";

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

const statusLabels = {
  draft: "Черновик",
  active: "Активен",
  cancelled: "Отменён",
  completed: "Завершён",
};

const erpStatusLabels = {
  not_configured: "ERP не настроена",
  pending: "Ожидает",
  success: "Создано в ERP",
  error: "Ошибка ERP",
};

function TreatyForm({ value, onChange, clientsOptions, complexesOptions }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="treaty-modal__row">
        <div className="treaty-modal__field">
          <label>
            ЖК <span className="treaty-modal__req">*</span>
          </label>
          <select
            name="residential_complex"
            className="treaty-modal__input"
            value={value.residential_complex}
            onChange={handleChange}
            required
          >
            <option value="">Выберите ЖК</option>
            {complexesOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="treaty-modal__field">
          <label>
            Клиент <span className="treaty-modal__req">*</span>
          </label>
          <select
            name="client"
            className="treaty-modal__input"
            value={value.client}
            onChange={handleChange}
            required
          >
            <option value="">Выберите клиента</option>
            {clientsOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="treaty-modal__row">
        <div className="treaty-modal__field">
          <label>Номер договора</label>
          <input
            name="number"
            className="treaty-modal__input"
            value={value.number}
            onChange={handleChange}
            placeholder="ДГ-001"
          />
        </div>
        <div className="treaty-modal__field">
          <label>
            Наименование <span className="treaty-modal__req">*</span>
          </label>
          <input
            name="title"
            className="treaty-modal__input"
            value={value.title}
            onChange={handleChange}
            placeholder="Договор подряда"
            required
          />
        </div>
      </div>

      <div className="treaty-modal__section">
        <label>Описание</label>
        <textarea
          name="description"
          className="treaty-modal__input treaty-modal__textarea"
          value={value.description}
          onChange={handleChange}
          placeholder="Условия договора..."
          rows={3}
        />
      </div>

      <div className="treaty-modal__row">
        <div className="treaty-modal__field">
          <label>Сумма</label>
          <input
            type="number"
            name="amount"
            className="treaty-modal__input"
            value={value.amount}
            onChange={handleChange}
            min="0"
            step="0.01"
            placeholder="150000.00"
          />
        </div>
        <div className="treaty-modal__field">
          <label>Статус</label>
          <select
            name="status"
            className="treaty-modal__input"
            value={value.status}
            onChange={handleChange}
          >
            <option value="draft">Черновик</option>
            <option value="active">Активен</option>
            <option value="completed">Завершён</option>
            <option value="cancelled">Отменён</option>
          </select>
        </div>
      </div>

      <div className="treaty-modal__section treaty-modal__checkbox-row">
        <label className="treaty-modal__checkbox-label">
          <input
            type="checkbox"
            checked={value.auto_create_in_erp}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                auto_create_in_erp: e.target.checked,
              }))
            }
          />
          Создавать договор в ERP автоматически
        </label>
      </div>
    </>
  );
}

function CreateTreatyModal({
  onClose,
  onCreated,
  clientsOptions,
  complexesOptions,
}) {
  const [form, setForm] = useState({
    residential_complex: "",
    client: "",
    number: "",
    title: "",
    description: "",
    amount: "",
    status: "draft",
    auto_create_in_erp: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.residential_complex || !form.client || !form.title.trim()) {
      alert("Заполните ЖК, клиента и наименование договора");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const payload = {
        ...form,
        amount: form.amount ? String(form.amount) : undefined,
      };
      const data = await httpJson(`${API_BASE}/treaties/`, {
        method: "POST",
        body: JSON.stringify(payload),
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
    <div className="treaty__modalOverlay">
      <div className="treaty-modal">
        <div className="treaty-modal__header">
          <h3 className="treaty-modal__title">Новый договор</h3>
          <button
            type="button"
            className="treaty-modal__iconBtn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error && <div className="treaty-modal__error">{error}</div>}
        <form className="treaty-modal__form" onSubmit={handleSubmit}>
          <TreatyForm
            value={form}
            onChange={setForm}
            clientsOptions={clientsOptions}
            complexesOptions={complexesOptions}
          />
          <div className="treaty-modal__footer">
            <button
              type="button"
              className="treaty-modal__btn"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="treaty-modal__btn treaty-modal__btn--primary"
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

function EditTreatyModal({
  treaty,
  onClose,
  onUpdated,
  clientsOptions,
  complexesOptions,
}) {
  const [form, setForm] = useState({
    residential_complex: treaty.residential_complex || "",
    client: treaty.client || "",
    number: treaty.number || "",
    title: treaty.title || "",
    description: treaty.description || "",
    amount: treaty.amount || "",
    status: treaty.status || "draft",
    auto_create_in_erp: treaty.auto_create_in_erp ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.residential_complex || !form.client || !form.title.trim()) {
      alert("Заполните ЖК, клиента и наименование договора");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const payload = {
        ...form,
        amount: form.amount ? String(form.amount) : undefined,
      };
      const data = await httpJson(`${API_BASE}/treaties/${treaty.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
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
    <div className="treaty__modalOverlay">
      <div className="treaty-modal">
        <div className="treaty-modal__header">
          <h3 className="treaty-modal__title">Редактирование договора</h3>
          <button
            type="button"
            className="treaty-modal__iconBtn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {error && <div className="treaty-modal__error">{error}</div>}
        <form className="treaty-modal__form" onSubmit={handleSubmit}>
          <TreatyForm
            value={form}
            onChange={setForm}
            clientsOptions={clientsOptions}
            complexesOptions={complexesOptions}
          />
          <div className="treaty-modal__footer">
            <button
              type="button"
              className="treaty-modal__btn"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="treaty-modal__btn treaty-modal__btn--primary"
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

export default function BuildingTreaty() {
  const { selectedProjectId } = useBuildingProjects();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [erpFilter, setErpFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTreaty, setEditTreaty] = useState(null);

  const [clientsOptions, setClientsOptions] = useState([]);
  const [complexesOptions, setComplexesOptions] = useState([]);

  const fetchTreaties = async (params = {}) => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError("");
    try {
      const url = buildUrl("/treaties/", {
        ...params,
        residential_complex: selectedProjectId,
      });
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

  const fetchClients = async () => {
    try {
      const data = await httpJson(`${API_BASE}/clients/`);
      setClientsOptions(listFrom(data));
    } catch (e) {
      console.error(e);
      setClientsOptions([]);
    }
  };

  const fetchComplexes = async () => {
    try {
      const data = await httpJson(`${API_BASE}/objects/`);
      setComplexesOptions(listFrom(data));
    } catch (e) {
      console.error(e);
      setComplexesOptions([]);
    }
  };

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchTreaties();
    fetchClients();
    fetchComplexes();
  }, [selectedProjectId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    fetchTreaties({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      erp_sync_status: erpFilter || undefined,
    });
  };

  const effectiveRows = useMemo(() => {
    if (!search && !statusFilter && !erpFilter) return rows;
    return rows.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (erpFilter && t.erp_sync_status !== erpFilter) return false;
      if (!search.trim()) return true;
      const hay = `${t.number || ""} ${t.title || ""} ${
        t.description || ""
      } ${t.client_name || ""} ${t.residential_complex_name || ""}`
        .toLowerCase()
        .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [rows, search, statusFilter, erpFilter]);

  const onCreated = (treaty) => {
    setRows((prev) => [treaty, ...prev]);
  };

  const onUpdated = (updated) => {
    setRows((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleErpCreate = async (treaty) => {
    if (!window.confirm("Отправить договор на создание в ERP?")) return;
    try {
      await httpJson(`${API_BASE}/treaties/${treaty.id}/erp/create/`, {
        method: "POST",
      });
      fetchTreaties();
    } catch (e) {
      console.error(e);
      alert(
        e?.data
          ? JSON.stringify(e.data)
          : e?.message || "Не удалось отправить договор в ERP"
      );
    }
  };

  return (
    <div className="building-treaty">
      <div className="building-treaty__header">
        <div>
          <h1 className="building-treaty__title">Договоры строительства</h1>
          <p className="building-treaty__subtitle">
            Реестр договоров по объектам строительства с фильтрами и ERP-синхронизацией.
          </p>
        </div>
        <button
          className="building-treaty__add"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} /> <span>Новый договор</span>
        </button>
      </div>

      <form
        className="building-treaty__filters"
        onSubmit={handleSearchSubmit}
      >
        <input
          className="building-treaty__search"
          placeholder="Поиск по номеру, названию, описанию, клиенту, ЖК"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="building-treaty__select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Статус: все</option>
          <option value="draft">Черновики</option>
          <option value="active">Активные</option>
          <option value="completed">Завершённые</option>
          <option value="cancelled">Отменённые</option>
        </select>

        <select
          className="building-treaty__select"
          value={erpFilter}
          onChange={(e) => setErpFilter(e.target.value)}
        >
          <option value="">ERP: все</option>
          <option value="not_configured">ERP не настроена</option>
          <option value="pending">Ожидает</option>
          <option value="success">Создано</option>
          <option value="error">Ошибка</option>
        </select>

        <button
          type="submit"
          className="building-treaty__btn building-treaty__btn--primary"
        >
          Применить
        </button>
        <button
          type="button"
          className="building-treaty__btn"
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setErpFilter("");
            fetchTreaties();
          }}
        >
          Сбросить
        </button>
      </form>

      {error && (
        <div className="building-treaty__alert building-treaty__alert--error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="building-treaty__status">Загрузка...</div>
      ) : effectiveRows.length === 0 ? (
        <div className="building-treaty__status">Договоры не найдены.</div>
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
                <th>Номер</th>
                <th>Название</th>
                <th>ЖК</th>
                <th>Клиент</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>ERP</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((t, idx) => (
                <tr key={t.id || idx}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="building-treaty__iconBtn"
                      onClick={() => setEditTreaty(t)}
                      title="Редактировать"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                  <td>{idx + 1}</td>
                  <td>{t.number || "—"}</td>
                  <td>{t.title || "—"}</td>
                  <td>{t.residential_complex_name || t.residential_complex || "—"}</td>
                  <td>{t.client_name || t.client || "—"}</td>
                  <td>{t.amount || "—"}</td>
                  <td>{statusLabels[t.status] || t.status || "—"}</td>
                  <td>
                    <span
                      className={`building-treaty__erp building-treaty__erp--${
                        t.erp_sync_status || "none"
                      }`}
                    >
                      {erpStatusLabels[t.erp_sync_status] || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="building-treaty__smallBtn"
                      onClick={() => handleErpCreate(t)}
                    >
                      В ERP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateTreatyModal
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
          clientsOptions={clientsOptions}
          complexesOptions={complexesOptions}
        />
      )}

      {editTreaty && (
        <EditTreatyModal
          treaty={editTreaty}
          onClose={() => setEditTreaty(null)}
          onUpdated={onUpdated}
          clientsOptions={clientsOptions}
          complexesOptions={complexesOptions}
        />
      )}
    </div>
  );
}