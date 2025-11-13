// Clients.jsx
import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import api from "../../../../api";
import "./Clients.scss";
import { FaPlus, FaEdit, FaTimes, FaSearch, FaTrash, FaUserPlus, FaCheck } from "react-icons/fa";

/* === статусы и отображение === */
const UI_TO_API_STATUS = { Активен: "active", Неактивен: "inactive", VIP: "vip", "В черном списке": "blacklist" };
const API_TO_UI_STATUS = { active: "Активен", inactive: "Неактивен", vip: "VIP", blacklist: "В черном списке" };
const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

/* === фильтр статуса === */
const STATUS_FILTER_ALL = "Все статусы";
const STATUS_FILTER_OPTIONS = [STATUS_FILTER_ALL, ...STATUS_OPTIONS_UI];

/* === ранги групп для сортировки ===
   0 — верх: Активен и VIP (внутри новые сверху)
   1 — средина: Неактивен
   2 — низ: В черном списке
*/
const STATUS_RANK = { "Активен": 0, "VIP": 0, "Неактивен": 1, "В черном списке": 2 };
const rankOf = (ui) => STATUS_RANK[ui] ?? 1;

/* === утилиты === */
const pad = (n) => String(n).padStart(2, "0");
const dateISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const timeISO = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");
const isValidPhone = (p) => normalizePhone(p).length >= 10;
const normalizeName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const getInitials = (fullName = "") => fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);

