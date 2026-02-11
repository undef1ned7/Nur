import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FaSearch, FaFilter } from "react-icons/fa";
import {
  RequestCard,
  RequestDetailModal,
  FiltersModal,
  Pager,
} from "./components";
import Loading from "../../../common/Loading/Loading";
import "./Requests.scss";
import api from "../../../../api";

const BOOKINGS_EP = "/barbershop/bookings/";

const normPhone = (p) => String(p || "").replace(/[^\d]/g, "").trim();

const normName = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

async function createAppointmentFromBooking(request) {
  const company = localStorage.getItem("company");
  let clientId = null;
  const bookingName = normName(request.client_name);
  const bookingPhone = normPhone(request.client_phone);

  if (bookingPhone || request.client_name) {
    const clientsRes = await api.get("/barbershop/clients/", {
      params: { page_size: 1000 },
    });
    const list = asArray(clientsRes.data);
    let found = null;
    if (bookingPhone) {
      const byPhone = list.filter(
        (c) => normPhone(c.phone || c.phone_number) === bookingPhone
      );
      found = byPhone.find(
        (c) => normName(c.full_name || c.name) === bookingName
      );
      if (!found && byPhone.length && !bookingName) {
        found = byPhone[0];
      }
    }
    if (found) {
      clientId = found.id;
    } else {
      const { data } = await api.post("/barbershop/clients/", {
        full_name: (request.client_name || "Клиент").trim(),
        phone: (request.client_phone || "").trim() || null,
        status: "active",
        notes: null,
        company,
      });
      clientId = data?.id ?? data?.data?.id;
    }
  }
  const masterId =
    request.master?.id ?? request.master ?? request.master_id;
  if (!masterId) throw new Error("Нет мастера в заявке");
  const dateStr =
    request.date && String(request.date).length >= 10
      ? String(request.date).slice(0, 10)
      : null;
  if (!dateStr || !request.time_start || !request.time_end)
    throw new Error("Нет даты или времени в заявке");
  const tStart = String(request.time_start).slice(0, 5);
  const tEnd = String(request.time_end).slice(0, 5);
  const start_at = `${dateStr}T${tStart}:00+06:00`;
  const end_at = `${dateStr}T${tEnd}:00+06:00`;
  const serviceIds = (request.services || [])
    .map((s) => s.id ?? s.service_id ?? s.service)
    .filter(Boolean);
  const payload = {
    client: clientId,
    barber: masterId,
    services: serviceIds.length ? serviceIds : [],
    start_at,
    end_at,
    status: "confirmed",
    comment: request.client_comment || null,
    company,
    price:
      request.total_price != null && request.total_price !== ""
        ? Number(request.total_price)
        : null,
  };
  await api.post("/barbershop/appointments/", payload);
}

/* ===== Status tabs config ===== */
const STATUS_TABS = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "confirmed", label: "Подтверждены" },
  { value: "no_show", label: "Не пришли" },
  { value: "spam", label: "Спам" },
];

