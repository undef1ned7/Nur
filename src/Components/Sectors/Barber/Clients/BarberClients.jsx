// BarberClients.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import api from "../../../../api";
import "./Clients.scss";

import {
  UI_TO_API_STATUS,
  API_TO_UI_STATUS,
  STATUS_OPTIONS_UI,
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
  // Server-side список: состояние query
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);

  // Server-side список: состояние данных
  const [clients, setClients] = useState([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [clientsNext, setClientsNext] = useState(null);
  const [clientsPrevious, setClientsPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  // Refs для отмены запросов и защиты от race conditions
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const historyAbortControllerRef = useRef(null);
  const historyRequestIdRef = useRef(0);
  const historyDebounceRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clientAlerts, setClientAlerts] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyNext, setHistoryNext] = useState(null);
  const [historyPrevious, setHistoryPrevious] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");

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
  const [viewMode, setViewMode] = useState("table");


  // Маппинг сортировки UI -> API
  const getOrderingForAPI = (sortKey) => {
    switch (sortKey) {
      case "name_asc":
        return "full_name";
      case "name_desc":
        return "-full_name";
      case "oldest":
        return "created_at";
      case "newest":
      default:
        return "-created_at";
    }
  };

  // Debounce для search (400ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Debounce для истории клиента (400ms)
  useEffect(() => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
    }

    historyDebounceRef.current = setTimeout(() => {
      setDebouncedHistorySearch(historySearch);
    }, 400);

    return () => {
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
      }
    };
  }, [historySearch]);

  // Сброс page при изменении search или ordering
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy]);

  // Сброс page при изменении фильтра статуса
  useEffect(() => {
    setPage(1);
  }, [fltStatus]);

  // Основной эффект для загрузки clients (server-side)
  useEffect(() => {
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Создаем новый AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Увеличиваем requestId для защиты от race conditions
    const currentRequestId = ++requestIdRef.current;

    // Формируем query params
    const params = {};
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    const ordering = getOrderingForAPI(sortBy);
    if (ordering) {
      params.ordering = ordering;
    }
    if (page > 1) {
      params.page = page;
    }
    if (fltStatus !== "all") {
      const apiStatus = UI_TO_API_STATUS[fltStatus];
      if (apiStatus) {
        params.status = apiStatus;
      }
    }

    // Выполняем запрос
    setLoading(true);
    setPageError("");

    api.get("/barbershop/clients/", {
      params,
      signal: abortController.signal,
    })
      .then((response) => {
        // Проверяем, что это актуальный запрос
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Проверяем, что запрос не был отменен
        if (abortController.signal.aborted) {
          return;
        }

        const data = response.data;

        // Обрабатываем ответ (может быть {results, count, next, previous} или просто массив)
        let results = [];
        let count = 0;
        let next = null;
        let previous = null;

        if (Array.isArray(data)) {
          results = data;
          count = data.length;
        } else {
          results = data.results || [];
          count = data.count || results.length;
          next = data.next || null;
          previous = data.previous || null;
        }

        // Нормализуем данные
        const normalized = results.map((c) => ({
          id: c.id,
          fullName: c.full_name || "",
          phone: c.phone || "",
          birthDate: c.birth_date || "",
          status:
            API_TO_UI_STATUS[String(c.status || "").toLowerCase()] ||
            "Активен",
          notes: c.notes || "",
          createdAt: c.created_at || c.createdAt || null,
          visitsCount:
            c.visits_count ??
            c.visitsCount ??
            c.visits ??
            null,
        }));

        setClients(normalized);
        setClientsCount(count);
        setClientsNext(next);
        setClientsPrevious(previous);
        setLoading(false);
      })
      .catch((err) => {
        // Игнорируем ошибки отмененных запросов
        if (err.name === "AbortError" || err.name === "CanceledError") {
          return;
        }

        // Проверяем, что это актуальный запрос
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const errorMessage =
          err?.response?.data?.detail ||
          err?.message ||
          "Не удалось загрузить клиентов.";

        setPageError(errorMessage);
        setLoading(false);
      });

    // Cleanup: отменяем запрос при размонтировании или изменении зависимостей
    return () => {
      // Отменяем только если это текущий запрос
      if (abortControllerRef.current === abortController) {
        abortController.abort();
        abortControllerRef.current = null;
      }
    };
  }, [debouncedSearch, sortBy, page, fltStatus]);

  // Cleanup при размонтировании компонента
  useEffect(() => {
    return () => {
      // Отменяем все активные запросы при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (historyAbortControllerRef.current) {
        historyAbortControllerRef.current.abort();
        historyAbortControllerRef.current = null;
      }
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = null;
      }
    };
  }, []);

  // Вычисляем totalPages на основе count
  const totalPages = useMemo(() => {
    if (clientsCount === 0) return 1;
    const pageSize = clients.length || 1;
    if (pageSize === 0) return 1;
    if (clientsNext) {
      return Math.ceil(clientsCount / pageSize);
    }
    return page;
  }, [clientsCount, clients.length, clientsNext, page]);

  /* Проверка есть ли активные фильтры */
  const hasFilters = search || fltStatus !== "all" || sortBy !== "newest";

  /* Сброс всех фильтров */
  const handleReset = () => {
    setSearch("");
    setFltStatus("all");
    setSortBy("newest");
    setPage(1);
  };

  // Функция для обновления списка clients
  const refreshClients = useCallback(() => {
    // Триггерим перезагрузку через изменение page
    if (page === 1) {
      setPage(2);
      setTimeout(() => setPage(1), 0);
    } else {
      setPage(1);
    }
  }, [page]);

  /* === модальные окна === */
  const openModal = (client = null) => {
    setCurrentClient(client);
    setFormErrors({});
    setClientAlerts([]);
    setConfirmOpen(false);
    setModalOpen(true);
  };

  const openConfirm = () => {
    setConfirmOpen(true);
  };

  const closeModal = () => {
    // Не закрываем модальное окно во время сохранения, чтобы не потерять данные
    if (saving) return;
    // Разрешаем закрытие во время удаления, так как удаление обрабатывается отдельно
    setModalOpen(false);
    setCurrentClient(null);
    setFormErrors({});
    setClientAlerts([]);
    setConfirmOpen(false);
  };

  /* === валидация === */
  const validateClient = async (form) => {
    const errs = {};
    const alerts = [];

    const nameNorm = normalizeName(form.fullName);
    const phoneNorm = normalizePhone(form.phone);

    if (!nameNorm) {
      errs.fullName = true;
      alerts.push("Укажите ФИО.");
    } else {
      // Проверяем дубликаты через API
      try {
        const params = { search: nameNorm };
        const { data } = await api.get("/barbershop/clients/", { params });
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const existsName = list.some(
          (c) =>
            normalizeName(c.full_name || "") === nameNorm &&
            (!currentClient?.id || c.id !== currentClient.id)
        );
        if (existsName) {
          errs.fullName = true;
          alerts.push("Клиент с таким ФИО уже существует.");
        }
      } catch (e) {
        // Игнорируем ошибки при проверке, бекенд сам проверит
        console.error("Не удалось проверить дубликаты по имени:", e);
      }
    }

    if (!form.phone) {
      errs.phone = true;
      alerts.push("Укажите телефон.");
    } else if (!isValidPhone(form.phone)) {
      errs.phone = true;
      alerts.push("Телефон должен содержать минимум 10 цифр.");
    } else {
      // Проверяем дубликаты через API
      try {
        const params = { search: phoneNorm };
        const { data } = await api.get("/barbershop/clients/", { params });
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const existsPhone = list.some(
          (c) =>
            normalizePhone(c.phone || "") === phoneNorm &&
            (!currentClient?.id || c.id !== currentClient.id)
        );
        if (existsPhone) {
          errs.phone = true;
          alerts.push("Клиент с таким телефоном уже существует.");
        }
      } catch (e) {
        // Игнорируем ошибки при проверке, бекенд сам проверит
        console.error("Не удалось проверить дубликаты по телефону:", e);
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
        await api.post(
          "/barbershop/clients/",
          payload
        );
      }

      refreshClients();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const form = {
      fullName: fd.get("fullName")?.toString().trim() || "",
      phone: fd.get("phone")?.toString().trim() || "",
      birthDate: fd.get("birthDate")?.toString().trim() || "",
      status: fd.get("status")?.toString().trim() || "Активен",
      notes: fd.get("notes")?.toString() || "",
    };

    const { errs, alerts } = await validateClient(form);

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

      // Успешное удаление - закрываем все модальные окна и очищаем состояние
      setConfirmOpen(false);
      setModalOpen(false);
      setCurrentClient(null);
      setFormErrors({});
      setClientAlerts([]);

      // Обновляем список клиентов
      refreshClients();
    } catch (e) {
      console.error(e);
      // При ошибке закрываем окно подтверждения и показываем ошибку в модальном окне
      setConfirmOpen(false);
      setClientAlerts(["Не удалось удалить клиента."]);
      // Модальное окно редактирования остается открытым, чтобы показать ошибку
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
    setHistorySearch("");
    setDebouncedHistorySearch("");
    setHistoryPage(1);
    setHistoryList([]);
    setHistoryCount(0);
    setHistoryNext(null);
    setHistoryPrevious(null);
    setHistoryOpen(true);
  };

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryClient(null);
    setHistoryList([]);
    setHistoryCount(0);
    setHistoryNext(null);
    setHistoryPrevious(null);
    setHistoryPage(1);
    setHistoryError("");
  };

  // Сброс page при изменении поиска в истории
  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedHistorySearch]);

  // Загрузка истории записей (server-side)
  useEffect(() => {
    // Отменяем предыдущий запрос истории
    if (historyAbortControllerRef.current) {
      historyAbortControllerRef.current.abort();
      historyAbortControllerRef.current = null;
    }

    if (!historyOpen || !historyClient?.id) {
      return;
    }

    const clientId = encodeURIComponent(historyClient.id);
    const abortController = new AbortController();
    historyAbortControllerRef.current = abortController;
    const currentRequestId = ++historyRequestIdRef.current;

    const params = {};
    if (debouncedHistorySearch.trim()) {
      params.search = debouncedHistorySearch.trim();
    }
    if (historyPage > 1) {
      params.page = historyPage;
    }

    setHistoryLoading(true);
    setHistoryError("");

    api
      .get(`/barbershop/clients/${clientId}/visits/history/`, {
        params,
        signal: abortController.signal,
      })
      .then((response) => {
        if (currentRequestId !== historyRequestIdRef.current) {
          return;
        }
        if (abortController.signal.aborted) {
          return;
        }

        const data = response.data;
        const results = Array.isArray(data) ? data : data?.results || [];
        const count = Array.isArray(data) ? data.length : data?.count || results.length;
        const next = Array.isArray(data) ? null : data?.next || null;
        const previous = Array.isArray(data) ? null : data?.previous || null;

        setHistoryList(results);
        setHistoryCount(count);
        setHistoryNext(next);
        setHistoryPrevious(previous);
        setHistoryLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError" || err.name === "CanceledError") {
          return;
        }
        if (currentRequestId !== historyRequestIdRef.current) {
          return;
        }
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Не удалось загрузить историю визитов.";
        setHistoryError(message);
        setHistoryLoading(false);
      });

    return () => {
      if (historyAbortControllerRef.current === abortController) {
        abortController.abort();
        historyAbortControllerRef.current = null;
      }
    };
  }, [historyOpen, historyClient, debouncedHistorySearch, historyPage]);

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
        clients={clients}
        count={clientsCount}
        page={page}
        next={clientsNext}
        previous={clientsPrevious}
        totalPages={totalPages}
        viewMode={viewMode}
        onOpenModal={openModal}
        onPageChange={setPage}
        onOpenHistory={openHistory}
      />

      <ClientModals
        modalOpen={modalOpen}
        confirmOpen={confirmOpen}
        historyOpen={historyOpen}
        currentClient={currentClient}
        historyClient={historyClient}
        historyList={historyList}
        historyCount={historyCount}
        historyNext={historyNext}
        historyPrevious={historyPrevious}
        historyPage={historyPage}
        historyLoading={historyLoading}
        historyError={historyError}
        historySearch={historySearch}
        onHistorySearchChange={setHistorySearch}
        onHistoryPageChange={setHistoryPage}
        clientAlerts={clientAlerts}
        formErrors={formErrors}
        saving={saving}
        deleting={deleting}
        statusOptions={STATUS_OPTIONS_UI}
        onCloseModal={closeModal}
        onSubmit={handleSubmit}
        onOpenConfirm={openConfirm}
        onCloseConfirm={() => setConfirmOpen(false)}
        onConfirmDelete={confirmDeleteClient}
        onCloseHistory={closeHistory}
        fmtMoney={fmtMoney}
      />
    </>
  );
};

export default BarberClients;
