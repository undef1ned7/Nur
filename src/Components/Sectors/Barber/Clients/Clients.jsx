import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import api from "../../../../api";
import "./Clients.scss";
import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash, FaUserPlus } from "react-icons/fa";

const UI_TO_API_STATUS = { Активен: "active", Неактивен: "inactive", VIP: "vip", "В черном списке": "blacklist" };
const API_TO_UI_STATUS = { active: "Активен", inactive: "Неактивен", vip: "VIP", blacklist: "В черном списке" };
const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

/* === опции фильтра статуса === */
const STATUS_FILTER_ALL = "Все статусы";
const STATUS_FILTER_OPTIONS = [STATUS_FILTER_ALL, ...STATUS_OPTIONS_UI];

const pad = (n) => String(n).padStart(2, "0");
const dateISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const timeISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");
const isValidPhone = (p) => normalizePhone(p).length >= 10;
const normalizeName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const getInitials = (fullName = "") => fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);

const MarketClients = lazy(() => import("../../Market/Clients/Clients"));

const Clients = () => {
  const [activeTab, setActiveTab] = useState("barber");
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clientAlerts, setClientAlerts] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);

  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

  const [creatingClientIds, setCreatingClientIds] = useState(new Set());

  /* === новый фильтр статуса === */
  const [fltStatus, setFltStatus] = useState(STATUS_FILTER_ALL);

  const fetchClients = async () => {
    const res = await api.get("/barbershop/clients/");
    const data = res?.data;
    const raw = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const normalized = raw.map((c) => ({
      id: c.id,
      fullName: c.full_name || "",
      phone: c.phone || "",
      birthDate: c.birth_date || "",
      status: API_TO_UI_STATUS[String(c.status || "").toLowerCase()] || "Активен",
      notes: c.notes || "",
    }));
    setClients(normalized);
  };

  const fetchAllAppointments = async () => {
    const acc = [];
    let next = "/barbershop/appointments/";
    while (next) {
      const { data } = await api.get(next);
      acc.push(...(data?.results || []));
      next = data?.next;
    }
    setAppointments(acc);
  };

  const fetchAllServices = async () => {
    const acc = [];
    let next = "/barbershop/services/";
    while (next) {
      const { data } = await api.get(next);
      acc.push(...(data?.results || []));
      next = data?.next;
    }
    setServices(acc);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setPageError("");
        await Promise.all([fetchClients(), fetchAllAppointments(), fetchAllServices()]);
      } catch (e) {
        console.error(e);
        setPageError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const apptsByClient = useMemo(() => {
    const map = new Map();
    appointments.forEach((a) => {
      if (!a.client) return;
      const arr = map.get(a.client) || [];
      arr.push(a);
      map.set(a.client, arr);
    });
    return map;
  }, [appointments]);

  const servicesById = useMemo(() => {
    const map = new Map();
    services.forEach((s) => map.set(s.id, s));
    return map;
  }, [services]);

  /* === применяем фильтр статуса + поиск === */
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const passStatus = fltStatus === STATUS_FILTER_ALL ? true : c.status === fltStatus;
      if (!passStatus) return false;
      if (!q) return true;
      const name = (c.fullName || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [clients, search, fltStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageSlice = useMemo(() => {
    const from = (pageSafe - 1) * PAGE_SIZE;
    return filteredClients.slice(from, from + PAGE_SIZE);
  }, [filteredClients, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, clients.length, fltStatus]); // сбрасываем страницу при смене фильтра статуса

  const openModal = (client = null) => {
    setCurrentClient(client);
    setFormErrors({});
    setClientAlerts([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setModalOpen(false);
    setCurrentClient(null);
    setFormErrors({});
    setClientAlerts([]);
    setConfirmOpen(false);
  };

  const validateClient = (form) => {
    const errs = {};
    const alerts = [];
    const nameNorm = normalizeName(form.fullName);
    const phoneNorm = normalizePhone(form.phone);
    if (!nameNorm) {
      errs.fullName = true;
      alerts.push("Укажите ФИО.");
    } else {
      const existsName = clients.some((c) => normalizeName(c.fullName) === nameNorm && (!currentClient?.id || c.id !== currentClient.id));
      if (existsName) {
        errs.fullName = true;
        alerts.push("Клиент с таким ФИО уже существует.");
      }
    }
    if (!form.phone) {
      errs.phone = true;
      alerts.push("Укажите телефон.");
    } else if (!isValidPhone(form.phone)) {
      errs.phone = true;
      alerts.push("Телефон должен содержать минимум 10 цифр.");
    } else {
      const existsPhone = clients.some((c) => normalizePhone(c.phone) === phoneNorm && (!currentClient?.id || c.id !== currentClient.id));
      if (existsPhone) {
        errs.phone = true;
        alerts.push("Клиент с таким телефоном уже существует.");
      }
    }
    if (form.birthDate) {
      const d = new Date(form.birthDate);
      const now = new Date(todayStr());
      if (Number.isNaN(d.getTime())) {
        errs.birthDate = true;
        alerts.push("Дата рождения указана некорректно.");
      } else if (d > now) {
        errs.birthDate = true;
        alerts.push("Дата рождения в будущем недопустима.");
      } else if (d.getFullYear() < 1900) {
        errs.birthDate = true;
        alerts.push("Слишком ранняя дата рождения.");
      }
    }
    if (!STATUS_OPTIONS_UI.includes(form.status)) {
      errs.status = true;
      alerts.push("Выберите статус из списка.");
    }
    return { errs, alerts };
  };

  const focusFirstError = (errs) => {
    const order = ["fullName", "phone", "birthDate", "status"];
    const firstKey = order.find((k) => errs[k]);
    if (!firstKey) return;
    const el = document.getElementById(firstKey);
    if (el?.focus) el.focus();
  };

  const saveClient = async (form) => {
    setSaving(true);
    try {
      const payload = {
        full_name: form.fullName,
        phone: form.phone,
        birth_date: form.birthDate || null,
        status: UI_TO_API_STATUS[form.status] || "active",
        notes: form.notes || null,
        company: localStorage.getItem("company"),
      };
      if (currentClient?.id) {
        await api.patch(`/barbershop/clients/${currentClient.id}/`, payload);
      } else {
        await api.post("/barbershop/clients/", payload);
      }
      await fetchClients();
      setModalOpen(false);
      setCurrentClient(null);
      setFormErrors({});
      setClientAlerts([]);
    } catch (e) {
      const data = e?.response?.data;
      const alerts = [];
      if (typeof data === "string") alerts.push(data);
      else if (data && typeof data === "object") {
        try { Object.values(data).forEach((v) => alerts.push(String(Array.isArray(v) ? v[0] : v))); } catch { alerts.push("Не удалось сохранить клиента."); }
      }
      if (!alerts.length) alerts.push("Не удалось сохранить клиента.");
      setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = {
      fullName: fd.get("fullName")?.toString().trim() || "",
      phone: fd.get("phone")?.toString().trim() || "",
      birthDate: fd.get("birthDate")?.toString().trim() || "",
      status: fd.get("status")?.toString().trim() || "Активен",
      notes: fd.get("notes")?.toString() || "",
    };
    const { errs, alerts } = validateClient(form);
    if (alerts.length) {
      setFormErrors(errs);
      setClientAlerts(["Исправьте ошибки в форме", ...alerts]);
      focusFirstError(errs);
      return;
    }
    setFormErrors({});
    setClientAlerts([]);
    saveClient(form);
  };

  const askDeleteClient = () => setConfirmOpen(true);

  const confirmDeleteClient = async () => {
    if (!currentClient?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/barbershop/clients/${currentClient.id}/`);
      await fetchClients();
      closeModal();
    } catch (e) {
      console.error(e);
      setClientAlerts(["Не удалось удалить клиента."]);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const openHistory = (client) => {
    setHistoryClient(client);
    setHistoryOpen(true);
  };
  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryClient(null);
  };
  const historyList = useMemo(() => {
    if (!historyClient?.id) return [];
    const list = (apptsByClient.get(historyClient.id) || []).slice();
    return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [historyClient, apptsByClient]);

  const fmtMoney = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`);

  const findExistingMarketClient = async (fullName, phone) => {
    try {
      const res = await api.get("/main/clients/");
      const list = asArray(res.data);
      const p = normalizePhone(phone);
      const n = normalizeName(fullName);
      return list.find((c) => {
        const phoneMatch = p && normalizePhone(c.phone || "") === p;
        const nameMatch = n && normalizeName(c.full_name || c.fio || "") === n;
        return phoneMatch || nameMatch;
      }) || null;
    } catch (e) {
      return null;
    }
  };

  const makeMarketClient = async (c) => {
    if (!c || creatingClientIds.has(c.id)) return;
    const exists = await findExistingMarketClient(c.fullName, c.phone);
    if (exists) {
      setPageError("Такой клиент уже есть!");
      return;
    }
    const payload = { type: "client", full_name: String(c.fullName || "").trim(), phone: String(c.phone || "").trim() || undefined, date: todayStr() };
    setCreatingClientIds((p) => new Set(p).add(c.id));
    setPageError("");
    try {
      await api.post("/main/clients/", payload);
    } catch (e) {
      console.error(e);
      setPageError("Не удалось создать клиента в CRM.");
    } finally {
      setCreatingClientIds((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
    }
  };

  return (
    <div className="barberclient">
      <nav className="barberclient__tabs" aria-label="Секции">
        <button
          type="button"
          onClick={() => setActiveTab("barber")}
          className={`barberclient__tab ${activeTab === "barber" ? "barberclient__tab--active" : ""}`}
        >
          Клиенты барбершоп
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("market")}
          className={`barberclient__tab ${activeTab === "market" ? "barberclient__tab--active" : ""}`}
        >
          Клиенты Продаж
        </button>
      </nav>

      {activeTab === "barber" ? (
        <>
          <header className="barberclient__header">
            <div>
              <h2 className="barberclient__title">Клиенты</h2>
              <span className="barberclient__subtitle">{loading ? "Загрузка…" : `${clients.length} записей`}</span>
            </div>
            <div className="barberclient__actions">
              {/* === новый селект статуса === */}
              <select
                className="barberclient__select"
                aria-label="Фильтр по статусу"
                title="Фильтр по статусу"
                value={fltStatus}
                onChange={(e) => setFltStatus(e.target.value)}
              >
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <div className="barberclient__search">
                <FaSearch className="barberclient__search-icon" />
                <input
                  className="barberclient__search-input"
                  type="text"
                  placeholder="Поиск по ФИО или телефону"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="barberclient__btn barberclient__btn--primary"
                onClick={() => openModal()}
              >
                <FaPlus />
              </button>
            </div>
          </header>

          {pageError && <div className="barberclient__alert">{pageError}</div>}

          {loading ? (
            <div className="barberclient__skeleton-list">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="barberclient__skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <div className="barberclient__list">
                {pageSlice.map((client) => {
                  const appts = apptsByClient.get(client.id) || [];
                  const inactive = client.status === "Неактивен";
                  const making = creatingClientIds.has(client.id);
                  return (
                    <article key={client.id} className="barberclient__card">
                      <div className="barberclient__card-left">
                        <div className="barberclient__avatar">{getInitials(client.fullName)}</div>
                        <div className="barberclient__info">
                          <h4 className="barberclient__name">{client.fullName}</h4>
                          <div className="barberclient__meta">
                            <span className={`barberclient__badge barberclient__badge--${UI_TO_API_STATUS[client.status] || "active"}`}>{client.status}</span>
                            <span>{client.phone || "—"}</span>
                            <span>•</span>
                            <span>Записей: {appts.length}</span>
                          </div>
                        </div>
                      </div>
                      <div className="barberclient__card-actions">
                        <button
                          className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
                          onClick={() => openHistory(client)}
                          aria-label="История"
                        >
                          <FaSearch />
                        </button>
                        <button
                          className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
                          onClick={() => openModal(client)}
                          aria-label="Редактировать"
                        >
                          <FaEdit />
                        </button>
                        {inactive && (
                          <button
                            className="barberclient__btn barberclient__btn--primary"
                            onClick={() => makeMarketClient(client)}
                            disabled={making}
                            title="Создать клиента в CRM"
                          >
                            <FaUserPlus />
                            <span className="barberclient__btn-label">{making ? "Создание…" : "Сделать клиентом"}</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!pageSlice.length && (
                  <div className="barberclient__loading" style={{ textAlign: "center" }}>
                    Ничего не найдено
                  </div>
                )}
              </div>

              {filteredClients.length > PAGE_SIZE && (
                <nav className="barberclient__pager" aria-label="Пагинация">
                  <button
                    type="button"
                    className="barberclient__pager-btn"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="barberclient__pager-info">
                    Страница {pageSafe} из {totalPages}
                  </span>
                  <button
                    type="button"
                    className="barberclient__pager-btn"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперёд
                  </button>
                </nav>
              )}
            </>
          )}

          {modalOpen && (
            <div className="barberclient__modalOverlay" onClick={closeModal}>
              <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
                <div className="barberclient__modalHeader">
                  <h3 className="barberclient__modalTitle">{currentClient ? "Редактировать клиента" : "Новый клиент"}</h3>
                  <button className="barberclient__iconBtn" onClick={closeModal} aria-label="Закрыть">
                    <FaTimes />
                  </button>
                </div>

                {clientAlerts.length > 0 && (
                  <div className="barberclient__alert">
                    {clientAlerts.length === 1 ? clientAlerts[0] : (
                      <ul className="barberclient__alert-list">
                        {clientAlerts.map((m, i) => (<li key={i}>{m}</li>))}
                      </ul>
                    )}
                  </div>
                )}

                <form className="barberclient__form" onSubmit={handleSubmit} noValidate>
                  <div className="barberclient__formGrid">
                    <div className={`barberclient__field ${formErrors.fullName ? "barberclient__field--invalid" : ""}`}>
                      <label htmlFor="fullName" className="barberclient__label">
                        ФИО <span className="barberclient__req">*</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        className={`barberclient__input ${formErrors.fullName ? "barberclient__input--invalid" : ""}`}
                        defaultValue={currentClient?.fullName || ""}
                        placeholder="Фамилия Имя Отчество"
                        autoFocus
                      />
                    </div>

                    <div className={`barberclient__field ${formErrors.phone ? "barberclient__field--invalid" : ""}`}>
                      <label htmlFor="phone" className="barberclient__label">
                        Телефон <span className="barberclient__req">*</span>
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        className={`barberclient__input ${formErrors.phone ? "barberclient__input--invalid" : ""}`}
                        defaultValue={currentClient?.phone || ""}
                        placeholder="+996 ..."
                        inputMode="tel"
                      />
                    </div>

                    <div className={`barberclient__field ${formErrors.birthDate ? "barberclient__field--invalid" : ""}`}>
                      <label htmlFor="birthDate" className="barberclient__label">
                        Дата рождения
                      </label>
                      <input
                        id="birthDate"
                        name="birthDate"
                        className={`barberclient__input ${formErrors.birthDate ? "barberclient__input--invalid" : ""}`}
                        defaultValue={currentClient?.birthDate || ""}
                        type="date"
                      />
                    </div>

                    <div className={`barberclient__field ${formErrors.status ? "barberclient__field--invalid" : ""}`}>
                      <label htmlFor="status" className="barberclient__label">
                        Статус
                      </label>
                      <select
                        id="status"
                        name="status"
                        className={`barberclient__input ${formErrors.status ? "barberclient__input--invalid" : ""}`}
                        defaultValue={currentClient?.status || "Активен"}
                      >
                        {STATUS_OPTIONS_UI.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="barberclient__field barberclient__field--full">
                      <label htmlFor="notes" className="barberclient__label">
                        Заметки
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        className="barberclient__textarea"
                        defaultValue={currentClient?.notes || ""}
                        placeholder="Комментарий, пожелания…"
                      />
                    </div>
                  </div>

                  <div className="barberclient__formActions">
                    {currentClient?.id ? (
                      <button
                        type="button"
                        className="barberclient__btn barberclient__btn--danger"
                        onClick={askDeleteClient}
                        disabled={saving || deleting}
                        title="Удалить клиента"
                      >
                        <FaTrash />
                        <span className="barberclient__btn-label">{deleting ? "Удаление…" : "Удалить"}</span>
                      </button>
                    ) : (
                      <span className="barberclient__actionsSpacer" />
                    )}

                    <div className="barberclient__actionsRight">
                      <button
                        type="button"
                        className="barberclient__btn barberclient__btn--secondary"
                        onClick={closeModal}
                        disabled={saving || deleting}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={saving || deleting}
                        className="barberclient__btn barberclient__btn--primary"
                      >
                        {saving ? "Сохранение…" : "Сохранить"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmOpen && (
            <div className="barberclient__confirmOverlay" onClick={() => setConfirmOpen(false)}>
              <div
                className="barberclient__confirm"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="barberclient__confirm-title">Удалить клиента?</div>
                <div className="barberclient__confirm-text">
                  Действие необратимо. Клиент «{currentClient?.fullName || "—"}» будет удалён.
                </div>
                <div className="barberclient__confirm-actions">
                  <button
                    className="barberclient__btn barberclient__btn--danger"
                    onClick={confirmDeleteClient}
                    disabled={deleting}
                  >
                    {deleting ? "Удаление…" : "Удалить"}
                  </button>
                  <button
                    className="barberclient__btn barberclient__btn--secondary"
                    onClick={() => setConfirmOpen(false)}
                    disabled={deleting}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {historyOpen && (
            <div className="barberclient__modalOverlay" onClick={closeHistory}>
              <div className="barberclient__modal" onClick={(e) => e.stopPropagation()}>
                <div className="barberclient__modalHeader">
                  <h3 className="barberclient__modalTitle">История — {historyClient?.fullName}</h3>
                  <button className="barberclient__iconBtn" onClick={closeHistory} aria-label="Закрыть">
                    <FaTimes />
                  </button>
                </div>

                <div className="barberclient__form" style={{ marginTop: 0 }}>
                  {historyList.length === 0 ? (
                    <div className="barberclient__meta">Записей нет</div>
                  ) : (
                    <div className="barberclient__history">
                      {historyList.map((a) => {
                        const date = dateISO(a.start_at);
                        const time = timeISO(a.start_at);
                        const barber = a.barber_name || (a.barber ? `ID ${a.barber}` : "—");
                        const svcObj = servicesById.get(a.service);
                        const service = a.service_name || svcObj?.service_name || svcObj?.name || "—";
                        const priceVal = a.service_price ?? a.price ?? svcObj?.price;
                        return (
                          <div key={a.id} className="barberclient__history-card">
                            <div className="barberclient__history-top">
                              <span className="barberclient__badge">{date} • {time}</span>
                            </div>
                            <div className="barberclient__meta" style={{ gap: 12 }}>
                              <span>Мастер: {barber}</span>
                              <span>•</span>
                              <span>Услуга: {service}</span>
                              <span>•</span>
                              <span>Цена: {fmtMoney(priceVal)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="barberclient__formActions">
                    <button
                      type="button"
                      className="barberclient__btn barberclient__btn--secondary"
                      onClick={closeHistory}
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <Suspense fallback={<div className="barberclient__loading">Загрузка…</div>}>
          <MarketClients />
        </Suspense>
      )}
    </div>
  );
};

export default Clients;
