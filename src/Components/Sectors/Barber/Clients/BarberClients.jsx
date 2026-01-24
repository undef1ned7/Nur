// BarberClients.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./Clients.scss";

import {
  UI_TO_API_STATUS,
  API_TO_UI_STATUS,
  STATUS_OPTIONS_UI,
  PAGE_SIZE,
} from "./barberClientConstants";

import {
  todayStr,
  normalizePhone,
  isValidPhone,
  normalizeName,
  asArray,
  parseApiError,
} from "./barberClientUtils";

import { ClientsHeader, ClientsList, ClientModals } from "./components";

export const BarberClients = () => {
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clientAlerts, setClientAlerts] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);

  const [page, setPage] = useState(1);

  /* === CRM создание: прогресс, итоговый статус, тосты === */
  const [creatingClientIds, setCreatingClientIds] = useState(new Set());
  const [crmCreatedIds, setCrmCreatedIds] = useState(new Set());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  /* фильтры */
  const [fltStatus, setFltStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("table");

  /* для подъёма новых в верх верхней группы */
  const [lastAddedId, setLastAddedId] = useState(null);

  /* === загрузка данных === */
  const fetchClients = async () => {
    const res = await api.get("/barbershop/clients/");
    const data = res?.data;
    const raw = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    const normalized = raw.map((c) => ({
      id: c.id,
      fullName: c.full_name || "",
      phone: c.phone || "",
      birthDate: c.birth_date || "",
      status:
        API_TO_UI_STATUS[String(c.status || "").toLowerCase()] ||
        "Активен",
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

  const fetchAllEmployees = async () => {
    const acc = [];
    let next = "/users/employees/";
    while (next) {
      const { data } = await api.get(next);
      acc.push(...(data?.results || data || []));
      next = data?.next;
    }
    setEmployees(acc);
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        setPageError("");
        await Promise.all([
          fetchClients(),
          fetchAllAppointments(),
          fetchAllServices(),
          fetchAllEmployees(),
        ]);
      } catch (e) {
        console.error(e);
        setPageError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
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

  /* Последний визит клиента */
  const getLastVisit = useCallback((clientId) => {
    const appts = apptsByClient.get(clientId) || [];
    if (!appts.length) return null;
    const sorted = [...appts].sort((a, b) => 
      new Date(b.start_at) - new Date(a.start_at)
    );
    return sorted[0]?.start_at || null;
  }, [apptsByClient]);

  /* === сортировка клиентов === */
  const sortClients = useCallback((arr, sortKey) => {
    const sorted = [...arr];
    switch (sortKey) {
      case "oldest":
        return sorted.sort((a, b) => {
          const ad = Date.parse(a.createdAt || 0) || 0;
          const bd = Date.parse(b.createdAt || 0) || 0;
          return ad - bd;
        });
      case "name_asc":
        return sorted.sort((a, b) => 
          (a.fullName || "").localeCompare(b.fullName || "", "ru")
        );
      case "name_desc":
        return sorted.sort((a, b) => 
          (b.fullName || "").localeCompare(a.fullName || "", "ru")
        );
      case "visits_desc":
        return sorted.sort((a, b) => {
          const va = apptsByClient.get(a.id)?.length || 0;
          const vb = apptsByClient.get(b.id)?.length || 0;
          return vb - va;
        });
      case "last_visit":
        return sorted.sort((a, b) => {
          const la = getLastVisit(a.id);
          const lb = getLastVisit(b.id);
          if (!la && !lb) return 0;
          if (!la) return 1;
          if (!lb) return -1;
          return new Date(lb) - new Date(la);
        });
      case "newest":
      default:
        return sorted.sort((a, b) => {
          if (lastAddedId && (a.id === lastAddedId || b.id === lastAddedId)) {
            return a.id === lastAddedId ? -1 : 1;
          }
          const ad = Date.parse(a.createdAt || 0) || 0;
          const bd = Date.parse(b.createdAt || 0) || 0;
          return bd - ad;
        });
    }
  }, [apptsByClient, getLastVisit, lastAddedId]);

  /* === фильтр + поиск + сортировка === */
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = clients.filter((c) => {
      const passStatus = fltStatus === "all" ? true : c.status === fltStatus;
      if (!passStatus) return false;

      if (!q) return true;
      const name = (c.fullName || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });

    return sortClients(base, sortBy);
  }, [clients, search, fltStatus, sortBy, sortClients]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredClients.length / PAGE_SIZE)
  );
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageSlice = useMemo(() => {
    const from = (pageSafe - 1) * PAGE_SIZE;
    return filteredClients.slice(from, from + PAGE_SIZE);
  }, [filteredClients, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, clients.length, fltStatus, sortBy]);

  /* Проверка есть ли активные фильтры */
  const hasFilters = search || fltStatus !== "all" || sortBy !== "newest";

  /* Сброс всех фильтров */
  const handleReset = () => {
    setSearch("");
    setFltStatus("all");
    setSortBy("newest");
    setPage(1);
  };

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
      const existsName = clients.some(
        (c) =>
          normalizeName(c.fullName) === nameNorm &&
          (!currentClient?.id || c.id !== currentClient.id)
      );
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
      const existsPhone = clients.some(
        (c) =>
          normalizePhone(c.phone) === phoneNorm &&
          (!currentClient?.id || c.id !== currentClient.id)
      );
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
        const { data: created } = await api.post(
          "/barbershop/clients/",
          payload
        );
        setLastAddedId(created?.id || null);
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

      setClients((prev) => prev.filter((c) => c.id !== currentClient.id));

      setConfirmOpen(false);
      setModalOpen(false);
      setCurrentClient(null);

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

      return (
        list.find((c) => {
          const phoneMatch = p && normalizePhone(c.phone || "") === p;
          const nameMatch =
            n && normalizeName(c.full_name || c.fio || "") === n;
          return phoneMatch || nameMatch;
        }) || null
      );
    } catch {
      return null;
    }
  };

  const makeMarketClient = async (c) => {
    if (!c || creatingClientIds.has(c.id)) return;

    if (!normalizeName(c.fullName)) {
      setToast({ type: "error", text: "Укажите ФИО клиента." });
      return;
    }

    if (!isValidPhone(c.phone)) {
      setToast({
        type: "error",
        text: "Телефон должен содержать минимум 10 цифр.",
      });
      return;
    }

    setCreatingClientIds((prev) => new Set(prev).add(c.id));

    try {
      const exists = await findExistingMarketClient(
        c.fullName,
        c.phone
      );
      if (exists) {
        setToast({
          type: "error",
          text: "Такой клиент уже есть в Продажах.",
        });
        return;
      }

      await api.post("/main/clients/", {
        type: "client",
        full_name: String(c.fullName || "").trim(),
        phone: String(c.phone || "").trim() || undefined,
        date: todayStr(),
      });

      setCrmCreatedIds((prev) => new Set(prev).add(c.id));
      setToast({
        type: "success",
        text: "Клиент создан в Продажах.",
      });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409 || status === 400) {
        setToast({
          type: "error",
          text: "Такой клиент уже есть в Продажах.",
        });
      } else {
        setToast({
          type: "error",
          text: parseApiError(e, "Не удалось создать клиента в CRM."),
        });
      }
    } finally {
      setCreatingClientIds((prev) => {
        const n = new Set(prev);
        n.delete(c.id);
        return n;
      });
    }
  };

  /* === история записей === */
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
    return list.sort(
      (a, b) => new Date(b.start_at) - new Date(a.start_at)
    );
  }, [historyClient, apptsByClient]);

  const fmtMoney = (v) =>
    v === null || v === undefined || v === ""
      ? "—"
      : `${Number(v).toLocaleString("ru-RU")} сом`;

  /* === рендер === */
  return (
    <>
      {toast && (
        <div
          className={`barberclient__toast barberclient__toast--${toast.type}`}
        >
          {toast.text}
        </div>
      )}

      <ClientsHeader
        fltStatus={fltStatus}
        onStatusChange={setFltStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onReset={handleReset}
        onAdd={() => openModal()}
        hasFilters={hasFilters}
      />

      <ClientsList
        pageError={pageError}
        loading={loading}
        pageSlice={pageSlice}
        filteredCount={filteredClients.length}
        pageSafe={pageSafe}
        totalPages={totalPages}
        apptsByClient={apptsByClient}
        viewMode={viewMode}
        onOpenModal={openModal}
        onPageChange={setPage}
        getLastVisit={getLastVisit}
        onOpenHistory={openHistory}
      />

      <ClientModals
        modalOpen={modalOpen}
        confirmOpen={confirmOpen}
        historyOpen={historyOpen}
        currentClient={currentClient}
        historyClient={historyClient}
        historyList={historyList}
        clientAlerts={clientAlerts}
        formErrors={formErrors}
        saving={saving}
        deleting={deleting}
        statusOptions={STATUS_OPTIONS_UI}
        onCloseModal={closeModal}
        onSubmit={handleSubmit}
        onOpenConfirm={() => setConfirmOpen(true)}
        onCloseConfirm={() => setConfirmOpen(false)}
        onConfirmDelete={confirmDeleteClient}
        onCloseHistory={closeHistory}
        fmtMoney={fmtMoney}
        servicesById={servicesById}
        employees={employees}
      />
    </>
  );
};

export default BarberClients;
