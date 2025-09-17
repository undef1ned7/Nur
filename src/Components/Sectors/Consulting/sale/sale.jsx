import React, { useEffect, useMemo, useRef, useState } from "react";
import "./sale.scss";
import { FaPlus, FaTimes, FaTrash } from "react-icons/fa";

/* ===== localStorage keys ===== */
const LS_SALES = "sales_v1";
const LS_CLIENTS = "clients_v1";
const LS_SERVICES = "services_v1";
const LS_EMPLOYEES = "employees_v1";

/* ===== helpers ===== */
const safeRead = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    return Array.isArray(val) ? val : fallback;
  } catch {
    return fallback;
  }
};
const safeWrite = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {/* ignore */}
};
const notifySalesUpdated = () => window.dispatchEvent(new Event("sales:updated"));
const notifyEmployeesUpdated = () => window.dispatchEvent(new Event("employees:updated"));

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const money = (v) => (Number(v) || 0).toLocaleString() + " с";

/* нормализация под наш UI */
const normalizeService = (s = {}) => ({
  id: s.id || s.uuid || String(Date.now()),
  title: s.title ?? s.name ?? "",
  price: Number(s.price ?? 0) || 0,
});
const normalizeClient = (c = {}) => ({
  id: c.id || c.uuid || String(Date.now()),
  full_name: c.full_name ?? c.name ?? "",
  phone: c.phone ?? "",
});
const normalizeEmployee = (e = {}) => ({
  id: e.id || e.uuid || String(Date.now()),
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  email: e.email ?? "",
  commission_percent: Number(e.commission_percent ?? 0) || 0, // ВАЖНО: процент
});
const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