/* парсер ошибок API для понятных сообщений */
const parseApiError = (e, fallback = "Ошибка запроса.") => {
  const data = e?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const arr = [];
    try { Object.values(data).forEach((v) => arr.push(String(Array.isArray(v) ? v[0] : v))); } catch {}
    if (arr.length) return arr.join("; ");
  }
  const status = e?.response?.status;
  if (status) return `Ошибка ${status}`;
  return fallback;
};

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

  /* === CRM создание: прогресс, итоговый статус, тосты === */
  const [creatingClientIds, setCreatingClientIds] = useState(new Set());
  const [crmCreatedIds, setCrmCreatedIds] = useState(new Set());
  const [toast, setToast] = useState(null); // { type: "success"|"error", text: string }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  /* фильтр статуса */
  const [fltStatus, setFltStatus] = useState(STATUS_FILTER_ALL);

  /* для подъёма новых в верх верхней группы */
  const [lastAddedId, setLastAddedId] = useState(null);

  /* === загрузка данных === */
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
      createdAt: c.created_at || c.createdAt || null,
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

  /* === индексы === */
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

  /* === сортировка клиентов === */
  const clientsSorter = (a, b) => {
    const ra = rankOf(a.status);
    const rb = rankOf(b.status);
    if (ra !== rb) return ra - rb; // группы

    // верхняя группа: «новый» сразу наверху
    if (ra === 0 && lastAddedId && (a.id === lastAddedId || b.id === lastAddedId)) {
      return a.id === lastAddedId ? -1 : 1;
    }

    // затем по дате создания (новее выше)
    const ad = Date.parse(a.createdAt || 0) || 0;
    const bd = Date.parse(b.createdAt || 0) || 0;
    if (ad !== bd) return bd - ad;

    // стабильно по ФИО
    return String(a.fullName || "").localeCompare(String(b.fullName || ""), "ru", { sensitivity: "base" });
  };

  /* === фильтр + поиск + сортировка === */
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = clients.filter((c) => {
      const passStatus = fltStatus === STATUS_FILTER_ALL ? true : c.status === fltStatus;
      if (!passStatus) return false;
      if (!q) return true;
      const name = (c.fullName || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
    return base.sort(clientsSorter);
  }, [clients, search, fltStatus, lastAddedId]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageSlice = useMemo(() => {
    const from = (pageSafe - 1) * PAGE_SIZE;
    return filteredClients.slice(from, from + PAGE_SIZE);
  }, [filteredClients, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, clients.length, fltStatus]);

  /* === модальные окна === */
  const openModal = (client = null) => {
    setCurrentClient(client);
    setFormErrors({});
    setClientAlerts([]);
    setConfirmOpen(false);
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

  /* === валидация === */
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

  /* === сохранение === */
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
        const id = encodeURIComponent(currentClient.id);
        try {
          await api.patch(`/barbershop/clients/${id}/`, payload);
        } catch (err) {
          const st = err?.response?.status;
          if (st === 404 || st === 405 || st === 301 || st === 302) {
            await api.patch(`/barbershop/clients/${id}`, payload);
          } else {
            throw err;
          }
        }
      } else {
        const { data: created } = await api.post("/barbershop/clients/", payload);
        setLastAddedId(created?.id || null); // поднимем нового в верх верхней группы
      }

      await fetchClients();
      setModalOpen(false);
      setCurrentClient(null);
      setFormErrors({});
      setClientAlerts([]);
    } catch (e) {
      const alerts = [parseApiError(e, "Не удалось сохранить клиента.")];
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

  /* === удаление === */
  const confirmDeleteClient = async () => {
    if (!currentClient?.id) return;
    setDeleting(true);
    try {
      const id = encodeURIComponent(currentClient.id);

      try {
        await api.delete(`/barbershop/clients/${id}/`);
      } catch (err) {
        const st = err?.response?.status;
        if (st === 404 || st === 405 || st === 301 || st === 302) {
          await api.delete(`/barbershop/clients/${id}`);
        } else {
          throw err;
        }
      }

      // оптимистично из UI
      setClients((prev) => prev.filter((c) => c.id !== currentClient.id));

      // закрыть окна
      setConfirmOpen(false);
      setModalOpen(false);
      setCurrentClient(null);

      // синхронизировать
      await fetchClients();
    } catch (e) {
      console.error(e);
      setClientAlerts(["Не удалось удалить клиента."]);
      setConfirmOpen(false);
      setModalOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  /* === Продажи (CRM) === */
  const findExistingMarketClient = async (fullName, phone) => {
    try {
      const res = await api.get("/main/clients/");
      const list = asArray(res.data);
      const p = normalizePhone(phone);
      const n = normalizeName(fullName);
      return list.find((c) => {
        const phoneMatch = p && normalizePhone(c.phone || "") === p;
        const nameMatch  = n && normalizeName(c.full_name || c.fio || "") === n;
        return phoneMatch || nameMatch;
      }) || null;
    } catch {
      return null;
    }
  };

  const makeMarketClient = async (c) => {
    if (!c || creatingClientIds.has(c.id)) return;

    // базовая валидация
    if (!normalizeName(c.fullName)) {
      setToast({ type: "error", text: "Укажите ФИО клиента." });
      return;
    }
    if (!isValidPhone(c.phone)) {
      setToast({ type: "error", text: "Телефон должен содержать минимум 10 цифр." });
      return;
    }

    setCreatingClientIds((p) => new Set(p).add(c.id));
    try {
      // быстрый предчек дублей
      const exists = await findExistingMarketClient(c.fullName, c.phone);
      if (exists) {
        setToast({ type: "error", text: "Такой клиент уже есть в Продажах." });
        return;
      }

      // создание
      await api.post("/main/clients/", {
        type: "client",
        full_name: String(c.fullName || "").trim(),
        phone: String(c.phone || "").trim() || undefined,
        date: todayStr(),
      });

      setCrmCreatedIds((prev) => new Set(prev).add(c.id));
      setToast({ type: "success", text: "Клиент создан в Продажах." });

      // при желании сразу открыть вкладку Продаж:
      // setActiveTab("market");
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409 || status === 400) {
        setToast({ type: "error", text: "Такой клиент уже есть в Продажах." });
      } else {
        setToast({ type: "error", text: parseApiError(e, "Не удалось создать клиента в CRM.") });
      }
    } finally {
      setCreatingClientIds((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
    }
  };

  /* === история записей === */
  const openHistory = (client) => { setHistoryClient(client); setHistoryOpen(true); };
  const closeHistory = () => { setHistoryOpen(false); setHistoryClient(null); };

  const historyList = useMemo(() => {
    if (!historyClient?.id) return [];
    const list = (apptsByClient.get(historyClient.id) || []).slice();
    return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [historyClient, apptsByClient]);

  const fmtMoney = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`);

  /* === рендер === */
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

      {toast && (
        <div className={`barberclient__toast barberclient__toast--${toast.type}`}>
          {toast.text}
        </div>
      )}

      {activeTab === "barber" ? (
        <>
          <header className="barberclient__header">
            <div>
              <h2 className="barberclient__title">Клиенты</h2>
              <span className="barberclient__subtitle">{loading ? "Загрузка…" : `${clients.length} записей`}</span>
            </div>
            <div className="barberclient__actions">
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
                  const making = creatingClientIds.has(client.id);
                  const alreadyMade = crmCreatedIds.has(client.id);
                  const statusCode = UI_TO_API_STATUS[client.status] || "active"; // active | inactive | vip | blacklist

                  return (
                    <article key={client.id} className={`barberclient__card barberclient__card--status-${statusCode}`}>
                      <div className="barberclient__card-left">
                        <div className="barberclient__avatar">{getInitials(client.fullName)}</div>
                        <div className="barberclient__info">
                          <h4 className="barberclient__name">{client.fullName}</h4>
                          <div className="barberclient__meta">
                            <span className={`barberclient__badge barberclient__badge--${statusCode}`}>{client.status}</span>
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
                          title="История записей"
                        >
                          <FaSearch />
                        </button>
                        <button
                          className="barberclient__btn barberclient__btn--secondary barberclient__btn--icon"
                          onClick={() => openModal(client)}
                          aria-label="Редактировать"
                          title="Редактировать клиента"
                        >
                          <FaEdit />
                        </button>

                        <button
                          className="barberclient__btn barberclient__btn--primary barberclient__btn--iconOnly"
                          onClick={() => makeMarketClient(client)}
                          disabled={making || alreadyMade}
                          aria-label={
                            making ? "Создание клиента в CRM…" :
                            alreadyMade ? "Клиент уже создан в CRM" :
                            "Создать клиента в CRM"
                          }
                          title={
                            making ? "Создание клиента в CRM…" :
                            alreadyMade ? "Клиент уже создан в CRM" :
                            "Создать клиента в CRM"
                          }
                        >
                          {alreadyMade ? (
                            <FaCheck />
                          ) : (
                            <FaUserPlus className={`barberclient__btn-icon ${making ? "is-spinning" : ""}`} />
                          )}
                        </button>
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

          {/* форма редактирования показывается только если НЕ открыт confirm */}
          {modalOpen && !confirmOpen && (
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
                        onClick={() => setConfirmOpen(true)}
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
                              <span>Сотрудник: {barber}</span>
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
