import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import "./CashReports.scss";
import api from "../../../../api";
import {
  FaSync,
  FaUsers,
  FaCut,
  FaCalendarAlt,
  FaListUl,
  FaTimes,
} from "react-icons/fa";
import RecordaRates from "../RecordaRates/RecordaRates";
import { useUser } from "../../../../store/slices/userSlice";

/* ===== ленивые импорты ===== */
const KassaLazy = lazy(() => import("../../../Deposits/Kassa/Kassa"));
const CatalogAnalyticsLazy = lazy(() =>
  import("../CatalogAnalytics/CatalogAnalytics")
);

/* ===== helpers ===== */
const RANK_PAGE = 3;
const MODAL_PAGE = 10;

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const pad2 = (n) => String(n).padStart(2, "0");
const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;
const byDescCount = (a, b) => b.count - a.count;
const byDescSum = (a, b) => (b.sum || 0) - (a.sum || 0);

const STATUS_LABELS = {
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не пришёл",
};

const COUNTABLE_FOR_RANK = new Set([
  "booked",
  "confirmed",
  "completed",
  "no_show",
]);
const isSupplierLike = (c = {}) => {
  if (c.is_supplier === true || c.isVendor === true || c.supplier === true)
    return true;
  const text = [
    c.type,
    c.category,
    c.group,
    c.role,
    c.kind,
    c.segment,
    c.status,
    (c.name || c.full_name || "").toString(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /поставщик|supplier|vendor/.test(text);
};

/* ===== эндпоинт ставок (Swagger) ===== */
const RATES_EP = "/education/teacher-rates/"; // teacher, period YYYY-MM, mode: lesson|month, rate

const CashReports = () => {
  const now = new Date();
  const [tab, setTab] = useState("catalog"); // analytics | catalog | kassa | payouts

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [clientsBarber, setClientsBarber] = useState([]);
  const [clientsMarket, setClientsMarket] = useState([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [pageBarbers, setPageBarbers] = useState(1);
  const [pageServices, setPageServices] = useState(1);
  const [pageTop10, setPageTop10] = useState(1);

  const [fullView, setFullView] = useState(null); // 'barbers' | 'services' | 'topClients' | null
  const [modalPage, setModalPage] = useState(1);

  /* ===== ставки мастеров (для KPI расхода и вкладки «Выплаты») ===== */
  const periodLabel = `${year}-${pad2(month)}`;
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  // { [barberId]: { id_lesson?, id_month?, perRecord, perMonth } }
  const [rates, setRates] = useState({});

  const loadRates = async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const [lessonRes, monthRes] = await Promise.all([
        api.get(RATES_EP, {
          params: { period: periodLabel, mode: "lesson", page_size: 1000 },
        }),
        api.get(RATES_EP, {
          params: { period: periodLabel, mode: "month", page_size: 1000 },
        }),
      ]);

      const map = {};
      const take = (resp, mode) => {
        (asArray(resp?.data) || []).forEach((r) => {
          const tId =
            r.teacher || r.teacher_id || r.user || r.employee || r.master;
          if (!tId) return;
          map[tId] = map[tId] || {};
          if (mode === "lesson") {
            map[tId].id_lesson = r.id;
            map[tId].perRecord = Number(r.rate ?? 0) || 0;
          } else {
            map[tId].id_month = r.id;
            map[tId].perMonth = Number(r.rate ?? 0) || 0;
          }
        });
      };
      take(lessonRes, "lesson");
      take(monthRes, "month");
      setRates(map);
    } catch (e) {
      console.error(e);
      setRates({});
      setRatesError("Не удалось загрузить ставки мастеров.");
    } finally {
      setRatesLoading(false);
    }
  };

  const setRateValue = (barberId, field, value) => {
    const raw = String(value).trim();
    if (raw === "") {
      setRates((prev) => ({
        ...prev,
        [barberId]: { ...(prev[barberId] || {}), [field]: "" },
      }));
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    setRates((prev) => ({
      ...prev,
      [barberId]: { ...(prev[barberId] || {}), [field]: num },
    }));
  };

  const persistRates = async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const tasks = [];
      Object.entries(rates).forEach(([barberId, rec]) => {
        const send = async (mode, amount, idKey) => {
          if (amount === "" || amount == null) return;
          const num = Number(amount);
          if (!Number.isFinite(num) || num < 0) return;
          const payload = {
            teacher: barberId,
            period: periodLabel,
            mode,
            rate: String(num),
          };
          const id = rec[idKey];
          if (id) await api.put(`${RATES_EP}${id}/`, payload);
          else await api.post(RATES_EP, payload);
        };
        tasks.push(send("lesson", rec.perRecord, "id_lesson"));
        tasks.push(send("month", rec.perMonth, "id_month"));
      });
      await Promise.allSettled(tasks);
      await loadRates(); // подтянуть id после создания
    } catch (e) {
      console.error(e);
      setRatesError("Не удалось сохранить ставки мастеров.");
    } finally {
      setRatesLoading(false);
    }
  };

  /* ===== данные аналитики ===== */
  const fetchPaged = async (url) => {
    const acc = [];
    let next = url;
    while (next) {
      const { data } = await api.get(next);
      acc.push(...asArray(data));
      next = data?.next;
    }
    return acc;
  };

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [apps, emps, svcs, clBarber, clMarket] = await Promise.all([
        fetchPaged("/barbershop/appointments/"),
        fetchPaged("/users/employees/"),
        fetchPaged("/barbershop/services/"),
        fetchPaged("/barbershop/clients/"),
        fetchPaged("/main/clients/"),
      ]);

      const normEmp = emps
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const disp =
            [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
          return { id: e.id, name: disp };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const normSvc = svcs.map((s) => ({
        id: s.id,
        name: s.service_name || s.name || "—",
        price: s.price,
      }));

      setAppointments(apps);
      setEmployees(normEmp);
      setServices(normSvc);
      setClientsBarber(clBarber);
      setClientsMarket(clMarket);

      await loadRates();
    } catch (e) {
      console.error(e);
      setErrorMsg("Не удалось загрузить данные для аналитики.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(); /* eslint-disable-next-line */
  }, [year, month]);
  useEffect(() => {
    if (fullView) setModalPage(1);
  }, [fullView]);

  /* lookups и расчёты */
  const empName = (id) =>
    employees.find((x) => String(x.id) === String(id))?.name || `ID ${id}`;
  const svcById = (id) => services.find((x) => String(x.id) === String(id));
  const svcName = (id) => svcById(id)?.name || `ID ${id}`;
  const clientName = (id) => {
    const c = clientsBarber.find((x) => String(x.id) === String(id));
    return c?.full_name || c?.name || `ID ${id}`;
  };
  const priceOf = (a) => {
    const svc = svcById(a.service);
    const p = a?.service_price ?? a?.price ?? svc?.price;
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  };

  const yearsList = useMemo(() => {
    const yNow = now.getFullYear();
    const years = new Set([2025, 2026, yNow, yNow - 1, yNow - 2]);
    appointments.forEach((a) => {
      const d = new Date(a.start_at);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [appointments]);

  const monthsList = [
    { v: 1, t: "Январь" },
    { v: 2, t: "Февраль" },
    { v: 3, t: "Март" },
    { v: 4, t: "Апрель" },
    { v: 5, t: "Май" },
    { v: 6, t: "Июнь" },
    { v: 7, t: "Июль" },
    { v: 8, t: "Август" },
    { v: 9, t: "Сентябрь" },
    { v: 10, t: "Октябрь" },
    { v: 11, t: "Ноябрь" },
    { v: 12, t: "Декабрь" },
  ];

  const filteredApps = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.start_at);
      if (Number.isNaN(d.getTime())) return false;
      return (
        d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month)
      );
    });
  }, [appointments, month, year]);

  const totalServices = services.length;
  const totalClientsBarber = clientsBarber.length;
  const totalClientsMarket = useMemo(
    () => clientsMarket.filter((c) => !isSupplierLike(c)).length,
    [clientsMarket]
  );
  const totalApps = filteredApps.length;

  const totalRevenue = useMemo(
    () =>
      filteredApps.reduce(
        (sum, a) => sum + (a.status === "completed" ? priceOf(a) : 0),
        0
      ),
    [filteredApps]
  );

  const totalsByStatus = useMemo(() => {
    const map = new Map();
    filteredApps.forEach((a) => {
      const s = a.status || "";
      const prev = map.get(s) || { count: 0, sum: 0 };
      prev.count += 1;
      if (s === "completed") prev.sum += priceOf(a);
      map.set(s, prev);
    });
    return map;
  }, [filteredApps]);

  const completedCount = totalsByStatus.get("completed")?.count || 0;
  const completedSum = totalsByStatus.get("completed")?.sum || 0;
  const canceledCount = totalsByStatus.get("canceled")?.count || 0;
  const noShowCount = totalsByStatus.get("no_show")?.count || 0;
  const { company } = useUser();
  const abortedCount = canceledCount + noShowCount;
  const abortedRate =
    totalApps > 0 ? Math.round((abortedCount / totalApps) * 100) : 0;

  const rankBarbers = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.barber);
      if (!key) return;
      const rec = m.get(key) || {
        id: key,
        name: empName(key),
        count: 0,
        sum: 0,
      };
      if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
      if (a.status === "completed") rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => byDescSum(x, y) || byDescCount(x, y));
  }, [filteredApps, employees]);

  const rankClientsVisits = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.client);
      if (!key || a.status !== "completed") return;
      const rec = m.get(key) || {
        id: key,
        name: clientName(key),
        count: 0,
        sum: 0,
      };
      rec.count += 1;
      rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => byDescSum(x, y) || byDescCount(x, y));
  }, [filteredApps, clientsBarber]);

  const rankServices = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.service);
      if (!key) return;
      const rec = m.get(key) || {
        id: key,
        name: svcName(key),
        count: 0,
        sum: 0,
      };
      if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
      if (a.status === "completed") rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => byDescSum(x, y) || byDescCount(x, y));
  }, [filteredApps, services]);

  const top10Clients = useMemo(
    () => [...rankClientsVisits].sort(byDescCount).slice(0, 10),
    [rankClientsVisits]
  );

  const lastVisitOf = (clientId) => {
    const last = filteredApps
      .filter(
        (a) =>
          a.client &&
          String(a.client) === String(clientId) &&
          a.status === "completed"
      )
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))[0];
    return last ? toDate(last.start_at) : "—";
  };

  /* расход: выплаты по ставкам за месяц */
  const payoutsTotal = useMemo(() => {
    return employees.reduce((sum, e) => {
      const done = filteredApps.filter(
        (a) =>
          a.barber &&
          String(a.barber) === String(e.id) &&
          a.status === "completed"
      ).length;
      const r = rates[e.id] || {};
      const perRec = Number(r.perRecord || 0) || 0;
      const perMon = Number(r.perMonth || 0) || 0;
      return sum + done * perRec + perMon;
    }, 0);
  }, [employees, filteredApps, rates]);

  /* пагинация и модалки (как были) */
  const slicePage = (arr, page, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
    const safe = Math.min(Math.max(1, page), totalPages);
    const from = (safe - 1) * pageSize;
    return { rows: arr.slice(from, from + pageSize), page: safe, totalPages };
  };
  const barbersPage = slicePage(rankBarbers, pageBarbers, RANK_PAGE);
  const servicesPage = slicePage(rankServices, pageServices, RANK_PAGE);
  const topPage = slicePage(top10Clients, pageTop10, RANK_PAGE);

  const Pager = ({ page, totalPages, onPrev, onNext }) => {
    if (totalPages <= 1) return null;
    const pages = new Set([1, page - 1, page, page + 1, totalPages]);
    const list = [...pages]
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
    return (
      <nav className="barbercashreports__pager" aria-label="Пагинация">
        <button
          className="barbercashreports__pageBtn"
          onClick={onPrev}
          disabled={page === 1}
        >
          Назад
        </button>
        <ul className="barbercashreports__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const needDots = prev && n - prev > 1;
            return (
              <React.Fragment key={n}>
                {needDots && <li className="barbercashreports__dots">…</li>}
                <li>
                  <button
                    className={`barbercashreports__pageBtn ${
                      n === page ? "is-active" : ""
                    }`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => onNext(n)}
                  >
                    {n}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <button
          className="barbercashreports__pageBtn"
          onClick={() => onNext(page + 1)}
          disabled={page === totalPages}
        >
          Далее
        </button>
      </nav>
    );
  };

  return (
    <div className="barbercashreports">
      {/* Tabs */}
      {company?.sector?.name === "Барбершоп" && (
        <div className="barbercashreports__tabs">
          <button
            className={`barbercashreports__tab ${
              tab === "analytics" ? "is-active" : ""
            }`}
            onClick={() => setTab("analytics")}
          >
            Аналитика
          </button>
          <button
            className={`barbercashreports__tab ${
              tab === "catalog" ? "is-active" : ""
            }`}
            onClick={() => setTab("catalog")}
          >
            Каталог
          </button>
          <button
            className={`barbercashreports__tab ${
              tab === "kassa" ? "is-active" : ""
            }`}
            onClick={() => setTab("kassa")}
          >
            Касса
          </button>
          <button
            className={`barbercashreports__tab ${
              tab === "payouts" ? "is-active" : ""
            }`}
            onClick={() => setTab("payouts")}
          >
            Выплаты
          </button>
        </div>
      )}

      {/* ======= АНАЛИТИКА ======= */}
      {tab === "analytics" && (
        <>
          <header className="barbercashreports__header">
            <div className="barbercashreports__titleBox">
              <h2 className="barbercashreports__title">Аналитика</h2>
              <span className="barbercashreports__subtitle">
                {loading ? "Загрузка…" : `Период: ${pad2(month)}.${year}`}
              </span>
            </div>

            <div className="barbercashreports__actions">
              <div className="barbercashreports__period">
                <select
                  className="barbercashreports__select"
                  value={month}
                  onChange={(e) => {
                    setMonth(Number(e.target.value));
                    setPageBarbers(1);
                    setPageServices(1);
                    setPageTop10(1);
                  }}
                  aria-label="Месяц"
                  title="Месяц"
                >
                  {monthsList.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.t}
                    </option>
                  ))}
                </select>
                <select
                  className="barbercashreports__select"
                  value={year}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    setPageBarbers(1);
                    setPageServices(1);
                    setPageTop10(1);
                  }}
                  aria-label="Год"
                  title="Год"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="barbercashreports__btn barbercashreports__btn--primary barbercashreports__btn--icon"
                onClick={loadAll}
                title="Обновить данные"
              >
                <FaSync />{" "}
                <span className="barbercashreports__btnText">Обновить</span>
              </button>
            </div>
          </header>

          {errorMsg && (
            <div className="barbercashreports__alert">{errorMsg}</div>
          )}

          {/* KPI */}
          <section className="barbercashreports__kpi">
            <div className="barbercashreports__card">
              <div className="barbercashreports__cardIcon">
                <FaCalendarAlt />
              </div>
              <div className="barbercashreports__cardLabel">
                Записей (месяц)
              </div>
              <div className="barbercashreports__cardValue">
                {fmtInt(totalApps)}
              </div>
            </div>
            <div className="barbercashreports__card">
              <div className="barbercashreports__cardIcon">
                <FaCut />
              </div>
              <div className="barbercashreports__cardLabel">Услуг (всего)</div>
              <div className="barbercashreports__cardValue">
                {fmtInt(totalServices)}
              </div>
            </div>
            <div className="barbercashreports__card">
              <div className="barbercashreports__cardIcon">
                <FaUsers />
              </div>
              <div className="barbercashreports__cardLabel">
                Клиенты барбершоп
              </div>
              <div className="barbercashreports__cardValue">
                {fmtInt(totalClientsBarber)}
              </div>
            </div>
            <div className="barbercashreports__card">
              <div className="barbercashreports__cardIcon">
                <FaUsers />
              </div>
              <div className="barbercashreports__cardLabel">Клиенты продаж</div>
              <div className="barbercashreports__cardValue">
                {fmtInt(totalClientsMarket)}
              </div>
            </div>
            <div className="barbercashreports__card barbercashreports__card--accent">
              <div className="barbercashreports__cardIcon">
                <FaCalendarAlt />
              </div>
              <div className="barbercashreports__cardLabel">Приход (месяц)</div>
              <div className="barbercashreports__cardValue">
                {fmtMoney(totalRevenue)}
              </div>
            </div>
            <div className="barbercashreports__card barbercashreports__card--accent">
              <div className="barbercashreports__cardLabel">
                Расход: выплаты мастерам
              </div>
              <div className="barbercashreports__cardValue">
                {fmtMoney(payoutsTotal)}
              </div>
            </div>
          </section>

          {/* Статусы */}
          <section className="barbercashreports__panel">
            <h3 className="barbercashreports__panelTitle">Статусы записей</h3>
            <div className="barbercashreports__statusList">
              {[
                {
                  code: "completed",
                  label: STATUS_LABELS.completed,
                  count: completedCount,
                  sum: completedSum,
                },
                {
                  code: "aborted",
                  label: "Отмены и не пришёл",
                  count: abortedCount,
                  sum: 0,
                },
              ].map((row) => {
                const share = totalApps
                  ? Math.round((row.count / totalApps) * 100)
                  : 0;
                return (
                  <div key={row.code} className="barbercashreports__statusRow">
                    <div className="barbercashreports__statusHead">
                      <span
                        className={`barbercashreports__badge barbercashreports__badge--${row.code}`}
                      >
                        {row.label}
                      </span>
                      <span className="barbercashreports__statusNum">
                        {fmtInt(row.count)}
                      </span>
                    </div>
                    <div
                      className="barbercashreports__progress"
                      aria-label={`${row.label} ${share}%`}
                    >
                      <div
                        className="barbercashreports__progressFill"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    {row.code === "completed" && (
                      <div className="barbercashreports__statusMoney">
                        Сумма: {fmtMoney(row.sum)}
                      </div>
                    )}
                  </div>
                );
              })}
              {!totalApps && (
                <div className="barbercashreports__muted">
                  Нет данных за месяц.
                </div>
              )}
            </div>
          </section>

          {/* Рейтинги */}
          <section className="barbercashreports__grid">
            {/* Мастера */}
            <div className="barbercashreports__panel">
              <div className="barbercashreports__panelHead">
                <h3 className="barbercashreports__panelTitle">
                  Мастера — записи
                </h3>
                <button
                  className="barbercashreports__iconBtn"
                  title="Показать всё"
                  onClick={() => setFullView("barbers")}
                >
                  <FaListUl />
                </button>
              </div>
              <div
                className={`barbercashreports__scroll ${
                  rankBarbers.length <= RANK_PAGE
                    ? "barbercashreports__scroll--center"
                    : ""
                }`}
              >
                <ol className="barbercashreports__rankList">
                  {barbersPage.rows.map((r, i) => (
                    <li
                      key={`${r.id}-${i}`}
                      className="barbercashreports__rankItem"
                    >
                      <span className="barbercashreports__rankName">
                        {r.name}
                      </span>
                      <span className="barbercashreports__rankCount">
                        {fmtInt(r.count)} • {fmtMoney(r.sum)}
                      </span>
                    </li>
                  ))}
                  {!loading && !rankBarbers.length && (
                    <div className="barbercashreports__muted">Нет записей.</div>
                  )}
                </ol>
              </div>
              <Pager
                page={barbersPage.page}
                totalPages={barbersPage.totalPages}
                onPrev={() => setPageBarbers((p) => Math.max(1, p - 1))}
                onNext={(n) =>
                  setPageBarbers((p) =>
                    typeof n === "number"
                      ? n
                      : Math.min(barbersPage.totalPages, p + 1)
                  )
                }
              />
            </div>

            {/* Услуги */}
            <div className="barbercashreports__panel">
              <div className="barbercashreports__panelHead">
                <h3 className="barbercashreports__panelTitle">
                  Услуги — использование
                </h3>
                <button
                  className="barbercashreports__iconBtn"
                  title="Показать всё"
                  onClick={() => setFullView("services")}
                >
                  <FaListUl />
                </button>
              </div>
              <div
                className={`barbercashreports__scroll ${
                  rankServices.length <= RANK_PAGE
                    ? "barbercashreports__scroll--center"
                    : ""
                }`}
              >
                <ol className="barbercashreports__rankList">
                  {servicesPage.rows.map((r, i) => (
                    <li
                      key={`${r.id}-${i}`}
                      className="barbercashreports__rankItem"
                    >
                      <span className="barbercashreports__rankName">
                        {r.name}
                      </span>
                      <span className="barbercashreports__rankCount">
                        {fmtInt(r.count)} • {fmtMoney(r.sum)}
                      </span>
                    </li>
                  ))}
                  {!loading && !rankServices.length && (
                    <div className="barbercashreports__muted">Нет данных.</div>
                  )}
                </ol>
              </div>
              <Pager
                page={servicesPage.page}
                totalPages={servicesPage.totalPages}
                onPrev={() => setPageServices((p) => Math.max(1, p - 1))}
                onNext={(n) =>
                  setPageServices((p) =>
                    typeof n === "number"
                      ? n
                      : Math.min(servicesPage.totalPages, p + 1)
                  )
                }
              />
            </div>
          </section>

          {/* Топ-10 клиентов */}
          <section className="barbercashreports__panel">
            <div className="barbercashreports__panelHead">
              <h3 className="barbercashreports__panelTitle">Топ-10 клиентов</h3>
              <button
                className="barbercashreports__iconBtn"
                title="Показать полный список"
                onClick={() => setFullView("topClients")}
              >
                <FaListUl />
              </button>
            </div>

            <div className="barbercashreports__topTableWrap">
              <table className="barbercashreports__table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Приходов</th>
                    <th>Сумма</th>
                    <th>Последний визит</th>
                  </tr>
                </thead>
                <tbody>
                  {topPage.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{fmtInt(r.count)}</td>
                      <td>{fmtMoney(r.sum)}</td>
                      <td>{lastVisitOf(r.id)}</td>
                    </tr>
                  ))}
                  {!topPage.rows.length && (
                    <tr>
                      <td colSpan="4" className="barbercashreports__muted">
                        Нет данных.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pager
              page={topPage.page}
              totalPages={topPage.totalPages}
              onPrev={() => setPageTop10((p) => Math.max(1, p - 1))}
              onNext={(n) =>
                setPageTop10((p) =>
                  typeof n === "number"
                    ? n
                    : Math.min(topPage.totalPages, p + 1)
                )
              }
            />
          </section>

          {/* Модалка полноты */}
          {fullView && (
            <div
              className="barbercashreports__modalOverlay"
              onClick={() => setFullView(null)}
            >
              <div
                className="barbercashreports__modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="barbercashreports__modalHeader">
                  <h3 className="barbercashreports__modalTitle">
                    {fullView === "barbers"
                      ? "Мастера — записи"
                      : fullView === "services"
                      ? "Услуги — использование"
                      : "Клиенты"}
                  </h3>
                  <button
                    className="barbercashreports__iconBtn"
                    onClick={() => setFullView(null)}
                    aria-label="Закрыть"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className="barbercashreports__modalBody">
                  {fullView === "topClients" ? (
                    <div className="barbercashreports__topTableWrap">
                      <table className="barbercashreports__table">
                        <thead>
                          <tr>
                            <th>Клиент</th>
                            <th>Приходов</th>
                            <th>Сумма</th>
                            <th>Последний визит</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slicePage(
                            rankClientsVisits,
                            modalPage,
                            MODAL_PAGE
                          ).rows.map((r) => (
                            <tr key={r.id}>
                              <td>{r.name}</td>
                              <td>{fmtInt(r.count)}</td>
                              <td>{fmtMoney(r.sum)}</td>
                              <td>{lastVisitOf(r.id)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ol className="barbercashreports__rankList barbercashreports__rankList--full">
                      {slicePage(
                        fullView === "barbers" ? rankBarbers : rankServices,
                        modalPage,
                        MODAL_PAGE
                      ).rows.map((r, i) => (
                        <li
                          key={`${r.id}-${i}`}
                          className="barbercashreports__rankItem"
                        >
                          <span className="barbercashreports__rankName">
                            {r.name}
                          </span>
                          <span className="barbercashreports__rankCount">
                            {fmtInt(r.count)} • {fmtMoney(r.sum)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <nav
                  className="barbercashreports__pager"
                  aria-label="Пагинация"
                >
                  <button
                    className="barbercashreports__pageBtn"
                    onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                    disabled={modalPage === 1}
                  >
                    Назад
                  </button>
                  <button
                    className="barbercashreports__pageBtn"
                    onClick={() => setModalPage((p) => p + 1)}
                  >
                    Далее
                  </button>
                </nav>

                <div className="barbercashreports__formActions">
                  <button
                    className="barbercashreports__btn barbercashreports__btn--secondary"
                    onClick={() => setFullView(null)}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "catalog" && (
        <div className="barbercashreports__kassaWrap">
          <Suspense
            fallback={<div className="barbercashreports__muted">Загрузка…</div>}
          >
            <CatalogAnalyticsLazy />
          </Suspense>
        </div>
      )}

      {tab === "kassa" && (
        <div className="barbercashreports__kassaWrap">
          <Suspense
            fallback={
              <div className="barbercashreports__muted">Загрузка кассы…</div>
            }
          >
            <KassaLazy />
          </Suspense>
        </div>
      )}

      {/* ======= ВЫПЛАТЫ МАСТЕРАМ ======= */}
      {tab === "payouts" && (
        <RecordaRates
          year={year}
          month={month}
          employees={employees}
          appointments={filteredApps}
          rates={rates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          onChangeRate={setRateValue}
          onSaveRates={persistRates}
        />
      )}
    </div>
  );
};

export default CashReports;
