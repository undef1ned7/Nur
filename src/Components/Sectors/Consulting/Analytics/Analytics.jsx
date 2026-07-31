import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Banknote,
  Clock,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Radio,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getAnalyticsDashboard,
  getAnalyticsManagers,
  getAnalyticsMessenger,
  getAnalyticsSources,
} from "../../../../api/consultingAnalytics";
import { consultingFunnelLeadPath } from "../../../../utils/consultingLeadSources";
import Modal from "../../../common/Modal/Modal";
import ConsultingShell from "../common/ConsultingShell";
import "./Analytics.scss";

const BEM = "consulting-analytics";

const TABS = [
  {
    value: "overview",
    label: "Обзор",
    hint: "Главные показатели",
    icon: LayoutDashboard,
  },
  {
    value: "messenger",
    label: "Мессенджер",
    hint: "Ответы и ожидание",
    icon: MessageSquare,
  },
  {
    value: "sources",
    label: "Источники",
    hint: "Откуда приходят заявки",
    icon: Radio,
  },
  {
    value: "managers",
    label: "Менеджеры",
    hint: "Нагрузка команды",
    icon: Users,
  },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDateRu = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
};

const formatChartDate = (iso) => {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length >= 3) return `${parts[2]}.${parts[1]}`;
  return String(iso);
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Деньги; null → «—». */
const money = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("ru-RU")} с` : "—";
};

/** Число; null → «—». */
const num = (v, digits = 0) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
};

/**
 * Доля 0..1 → проценты. Уже-проценты (share/percent) передавайте через
 * `alreadyPercent: true`.
 */
const pct = (v, { alreadyPercent = false, digits = 1 } = {}) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const value = alreadyPercent ? n : n * 100;
  return `${value.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? 0 : 0,
  })}%`;
};

const minutesLabel = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n < 1) return `${Math.round(n * 60)} сек`;
  if (n < 60)
    return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} мин`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h} ч ${m} мин`;
};

/** KPI-объект {current, previous, diff, percent} или скаляр. */
const kpiValue = (kpi) => {
  if (kpi == null) return null;
  if (typeof kpi === "object" && !Array.isArray(kpi)) {
    return kpi.current ?? null;
  }
  return kpi;
};

const kpiMeta = (kpi) => {
  if (kpi == null || typeof kpi !== "object" || Array.isArray(kpi)) {
    return { percent: null, diff: null, previous: null };
  }
  return {
    percent: kpi.percent ?? null,
    diff: kpi.diff ?? null,
    previous: kpi.previous ?? null,
  };
};

const normalizeWaiting = (raw) => {
  if (raw == null) return { count: 0, items: [] };
  if (typeof raw === "number") return { count: raw, items: [] };
  if (typeof raw === "object") {
    return {
      count:
        Number(raw.count) ||
        (Array.isArray(raw.items) ? raw.items.length : 0),
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  }
  return { count: 0, items: [] };
};

const errText = (e, fallback) => {
  if (!e) return fallback;
  if (typeof e.detail === "string") return e.detail;
  if (typeof e === "string") return e;
  return fallback;
};

const isNotReady = (e) => e?.status === 404 || e?.status === 501;

/* ===================== UI atoms ===================== */

const Delta = ({ percent, invert = false }) => {
  if (percent == null || percent === "") return null;
  const n = Number(percent);
  if (!Number.isFinite(n) || n === 0) {
    return <span className={`${BEM}__delta is-flat`}>без изм.</span>;
  }
  const up = n > 0;
  const good = invert ? !up : up;
  return (
    <span className={`${BEM}__delta ${good ? "is-up" : "is-down"}`}>
      {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
      {up ? "+" : ""}
      {n.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%
    </span>
  );
};

const KpiCard = ({
  label,
  value,
  description,
  icon: Icon,
  percent,
  invertDelta = false,
  tone = "default",
}) => (
  <div className={`${BEM}__kpi ${BEM}__kpi--${tone}`}>
    {Icon && (
      <div className={`${BEM}__kpiIcon`} aria-hidden>
        <Icon size={18} strokeWidth={2.2} />
      </div>
    )}
    <div className={`${BEM}__kpiBody`}>
      <div className={`${BEM}__kpiTop`}>
        <div className={`${BEM}__kpiLabel`}>{label}</div>
        <Delta percent={percent} invert={invertDelta} />
      </div>
      <div className={`${BEM}__kpiValue`}>{value}</div>
      {description ? (
        <div className={`${BEM}__kpiDesc`}>{description}</div>
      ) : null}
    </div>
  </div>
);

const Empty = ({ title = "Нет данных", children }) => (
  <div className={`${BEM}__emptyState`}>
    <strong>{title}</strong>
    {children ? <p>{children}</p> : <p>За выбранный период пока ничего нет</p>}
  </div>
);

const SectionCard = ({ title, subtitle, action, children, full = false }) => (
  <div className={`${BEM}__card${full ? ` ${BEM}__card--full` : ""}`}>
    <div className={`${BEM}__cardHead`}>
      <div className={`${BEM}__cardHeading`}>
        <div className={`${BEM}__cardTitle`}>{title}</div>
        {subtitle ? (
          <div className={`${BEM}__cardSubtitle`}>{subtitle}</div>
        ) : null}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const SectionLabel = ({ children }) => (
  <div className={`${BEM}__sectionLabel`}>{children}</div>
);

const LoadingBlock = () => (
  <div className={`${BEM}__loading`} aria-live="polite">
    <span className={`${BEM}__spinner`} />
    Загружаем данные…
  </div>
);

/* ===================== Page ===================== */

export default function ConsultingAnalytics() {
  const today = useMemo(() => new Date(), []);
  const todayIso = ymd(today);

  const [tab, setTab] = useState("overview");
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(
    ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
  );
  const [to, setTo] = useState(todayIso);
  const [debounced, setDebounced] = useState({ from, to });

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftErr, setDraftErr] = useState("");
  const [rangeErr, setRangeErr] = useState("");

  const [loading, setLoading] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [messenger, setMessenger] = useState(null);
  const [sources, setSources] = useState(null);
  const [managers, setManagers] = useState(null);

  // Debounce периода — не дёргать тяжёлый dashboard на каждый ввод.
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ from, to }), 400);
    return () => clearTimeout(t);
  }, [from, to]);

  useEffect(() => {
    if (new Date(from) > new Date(to)) {
      setRangeErr("Начальная дата позже конечной.");
    } else {
      setRangeErr("");
    }
  }, [from, to]);

  const periodParams = useMemo(
    () => ({
      date_from: debounced.from,
      date_to: debounced.to,
    }),
    [debounced],
  );

  const load = useCallback(async () => {
    if (new Date(periodParams.date_from) > new Date(periodParams.date_to)) {
      return;
    }
    setLoading(true);
    setError("");
    setNotReady(false);
    try {
      if (tab === "overview") {
        const data = await getAnalyticsDashboard(periodParams);
        setDashboard(data);
      } else if (tab === "messenger") {
        const data = await getAnalyticsMessenger(periodParams);
        setMessenger(data);
      } else if (tab === "sources") {
        const data = await getAnalyticsSources(periodParams);
        setSources(data);
      } else if (tab === "managers") {
        const data = await getAnalyticsManagers(periodParams);
        setManagers(data);
      }
    } catch (e) {
      if (isNotReady(e)) {
        setNotReady(true);
        if (tab === "overview") setDashboard(null);
        if (tab === "messenger") setMessenger(null);
        if (tab === "sources") setSources(null);
        if (tab === "managers") setManagers(null);
      } else {
        setError(errText(e, "Не удалось загрузить аналитику."));
      }
    } finally {
      setLoading(false);
    }
  }, [tab, periodParams]);

  useEffect(() => {
    load();
  }, [load]);

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
    setShowPeriodModal(false);
  };

  const resetFilters = () => applyPreset("30");

  const kpis = dashboard?.kpis || {};
  const leads = dashboard?.leads || {};
  const dashMessenger = dashboard?.messenger || {};
  const dashSources = dashboard?.sources || {};
  const dashSales = dashboard?.sales || {};
  const dashManagers = Array.isArray(dashboard?.managers)
    ? dashboard.managers
    : [];

  const waitingOverview = normalizeWaiting(dashMessenger.waiting_now);
  const waitingMessenger = normalizeWaiting(messenger?.waiting_now);

  const salesByDay = useMemo(() => {
    const rows = Array.isArray(dashSales.by_day) ? dashSales.by_day : [];
    return rows.map((r) => ({
      date: r.date,
      label: formatChartDate(r.date),
      revenue: Number(r.revenue ?? r.sum ?? r.total) || 0,
      sales: Number(r.sales ?? r.count) || 0,
    }));
  }, [dashSales]);

  const msgByDay = useMemo(() => {
    const rows = Array.isArray(messenger?.by_day) ? messenger.by_day : [];
    return rows.map((r) => ({
      date: r.date,
      label: formatChartDate(r.date),
      inbound: Number(r.inbound) || 0,
      outbound: Number(r.outbound) || 0,
      total: Number(r.total) || 0,
    }));
  }, [messenger]);

  const msgByHour = useMemo(() => {
    const rows = Array.isArray(messenger?.by_hour) ? messenger.by_hour : [];
    return rows.map((r) => ({
      hour: `${String(r.hour).padStart(2, "0")}:00`,
      inbound: Number(r.inbound) || 0,
      outbound: Number(r.outbound) || 0,
    }));
  }, [messenger]);

  const sourceStatusPie = useMemo(() => {
    const by = sources?.by_status || dashSources.by_status || {};
    const map = [
      { key: "new", name: "Новые", color: "#3b82f6" },
      { key: "assigned", name: "Назначены", color: "#f59e0b" },
      { key: "in_work", name: "В работе", color: "#f7d617" },
      { key: "converted", name: "Клиенты", color: "#10b981" },
      { key: "rejected", name: "Отклонены", color: "#ef4444" },
    ];
    return map
      .map((m) => ({ ...m, value: Number(by[m.key]) || 0 }))
      .filter((x) => x.value > 0);
  }, [sources, dashSources]);

  const sourcesBySource = useMemo(() => {
    const rows = Array.isArray(sources?.by_source)
      ? sources.by_source
      : Array.isArray(dashSources.by_source)
        ? dashSources.by_source
        : [];
    return rows;
  }, [sources, dashSources]);

  const sourcesByDay = useMemo(() => {
    const rows = Array.isArray(sources?.by_day) ? sources.by_day : [];
    return rows.map((r) => ({
      date: r.date,
      label: formatChartDate(r.date),
      count: Number(r.count) || 0,
    }));
  }, [sources]);

  const managersList = useMemo(() => {
    const rows = Array.isArray(managers?.managers)
      ? managers.managers
      : dashManagers;
    return rows.map((m) => ({
      ...m,
      name: m.user_id == null ? "Не распределено" : m.name || "—",
    }));
  }, [managers, dashManagers]);

  const operators = useMemo(() => {
    const rows = Array.isArray(messenger?.by_operator)
      ? messenger.by_operator
      : [];
    return rows.map((o) => ({
      ...o,
      name: o.user_id == null ? "Без ответственного" : o.name || "—",
    }));
  }, [messenger]);

  const hasTabData =
    (tab === "overview" && dashboard) ||
    (tab === "messenger" && messenger) ||
    (tab === "sources" && sources) ||
    (tab === "managers" && (managers || dashboard));

  return (
    <ConsultingShell
      eyebrow="Консалтинг · Отчёты"
      title="Аналитика"
      subtitle="Продажи, лиды, мессенджер и источники — в одном отчёте"
      nav={TABS}
      navValue={tab}
      onNavChange={setTab}
      panelHint={`${formatDateRu(from)} — ${formatDateRu(to)}`}
      headerActions={
        <>
          <div className={`${BEM}__seg`} role="tablist" aria-label="Период">
            {[
              { value: "7", label: "7 дн." },
              { value: "30", label: "30 дн." },
              { value: "90", label: "90 дн." },
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
              className={`${BEM}__segBtn ${
                preset === "custom" ? "is-active" : ""
              }`}
              onClick={openPeriodModal}
            >
              Свой
            </button>
          </div>
          <button
            type="button"
            className="cShell__btn cShell__btn--sm"
            onClick={resetFilters}
          >
            Сброс
          </button>
        </>
      }
    >
      <div className={`${BEM} ${BEM}--embedded`}>
      {(rangeErr || error) && (
        <div className={`${BEM}__alert`}>{rangeErr || error}</div>
      )}

      {notReady && (
        <div className={`${BEM}__notice`}>
          <b>Аналитика на сервере ещё не подключена</b>
          <p>
            После деплоя здесь появятся продажи, мессенджер, источники и
            менеджеры. Сейчас можно выбрать период — данные подтянутся
            автоматически.
          </p>
        </div>
      )}

      {!notReady && loading && !hasTabData && <LoadingBlock />}

      {!notReady && tab === "overview" && dashboard && (
        <div className={`${BEM}__body${loading ? " is-loading" : ""}`}>
          <SectionLabel>Деньги и продажи</SectionLabel>
          <div className={`${BEM}__kpis`}>
            <KpiCard
              label="Выручка"
              value={money(kpiValue(kpis.revenue))}
              percent={kpiMeta(kpis.revenue).percent}
              description="Сумма продаж за период"
              icon={Banknote}
              tone="money"
            />
            <KpiCard
              label="Оплачено"
              value={money(kpiValue(kpis.paid_income))}
              percent={kpiMeta(kpis.paid_income).percent}
              description="Фактически полученные деньги"
              icon={Banknote}
              tone="success"
            />
            <KpiCard
              label="Продаж"
              value={num(kpiValue(kpis.sales_count))}
              percent={kpiMeta(kpis.sales_count).percent}
              description={`Средний чек: ${money(kpiValue(kpis.avg_check))}`}
              icon={ShoppingBag}
            />
            <KpiCard
              label="Абонентка (MRR)"
              value={money(kpiValue(kpis.subscription_mrr))}
              percent={kpiMeta(kpis.subscription_mrr).percent}
              description="Регулярная выручка в месяц"
              icon={TrendingUp}
              tone="money"
            />
          </div>

          <SectionLabel>Лиды и ответы</SectionLabel>
          <div className={`${BEM}__kpis`}>
            <KpiCard
              label="Лиды"
              value={num(kpiValue(kpis.leads) ?? leads.total)}
              percent={kpiMeta(kpis.leads).percent}
              description={`В работе: ${num(leads.in_work)} · Win rate: ${pct(leads.win_rate)}`}
              icon={Users}
            />
            <KpiCard
              label="Заявки"
              value={num(kpiValue(kpis.requests))}
              percent={kpiMeta(kpis.requests).percent}
              description="Входящие обращения"
              icon={FileText}
            />
            <KpiCard
              label="Ср. время ответа"
              value={minutesLabel(kpiValue(kpis.avg_response_minutes))}
              percent={kpiMeta(kpis.avg_response_minutes).percent}
              invertDelta
              description={`Сообщений: ${num(kpiValue(kpis.messages))}`}
              icon={Clock}
              tone="warning"
            />
            <KpiCard
              label="Ждут ответа"
              value={num(waitingOverview.count)}
              description="Диалоги без ответа дольше 15 мин"
              icon={MessageSquare}
              tone={waitingOverview.count > 0 ? "danger" : "success"}
            />
          </div>

          <div className={`${BEM}__chartsRow`}>
            <SectionCard
              title="Воронка лидов"
              subtitle="Как движутся сделки в периоде"
            >
              <div className={`${BEM}__funnelStats`}>
                <div className={`${BEM}__funnelItem`}>
                  <span>Всего</span>
                  <b>{num(leads.total)}</b>
                </div>
                <div className={`${BEM}__funnelItem ${BEM}__funnelItem--ok`}>
                  <span>Выиграно</span>
                  <b>{num(leads.won)}</b>
                </div>
                <div className={`${BEM}__funnelItem ${BEM}__funnelItem--bad`}>
                  <span>Проиграно</span>
                  <b>{num(leads.lost)}</b>
                </div>
                <div className={`${BEM}__funnelItem ${BEM}__funnelItem--work`}>
                  <span>В работе</span>
                  <b>{num(leads.in_work)}</b>
                </div>
                <div className={`${BEM}__funnelItem`}>
                  <span>В пайплайне</span>
                  <b>{money(leads.pipeline_value)}</b>
                </div>
                <div className={`${BEM}__funnelItem ${BEM}__funnelItem--risk`}>
                  <span>Под риском</span>
                  <b>{num(leads.at_risk)}</b>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Нужно ответить"
              subtitle="Клиенты ждут ответа прямо сейчас"
              action={
                waitingOverview.count > 0 ? (
                  <button
                    type="button"
                    className={`${BEM}__linkBtn`}
                    onClick={() => setTab("messenger")}
                  >
                    Смотреть список
                  </button>
                ) : null
              }
            >
              <div
                className={`${BEM}__waitingHero${
                  waitingOverview.count > 0 ? "" : " is-ok"
                }`}
              >
                <MessageSquare size={22} />
                <div>
                  <b>{waitingOverview.count}</b>
                  <span>
                    {waitingOverview.count > 0
                      ? "диалогов ждут ответа больше 15 минут"
                      : "все диалоги под контролем"}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className={`${BEM}__chartsRow`}>
            <SectionCard
              title="Динамика выручки"
              subtitle="По дням выбранного периода"
            >
              <div className={`${BEM}__chartWrap`}>
                {salesByDay.some((d) => d.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={salesByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="caRevenueFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#f7d617"
                            stopOpacity={0.45}
                          />
                          <stop
                            offset="100%"
                            stopColor="#f7d617"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => money(v)}
                        width={72}
                      />
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
                        fill="url(#caRevenueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty title="Нет выручки" />
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="ТОП менеджеров"
              subtitle="По числу лидов и пайплайну"
            >
              {managersList.length ? (
                <ul className={`${BEM}__rankList`}>
                  {managersList.slice(0, 8).map((m, i) => (
                    <li
                      key={m.user_id ?? `none-${i}`}
                      className={`${BEM}__rankRow`}
                    >
                      <span className={`${BEM}__rankIndex`}>{i + 1}</span>
                      <div className={`${BEM}__rankMain`}>
                        <div className={`${BEM}__rankTitle`} title={m.name}>
                          {m.name}
                        </div>
                        <div className={`${BEM}__rankSub`}>
                          Лидов: {num(m.leads)} · Win: {pct(m.win_rate)}
                        </div>
                      </div>
                      <div className={`${BEM}__rankMeta`}>
                        <b>{money(m.pipeline_value)}</b>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Нет менеджеров" />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Услуги по выручке"
            subtitle="Что продавали в этом периоде"
            full
          >
            {Array.isArray(dashSales.by_service) &&
            dashSales.by_service.length ? (
              <div className={`${BEM}__detailTableWrap`}>
                <table className={`${BEM}__detailTable`}>
                  <thead>
                    <tr>
                      <th>Услуга</th>
                      <th>Продаж</th>
                      <th>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashSales.by_service.map((s, i) => (
                      <tr key={s.service_id || s.name || i}>
                        <td>{s.service_name || s.name || "—"}</td>
                        <td>{num(s.count ?? s.sales)}</td>
                        <td>
                          <b>{money(s.revenue ?? s.sum)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Нет продаж" />
            )}
          </SectionCard>
        </div>
      )}

      {!notReady && tab === "messenger" && messenger && (
        <div className={`${BEM}__body${loading ? " is-loading" : ""}`}>
          <SectionLabel>Скорость и объём переписки</SectionLabel>
          <div className={`${BEM}__kpis`}>
            <KpiCard
              label="Сообщений"
              value={num(messenger.totals?.messages)}
              description={`Вх: ${num(messenger.totals?.inbound)} · Исх: ${num(messenger.totals?.outbound)}`}
              icon={MessageSquare}
            />
            <KpiCard
              label="Чатов"
              value={num(messenger.totals?.chats)}
              description={`Ошибки отправки: ${pct(messenger.totals?.failure_rate)}`}
              icon={Users}
            />
            <KpiCard
              label="Медиана ответа"
              value={minutesLabel(messenger.response?.median_minutes)}
              description={`Среднее: ${minutesLabel(messenger.response?.avg_minutes)}`}
              icon={Clock}
              tone="warning"
              invertDelta
            />
            <KpiCard
              label="Доля ответов"
              value={pct(messenger.response?.answer_rate)}
              description={`Без ответа: ${num(messenger.response?.never_answered_chats)}`}
              icon={TrendingUp}
              tone="success"
            />
          </div>

          <SectionCard
            title={`Ждут ответа · ${waitingMessenger.count}`}
            subtitle="Последнее сообщение от клиента, ждут дольше 15 минут"
            full
          >
            {waitingMessenger.items.length ? (
              <div className={`${BEM}__detailTableWrap`}>
                <table className={`${BEM}__detailTable`}>
                  <thead>
                    <tr>
                      <th>Клиент</th>
                      <th>Ответственный</th>
                      <th>Последнее сообщение</th>
                      <th>Ждёт</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {waitingMessenger.items.map((item) => (
                      <tr
                        key={
                          item.lead_id ||
                          `${item.phone}-${item.last_message_at}`
                        }
                      >
                        <td>
                          <div className={`${BEM}__personCell`}>
                            <b>{item.name || "Без имени"}</b>
                            <span>{item.phone || "—"}</span>
                          </div>
                        </td>
                        <td>{item.owner || "—"}</td>
                        <td>{formatDateTime(item.last_message_at)}</td>
                        <td>
                          <span className={`${BEM}__waitBadge`}>
                            {minutesLabel(item.waiting_minutes)}
                          </span>
                        </td>
                        <td>
                          {item.lead_id ? (
                            <Link
                              className={`${BEM}__linkBtn`}
                              to={consultingFunnelLeadPath(item.lead_id) || "#"}
                            >
                              Открыть
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Никто не ждёт">
                Сейчас все диалоги с ответом
              </Empty>
            )}
          </SectionCard>

          <div className={`${BEM}__chartsRow`}>
            <SectionCard
              title="Сообщения по дням"
              subtitle="Входящие и исходящие"
            >
              <div className={`${BEM}__chartWrap`}>
                {msgByDay.some((d) => d.total > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={msgByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        width={36}
                      />
                      <Tooltip />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Bar
                        dataKey="inbound"
                        name="Входящие"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="outbound"
                        name="Исходящие"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty title="Нет сообщений" />
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Когда пишут клиенты"
              subtitle="По часам суток — удобно планировать смены"
            >
              <div className={`${BEM}__chartWrap`}>
                {msgByHour.some((d) => d.inbound > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={msgByHour}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10 }}
                        interval={2}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        width={36}
                      />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="inbound"
                        name="Входящие"
                        stroke="#8b5cf6"
                        fill="#ddd6fe"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty title="Нет данных по часам" />
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="По операторам"
            subtitle="Атрибуция по ответственному за лида"
            full
          >
            {operators.length ? (
              <div className={`${BEM}__detailTableWrap`}>
                <table className={`${BEM}__detailTable`}>
                  <thead>
                    <tr>
                      <th>Оператор</th>
                      <th>Входящие</th>
                      <th>Исходящие</th>
                      <th>Ответил</th>
                      <th>Ср. ответ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operators.map((o, i) => (
                      <tr key={o.user_id ?? `op-${i}`}>
                        <td>{o.name}</td>
                        <td>{num(o.inbound)}</td>
                        <td>{num(o.outbound)}</td>
                        <td>{num(o.answered)}</td>
                        <td>{minutesLabel(o.avg_response_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Нет операторов" />
            )}
          </SectionCard>
        </div>
      )}

      {!notReady && tab === "sources" && sources && (
        <div className={`${BEM}__body${loading ? " is-loading" : ""}`}>
          <SectionLabel>Воронка источников</SectionLabel>
          <div className={`${BEM}__kpis`}>
            <KpiCard
              label="Заявок"
              value={num(sources.totals?.requests)}
              description={`Связано с лидами: ${num(sources.totals?.linked_leads)}`}
              icon={FileText}
            />
            <KpiCard
              label="→ в лид"
              value={pct(sources.totals?.conversion_to_lead)}
              description="Заявка стала карточкой лида"
              icon={Users}
              tone="success"
            />
            <KpiCard
              label="→ выиграно"
              value={pct(sources.totals?.conversion_to_won)}
              description={`Выиграно сделок: ${num(sources.totals?.won)}`}
              icon={TrendingUp}
              tone="money"
            />
            <KpiCard
              label="Источников"
              value={num(sourcesBySource.length)}
              description="Уникальных каналов за период"
              icon={MessageSquare}
            />
          </div>

          <div className={`${BEM}__chartsRow`}>
            <SectionCard
              title="Статусы заявок"
              subtitle="Распределение по статусам"
            >
              <div className={`${BEM}__chartWrap`}>
                {sourceStatusPie.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceStatusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={2}
                      >
                        {sourceStatusPie.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} шт.`, name]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty title="Нет заявок" />
                )}
              </div>
            </SectionCard>

            <SectionCard title="Заявки по дням" subtitle="Динамика потока">
              <div className={`${BEM}__chartWrap`}>
                {sourcesByDay.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sourcesByDay}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        width={36}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name="Заявки"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty title="Нет динамики" />
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Источники и конверсия"
            subtitle="Откуда приходят заявки и сколько доходят до сделки"
            full
          >
            {sourcesBySource.length ? (
              <div className={`${BEM}__detailTableWrap`}>
                <table className={`${BEM}__detailTable`}>
                  <thead>
                    <tr>
                      <th>Источник</th>
                      <th>Заявок</th>
                      <th>Лидов</th>
                      <th>Выиграно</th>
                      <th>→ лид</th>
                      <th>→ won</th>
                      <th>Доля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesBySource.map((s, i) => (
                      <tr key={s.source || i}>
                        <td>{s.source || "—"}</td>
                        <td>{num(s.count)}</td>
                        <td>{num(s.linked_leads)}</td>
                        <td>{num(s.won)}</td>
                        <td>{pct(s.conversion_to_lead)}</td>
                        <td>{pct(s.conversion_to_won)}</td>
                        <td>
                          <div className={`${BEM}__shareCell`}>
                            <span
                              className={`${BEM}__shareBar`}
                              style={{
                                width: `${Math.min(100, Number(s.share) || 0)}%`,
                              }}
                            />
                            <span className={`${BEM}__shareVal`}>
                              {pct(s.share, {
                                alreadyPercent: true,
                                digits: 1,
                              })}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Нет источников" />
            )}
          </SectionCard>
        </div>
      )}

      {!notReady && tab === "managers" && (managers || dashboard) && (
        <div className={`${BEM}__body${loading ? " is-loading" : ""}`}>
          <SectionCard
            title="Менеджеры"
            subtitle="Нагрузка, win rate и скорость ответа"
            full
          >
            {managersList.length ? (
              <div className={`${BEM}__detailTableWrap`}>
                <table className={`${BEM}__detailTable`}>
                  <thead>
                    <tr>
                      <th>Менеджер</th>
                      <th>Лиды</th>
                      <th>Выиграно</th>
                      <th>Проиграно</th>
                      <th>Win rate</th>
                      <th>Риск</th>
                      <th>Пайплайн</th>
                      <th>Исх. сообщ.</th>
                      <th>Ср. ответ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managersList.map((m, i) => (
                      <tr key={m.user_id ?? `mgr-${i}`}>
                        <td>
                          <b>{m.name}</b>
                        </td>
                        <td>{num(m.leads)}</td>
                        <td>{num(m.won)}</td>
                        <td>{num(m.lost)}</td>
                        <td>{pct(m.win_rate)}</td>
                        <td>{num(m.at_risk)}</td>
                        <td>{money(m.pipeline_value)}</td>
                        <td>{num(m.messages_out)}</td>
                        <td>{minutesLabel(m.avg_response_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Нет менеджеров" />
            )}
          </SectionCard>
        </div>
      )}

      {!notReady && !loading && tab === "overview" && !dashboard && !error && (
        <Empty title="Нет данных дашборда" />
      )}

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
      </div>
    </ConsultingShell>
  );
}