const Requests = () => {
  // Server-side список: состояние query
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [masterFilter, setMasterFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Server-side список: состояние данных
  const [requests, setRequests] = useState([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [requestsNext, setRequestsNext] = useState(null);
  const [requestsPrevious, setRequestsPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Counts by status - отдельное состояние для общих счетчиков
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    new: 0,
    confirmed: 0,
    no_show: 0,
    spam: 0,
  });

  // Refs для отмены запросов и защиты от race conditions
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const countsAbortControllerRef = useRef(null);

  /* Modals */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Маппинг сортировки UI -> API
  const getOrderingForAPI = (sortKey) => {
    switch (sortKey) {
      case "oldest":
        return "created_at";
      case "price_asc":
        return "total_price";
      case "price_desc":
        return "-total_price";
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

  // Сброс page при изменении search или ordering или фильтров
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, statusTab, statusFilter, masterFilter, dateFrom, dateTo]);

  // Основной эффект для загрузки bookings (server-side)
  useEffect(() => {
    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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

    // Статус из таба или фильтра (приоритет у фильтра)
    const status = statusFilter || (statusTab !== "all" ? statusTab : null);
    if (status) {
      params.status = status;
    }

    // Фильтр по мастеру
    if (masterFilter) {
      params.master = masterFilter;
    }

    // Фильтры по дате
    if (dateFrom) {
      params.date_from = dateFrom;
    }
    if (dateTo) {
      params.date_to = dateTo;
    }

    // Выполняем запрос
    setLoading(true);
    setError("");

    api.get(BOOKINGS_EP, {
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

        setRequests(results);
        setRequestsCount(count);
        setRequestsNext(next);
        setRequestsPrevious(previous);
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
          "Не удалось загрузить заявки.";

        setError(errorMessage);
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
  }, [debouncedSearch, sortBy, page, statusTab, statusFilter, masterFilter, dateFrom, dateTo]);

  // Отдельный эффект для загрузки counts по статусам
  useEffect(() => {
    // Отменяем предыдущий запрос counts
    if (countsAbortControllerRef.current) {
      countsAbortControllerRef.current.abort();
      countsAbortControllerRef.current = null;
    }

    const abortController = new AbortController();
    countsAbortControllerRef.current = abortController;

    // Параллельно запрашиваем count для каждого статуса
    const fetchCounts = async () => {
      try {
        const statuses = ['new', 'confirmed', 'no_show', 'spam'];
        const promises = [
          // all - без фильтра по статусу
          api.get(BOOKINGS_EP, { 
            params: { page: 1, page_size: 1 }, 
            signal: abortController.signal 
          }),
          // для каждого статуса
          ...statuses.map(status => 
            api.get(BOOKINGS_EP, { 
              params: { status, page: 1, page_size: 1 }, 
              signal: abortController.signal 
            })
          )
        ];

        const results = await Promise.all(promises);
        
        if (abortController.signal.aborted) {
          return;
        }

        const newCounts = {
          all: results[0].data.count || 0,
          new: results[1].data.count || 0,
          confirmed: results[2].data.count || 0,
          no_show: results[3].data.count || 0,
          spam: results[4].data.count || 0,
        };

        setStatusCounts(newCounts);
      } catch (err) {
        if (err.name === "AbortError" || err.name === "CanceledError") {
          return;
        }
        console.error("Error fetching status counts:", err);
      }
    };

    fetchCounts();

    return () => {
      if (countsAbortControllerRef.current === abortController) {
        abortController.abort();
        countsAbortControllerRef.current = null;
      }
    };
  }, []); // Загружаем counts только при монтировании

  // Cleanup при размонтировании компонента
  useEffect(() => {
    return () => {
      // Отменяем все активные запросы при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (countsAbortControllerRef.current) {
        countsAbortControllerRef.current.abort();
        countsAbortControllerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  // Вычисляем totalPages на основе count
  const totalPages = useMemo(() => {
    if (requestsCount === 0) return 1;
    const pageSize = requests.length || 1;
    if (pageSize === 0) return 1;
    if (requestsNext) {
      return Math.ceil(requestsCount / pageSize);
    }
    return page;
  }, [requestsCount, requests.length, requestsNext, page]);

  /* Master options for filter - получаем из текущих заявок */
  const masterOptions = useMemo(() => {
    const opts = [{ value: "", label: "Все мастера" }];
    const uniqueMasters = new Map();
    
    requests.forEach((r) => {
      if (r.master && !uniqueMasters.has(r.master.id)) {
        const first = r.master.first_name ?? "";
        const last = r.master.last_name ?? "";
        const name = [first, last].filter(Boolean).join(" ").trim() || r.master.email || "—";
        uniqueMasters.set(r.master.id, { value: r.master.id, label: name });
      }
    });
    
    return [...opts, ...Array.from(uniqueMasters.values())];
  }, [requests]);

  /* Handle status change via API */
  const handleStatusChange = useCallback(async (requestId, newStatus) => {
    const oldRequest = requests.find((r) => r.id === requestId);
    const oldStatus = oldRequest?.status;

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );

    try {
      if (newStatus === "confirmed" && oldRequest) {
        await createAppointmentFromBooking(oldRequest);
      }
      await api.patch(`${BOOKINGS_EP}${requestId}/status/`, { status: newStatus });

      if (newStatus === "confirmed") {
        window.dispatchEvent(new CustomEvent("barber:booking-confirmed"));
      }

      if (oldStatus && oldStatus !== newStatus) {
        setStatusCounts((prev) => ({
          ...prev,
          [oldStatus]: Math.max(0, prev[oldStatus] - 1),
          [newStatus]: prev[newStatus] + 1,
        }));
      }

      if (page === 1) {
        setPage(2);
        setTimeout(() => setPage(1), 0);
      } else {
        setPage(1);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      if (page === 1) {
        setPage(2);
        setTimeout(() => setPage(1), 0);
      } else {
        setPage(1);
      }
    }
  }, [page, requests]);


  /* Active filters count */
  const activeFiltersCount = [
    statusFilter,
    masterFilter,
    dateFrom,
    dateTo,
    sortBy !== "newest" ? sortBy : null,
  ].filter(Boolean).length;

  /* Clear filters */
  const handleClearFilters = () => {
    setStatusFilter("");
    setSortBy("newest");
    setMasterFilter("");
    setDateFrom("");
    setDateTo("");
  };

  /* Reset all */
  const handleReset = () => {
    setSearch("");
    setStatusTab("all");
    handleClearFilters();
    setPage(1);
    setFiltersOpen(false);
  };

  const counterText = loading
    ? "Загрузка…"
    : `${requestsCount} заявок`;

  const hasFilters = search || activeFiltersCount > 0 || statusTab !== "all";

  return (
    <div className="barberrequests">
      <div className="barberrequests__topRow">
        <span className="barberrequests__counter">{counterText}</span>
        {hasFilters && (
          <button
            type="button"
            className="barberrequests__resetBtn"
            onClick={handleReset}
          >
            Сбросить
          </button>
        )}
      </div>

      <div className="barberrequests__tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`barberrequests__tab ${
              statusTab === tab.value ? "barberrequests__tab--active" : ""
            }`}
            onClick={() => setStatusTab(tab.value)}
          >
            {tab.label}
            <span className="barberrequests__tabCount">{statusCounts[tab.value]}</span>
          </button>
        ))}
      </div>

      <div className="barberrequests__actions">
        <div className="barberrequests__searchWrap">
          <FaSearch className="barberrequests__searchIcon" />
          <input
            className="barberrequests__searchInput"
            placeholder="Поиск по имени клиента..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="barberrequests__filtersWrap">
          <button
            type="button"
            className={`barberrequests__filtersBtn ${filtersOpen ? "is-open" : ""} ${
              activeFiltersCount > 0 ? "has-active" : ""
            }`}
            onClick={() => setFiltersOpen(true)}
          >
            <FaFilter />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="barberrequests__filtersBadge">{activeFiltersCount}</span>
            )}
          </button>
        </div>
      </div>

      {error && <div className="barberrequests__alert">{error}</div>}

      {loading ? (
        <Loading message="Загрузка заявок..." />
      ) : requests.length === 0 ? (
        <div className="barberrequests__empty">Заявок не найдено</div>
      ) : (
        <>
          <div className="barberrequests__list">
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onStatusChange={handleStatusChange}
                onClick={setSelectedRequest}
              />
            ))}
          </div>

          <Pager
            count={requestsCount}
            page={page}
            totalPages={totalPages}
            next={requestsNext}
            previous={requestsPrevious}
            onChange={setPage}
          />
        </>
      )}

      <FiltersModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        masterFilter={masterFilter}
        setMasterFilter={setMasterFilter}
        masterOptions={masterOptions}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onClear={handleClearFilters}
      />

      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default Requests;
