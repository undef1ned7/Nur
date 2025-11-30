import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  RefreshCcw,
  Users2,
  PackageSearch,
  Wallet,
  Trophy,
  Boxes,
  Info,
  X,
  CalendarDays,
  Scissors,
} from "lucide-react";
import "./BarberAnalitika.scss";
import { useDispatch, useSelector } from "react-redux";
import { useSale } from "../../../../store/slices/saleSlice";
import {
  historySellProduct,
  historySellObjects,
  historySellProductDetail,
  historySellObjectDetail,
} from "../../../../store/creators/saleThunk";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import api from "../../../../api";

/* ─── helpers ─── */
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (x) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(toNum(x));
const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
const fmtMoney = (n) => `${fmt(n)} c`;
const take = (arr, n) => arr.slice(0, n);
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const clean = (s, fallback = "—") => (s ?? "").toString().trim() || fallback;
const keyOf = (s, fallback = "—") =>
  clean(s, fallback).replace(/\s+/g, " ").toLowerCase();
const pad2 = (n) => String(n).padStart(2, "0");

const months = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const monthRange = (year, monthIdx) => {
  const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
  return { startTs: start.getTime(), endTs: end.getTime() - 1 };
};

/* для записей берём start_at */
const tsOf = (x) => {
  const v =
    x?.start_at ||
    x?.sold_at ||
    x?.date ||
    x?.datetime ||
    x?.accepted_at ||
    x?.updated_at ||
    x?.created_at;
  const t = v ? new Date(v).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

const padDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* ─── cashflows (кассы строительства) ─── */
async function fetchAllConstructionCashflows(params = {}) {
  const acc = [];
  let page = 1;
  for (;;) {
    try {
      const res = await api.get("/construction/cashflows/", {
        params: { page, page_size: 200, ...params },
      });
      const rows = asArray(res?.data);
      acc.push(...rows);
      if (!res?.data?.next) break;
      page += 1;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  return acc;
}

/* ─── tiny pager ─── */
const usePaged = (rows, pageSize) => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => setPage(1), [rows, pageSize]);
  const slice = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );
  return { page, pages, setPage, slice };
};