/* ===== Component ===== */
export default function ConsultingSale() {
  /* списки */
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);

  /* продажи-история (локально) */
  const [rows, setRows] = useState([]);

  /* модалка создания продажи */
  const [open, setOpen] = useState(false);

  /* форма */
  const [sellerId, setSellerId] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [note, setNote] = useState("");

  /* инлайн-создание клиента */
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: "", phone: "" });
  const [formErr, setFormErr] = useState("");

  /* === ВАЖНО === StrictMode двойной init */
  const didInitRef = useRef(false);

  /* загрузка из localStorage (однократно) */
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    setServices(safeRead(LS_SERVICES).map(normalizeService));
    setClients(safeRead(LS_CLIENTS).map(normalizeClient));
    const emps = safeRead(LS_EMPLOYEES).map(normalizeEmployee);
    setEmployees(emps);
    if (!emps.length) notifyEmployeesUpdated();

    const sales = safeRead(LS_SALES).map((s) => ({
      id: s.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
      seller_id: s.seller_id,
      client_id: s.client_id,
      service_id: s.service_id,
      seller_name: s.seller_name || s.sellerName || "",
      client_name: s.client_name || s.clientName || "",
      service_title: s.service_title || s.serviceTitle || "",
      service_price: Number(s.service_price ?? 0) || 0,
      seller_percent: Number(s.seller_percent ?? 0) || 0, // <— уже сохранённый процент
      note: s.note || "",
      created_at: s.created_at || new Date().toISOString(),
    }));
    sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setRows(sales);
  }, []);

  /* живое обновление сотрудников */
  useEffect(() => {
    const onUpdated = () => {
      setEmployees(safeRead(LS_EMPLOYEES).map(normalizeEmployee));
    };
    window.addEventListener("employees:updated", onUpdated);
    return () => window.removeEventListener("employees:updated", onUpdated);
  }, []);

  // справочники по id
  const seller = useMemo(
    () => employees.find((x) => String(x.id) === String(sellerId)) || null,
    [employees, sellerId]
  );
  const client = useMemo(
    () => clients.find((x) => String(x.id) === String(clientId)) || null,
    [clients, clientId]
  );
  const service = useMemo(
    () => services.find((x) => String(x.id) === String(serviceId)) || null,
    [services, serviceId]
  );

  const canCreate = Boolean(sellerId) && Boolean(clientId) && Boolean(serviceId);

  const resetForm = () => {
    setSellerId("");
    setClientId("");
    setServiceId("");
    setNote("");
    setCreateClientOpen(false);
    setNewClient({ full_name: "", phone: "" });
    setFormErr("");
  };

  /* сохранить продажу (локально) */
  const submitSale = (e) => {
    e.preventDefault();
    if (!canCreate) {
      setFormErr("Выберите продавца, клиента и услугу.");
      return;
    }
    setFormErr("");

    const row = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      seller_id: sellerId,
      client_id: clientId,
      service_id: serviceId,
      seller_name: fullName(seller) || seller?.email || `ID ${sellerId}`,
      client_name: client?.full_name || client?.phone || `ID ${clientId}`,
      service_title: service?.title || `ID ${serviceId}`,
      service_price: service?.price || 0,
      seller_percent: Number(seller?.commission_percent || 0), // <— фиксируем % на момент продажи
      note: note || "",
      created_at: new Date().toISOString(),
    };

    const next = [row, ...rows];
    setRows(next);
    safeWrite(LS_SALES, next);
    notifySalesUpdated();

    setOpen(false);
    resetForm();
  };

  /* создать клиента инлайн (тоже локально) */
  const submitCreateClient = (e) => {
    e.preventDefault();
    const full_name = clean(newClient.full_name);
    if (!full_name || full_name.length < 2) {
      setFormErr("Введите имя клиента (минимум 2 символа).");
      return;
    }
    const c = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      full_name,
      phone: clean(newClient.phone),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const next = [c, ...clients];
    setClients(next);
    safeWrite(LS_CLIENTS, next);
    setClientId(String(c.id));
    setCreateClientOpen(false);
    setNewClient({ full_name: "", phone: "" });
    setFormErr("");
  };

  /* удалить продажу из списка */
  const removeSale = (row) => {
    if (!window.confirm("Удалить эту продажу?")) return;
    const next = rows.filter((r) => r.id !== row.id);
    setRows(next);
    safeWrite(LS_SALES, next);
    notifySalesUpdated();
  };

  return (
    <section className="sale">
      <header className="sale__header">
        <div>
          <h2 className="sale__title">Продажи</h2>
          <p className="sale__subtitle">Выбор продавца, клиента и услуги (локально)</p>
        </div>
        <div className="sale__toolbar">
          <button className="sale__btn sale__btn--primary" onClick={() => setOpen(true)}>
            <FaPlus />Продажа
          </button>
        </div>
      </header>

      {/* подсказки, если пустые справочники */}
      {employees.length === 0 && (
        <div className="sale__alert">
          Добавьте сотрудников (раздел «Преподаватели/Сотрудники»). Список пуст.
        </div>
      )}
      {services.length === 0 && (
        <div className="sale__alert">
          Справочник услуг пуст. Создайте услуги в разделе «Услуги».
        </div>
      )}

      {/* История продаж (локально) */}
      <div className="sale__tableWrap">
        <table className="sale__table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Продавец</th>
              <th>Клиент</th>
              <th>Услуга</th>
              <th>Цена</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.seller_name}</td>
                  <td>{r.client_name}</td>
                  <td className="sale__ellipsis" title={r.service_title}>
                    {r.service_title}
                  </td>
                  <td>{money(r.service_price)}</td>
                  <td className="sale__rowActions">
                    <button
                      className="sale__btn sale__btn--danger"
                      onClick={() => removeSale(r)}
                      title="Удалить продажу"
                    >
                      <FaTrash /> Удалить
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="sale__empty" colSpan={6}>
                  Пока нет продаж
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ====== Модалка «Новая продажа» ====== */}
      {open && (
        <div
          className="sale__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="sale__modal" onClick={(e) => e.stopPropagation()}>
            <div className="sale__modalHeader">
              <h3 className="sale__modalTitle">Новая продажа</h3>
              <button
                className="sale__iconBtn"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!formErr && <div className="sale__alert sale__alert--error">{formErr}</div>}

            <form className="sale__form" onSubmit={submitSale} noValidate>
              <div className="sale__grid">
                {/* Продавец */}
                <div className="sale__field">
                  <label className="sale__label">Продавец *</label>
                  <select
                    className="sale__input"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    required
                  >
                    <option value="">Выберите сотрудника</option>
                    {employees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {fullName(u) || u.email || `ID ${u.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Клиент + Быстро создать */}
                <div className="sale__field">
                  <label className="sale__label">Клиент *</label>
                  <div className="sale__row">
                    <select
                      className="sale__input"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    >
                      <option value="">Выберите клиента</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.phone || `ID ${c.id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="sale__btn sale__btn--secondary"
                      onClick={() => setCreateClientOpen((v) => !v)}
                    >
                      <FaPlus /> Клиент
                    </button>
                  </div>
                </div>

                {/* Инлайн форма клиента */}
                {createClientOpen && (
                  <div className="sale__field sale__field--full">
                    <div className="sale__inlineCard">
                      <div className="sale__inlineGrid">
                        <div className="sale__field">
                          <label className="sale__label">Имя клиента *</label>
                          <input
                            className="sale__input"
                            value={newClient.full_name}
                            onChange={(e) =>
                              setNewClient((p) => ({ ...p, full_name: e.target.value }))
                            }
                            maxLength={120}
                            required
                          />
                        </div>
                        <div className="sale__field">
                          <label className="sale__label">Телефон</label>
                          <input
                            className="sale__input"
                            value={newClient.phone}
                            onChange={(e) =>
                              setNewClient((p) => ({ ...p, phone: e.target.value }))
                            }
                            maxLength={40}
                            placeholder="+996700000000"
                          />
                        </div>
                      </div>
                      <div className="sale__inlineActions">
                        <button
                          type="button"
                          className="sale__btn"
                          onClick={() => setCreateClientOpen(false)}
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          className="sale__btn sale__btn--primary"
                          onClick={submitCreateClient}
                        >
                          Создать клиента
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Услуга */}
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Услуга *</label>
                  <select
                    className="sale__input"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    required
                  >
                    <option value="">Выберите услугу</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} — {money(s.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Заметка (опционально) */}
                <div className="sale__field sale__field--full">
                  <label className="sale__label">Заметка</label>
                  <textarea
                    className="sale__input"
                    rows={3}
                    placeholder="Комментарий к продаже (необязательно)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="sale__actions">
                <button type="button" className="sale__btn" onClick={() => setOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="sale__btn sale__btn--primary" disabled={!canCreate}>
                  Продать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
