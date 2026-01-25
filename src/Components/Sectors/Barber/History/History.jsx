import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FaSearch, FaThLarge, FaList, FaExclamationTriangle, FaFilter, FaTimes, FaUser, FaCut, FaCalendarAlt, FaClock, FaMoneyBillWave, FaPercent, FaTag } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import BarberSelect from "../common/BarberSelect";
import Loading from "../../../common/Loading/Loading";
import { Pager } from "./components";
import {
  dateISO,
  timeISO,
  fmtMoney,
  statusLabel,
  monthNames,
  pad,
  num,
} from "./HistoryUtils";
import "./History.scss";



const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "completed", label: "Завершено" },
  { value: "booked", label: "Забронировано" },
  { value: "confirmed", label: "Подтверждено" },
  { value: "canceled", label: "Отменено" },
  { value: "no_show", label: "Не пришёл" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "price_desc", label: "Цена ↓" },
  { value: "price_asc", label: "Цена ↑" },
];

const pluralRecords = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
};

const History = () => {
  const { isAuthenticated } = useUser();
  const isLoggedIn = isAuthenticated;

  // Server-side список: состояние query
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [page, setPage] = useState(1);

  // Server-side список: состояние данных
  const [appointments, setAppointments] = useState([]);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [appointmentsNext, setAppointmentsNext] = useState(null);
  const [appointmentsPrevious, setAppointmentsPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Refs для отмены запросов и защиты от race conditions
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const [viewMode, setViewMode] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Маппинг сортировки UI -> API
  const getOrderingForAPI = (sortKey) => {
    switch (sortKey) {
      case "oldest":
        return "start_at";
      case "price_asc":
        return "price";
      case "price_desc":
        return "-price";
      case "newest":
      default:
        return "-start_at";
    }
  };

  // Формирование date_start и date_end из фильтров
  const getDateRange = useCallback(() => {
    if (!yearFilter) return { date_start: null, date_end: null };

    const year = Number(yearFilter);
    if (!Number.isFinite(year)) return { date_start: null, date_end: null };

    let dateStart = `${year}-01-01`;
    let dateEnd = `${year}-12-31`;

    if (monthFilter) {
      const month = Number(monthFilter);
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        const daysInMonth = new Date(year, month, 0).getDate();
        dateStart = `${year}-${pad(month)}-01`;
        dateEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;

        if (dayFilter) {
          const day = Number(dayFilter);
          if (Number.isFinite(day) && day >= 1 && day <= daysInMonth) {
            dateStart = `${year}-${pad(month)}-${pad(day)}`;
            dateEnd = dateStart;
          }
        }
      }
    }

    return { date_start: dateStart, date_end: dateEnd };
  }, [yearFilter, monthFilter, dayFilter]);

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
  }, [debouncedSearch, sortBy, statusFilter, yearFilter, monthFilter, dayFilter]);

  // Основной эффект для загрузки appointments (server-side)
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
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }

    // Добавляем фильтры по дате
    const { date_start, date_end } = getDateRange();
    if (date_start) {
      params.date_start = date_start;
    }
    if (date_end) {
      params.date_end = date_end;
    }

    // Выполняем запрос
    setLoading(true);
    setErr("");

    api.get("/barbershop/appointments/my/", {
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

        setAppointments(results);
        setAppointmentsCount(count);
        setAppointmentsNext(next);
        setAppointmentsPrevious(previous);
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
          "Не удалось загрузить историю.";

        setErr(errorMessage);
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
  }, [debouncedSearch, sortBy, page, statusFilter, getDateRange]);

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
    };
  }, []);


  

  /* Options for year/month/day filters */
  const yearOptions = useMemo(
    () => [
      { value: "", label: "Все годы" },
      { value: "2025", label: "2025" },
      { value: "2026", label: "2026" },
      { value: "2027", label: "2027" },
    ],
    []
  );

  const monthOptions = useMemo(
    () => [
      { value: "", label: "Все месяцы" },
      ...monthNames.map((label, idx) => ({ value: String(idx + 1), label })),
    ],
    []
  );

  const daysInMonth = useMemo(() => {
    if (!yearFilter || !monthFilter) return 31;
    const y = Number(yearFilter);
    const m = Number(monthFilter);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
    return new Date(y, m, 0).getDate();
  }, [yearFilter, monthFilter]);

  const dayOptions = useMemo(
    () => [
      { value: "", label: "Все дни" },
      ...Array.from({ length: daysInMonth }).map((_, i) => ({
        value: String(i + 1),
        label: pad(i + 1),
      })),
    ],
    [daysInMonth]
  );

  // Вычисляем totalPages на основе count
  const totalPages = useMemo(() => {
    if (appointmentsCount === 0) return 1;
    const pageSize = appointments.length || 1;
    if (pageSize === 0) return 1;
    if (appointmentsNext) {
      return Math.ceil(appointmentsCount / pageSize);
    }
    return page;
  }, [appointmentsCount, appointments.length, appointmentsNext, page]);

  const counterText = loading
    ? "Загрузка…"
    : `${appointmentsCount} ${pluralRecords(appointmentsCount)}`;

  /* Check if filters are active */
  const activeFiltersCount = [
    statusFilter && statusFilter !== "all" ? statusFilter : null,
    sortBy !== "newest" ? sortBy : null,
    yearFilter,
  ].filter(Boolean).length;

  const hasFilters = search || activeFiltersCount > 0;

  const handleReset = () => {
    setSearch("");
    setStatusFilter("all");
    setSortBy("newest");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
    setPage(1);
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setSortBy("newest");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
  };

  /* Handlers with cascade reset */
  const handleYearChange = (val) => {
    setYearFilter(val);
    setMonthFilter("");
    setDayFilter("");
  };

  const handleMonthChange = (val) => {
    setMonthFilter(val);
    setDayFilter("");
  };

  /* Get record data - используем данные напрямую из API */
  const getRecordData = (a) => {
    const date = dateISO(a?.start_at);
    const time = timeISO(a?.start_at);
    
    // Используем данные напрямую из API ответа
    const client = a?.client_name || "—";
    const service = Array.isArray(a?.services_names) && a.services_names.length
      ? a.services_names.join(", ")
      : (a?.service_name || "—");
    const barber = a?.barber_name || a?.barber_public?.full_name || "—";
    
    // Цена из API
    const totalPrice = num(a?.price) || null;
    
    // Базовая цена (если есть скидка, вычисляем из totalPrice и discount)
    let basePrice = totalPrice;
    const discountPct = num(a?.discount) || null;
    if (discountPct && discountPct > 0 && discountPct < 100 && totalPrice) {
      basePrice = Math.round(totalPrice / (1 - discountPct / 100));
    }
    
    const statusKey = String(a?.status || "").toLowerCase();
    const statusText = a?.status_display || statusLabel(statusKey);

    return { date, time, client, service, barber, totalPrice, basePrice, discountPct, statusKey, statusText };
  };

  /* Modal */
  const renderModal = () => {
    if (!selectedRecord) return null;

    const data = getRecordData(selectedRecord);

    return (
      <>
        <div className="barberhistory__overlay" onClick={() => setSelectedRecord(null)} />
        <div className="barberhistory__modal">
          <div className="barberhistory__modalHeader">
            <h3 className="barberhistory__modalTitle">Детали записи</h3>
            <button
              type="button"
              className="barberhistory__modalClose"
              onClick={() => setSelectedRecord(null)}
            >
              <FaTimes />
            </button>
          </div>

          <div className="barberhistory__modalBody">
            <div className="barberhistory__modalStatus">
              <span className={`barberhistory__badge barberhistory__badge--${data.statusKey}`}>
                {data.statusText}
              </span>
            </div>

            <div className="barberhistory__modalGrid">
              <div className="barberhistory__modalItem">
                <div className="barberhistory__modalIcon">
                  <FaCalendarAlt />
                </div>
                <div className="barberhistory__modalInfo">
                  <span className="barberhistory__modalLabel">Дата</span>
                  <span className="barberhistory__modalValue">{data.date}</span>
                </div>
              </div>

              <div className="barberhistory__modalItem">
                <div className="barberhistory__modalIcon">
                  <FaClock />
                </div>
                <div className="barberhistory__modalInfo">
                  <span className="barberhistory__modalLabel">Время</span>
                  <span className="barberhistory__modalValue">{data.time}</span>
                </div>
              </div>

              <div className="barberhistory__modalItem">
                <div className="barberhistory__modalIcon">
                  <FaUser />
                </div>
                <div className="barberhistory__modalInfo">
                  <span className="barberhistory__modalLabel">Мастер</span>
                  <span className="barberhistory__modalValue">{data.barber}</span>
                </div>
              </div>

              <div className="barberhistory__modalItem">
                <div className="barberhistory__modalIcon">
                  <FaUser />
                </div>
                <div className="barberhistory__modalInfo">
                  <span className="barberhistory__modalLabel">Клиент</span>
                  <span className="barberhistory__modalValue">{data.client}</span>
                </div>
              </div>
            </div>

            <div className="barberhistory__modalSection">
              <div className="barberhistory__modalItem barberhistory__modalItem--full">
                <div className="barberhistory__modalIcon">
                  <FaCut />
                </div>
                <div className="barberhistory__modalInfo">
                  <span className="barberhistory__modalLabel">Услуги</span>
                  <span className="barberhistory__modalValue">{data.service}</span>
                </div>
              </div>
            </div>

            <div className="barberhistory__modalPricing">
              <div className="barberhistory__modalPriceRow">
                <span className="barberhistory__modalPriceLabel">
                  <FaTag /> Цена
                </span>
                <span className="barberhistory__modalPriceValue">{fmtMoney(data.basePrice)}</span>
              </div>

              {data.discountPct > 0 && (
                <div className="barberhistory__modalPriceRow barberhistory__modalPriceRow--discount">
                  <span className="barberhistory__modalPriceLabel">
                    <FaPercent /> Скидка
                  </span>
                  <span className="barberhistory__modalPriceValue">-{data.discountPct}%</span>
                </div>
              )}

              <div className="barberhistory__modalPriceRow barberhistory__modalPriceRow--total">
                <span className="barberhistory__modalPriceLabel">
                  <FaMoneyBillWave /> Итого
                </span>
                <span className="barberhistory__modalPriceValue">{fmtMoney(data.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderCard = (a) => {
    const data = getRecordData(a);

    return (
      <article
        key={a?.id ?? `${a?.start_at}-${data.client}`}
        className="barberhistory__card"
        onClick={() => setSelectedRecord(a)}
      >
        <div className="barberhistory__cardHead">
          <h4 className="barberhistory__cardTitle">{data.date}</h4>
          <span className={`barberhistory__badge barberhistory__badge--${data.statusKey}`}>
            {data.statusText}
          </span>
        </div>
        <div className="barberhistory__cardBody">
          <div className="barberhistory__cardRow">
            <span>Клиент: <strong>{data.client}</strong></span>
          </div>
          <div className="barberhistory__cardTotal">
            <span className="barberhistory__cardTotalLabel">Итого:</span>
            <span className="barberhistory__cardTotalValue">{fmtMoney(data.totalPrice)}</span>
          </div>
        </div>
      </article>
    );
  };

  const renderTable = () => (
    <div className="barberhistory__tableWrap">
      <table className="barberhistory__table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Клиент</th>
            <th>Итого</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => {
            const data = getRecordData(a);

            return (
              <tr
                key={a?.id ?? `${a?.start_at}-${data.client}`}
                className="barberhistory__row"
                onClick={() => setSelectedRecord(a)}
              >
                <td>{data.date}</td>
                <td>{data.client}</td>
                <td className="barberhistory__cellPrice">{fmtMoney(data.totalPrice)}</td>
                <td>
                  <span className={`barberhistory__badge barberhistory__badge--${data.statusKey}`}>
                    {data.statusText}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="barberhistory">
      <div className="barberhistory__topRow">
        <span className="barberhistory__counter">{counterText}</span>
        {hasFilters && (
          <button
            type="button"
            className="barberhistory__resetBtn"
            onClick={handleReset}
          >
            Сбросить всё
          </button>
        )}
      </div>

      <div className="barberhistory__actions">
        <div className="barberhistory__searchWrap">
          <FaSearch className="barberhistory__searchIcon" />
          <input
            className="barberhistory__searchInput"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск"
          />
        </div>

        {/* Кнопка "Фильтры" */}
        <div className="barberhistory__filtersWrap">
          <button
            type="button"
            className={`barberhistory__filtersBtn ${filtersOpen ? "is-open" : ""} ${activeFiltersCount > 0 ? "has-active" : ""}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <FaFilter />
            <span>Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="barberhistory__filtersBadge">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        <div className="barberhistory__viewToggle">
          <button
            className={`barberhistory__viewBtn ${viewMode === "table" ? "is-active" : ""}`}
            onClick={() => setViewMode("table")}
            title="Таблица"
            aria-label="Вид таблицей"
          >
            <FaList />
          </button>
          <button
            className={`barberhistory__viewBtn ${viewMode === "cards" ? "is-active" : ""}`}
            onClick={() => setViewMode("cards")}
            title="Карточки"
            aria-label="Вид карточками"
          >
            <FaThLarge />
          </button>
        </div>
      </div>

      {/* Модальное окно фильтров */}
      {filtersOpen && (
        <>
          <div className="barberhistory__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barberhistory__filtersPanel">
              <div className="barberhistory__filtersPanelHeader">
                <span className="barberhistory__filtersPanelTitle">Фильтры</span>
                <button
                  type="button"
                  className="barberhistory__filtersPanelClose"
                  onClick={() => setFiltersOpen(false)}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="barberhistory__filtersPanelBody">
                <div className="barberhistory__filtersPanelRow">
                  <label className="barberhistory__filtersPanelLabel">Статус</label>
                  <BarberSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                    placeholder="Все статусы"
                  />
                </div>

                <div className="barberhistory__filtersPanelRow">
                  <label className="barberhistory__filtersPanelLabel">Сортировка</label>
                  <BarberSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                    placeholder="Сортировка"
                  />
                </div>

                <div className="barberhistory__filtersPanelRow">
                  <label className="barberhistory__filtersPanelLabel">Год</label>
                  <BarberSelect
                    value={yearFilter}
                    onChange={handleYearChange}
                    options={yearOptions}
                    placeholder="Все годы"
                  />
                </div>

                <div className="barberhistory__filtersPanelRow">
                  <label className="barberhistory__filtersPanelLabel">Месяц</label>
                  <BarberSelect
                    value={monthFilter}
                    onChange={handleMonthChange}
                    options={monthOptions}
                    placeholder="Все месяцы"
                    disabled={!yearFilter}
                  />
                </div>

                <div className="barberhistory__filtersPanelRow">
                  <label className="barberhistory__filtersPanelLabel">День</label>
                  <BarberSelect
                    value={dayFilter}
                    onChange={setDayFilter}
                    options={dayOptions}
                    placeholder="Все дни"
                    disabled={!yearFilter || !monthFilter}
                  />
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="barberhistory__filtersPanelFooter">
                  <button
                    type="button"
                    className="barberhistory__filtersPanelClear"
                    onClick={handleClearFilters}
                  >
                    Очистить фильтры
                  </button>
                </div>
              )}
            </div>
          </>
        )}

      {!!err && <div className="barberhistory__alert">{err}</div>}

      {!isLoggedIn && !loading && appointments.length === 0 && (
        <div className="barberhistory__warning">
          <FaExclamationTriangle className="barberhistory__warningIcon" />
          <span>Войдите в систему, чтобы увидеть вашу историю записей. Если вы уже вошли — обновите страницу.</span>
        </div>
      )}

      {loading ? (
        <Loading message="Загрузка истории..." />
      ) : appointments.length === 0 ? (
        <div className="barberhistory__empty">
          {hasFilters ? "Ничего не найдено" : "Записей нет"}
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="barberhistory__list">
              {appointments.map(renderCard)}
            </div>
          ) : (
            renderTable()
          )}

          <Pager
            count={appointmentsCount}
            page={page}
            totalPages={totalPages}
            next={appointmentsNext}
            previous={appointmentsPrevious}
            onChange={setPage}
          />
        </>
      )}

      {renderModal()}
    </section>
  );
};

export default History;