/* ─── modal ─── */
const DetailsModal = ({ title, columns, rows, getKey, onClose, pageSize = 12 }) => {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div className="ba-modal" role="dialog" aria-modal="true">
      <div className="ba-modal__overlay" onClick={onClose} />
      <div className="ba-modal__card" aria-label={title}>
        <div className="ba-modal__head">
          <h3 className="ba-modal__title">{title}</h3>
          <button className="ba-modal__icon" onClick={onClose} aria-label="Закрыть" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="ba-modal__body">
          <div className="ba-tableWrap ba-tableWrap--modal">
            <table className="ba-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col">{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="ba-empty">Нет данных</td>
                  </tr>
                ) : (
                  slice.map((r, i) => (
                    <tr key={getKey(r, i)}>
                      {columns.map((c) => (
                        <td key={c.key} className={c.className || ""}>
                          {c.render ? c.render(r) : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ba-modal__footer">
          <div className="ba-pager" aria-label="Пагинация">
            <button
              className="ba-pager__btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Назад"
              type="button"
            >
              ←
            </button>
            <span className="ba-pager__info">Страница {page} из {pages}</span>
            <button
              className="ba-pager__btn"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              aria-label="Вперёд"
              type="button"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================= ЕДИНЫЙ КОМПОНЕНТ ======================= */
const BarberAnalitika = () => {
  const dispatch = useDispatch();
  const { history, historyObjects } = useSale();
  const { list: products } = useSelector((s) => s.product);

  /* фильтр: год/месяц */
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const { startTs, endTs } = useMemo(() => monthRange(year, monthIdx), [year, monthIdx]);

  /* модалка */
  const [modal, setModal] = useState({ open: false, title: "", columns: [], rows: [] });
  const openModal = (payload) => setModal({ open: true, ...payload });
  const closeModal = () => setModal((p) => ({ ...p, open: false }));

  /* ====== ЗАГРУЗКИ И ИСХОДНЫЕ ДАННЫЕ ====== */

  // Каталог (товары + продажи)
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
    dispatch(fetchProductsAsync({}));
  }, [dispatch]);

  // Барбершоп источники
  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [clientsBarber, setClientsBarber] = useState([]);
  const [clientsMarket, setClientsMarket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
            const disp = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
            return { id: e.id, name: disp };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "ru"));

        const normSvc = svcs.map((s) => ({ id: s.id, name: s.service_name || s.name || "—", price: s.price }));

        if (!cancelled) {
          setAppointments(apps);
          setEmployees(normEmp);
          setServices(normSvc);
          setClientsBarber(clBarber);
          setClientsMarket(clMarket);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setErrorMsg("Не удалось загрузить данные барбершопа.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year, monthIdx]);

  /* ===== СТАВКИ (включая проценты) ===== */
  const periodLabel = `${year}-${pad2(monthIdx + 1)}`;
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(false);

  const RATES_EP = "/education/teacher-rates/";
  const loadRates = async () => {
    setRatesLoading(true);
    try {
      const safeGet = async (mode) => {
        try {
          return await api.get(RATES_EP, { params: { period: periodLabel, mode, page_size: 1000 } });
        } catch {
          return null;
        }
      };

      const resLesson  = await safeGet("lesson");   // ставка за запись
      let   resPercent = await safeGet("percent");  // процент (новый режим)
      let   resMonth   = null;
      if (!resPercent) resMonth = await safeGet("month"); // фолбэк

      const map = {};

      const takeLesson = (resp) => {
        (asArray(resp?.data) || []).forEach((r) => {
          const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
          if (!tId) return;
          map[tId] = map[tId] || {};
          map[tId].perRecord = Number(r.rate ?? 0) || 0;
        });
      };

      const takePercentLike = (resp, mode) => {
        (asArray(resp?.data) || []).forEach((r) => {
          const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
          if (!tId) return;
          map[tId] = map[tId] || {};
          const val = Number(r.rate ?? 0) || 0;
          map[tId].percent = val;     // трактуем как процент
          if (mode === "month") map[tId].perMonth = val; // совместимость со старым UI
        });
      };

      if (resLesson)  takeLesson(resLesson);
      if (resPercent) takePercentLike(resPercent, "percent");
      else if (resMonth) takePercentLike(resMonth, "month");

      setRates(map);
    } catch (e) {
      console.error(e);
      setRates({});
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    setRates({});
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodLabel]);

  /* ===== LOOKUP'ы ===== */
  const svcById = (id) => services.find((x) => String(x.id) === String(id));
  const priceOf = (a) => {
    const svc = svcById(a.service);
    const p = a?.service_price ?? a?.price ?? svc?.price;
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  };
  const empName = (id) => employees.find((x) => String(x.id) === String(id))?.name || `ID ${id}`;
  const clientNameBarber = (id) => {
    const c = clientsBarber.find((x) => String(x.id) === String(id));
    return c?.full_name || c?.name || `ID ${id}`;
  };
  const isSupplierLike = (c = {}) => {
    if (c.is_supplier === true || c.isVendor === true || c.supplier === true) return true;
    const text = [c.type, c.category, c.group, c.role, c.kind, c.segment, c.status, (c.name || c.full_name || "").toString()]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /поставщик|supplier|vendor/.test(text);
  };

  /* ===== ФИЛЬТР ЗА ПЕРИОД ===== */
  const filteredApps = useMemo(() => {
    return appointments.filter((a) => {
      const t = tsOf(a);
      return t >= startTs && t <= endTs;
    });
  }, [appointments, startTs, endTs]);

  const totalApps = filteredApps.length;
  const totalServices = services.length;
  const totalClientsBarber = clientsBarber.length;
  const totalClientsMarket = useMemo(
    () => clientsMarket.filter((c) => !isSupplierLike(c)).length,
    [clientsMarket]
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

  /* ===== агрегаты по мастерам для выплат ===== */
  const doneByMaster = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      if (a.status !== "completed") return;
      const key = String(a.barber || "");
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [filteredApps]);

  const revenueByMaster = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      if (a.status !== "completed") return;
      const key = String(a.barber || "");
      if (!key) return;
      m.set(key, (m.get(key) || 0) + priceOf(a));
    });
    return m;
  }, [filteredApps, services]);

  /* ===== Рейтинги барбера ===== */
  const COUNTABLE_FOR_RANK = new Set(["booked", "confirmed", "completed", "no_show"]);
  const rankBarbers = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.barber);
      if (!key) return;
      const rec = m.get(key) || { id: key, name: empName(key), count: 0, sum: 0 };
      if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
      if (a.status === "completed") rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => (y.sum - x.sum) || (y.count - x.count));
  }, [filteredApps, employees]);

  const rankServices = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.service);
      if (!key) return;
      const rec = m.get(key) || { id: key, name: (svcById(key)?.name || `ID ${key}`), count: 0, sum: 0 };
      if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
      if (a.status === "completed") rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => (y.sum - x.sum) || (y.count - x.count));
  }, [filteredApps, services]);

  const rankClientsVisits = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.client);
      if (!key || a.status !== "completed") return;
      const rec = m.get(key) || { id: key, name: clientNameBarber(key), count: 0, sum: 0 };
      rec.count += 1;
      rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort((x, y) => (y.sum - x.sum) || (y.count - x.count));
  }, [filteredApps, clientsBarber]);

  const lastVisitOf = (clientId) => {
    const last = filteredApps
      .filter((a) => a.client && String(a.client) === String(clientId) && a.status === "completed")
      .sort((a, b) => tsOf(b) - tsOf(a))[0];
    return last ? padDate(last.start_at) : "—";
  };

  /* ===== Кассы (приход/расход за период) ===== */
  const [cashRows, setCashRows] = useState([]);
  const [loadingCash, setLoadingCash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCash(true);
      try {
        const flows = await fetchAllConstructionCashflows();

        const dirOf = (cf) => {
          const raw = String(cf.type ?? cf.kind ?? cf.direction ?? "").trim().toLowerCase();
          if (["income", "приход"].includes(raw)) return "income";
          if (["expense", "расход"].includes(raw)) return "expense";
          const amt = toNum(cf.amount ?? cf.value ?? cf.sum ?? 0);
          return amt >= 0 ? "income" : "expense";
        };

        const periodFlows = flows.filter((cf) => {
          const t = tsOf(cf);
          return t >= startTs && t <= endTs;
        });

        let boxes = [];
        try {
          const { data } = await api.get("/construction/cashboxes/");
          boxes = asArray(data);
        } catch (e) {
          console.error(e);
        }

        const m = new Map();
        for (const cf of periodFlows) {
          const id = String(cf.cashbox ?? cf.cashbox_id ?? "");
          const dir = dirOf(cf);
          const amt = Math.abs(toNum(cf.amount ?? cf.value ?? cf.sum ?? 0));
          const prev = m.get(id) || { income: 0, expense: 0, ops: 0 };
          m.set(id, {
            income: prev.income + (dir === "income" ? amt : 0),
            expense: prev.expense + (dir === "expense" ? amt : 0),
            ops: prev.ops + 1,
          });
        }

        const rows = Array.from(m, ([id, v]) => {
          const meta = boxes.find((b) => String(b.id || b.uuid) === id);
          const name = clean(
            meta?.department_name || meta?.name || (id ? `Касса #${id}` : "—"),
            "—"
          );
          return { name, ops: v.ops, income: v.income, expense: v.expense };
        }).sort((a, b) => b.income - a.income);

        if (!cancelled) setCashRows(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCashRows([]);
      } finally {
        if (!cancelled) setLoadingCash(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startTs, endTs]);

  const cashTotals = useMemo(() => {
    const income = cashRows.reduce((a, r) => a + toNum(r.income), 0);
    const expense = cashRows.reduce((a, r) => a + toNum(r.expense), 0);
    return { income, expense, net: income - expense };
  }, [cashRows]);

  /* ===== Продажи (товары) за период ===== */
  const periodSales = useMemo(() => {
    const all = [...(history || []), ...(historyObjects || [])];
    return all.filter((s) => {
      const t = tsOf(s);
      return t >= startTs && t <= endTs;
    });
  }, [history, historyObjects, startTs, endTs]);

  const [productsRowsAgg, setProductsRowsAgg] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      const m = new Map();
      const names = new Map();
      let hadItems = false;

      const addItem = (it) => {
        const disp = clean(it.product_name || it.object_name || it.name, "—");
        const k = keyOf(disp, "—");
        names.set(k, disp);
        const qty = toNum(it.quantity);
        const revenue = qty * toNum(it.unit_price);
        const prev = m.get(k) || { qty: 0, revenue: 0 };
        m.set(k, { qty: prev.qty + qty, revenue: prev.revenue + revenue });
      };

      for (const s of periodSales) {
        const items = Array.isArray(s.items) ? s.items : [];
        if (items.length) hadItems = true;
        items.forEach(addItem);
      }

      if (!hadItems) {
        const ids = take(periodSales.map((s) => s.id), 60);
        for (const id of ids) {
          try {
            const d1 = await dispatch(historySellProductDetail(id)).unwrap();
            (Array.isArray(d1?.items) ? d1.items : []).forEach(addItem);
          } catch (e) {
            console.error(e);
          }
          try {
            const d2 = await dispatch(historySellObjectDetail(id)).unwrap();
            (Array.isArray(d2?.items) ? d2.items : []).forEach(addItem);
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (!cancelled) {
        const rows = Array.from(m, ([k, v]) => ({
          name: names.get(k) || "—",
          qty: v.qty,
          revenue: v.revenue,
        })).sort((a, b) => b.revenue - a.revenue);
        setProductsRowsAgg(rows);
        setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [periodSales, dispatch]);

  /* ===== KPI склада (снимок) ===== */
  const stockKpis = useMemo(() => {
    const positions = (products || []).length;
    const totalQty = (products || []).reduce((a, p) => a + toNum(p.quantity), 0);
    const stockValueRetail = (products || []).reduce(
      (a, p) => a + toNum(p.price) * toNum(p.quantity),
      0
    );
    return { positions, totalQty, stockValueRetail };
  }, [products]);

  /* ===== ЕДИНЫЕ ПРИХОД/РАСХОД ===== */
  const payoutsTotal = useMemo(() => {
    // выплаты мастерам за выбранный месяц: perRecord + percent (+ perMonth, если нет процента)
    return employees.reduce((sum, e) => {
      const id = String(e.id);
      const done = Number(doneByMaster.get(id) || 0);
      const rev  = Number(revenueByMaster.get(id) || 0);
      const r    = rates[id] || {};
      const perRecord = Number(r.perRecord || 0) || 0;
      const percent   = Number(r.percent   || 0) || 0;
      const perMonth  = Number(r.perMonth  || 0) || 0;

      const byRecords = done * perRecord;
      const byPercent = Math.round((rev * percent) / 100);
      const fixed     = percent ? 0 : perMonth; // если есть процент, не удваиваем фикс

      return sum + byRecords + byPercent + fixed;
    }, 0);
  }, [employees, doneByMaster, revenueByMaster, rates]);

  const unifiedIncome = completedSum + cashTotals.income;
  const unifiedExpense = payoutsTotal + cashTotals.expense;

  /* ===== РЕНДЕР ===== */
  const renderCard = ({ icon, title, columns, rows, moreTitle }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { page, pages, setPage, slice } = usePaged(rows, 12);
    return (
      <div className="ba-card">
        <div className="ba-card__head">
          <div className="ba-card__title">
            {icon}
            <span>{title}</span>
          </div>
          <button
            className="ba-card__more"
            aria-label="Подробнее"
            title="Подробнее"
            type="button"
            onClick={() => openModal({ title: moreTitle || title, columns, rows })}
          >
            <Info size={16} />
          </button>
        </div>

        <div className="ba-tableWrap">
          <table className="ba-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col">{c.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="ba-empty">Нет данных</td>
                </tr>
              ) : (
                slice.map((r, i) => (
                  <tr key={`${title}-${i}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.className || ""}>
                        {c.render ? c.render(r) : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ba-card__pager">
          <button
            className="ba-pager__btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Назад"
            type="button"
          >
            ←
          </button>
          <span className="ba-pager__info">{page} / {pages}</span>
          <button
            className="ba-pager__btn"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            aria-label="Вперёд"
            type="button"
          >
            →
          </button>
        </div>
      </div>
    );
  };

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2, cur - 3, cur - 4];
  }, []);

  return (
    <div className="barber-analitika">
      <header className="ba-head">
        <h2 className="ba-title">Аналитика</h2>

        <div className="ba-filters">
          <select
            className="ba-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Год"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="ba-select"
            value={monthIdx}
            onChange={(e) => setMonthIdx(Number(e.target.value))}
            aria-label="Месяц"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <button
            className="ba-refresh"
            onClick={() => setYear((y) => y)}
            aria-label="Обновить"
            title="Обновить"
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      {errorMsg && <div className="ba-alert">{errorMsg}</div>}

      {/* KPI (барбер + кассы) */}
      <section className="ba-kpis">
        <div className="kpi">
          <div className="kpi__icon"><CalendarDays size={18} /></div>
          <div className="kpi__name">Записей</div>
          <div className="kpi__val">{fmtInt(totalApps)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Scissors size={18} /></div>
          <div className="kpi__name">Услуг (всего)</div>
          <div className="kpi__val">{fmtInt(totalServices)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Users2 size={18} /></div>
          <div className="kpi__name">Клиенты барбершоп</div>
          <div className="kpi__val">{fmtInt(totalClientsBarber)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Users2 size={18} /></div>
          <div className="kpi__name">Клиенты продаж</div>
          <div className="kpi__val">{fmtInt(totalClientsMarket)}</div>
        </div>
        <div className="kpi kpi--accent">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Приход</div>
          <div className="kpi__val">{fmtMoney(unifiedIncome)}</div>
        </div>
        <div className="kpi kpi--accent">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Расход</div>
          <div className="kpi__val">{fmtMoney(unifiedExpense)}</div>
        </div>
      </section>

      {/* KPI склада */}
      <section className="ba-kpis ba-kpis--secondary">
        <div className="kpi">
          <div className="kpi__icon"><Boxes size={18} /></div>
          <div className="kpi__name">Позиции</div>
          <div className="kpi__val">{stockKpis.positions}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><PackageSearch size={18} /></div>
          <div className="kpi__name">Штук на складе</div>
          <div className="kpi__val">{fmt(stockKpis.totalQty)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__icon"><Wallet size={18} /></div>
          <div className="kpi__name">Оценка запасов</div>
          <div className="kpi__val">{fmtMoney(stockKpis.stockValueRetail)}</div>
        </div>
      </section>

      {/* Статусы записей */}
      <section className="ba-panel">
        <h3 className="ba-panel__title">Статусы записей</h3>
        <div className="ba-statusList">
          {[
            { code: "completed", label: "Завершено", count: completedCount, sum: completedSum },
            { code: "aborted", label: "Отмены и не пришёл", count: canceledCount + noShowCount, sum: 0 },
          ].map((row) => {
            const share = totalApps ? Math.round((row.count / totalApps) * 100) : 0;
            return (
              <div key={row.code} className="ba-statusRow">
                <div className="ba-statusHead">
                  <span className={`ba-badge ba-badge--${row.code}`}>{row.label}</span>
                  <span className="ba-statusNum">{fmtInt(row.count)}</span>
                </div>
                <div className="ba-progress" aria-label={`${row.label} ${share}%`}>
                  <div className="ba-progress__fill" style={{ width: `${share}%` }} />
                </div>
                {row.code === "completed" && <div className="ba-statusMoney">Сумма: {fmtMoney(row.sum)}</div>}
              </div>
            );
          })}
          {!totalApps && <div className="ba-muted">Нет данных за месяц.</div>}
        </div>
      </section>

      {/* Рейтинги барбера */}
      <section className="ba-grid">
        <div className="ba-panel">
          <div className="ba-panel__head">
            <h3 className="ba-panel__title">Мастера — записи</h3>
          </div>
          <ol className="ba-rankList">
            {rankBarbers.slice(0, 6).map((r) => (
              <li key={r.id} className="ba-rankItem">
                <span className="ba-rankName">{r.name}</span>
                <span className="ba-rankCount">{fmtInt(r.count)} • {fmtMoney(r.sum)}</span>
              </li>
            ))}
            {!loading && !rankBarbers.length && <div className="ba-muted">Нет записей.</div>}
          </ol>
        </div>

        <div className="ba-panel">
          <div className="ba-panel__head">
            <h3 className="ba-panel__title">Услуги — использование</h3>
          </div>
          <ol className="ba-rankList">
            {rankServices.slice(0, 6).map((r) => (
              <li key={r.id} className="ba-rankItem">
                <span className="ba-rankName">{r.name}</span>
                <span className="ba-rankCount">{fmtInt(r.count)} • {fmtMoney(r.sum)}</span>
              </li>
            ))}
            {!loading && !rankServices.length && <div className="ba-muted">Нет данных.</div>}
          </ol>
        </div>
      </section>

      {/* Топ-10 клиентов (барбер) */}
      <section className="ba-panel">
        <h3 className="ba-panel__title">Топ-10 клиентов</h3>
        <div className="ba-tableWrap">
          <table className="ba-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Приходов</th>
                <th>Сумма</th>
                <th>Последний визит</th>
              </tr>
            </thead>
            <tbody>
              {rankClientsVisits.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{fmtInt(r.count)}</td>
                  <td className="ba-money">{fmtMoney(r.sum)}</td>
                  <td>{padDate(r.last_at) || padDate(r.start_at) || padDate(r.updated_at) || padDate(lastVisitOf(r.id))}</td>
                </tr>
              ))}
              {!rankClientsVisits.length && (
                <tr><td colSpan="4" className="ba-muted">Нет данных.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Сетка каталога */}
      <section className="ba-grid">
        {renderCard({
          icon: <Users2 size={16} />,
          title: "Поставщики",
          columns: [
            { key: "name", title: "Поставщик", className: "ba-ellipsis" },
            { key: "items", title: "Позиции" },
            { key: "amount", title: "Сумма", className: "ba-money", render: (r) => `${fmt(r.amount)} c` },
          ],
          rows: useMemo(() => {
            const inPeriod = (products || []).filter((p) => {
              const t = tsOf(p);
              return t >= startTs && t <= endTs;
            });
            const m = new Map();
            const names = new Map();
            for (const p of inPeriod) {
              const display = clean(p.client_name || p.client, "—");
              const k = keyOf(display, "—");
              names.set(k, display);
              const unit = p.purchase_price != null ? toNum(p.purchase_price) : toNum(p.price);
              const sum = unit * toNum(p.quantity);
              const prev = m.get(k) || { sum: 0, items: 0 };
              m.set(k, { sum: prev.sum + sum, items: prev.items + 1 });
            }
            return Array.from(m, ([k, v]) => ({
              name: names.get(k) || "—",
              items: v.items,
              amount: v.sum,
            })).sort((a, b) => b.amount - a.amount);
          }, [products, startTs, endTs]),
        })}

        {renderCard({
          icon: <Wallet size={16} />,
          title: "Кассы",
          columns: [
            { key: "name", title: "Касса", className: "ba-ellipsis" },
            { key: "ops", title: "Операции" },
            { key: "income", title: "Приход", className: "ba-money", render: (r) => `${fmt(r.income)} c` },
            { key: "expense", title: "Расход", className: "ba-money", render: (r) => `${fmt(r.expense)} c` },
          ],
          rows: cashRows,
        })}

        {renderCard({
          icon: <PackageSearch size={16} />,
          title: "Товары (продажи)",
          columns: [
            { key: "name", title: "Товар", className: "ba-ellipsis" },
            { key: "qty", title: "Кол-во" },
            { key: "revenue", title: "Выручка", className: "ba-money", render: (r) => `${fmt(r.revenue)} c` },
          ],
          rows: loadingProducts ? [] : productsRowsAgg,
        })}

        {renderCard({
          icon: <Users2 size={16} />,
          title: "Клиенты (продажи)",
          columns: [
            { key: "name", title: "Клиент", className: "ba-ellipsis" },
            { key: "orders", title: "Заказы" },
            { key: "revenue", title: "Выручка", className: "ba-money", render: (r) => `${fmt(r.revenue)} c` },
          ],
          rows: useMemo(() => {
            const m = new Map();
            const names = new Map();
            for (const s of periodSales) {
              const disp = clean(s.client_name || s.client, "Без имени");
              const k = keyOf(disp, "без имени");
              names.set(k, disp);
              const prev = m.get(k) || { sum: 0, cnt: 0 };
              m.set(k, { sum: prev.sum + toNum(s.total), cnt: prev.cnt + 1 });
            }
            return Array.from(m, ([k, v]) => ({
              name: names.get(k) || "—",
              orders: v.cnt,
              revenue: v.sum,
            })).sort((a, b) => b.revenue - a.revenue);
          }, [periodSales]),
        })}
      </section>

      {modal.open && (
        <DetailsModal
          title={modal.title}
          columns={modal.columns}
          rows={modal.rows}
          getKey={(r, i) => `${modal.title}-${i}`}
          onClose={closeModal}
          pageSize={12}
        />
      )}
    </div>
  );
};

export default BarberAnalitika;
