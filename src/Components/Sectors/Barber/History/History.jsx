import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  FaSearch,
  FaThLarge,
  FaList,
  FaExclamationTriangle,
  FaFilter,
  FaTimes,
  FaUser,
  FaCut,
  FaCalendarAlt,
  FaClock,
  FaMoneyBillWave,
  FaPercent,
  FaTag,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
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
  pad,
  num,
  todayStr,
  formatHistoryDateLabel,
  formatHistoryDateFull,
} from "./HistoryUtils";
import "./History.scss";



const SORT_OPTIONS = [
  { value: "newest", label: "Новые" },
  { value: "oldest", label: "Старые" },
  { value: "price_desc", label: "Дороже" },
  { value: "price_asc", label: "Дешевле" },
];

const QUICK_STATUS = [
  { value: "all", label: "Все" },
  { value: "completed", label: "Завершено" },
  { value: "booked", label: "Бронь" },
  { value: "confirmed", label: "Подтв." },
  { value: "canceled", label: "Отмена" },
];

const clientInitials = (name) => {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const History = () => {
  const { isAuthenticated } = useUser();
  const isLoggedIn = isAuthenticated;

  // Server-side список: состояние query
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [page, setPage] = useState(1);
  const dateInputRef = useRef(null);

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

  // Определяем начальный viewMode на основе размера экрана
  const getInitialViewMode = () => {
    if (typeof window !== 'undefined') {
      // Телефоны (≤768px) → карточки
      // Планшеты/ноутбуки/ПК (>768px) → список
      return window.innerWidth <= 768 ? "cards" : "table";
    }
    return "table";
  };

  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [userChangedView, setUserChangedView] = useState(false);

  // Обработчик изменения режима просмотра
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setUserChangedView(true);
  };

  // Обновляем viewMode при изменении размера экрана (только если пользователь не менял вручную)
  useEffect(() => {
    const handleResize = () => {
      if (!userChangedView) {
        const newMode = window.innerWidth <= 768 ? "cards" : "table";
        if (newMode !== viewMode) {
          setViewMode(newMode);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, userChangedView]);

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

  // Диапазон даты для API (по умолчанию — сегодня)
  const getDateRange = useCallback(() => {
    if (!selectedDate) return { date_start: null, date_end: null };
    return { date_start: selectedDate, date_end: selectedDate };
  }, [selectedDate]);

  const isToday = selectedDate === todayStr();

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
  }, [debouncedSearch, sortBy, statusFilter, selectedDate]);

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
    const params = { page_size: 500 };
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

  const dayTotal = useMemo(
    () =>
      appointments.reduce((sum, a) => {
        const price = num(a?.price);
        return sum + (price ?? 0);
      }, 0),
    [appointments],
  );

  const dateLabel = formatHistoryDateLabel(selectedDate, isToday);
  const dateSubtitle = formatHistoryDateFull(selectedDate);

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


  

  const hasFilters =
    search ||
    statusFilter !== "all" ||
    sortBy !== "newest" ||
    selectedDate !== todayStr();

  const handleReset = () => {
    setSearch("");
    setStatusFilter("all");
    setSortBy("newest");
    setSelectedDate(todayStr());
    setPage(1);
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setSortBy("newest");
  };

  const shiftDate = (days) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    );
  };

  const openDatePicker = () => {
    dateInputRef.current?.showPicker?.();
  };
  const totalPages = useMemo(() => {
    if (appointmentsCount === 0) return 1;
    const pageSize = appointments.length || 1;
    if (pageSize === 0) return 1;
    if (appointmentsNext) {
      return Math.ceil(appointmentsCount / pageSize);
    }
    return page;
  }, [appointmentsCount, appointments.length, appointmentsNext, page]);

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
        <div className="barberhistory__cardMain">
          <span className="barberhistory__cardAvatar" aria-hidden="true">
            {clientInitials(data.client)}
          </span>
          <div className="barberhistory__cardInfo">
            <div className="barberhistory__cardTop">
              <strong className="barberhistory__cardClient">{data.client}</strong>
              <span className="barberhistory__cardTime">{data.time}</span>
            </div>
            <p className="barberhistory__cardService">{data.service}</p>
            <span className="barberhistory__cardBarber">{data.barber}</span>
          </div>
        </div>
        <div className="barberhistory__cardFoot">
          <span className={`barberhistory__badge barberhistory__badge--${data.statusKey}`}>
            {data.statusText}
          </span>
          <span className="barberhistory__cardPrice">{fmtMoney(data.totalPrice)}</span>
        </div>
      </article>
    );
  };

  const renderTable = () => (
    <div className="barberhistory__tableWrap">
      <table className="barberhistory__table">
        <thead>
          <tr>
            <th>Время</th>
            <th>Клиент</th>
            <th>Услуги</th>
            <th>Сумма</th>
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
                <td className="barberhistory__cellTime">{data.time}</td>
                <td>
                  <div className="barberhistory__clientCell">
                    <span className="barberhistory__clientAvatar" aria-hidden="true">
                      {clientInitials(data.client)}
                    </span>
                    <div>
                      <span className="barberhistory__clientName">{data.client}</span>
                      <span className="barberhistory__clientMeta">{data.barber}</span>
                    </div>
                  </div>
                </td>
                <td className="barberhistory__cellService">{data.service}</td>
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
      <header className="barberhistory__hero">
        <div className="barberhistory__heroMain">
          <div className="barberhistory__dateNav">
            <button
              type="button"
              className="barberhistory__navBtn"
              onClick={() => shiftDate(-1)}
              aria-label="Предыдущий день"
            >
              <FaChevronLeft />
            </button>

            <button
              type="button"
              className="barberhistory__dateDisplay"
              onClick={openDatePicker}
              title="Выбрать дату"
            >
              <input
                ref={dateInputRef}
                type="date"
                className="barberhistory__dateHidden"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <FaCalendarAlt className="barberhistory__calIcon" />
              <span className="barberhistory__dateText">{dateLabel}</span>
            </button>

            <button
              type="button"
              className="barberhistory__navBtn"
              onClick={() => shiftDate(1)}
              aria-label="Следующий день"
            >
              <FaChevronRight />
            </button>

            {!isToday ? (
              <button
                type="button"
                className="barberhistory__todayBtn"
                onClick={() => setSelectedDate(todayStr())}
              >
                Сегодня
              </button>
            ) : null}
          </div>
          <p className="barberhistory__heroSub">{dateSubtitle}</p>
        </div>

        <div className="barberhistory__heroStats" aria-live="polite">
          <div className="barberhistory__stat">
            <span className="barberhistory__statLabel">Записей</span>
            <strong className="barberhistory__statValue">
              {loading ? "…" : appointmentsCount}
            </strong>
          </div>
          <div className="barberhistory__stat barberhistory__stat--money">
            <span className="barberhistory__statLabel">Выручка за день</span>
            <strong className="barberhistory__statValue">
              {loading ? "…" : fmtMoney(dayTotal)}
            </strong>
          </div>
        </div>
      </header>

      <div className="barberhistory__toolbar">
        <div className="barberhistory__searchWrap">
          <FaSearch className="barberhistory__searchIcon" />
          <input
            className="barberhistory__searchInput"
            placeholder="Клиент, услуга, мастер..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск"
          />
        </div>

        <div className="barberhistory__statusChips" role="group" aria-label="Статус">
          {QUICK_STATUS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`barberhistory__statusChip ${
                statusFilter === item.value ? "is-active" : ""
              }`}
              onClick={() => setStatusFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="barberhistory__toolbarActions">
          <div className="barberhistory__filtersWrap">
            <button
              type="button"
              className={`barberhistory__filtersBtn barberhistory__filtersBtn--compact ${
                filtersOpen ? "is-open" : ""
              } ${sortBy !== "newest" ? "has-active" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
              title="Сортировка"
            >
              <FaFilter />
            </button>
          </div>

          <div className="barberhistory__viewToggle">
            <button
              className={`barberhistory__viewBtn ${viewMode === "table" ? "is-active" : ""}`}
              onClick={() => handleViewModeChange("table")}
              title="Список"
              aria-label="Список"
            >
              <FaList />
            </button>
            <button
              className={`barberhistory__viewBtn ${viewMode === "cards" ? "is-active" : ""}`}
              onClick={() => handleViewModeChange("cards")}
              title="Карточки"
              aria-label="Карточки"
            >
              <FaThLarge />
            </button>
          </div>

          {hasFilters ? (
            <button
              type="button"
              className="barberhistory__resetBtn"
              onClick={handleReset}
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>

      {/* Модальное окно фильтров — только сортировка */}
      {filtersOpen && (
        <>
          <div className="barberhistory__filtersOverlay" onClick={() => setFiltersOpen(false)} />
          <div className="barberhistory__filtersPanel">
            <div className="barberhistory__filtersPanelHeader">
              <span className="barberhistory__filtersPanelTitle">Сортировка</span>
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
                <label className="barberhistory__filtersPanelLabel">Порядок</label>
                <BarberSelect
                  value={sortBy}
                  onChange={setSortBy}
                  options={SORT_OPTIONS}
                  placeholder="Сортировка"
                />
              </div>
            </div>

            {sortBy !== "newest" ? (
              <div className="barberhistory__filtersPanelFooter">
                <button
                  type="button"
                  className="barberhistory__filtersPanelClear"
                  onClick={handleClearFilters}
                >
                  По умолчанию
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="barberhistory__board">
        {!!err && <div className="barberhistory__alert">{err}</div>}

        {!isLoggedIn && !loading && appointments.length === 0 ? (
          <div className="barberhistory__warning">
            <FaExclamationTriangle className="barberhistory__warningIcon" />
            <span>Войдите, чтобы увидеть историю записей</span>
          </div>
        ) : null}

        {loading ? (
          <Loading message="Загрузка..." />
        ) : appointments.length === 0 ? (
          <div className="barberhistory__empty">
            <FaCalendarAlt className="barberhistory__emptyIcon" aria-hidden="true" />
            <strong>
              {hasFilters ? "Ничего не найдено" : "На этот день записей нет"}
            </strong>
            <p>
              {hasFilters
                ? "Измените фильтры или выберите другую дату"
                : "Записи за выбранный день появятся здесь"}
            </p>
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
      </div>

      {renderModal()}
    </section>
  );
};

export default History;
