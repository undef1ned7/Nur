// src/components/Analytics/Analytics.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Analytics.scss";
import { FaChevronLeft, FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import { Banknote, FileText, ShoppingBag, TrendingUp } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getConsultingRows,
  getConsultingServices,
  getConsultingRequests,
} from "../../../../store/creators/consultingThunk";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import api from "../../../../api";
import Modal from "../../../common/Modal/Modal";

const EMPLOYEES_LIST_URL = "/users/employees/";
const BEM = "consulting-analytics";

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") + " с" : "—";
};

const pct = (num, den) => {
  const a = Number(num) || 0;
  const b = Number(den) || 0;
  if (!b) return "0%";
  return `${Math.round((a * 100) / b)}%`;
};

const clean = (s) => String(s || "").trim();
const uniq = (arr) => Array.from(new Set(arr));

const formatDateRu = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
};

const formatChartDate = (iso) => {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length >= 3) return `${parts[2]}.${parts[1]}`;
  return iso;
};

const PAGE = 8;

const Combo = ({
  title = "Выбор",
  items = [],
  selected = [],
  onPick,
  placeholder = "Поиск…",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const t = clean(q).toLowerCase();
    if (!t) return items;
    return items.filter((it) => it.label.toLowerCase().includes(t));
  }, [items, q]);

  const total = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, total);
  const rows = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  return (
    <div className={`${BEM}__combo`} ref={ref}>
      <div className={`${BEM}__comboControl${disabled ? " is-disabled" : ""}`}>
        <FaSearch className={`${BEM}__comboIcon`} />
        <input
          ref={inputRef}
          className={`${BEM}__comboInput`}
          placeholder={placeholder}
          value={q}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          disabled={disabled}
        />
        <button
          type="button"
          className={`${BEM}__comboToggle`}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-label={`Открыть «${title}»`}
          disabled={disabled}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className={`${BEM}__comboDrop`} role="listbox">
          {rows.length === 0 ? (
            <div className={`${BEM}__comboEmpty`}>Ничего не найдено</div>
          ) : (
            <>
              <ul className={`${BEM}__comboList`}>
                {rows.map((it) => {
                  const isPicked = selected.includes(String(it.id));
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        className={`${BEM}__comboItem${
                          isPicked ? " is-active" : ""
                        }`}
                        onClick={() => {
                          if (!isPicked) onPick?.(it.id);
                        }}
                        disabled={isPicked}
                        title={isPicked ? "Уже выбрано" : `Добавить «${it.label}»`}
                      >
                        <span className={`${BEM}__comboItemLabel`}>
                          {it.label}
                        </span>
                        {isPicked && (
                          <span className={`${BEM}__tag`}>Добавлено</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {filtered.length > PAGE && (
                <div className={`${BEM}__comboPager`}>
                  <button
                    type="button"
                    className={`${BEM}__pageBtn`}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <FaChevronLeft /> Назад
                  </button>
                  <span className={`${BEM}__page`}>
                    Стр. {safePage} из {total}
                  </span>
                  <button
                    type="button"
                    className={`${BEM}__pageBtn`}
                    onClick={() => setPage((p) => Math.min(total, p + 1))}
                    disabled={safePage === total}
                  >
                    Далее <FaChevronRight />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const FilterField = ({
  label,
  emptyHint,
  items,
  selectedIds,
  onRemove,
  comboProps,
}) => (
  <div className={`${BEM}__filterField`}>
    <label className={`${BEM}__label`}>{label}</label>
    <Combo {...comboProps} selected={selectedIds} />
    <div className={`${BEM}__chipsSlot`}>
      {selectedIds.length > 0 ? (
        <div className={`${BEM}__chips`}>
          {selectedIds.map((id) => {
            const item = items.find((x) => String(x.id) === String(id));
            return (
              <span key={id} className={`${BEM}__chipSoft`}>
                <span className={`${BEM}__chipText`} title={item?.label || id}>
                  {item?.label || id}
                </span>
                <button
                  type="button"
                  className={`${BEM}__chipClose`}
                  aria-label="Убрать"
                  onClick={() => onRemove(id)}
                >
                  <FaTimes />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <span className={`${BEM}__chipsEmpty`}>{emptyHint}</span>
      )}
    </div>
  </div>
);

const KpiCard = ({ label, value, description, icon: Icon }) => (
  <div className={`${BEM}__kpi`}>
    {Icon && (
      <div className={`${BEM}__kpiIcon`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
    )}
    <div className={`${BEM}__kpiBody`}>
      <div className={`${BEM}__kpiLabel`}>{label}</div>
      <div className={`${BEM}__kpiValue`}>{value}</div>
      {description ? (
        <div className={`${BEM}__kpiDesc`}>{description}</div>
      ) : null}
    </div>
  </div>
);

const RankList = ({ items, emptyText = "Нет данных" }) => {
  if (!items.length) {
    return <div className={`${BEM}__empty`}>{emptyText}</div>;
  }

  const maxSum = items[0]?.sum || 1;

  return (
    <ul className={`${BEM}__rankList`}>
      {items.map((item) => (
        <li key={item.name} className={`${BEM}__rankRow`}>
          <div className={`${BEM}__rankMain`}>
            <div className={`${BEM}__rankTitle`} title={item.name}>
              {item.name}
            </div>
            <div className={`${BEM}__barWrap`} aria-hidden>
              <div
                className={`${BEM}__bar`}
                style={{
                  width: `${Math.min(100, (item.sum / maxSum) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className={`${BEM}__rankMeta`}>
            <b>{money(item.sum)}</b>
            <span> · {item.count} шт.</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

const ConsultingAnalytics = () => {
  const dispatch = useDispatch();
  const { rows = [], services = [] } = useConsulting();
  const requests = useSelector((s) => s.consulting?.requests || []);
  const loadingConsulting = useSelector((s) => s.consulting?.loading) || false;

  const [employees, setEmployees] = useState([]);
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(EMPLOYEES_LIST_URL);
      const list = asArray(res.data).map((e) => ({
        id: String(e.id),
        label:
          [e?.last_name || "", e?.first_name || ""]
            .filter(Boolean)
            .join(" ")
            .trim() || e?.email || "—",
      }));
      setEmployees(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    dispatch(getConsultingRows());
    dispatch(getConsultingServices());
    dispatch(getConsultingRequests());
    dispatch(fetchClientsAsync());
    fetchEmployees();
  }, [dispatch, fetchEmployees]);

  const serviceOpts = useMemo(
    () =>
      (services || []).map((s) => ({
        id: String(s.id),
        label: String(s.name ?? s.title ?? "—"),
      })),
    [services],
  );

  const today = new Date();
  const todayIso = ymd(today);
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(
    ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
  );
  const [to, setTo] = useState(todayIso);
  const [empSel, setEmpSel] = useState([]);
  const [srvSel, setSrvSel] = useState([]);
  const [err, setErr] = useState("");
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftErr, setDraftErr] = useState("");
  const [expandedSvc, setExpandedSvc] = useState(() => new Set());

  const toggleSvc = (name) =>
    setExpandedSvc((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const applyPreset = (p) => {
    setShowPeriodModal(false);
    setPreset(p);
    const n = Number(p);
    if (Number.isFinite(n)) {
      const start = new Date(today);
      start.setDate(today.getDate() - (n - 1));
      setFrom(ymd(start));
      setTo(todayIso);
    }
  };

  const openPeriodModal = () => {
    setDraftFrom(from);
    setDraftTo(to);
    setDraftErr("");
    setShowPeriodModal(true);
  };

  const applyCustomPeriod = () => {
    if (new Date(draftFrom) > new Date(draftTo)) {
      setDraftErr("Начальная дата позже конечной.");
      return;
    }
    setFrom(draftFrom);
    setTo(draftTo);
    setPreset("custom");
    setErr("");
    setShowPeriodModal(false);
  };

  const onPickEmp = (id) =>
    setEmpSel((prev) => uniq([...prev, String(id)]));
  const onPickSrv = (id) =>
    setSrvSel((prev) => uniq([...prev, String(id)]));
  const removeEmp = (id) =>
    setEmpSel((prev) => prev.filter((x) => x !== String(id)));
  const removeSrv = (id) =>
    setSrvSel((prev) => prev.filter((x) => x !== String(id)));

  useEffect(() => {
    if (new Date(from) > new Date(to)) {
      setErr("Начальная дата позже конечной.");
    } else {
      setErr("");
    }
  }, [from, to]);

  const empNameById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), e.label));
    return m;
  }, [employees]);

  const srvNameById = useMemo(() => {
    const m = new Map();
    serviceOpts.forEach((s) => m.set(String(s.id), s.label));
    return m;
  }, [serviceOpts]);

  const inRange = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= new Date(from) && d <= new Date(to);
  };

  const sales = useMemo(() => {
    let base = (rows || []).filter((r) => inRange(r.created_at || r.date));
    if (empSel.length) {
      const empNames = empSel
        .map((id) => empNameById.get(String(id)))
        .filter(Boolean);
      base = base.filter((r) =>
        r.user_display ? empNames.includes(String(r.user_display)) : true,
      );
    }
    if (srvSel.length) {
      const srvNames = srvSel
        .map((id) => srvNameById.get(String(id)))
        .filter(Boolean);
      base = base.filter((r) =>
        r.service_display ? srvNames.includes(String(r.service_display)) : true,
      );
    }
    return base;
  }, [rows, from, to, empSel, srvSel, empNameById, srvNameById]);

  const reqs = useMemo(
    () => (requests || []).filter((r) => inRange(r.created_at)),
    [requests, from, to],
  );

  const revenue = useMemo(
    () => sales.reduce((sum, r) => sum + (Number(r.service_price) || 0), 0),
    [sales],
  );
  const salesCount = sales.length;
  const reqCount = reqs.length;
  const avgCheck = salesCount ? revenue / salesCount : 0;

  const byService = useMemo(() => {
    const m = new Map();
    sales.forEach((r) => {
      const key = String(r.service_display || "—");
      const sum = Number(r.service_price) || 0;
      const prev = m.get(key) || { count: 0, sum: 0 };
      m.set(key, { count: prev.count + 1, sum: prev.sum + sum });
    });
    return Array.from(m, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 8);
  }, [sales]);

  const byEmployee = useMemo(() => {
    const m = new Map();
    sales.forEach((r) => {
      const key = String(r.user_display || "—");
      const sum = Number(r.service_price) || 0;
      const prev = m.get(key) || { count: 0, sum: 0 };
      m.set(key, { count: prev.count + 1, sum: prev.sum + sum });
    });
    return Array.from(m, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 8);
  }, [sales]);

  // Услуга по названию — для сопоставления абонентки/тарифов с продажами.
  const serviceByName = useMemo(() => {
    const m = new Map();
    (services || []).forEach((s) =>
      m.set(String(s.name ?? s.title ?? "").trim(), s),
    );
    return m;
  }, [services]);

  // Детализация по каждой услуге отдельно: продажи, выручка, средний чек,
  // уникальные клиенты, доля выручки и разбивка по тарифам.
  const byServiceDetailed = useMemo(() => {
    const m = new Map();
    sales.forEach((r) => {
      const name = String(r.service_display || "—");
      const amount = Number(r.total ?? r.service_price) || 0;
      if (!m.has(name)) {
        m.set(name, {
          name,
          count: 0,
          sum: 0,
          clients: new Set(),
          tariffs: new Map(),
        });
      }
      const g = m.get(name);
      g.count += 1;
      g.sum += amount;
      const clientKey = String(r.client || r.client_display || "");
      if (clientKey) g.clients.add(clientKey);
      const tName = String(r.tariff_display || "Без тарифа");
      const t = g.tariffs.get(tName) || { name: tName, count: 0, sum: 0 };
      t.count += 1;
      t.sum += amount;
      g.tariffs.set(tName, t);
    });
    const total = revenue || 1;
    return Array.from(m.values())
      .map((g) => ({
        name: g.name,
        count: g.count,
        sum: g.sum,
        avg: g.count ? g.sum / g.count : 0,
        clients: g.clients.size,
        share: Math.round((g.sum * 100) / total),
        tariffs: Array.from(g.tariffs.values()).sort((a, b) => b.sum - a.sum),
      }))
      .sort((a, b) => b.sum - a.sum);
  }, [sales, revenue]);

  // Оценка абонентской выручки в месяц (MRR): сопоставляем проданный тариф с
  // его абонплатой из справочника услуг; годовые приводим к месяцу.
  const subscriptionMrr = useMemo(() => {
    let mrr = 0;
    sales.forEach((r) => {
      const s = serviceByName.get(String(r.service_display || "").trim());
      if (!s) return;
      const t = (s.tariffs || []).find((x) => x.name === r.tariff_display);
      const amt = Number(t?.subscription_amount) || 0;
      if (!amt) return;
      mrr += t.subscription_period === "year" ? amt / 12 : amt;
    });
    return mrr;
  }, [sales, serviceByName]);

  // Клиентская аналитика: уникальные и повторные клиенты за период.
  const clientStats = useMemo(() => {
    const counts = new Map();
    sales.forEach((r) => {
      const key = String(r.client || r.client_display || "");
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const unique = counts.size;
    const repeat = [...counts.values()].filter((c) => c > 1).length;
    return {
      unique,
      repeat,
      repeatPct: unique ? Math.round((repeat * 100) / unique) : 0,
    };
  }, [sales]);

  const statusCounts = useMemo(() => {
    const m = { new: 0, in_work: 0, done: 0, canceled: 0, other: 0 };
    reqs.forEach((r) => {
      const k = String(r.status || "").toLowerCase();
      if (k in m) m[k] += 1;
      else m.other += 1;
    });
    return m;
  }, [reqs]);

  const statusPieData = useMemo(
    () =>
      [
        { name: "Новые", value: statusCounts.new, color: "#3b82f6" },
        { name: "В работе", value: statusCounts.in_work, color: "#f7d617" },
        { name: "Завершены", value: statusCounts.done, color: "#10b981" },
        { name: "Отменены", value: statusCounts.canceled, color: "#ef4444" },
        { name: "Прочие", value: statusCounts.other, color: "#9ca3af" },
      ].filter((item) => item.value > 0),
    [statusCounts],
  );

  const dailyChartData = useMemo(() => {
    const start = new Date(from);
    const end = new Date(to);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(ymd(d));
    }
    return days.map((iso) => {
      const daySales = sales.filter(
        (r) => ymd(new Date(r.created_at || r.date)) === iso,
      );
      const dayReqs = reqs.filter(
        (r) => ymd(new Date(r.created_at)) === iso,
      );
      return {
        date: iso,
        label: formatChartDate(iso),
        revenue: daySales.reduce(
          (sum, r) => sum + (Number(r.service_price) || 0),
          0,
        ),
        sales: daySales.length,
        requests: dayReqs.length,
      };
    });
  }, [sales, reqs, from, to]);

  const serviceBarData = useMemo(
    () =>
      byService.map((item) => ({
        name:
          item.name.length > 22
            ? `${item.name.slice(0, 22)}…`
            : item.name,
        fullName: item.name,
        sum: item.sum,
        count: item.count,
      })),
    [byService],
  );

  const employeeBarData = useMemo(
    () =>
      byEmployee.map((item) => ({
        name:
          item.name.length > 22
            ? `${item.name.slice(0, 22)}…`
            : item.name,
        fullName: item.name,
        sum: item.sum,
        count: item.count,
      })),
    [byEmployee],
  );

  const resetFilters = () => {
    setShowPeriodModal(false);
    applyPreset("30");
    setEmpSel([]);
    setSrvSel([]);
  };

  return (
    <section className={BEM}>
      <header className={`${BEM}__header`}>
        <div>
          <h2 className={`${BEM}__title`}>Аналитика</h2>
          <p className={`${BEM}__subtitle`}>
            Срез по продажам, заявкам и сотрудникам
            {loadingConsulting ? " · загрузка…" : ""}
          </p>
        </div>

        <div className={`${BEM}__toolbar`}>
          <div className={`${BEM}__seg`} role="tablist" aria-label="Период">
            {[
              { value: "7", label: "7 дней" },
              { value: "30", label: "30 дней" },
              { value: "90", label: "90 дней" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={preset === item.value}
                className={`${BEM}__segBtn ${
                  preset === item.value ? "is-active" : ""
                }`}
                onClick={() => applyPreset(item.value)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={preset === "custom"}
              className={`${BEM}__segBtn ${BEM}__segBtn--custom ${
                preset === "custom" ? "is-active" : ""
              }`}
              onClick={openPeriodModal}
            >
              <span className={`${BEM}__segBtnTitle`}>Свой период</span>
              {preset === "custom" && (
                <span className={`${BEM}__segBtnRange`}>
                  {formatDateRu(from)} — {formatDateRu(to)}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className={`${BEM}__btnGhost`}
            onClick={resetFilters}
          >
            Сброс
          </button>
        </div>
      </header>

      {!!err && <div className={`${BEM}__alert`}>{err}</div>}

      <div className={`${BEM}__filters`}>
        <FilterField
          label="Сотрудники"
          emptyHint="Все сотрудники"
          items={employees}
          selectedIds={empSel}
          onRemove={removeEmp}
          comboProps={{
            title: "Сотрудники",
            items: employees,
            onPick: onPickEmp,
            placeholder: "Найти сотрудника…",
          }}
        />
        <FilterField
          label="Услуги"
          emptyHint="Все услуги"
          items={serviceOpts}
          selectedIds={srvSel}
          onRemove={removeSrv}
          comboProps={{
            title: "Услуги",
            items: serviceOpts,
            onPick: onPickSrv,
            placeholder: "Найти услугу…",
          }}
        />
      </div>

      <div className={`${BEM}__kpis`}>
        <KpiCard
          label="Выручка"
          value={money(revenue)}
          description="За выбранный период"
          icon={Banknote}
        />
        <KpiCard
          label="Продаж"
          value={salesCount}
          description={`Средний чек: ${money(avgCheck)}`}
          icon={ShoppingBag}
        />
        <KpiCard
          label="Заявок"
          value={reqCount}
          description={`Конверсия: ${pct(salesCount, reqCount)}`}
          icon={FileText}
        />
        <KpiCard
          label="Средний чек"
          value={money(avgCheck)}
          description={`${salesCount} продаж за период`}
          icon={TrendingUp}
        />
      </div>

      {/* CRM-детализация: клиентская база и абонентская выручка */}
      <div className={`${BEM}__kpis`}>
        <KpiCard
          label="Уникальных клиентов"
          value={clientStats.unique}
          description={`Повторных: ${clientStats.repeat} (${clientStats.repeatPct}%)`}
          icon={FileText}
        />
        <KpiCard
          label="Абонентка (MRR)"
          value={money(subscriptionMrr)}
          description="Оценка регулярной выручки в месяц"
          icon={Banknote}
        />
        <KpiCard
          label="Конверсия заявок"
          value={pct(salesCount, reqCount)}
          description={`${salesCount} продаж из ${reqCount} заявок`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Услуг продано"
          value={byServiceDetailed.length}
          description="Разных услуг за период"
          icon={ShoppingBag}
        />
      </div>

      <div className={`${BEM}__chartsRow`}>
        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>Динамика выручки</div>
          <div className={`${BEM}__chartWrap`}>
            {dailyChartData.some((d) => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="consultingRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f7d617" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f7d617" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} width={72} />
                  <Tooltip
                    formatter={(value) => [money(value), "Выручка"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date
                        ? `Дата: ${formatChartDate(payload[0].payload.date)}`
                        : ""
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ca8a04"
                    strokeWidth={2}
                    fill="url(#consultingRevenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${BEM}__chartWrap--empty`}>Нет данных за период</div>
            )}
          </div>
        </div>

        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>Динамика продаж и заявок</div>
          <div className={`${BEM}__chartWrap`}>
            {dailyChartData.some((d) => d.sales > 0 || d.requests > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date
                        ? `Дата: ${formatChartDate(payload[0].payload.date)}`
                        : ""
                    }
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name="Продажи" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="requests" name="Заявки" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${BEM}__chartWrap--empty`}>Нет данных за период</div>
            )}
          </div>
        </div>
      </div>

      <div className={`${BEM}__chartsRow`}>
        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>Статусы заявок</div>
          <div className={`${BEM}__chartWrap`}>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} шт.`, name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${BEM}__chartWrap--empty`}>Нет заявок за период</div>
            )}
          </div>
        </div>

        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>ТОП услуг по выручке</div>
          <div className={`${BEM}__chartWrap`}>
            {serviceBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={serviceBarData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => money(v)} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => [money(value), "Выручка"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  />
                  <Bar dataKey="sum" name="Выручка" fill="#f7d617" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${BEM}__chartWrap--empty`}>Нет данных</div>
            )}
          </div>
        </div>
      </div>

      <div className={`${BEM}__chartsRow`}>
        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>ТОП сотрудников по выручке</div>
          <RankList items={byEmployee} />
        </div>

        <div className={`${BEM}__card`}>
          <div className={`${BEM}__cardTitle`}>ТОП услуг (список)</div>
          <RankList items={byService} />
        </div>
      </div>

      {/* Детализация по каждой услуге отдельно (с разбивкой по тарифам) */}
      <div className={`${BEM}__card ${BEM}__card--full`}>
        <div className={`${BEM}__cardTitle`}>Детализация по услугам</div>
        {byServiceDetailed.length ? (
          <div className={`${BEM}__detailTableWrap`}>
            <table className={`${BEM}__detailTable`}>
              <thead>
                <tr>
                  <th>Услуга</th>
                  <th>Продаж</th>
                  <th>Клиентов</th>
                  <th>Выручка</th>
                  <th>Ср. чек</th>
                  <th>Доля</th>
                </tr>
              </thead>
              <tbody>
                {byServiceDetailed.map((s) => {
                  const open = expandedSvc.has(s.name);
                  const hasTariffs =
                    s.tariffs.length > 1 ||
                    (s.tariffs[0] && s.tariffs[0].name !== "Без тарифа");
                  return (
                    <React.Fragment key={s.name}>
                      <tr
                        className={`${BEM}__detailRow${
                          hasTariffs ? " is-clickable" : ""
                        }`}
                        onClick={() => hasTariffs && toggleSvc(s.name)}
                      >
                        <td>
                          {hasTariffs && (
                            <span className={`${BEM}__detailCaret`}>
                              {open ? "▾" : "▸"}
                            </span>
                          )}
                          {s.name}
                        </td>
                        <td>{s.count}</td>
                        <td>{s.clients}</td>
                        <td>
                          <b>{money(s.sum)}</b>
                        </td>
                        <td>{money(s.avg)}</td>
                        <td>
                          <div className={`${BEM}__shareCell`}>
                            <span
                              className={`${BEM}__shareBar`}
                              style={{ width: `${Math.min(100, s.share)}%` }}
                            />
                            <span className={`${BEM}__shareVal`}>{s.share}%</span>
                          </div>
                        </td>
                      </tr>
                      {open &&
                        s.tariffs.map((t) => (
                          <tr
                            key={`${s.name}-${t.name}`}
                            className={`${BEM}__detailSubRow`}
                          >
                            <td className={`${BEM}__detailSubName`}>↳ {t.name}</td>
                            <td>{t.count}</td>
                            <td>—</td>
                            <td>{money(t.sum)}</td>
                            <td>{money(t.count ? t.sum / t.count : 0)}</td>
                            <td>—</td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Итого</td>
                  <td>{salesCount}</td>
                  <td>{clientStats.unique}</td>
                  <td>
                    <b>{money(revenue)}</b>
                  </td>
                  <td>{money(avgCheck)}</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className={`${BEM}__empty`}>Нет продаж за период</div>
        )}
      </div>

      <Modal
        open={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        title="Свой период"
        className="consulting-analytics-periodModal"
        contentClassName="consulting-analytics-periodModal__content"
        wrapperId="consulting-analytics-period-modal"
      >
        <p className="consulting-analytics-periodModal__hint">
          Выберите начальную и конечную дату отчёта.
        </p>
        <div className="consulting-analytics__range consulting-analytics-periodModal__range">
          <label>
            С
            <input
              type="date"
              className={`consulting-analytics__input ${
                draftErr ? "is-invalid" : ""
              }`}
              value={draftFrom}
              max={draftTo || todayIso}
              onChange={(e) => {
                setDraftFrom(e.target.value);
                setDraftErr("");
              }}
            />
          </label>
          <label>
            По
            <input
              type="date"
              className={`consulting-analytics__input ${
                draftErr ? "is-invalid" : ""
              }`}
              value={draftTo}
              min={draftFrom}
              max={todayIso}
              onChange={(e) => {
                setDraftTo(e.target.value);
                setDraftErr("");
              }}
            />
          </label>
        </div>
        {draftErr && (
          <p className="consulting-analytics__alert">{draftErr}</p>
        )}
        <div className="consulting-analytics-periodModal__actions">
          <button
            type="button"
            className="consulting-analytics__btnGhost"
            onClick={() => setShowPeriodModal(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="consulting-analytics-periodModal__apply"
            onClick={applyCustomPeriod}
          >
            Применить
          </button>
        </div>
      </Modal>
    </section>
  );
};

export default ConsultingAnalytics;
