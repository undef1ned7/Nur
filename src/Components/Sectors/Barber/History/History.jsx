import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaSearch, FaThLarge, FaList, FaExclamationTriangle, FaFilter, FaTimes, FaUser, FaCut, FaCalendarAlt, FaClock, FaMoneyBillWave, FaPercent, FaTag } from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import BarberSelect from "../common/BarberSelect";
import { Pager } from "./components";
import {
  PAGE_SIZE,
  asArray,
  norm,
  dateISO,
  timeISO,
  fmtMoney,
  barberNameOf,
  serviceNamesFromRecord,
  clientNameOf,
  priceOfAppointment,
  basePriceOfAppointment,
  discountPercentOfAppointment,
  statusLabel,
  getYMD,
  monthNames,
  pad,
} from "./HistoryUtils";
import "./History.scss";

const getId = (v) => (v && typeof v === "object" ? v.id : v);

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
  const { currentUser, userId, isAuthenticated } = useUser();
  const userEmail = currentUser?.email || currentUser?.user?.email || "";
  
  /* Проверяем, авторизован ли пользователь */
  const isLoggedIn = isAuthenticated && (userId || userEmail);

  const [employees, setEmployees] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("table");

  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");

  const [page, setPage] = useState(1);

  /* Filters panel state */
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Modal state */
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchEmployees = useCallback(async () => asArray((await api.get("/users/employees/")).data), []);
  const fetchAppointments = useCallback(async () => asArray((await api.get("/barbershop/appointments/")).data), []);
  const fetchServices = useCallback(async () => asArray((await api.get("/barbershop/services/")).data), []);
  const fetchClients = useCallback(async () => asArray((await api.get("/barbershop/clients/")).data), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [emps, appts, svcs, cls] = await Promise.all([
          fetchEmployees(),
          fetchAppointments(),
          fetchServices(),
          fetchClients(),
        ]);
        if (!alive) return;
        setEmployees(emps);
        setAppointments(appts);
        setServices(svcs);
        setClients(cls);
      } catch {
        if (!alive) return;
        setErr("Не удалось загрузить историю.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchEmployees, fetchAppointments, fetchServices, fetchClients]);


  /* Определяем ID сотрудников текущего пользователя */
  const myEmployeeIds = useMemo(() => {
    const ids = new Set();
    const email = norm(userEmail);

    employees.forEach((e) => {
      const em = norm(e?.email);
      if (email && em && em === email) ids.add(String(e.id));
      const eu = getId(e?.user) ?? e?.user_id;
      if (userId && eu === userId) ids.add(String(e.id));
    });

    return ids;
  }, [employees, userEmail, userId]);

  /* Фильтруем записи текущего пользователя */
  const myAppointments = useMemo(() => {
    const email = norm(userEmail);

    const belongs = (a) => {
      const barberId =
        getId(a?.barber) ??
        a?.barber_id ??
        getId(a?.employee) ??
        a?.employee_id ??
        getId(a?.master) ??
        a?.master_id;

      if (barberId && myEmployeeIds.has(String(barberId))) return true;

      const createdById = getId(a?.created_by) ?? a?.created_by_id ?? a?.created_by;
      if (userId && createdById === userId) return true;

      const emails = [
        a?.barber_email, a?.employee_email, a?.master_email,
        a?.user_email, a?.created_by_email, a?.user?.email,
        a?.created_by?.email, a?.barber?.email, a?.employee?.email, a?.master?.email,
      ].filter(Boolean).map(norm);

      return email && emails.some((x) => x === email);
    };

    return appointments.filter(belongs);
  }, [appointments, myEmployeeIds, userEmail, userId]);

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

  const sortAppointments = (arr, sortKey) => {
    const sorted = [...arr];
    switch (sortKey) {
      case "oldest":
        return sorted.sort((a, b) => (Date.parse(a?.start_at) || 0) - (Date.parse(b?.start_at) || 0));
      case "price_desc":
        return sorted.sort((a, b) => (priceOfAppointment(b, services) || 0) - (priceOfAppointment(a, services) || 0));
      case "price_asc":
        return sorted.sort((a, b) => (priceOfAppointment(a, services) || 0) - (priceOfAppointment(b, services) || 0));
      case "newest":
      default:
        return sorted.sort((a, b) => (Date.parse(b?.start_at) || 0) - (Date.parse(a?.start_at) || 0));
    }
  };

  const filtered = useMemo(() => {
    let arr = myAppointments.slice();

    // Year/Month/Day filter
    if (yearFilter) {
      const yStr = String(yearFilter);
      const mStr = monthFilter ? pad(Number(monthFilter)) : "";
      const dStr = dayFilter ? pad(Number(dayFilter)) : "";

      arr = arr.filter((x) => {
        const ymd = getYMD(x?.start_at);
        if (!ymd) return false;
        if (String(ymd.year) !== yStr) return false;
        if (mStr && pad(ymd.month) !== mStr) return false;
        if (dStr && pad(ymd.day) !== dStr) return false;
        return true;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      arr = arr.filter((x) => String(x?.status || "").toLowerCase() === statusFilter);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((x) => {
        const client = clientNameOf(x, clients).toLowerCase();
        const service = serviceNamesFromRecord(x, services).toLowerCase();
        const barber = barberNameOf(x, employees).toLowerCase();
        const date = dateISO(x?.start_at).toLowerCase();
        return client.includes(q) || service.includes(q) || barber.includes(q) || date.includes(q);
      });
    }

    return sortAppointments(arr, sortBy);
  }, [myAppointments, yearFilter, monthFilter, dayFilter, statusFilter, search, sortBy, clients, services, employees]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [yearFilter, monthFilter, dayFilter, search, statusFilter, sortBy]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counterText = loading
    ? "Загрузка…"
    : `${filtered.length} ${pluralRecords(filtered.length)}`;

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

  /* Get record data */
  const getRecordData = (a) => {
    const date = dateISO(a?.start_at);
    const time = timeISO(a?.start_at);
    const client = clientNameOf(a, clients);
    const service = serviceNamesFromRecord(a, services);
    const barber = barberNameOf(a, employees);
    const totalPrice = priceOfAppointment(a, services);
    const basePrice = basePriceOfAppointment(a, services);
    const discountPct = discountPercentOfAppointment(a, basePrice, totalPrice);
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
          {rows.map((a) => {
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

      {!isLoggedIn && !loading && (
        <div className="barberhistory__warning">
          <FaExclamationTriangle className="barberhistory__warningIcon" />
          <span>Войдите в систему, чтобы увидеть вашу историю записей. Если вы уже вошли — обновите страницу.</span>
        </div>
      )}

      {loading ? (
        <div className="barberhistory__skeletonList" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="barberhistory__skeletonCard" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="barberhistory__empty">
          {hasFilters ? "Ничего не найдено" : "Записей нет"}
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="barberhistory__list">
              {rows.map(renderCard)}
            </div>
          ) : (
            renderTable()
          )}

          <Pager
            filteredCount={filtered.length}
            page={safePage}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      )}

      {renderModal()}
    </section>
  );
};

export default History;
