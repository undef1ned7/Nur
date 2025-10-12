// src/components/Analytics/Analytics.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Analytics.scss";
import { FaChevronLeft, FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import {
  getConsultingRows,
  getConsultingServices,
  getConsultingRequests,
} from "../../../../store/creators/consultingThunk";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import api from "../../../../api";

/* ===================== API ===================== */
const EMPLOYEES_LIST_URL = "/users/employees/";

/* ===================== Helpers ===================== */
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

/* ===================== Generic Combo with typeahead & paging ===================== */
const PAGE = 8;

const Combo = ({
  title = "Выбор",
  items = [], // [{id, label}]
  selected = [], // array of ids (string)
  onPick, // (id) => void
  placeholder = "Поиск…",
  disabled = false,
  bem = "an", // BEM namespace
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
    <div className={`${bem}__combo`} ref={ref}>
      <div className={`${bem}__comboControl${disabled ? " is-disabled" : ""}`}>
        <FaSearch className={`${bem}__comboIcon`} />
        <input
          ref={inputRef}
          className={`${bem}__comboInput`}
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
          className={`${bem}__comboToggle`}
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
        <div className={`${bem}__comboDrop`} role="listbox">
          {rows.length === 0 ? (
            <div className={`${bem}__comboEmpty`}>Ничего не найдено</div>
          ) : (
            <>
              <ul className={`${bem}__comboList`}>
                {rows.map((it) => {
                  const isPicked = selected.includes(String(it.id));
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        className={`${bem}__comboItem${
                          isPicked ? " is-active" : ""
                        }`}
                        onClick={() => {
                          if (!isPicked) onPick?.(it.id);
                        }}
                        disabled={isPicked}
                        title={isPicked ? "Уже выбрано" : `Добавить «${it.label}»`}
                      >
                        {it.label}
                        {isPicked && <span className={`${bem}__tag`}>Добавлено</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {filtered.length > PAGE && (
                <div className={`${bem}__comboPager`}>
                  <button
                    type="button"
                    className={`${bem}__pageBtn`}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <FaChevronLeft /> Назад
                  </button>
                  <span className={`${bem}__page`}>
                    Стр. {safePage} из {total}
                  </span>
                  <button
                    type="button"
                    className={`${bem}__pageBtn`}
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

/* ===================== Sparkline (pure SVG) ===================== */
const Sparkline = ({ data = [] /* numbers */, bem = "an" }) => {
  const w = 180;
  const h = 48;
  const p = 4;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const span = Math.max(1, max - min);
  const step = data.length > 1 ? (w - p * 2) / (data.length - 1) : 0;

  const pts = data.map((v, i) => {
    const x = p + i * step;
    const y = h - p - ((v - min) / span) * (h - p * 2);
    return `${x},${y}`;
  });

  return (
    <svg className={`${bem}__spark`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

/* ===================== Main ===================== */
const ConsultingAnalytics = () => {
  const dispatch = useDispatch();

  // consulting slices
  const { rows = [], services = [] } = useConsulting();
  const requests = useSelector((s) => s.consulting?.requests || []);
  const loadingConsulting = useSelector((s) => s.consulting?.loading) || false;

  // employees for filters
  const [employees, setEmployees] = useState([]);
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(EMPLOYEES_LIST_URL);
      const list = asArray(res.data).map((e) => ({
        id: String(e.id),
        label: [e?.last_name || "", e?.first_name || ""]
          .filter(Boolean)
          .join(" ")
          .trim() || e?.email || "—",
      }));
      setEmployees(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // load data
  useEffect(() => {
    dispatch(getConsultingRows());
    dispatch(getConsultingServices());
    dispatch(getConsultingRequests());
    dispatch(fetchClientsAsync());
    fetchEmployees();
  }, [dispatch, fetchEmployees]);

  // services options
  const serviceOpts = useMemo(
    () =>
      (services || []).map((s) => ({
        id: String(s.id),
        label: String(s.name ?? s.title ?? "—"),
      })),
    [services]
  );

  /* ===== Filters ===== */
  const today = new Date();
  const [preset, setPreset] = useState("30"); // '7' | '30' | '90' | 'custom'
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [to, setTo] = useState(ymd(today));
  const [empSel, setEmpSel] = useState([]); // ids[]
  const [srvSel, setSrvSel] = useState([]); // ids[]
  const [err, setErr] = useState("");

  const applyPreset = (p) => {
    setPreset(p);
    const n = Number(p);
    if (Number.isFinite(n)) {
      const start = new Date(today);
      start.setDate(today.getDate() - (n - 1));
      setFrom(ymd(start));
      setTo(ymd(today));
    }
  };

  const onPickEmp = (id) =>
    setEmpSel((prev) => uniq([...prev, String(id)]));
  const onPickSrv = (id) =>
    setSrvSel((prev) => uniq([...prev, String(id)]));

  const removeEmp = (id) => setEmpSel((prev) => prev.filter((x) => x !== String(id)));
  const removeSrv = (id) => setSrvSel((prev) => prev.filter((x) => x !== String(id)));

  // validation for dates
  useEffect(() => {
    if (new Date(from) > new Date(to)) setErr("Начальная дата позже конечной.");
    else setErr("");
  }, [from, to]);

  /* ===== Filtering ===== */
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
    // inclusive
  };

  // sales filter
  const sales = useMemo(() => {
    let base = (rows || []).filter((r) => inRange(r.created_at || r.date));
    if (empSel.length) {
      const empNames = empSel.map((id) => empNameById.get(String(id))).filter(Boolean);
      base = base.filter((r) => (r.user_display ? empNames.includes(String(r.user_display)) : true));
    }
    if (srvSel.length) {
      const srvNames = srvSel.map((id) => srvNameById.get(String(id))).filter(Boolean);
      base = base.filter((r) => (r.service_display ? srvNames.includes(String(r.service_display)) : true));
    }
    return base;
  }, [rows, from, to, empSel, srvSel, empNameById, srvNameById]);

  // requests filter
  const reqs = useMemo(() => {
    let base = (requests || []).filter((r) => inRange(r.created_at));
    if (empSel.length) {
      // часто заявке не мапят менеджера — пропускаем фильтр по сотруднику, если нет поля
      base = base;
    }
    return base;
  }, [requests, from, to, empSel]);

  /* ===== Metrics ===== */
  const revenue = useMemo(
    () => sales.reduce((sum, r) => sum + (Number(r.service_price) || 0), 0),
    [sales]
  );
  const salesCount = sales.length;
  const reqCount = reqs.length;
  const avgCheck = salesCount ? revenue / salesCount : 0;

  const byService = useMemo(() => {
    const m = new Map(); // name => {count, sum}
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
    const m = new Map(); // name => {count, sum}
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

  // status donut
  const statusCounts = useMemo(() => {
    const m = { new: 0, in_work: 0, done: 0, canceled: 0, other: 0 };
    reqs.forEach((r) => {
      const k = String(r.status || "").toLowerCase();
      if (k in m) m[k] += 1;
      else m.other += 1;
    });
    const total = Object.values(m).reduce((a, b) => a + b, 0) || 1;
    // build conic-gradient stops
    const segs = [];
    let acc = 0;
    const add = (key, varName) => {
      const part = (m[key] * 100) / total;
      segs.push(`var(${varName}) ${acc}% ${acc + part}%`);
      acc += part;
    };
    add("new", "--blue");
    add("in_work", "--primary");
    add("done", "--green");
    add("canceled", "--danger");
    add("other", "--muted");
    return { m, seg: segs.join(", ") };
  }, [reqs]);

  // sparkline (daily sales)
  const sparkData = useMemo(() => {
    // build day buckets from 'from' to 'to'
    const start = new Date(from);
    const end = new Date(to);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(ymd(d));
    }
    const counts = days.map((iso) =>
      sales.reduce((n, r) => (ymd(new Date(r.created_at || r.date)) === iso ? n + 1 : n), 0)
    );
    return counts;
  }, [sales, from, to]);

  const resetFilters = () => {
    setPreset("30");
    applyPreset("30");
    setEmpSel([]);
    setSrvSel([]);
  };

  /* ===================== Render ===================== */
  return (
    <section className="an">
      <header className="an__header">
        <div>
          <h2 className="an__title">Аналитика</h2>
          <p className="an__subtitle">
            Срез по продажам, заявкам и сотрудникам
            {loadingConsulting ? " · загрузка…" : ""}
          </p>
        </div>

        <div className="an__preset">
          {["7", "30", "90"].map((p) => (
            <button
              key={p}
              className={`an__chip ${preset === p ? "is-active" : ""}`}
              onClick={() => applyPreset(p)}
              type="button"
              aria-pressed={preset === p}
            >
              {p} дней
            </button>
          ))}
          <button
            className={`an__chip ${preset === "custom" ? "is-active" : ""}`}
            onClick={() => setPreset("custom")}
            type="button"
            aria-pressed={preset === "custom"}
          >
            Свой период
          </button>
          <button className="an__btn an__btn--ghost" onClick={resetFilters} type="button">
            Сброс
          </button>
        </div>
      </header>

      <div className="an__filters">
        <div className="an__row">
          <div className="an__field">
            <label className="an__label">С даты</label>
            <input
              type="date"
              className={`an__input ${err ? "is-invalid" : ""}`}
              value={from}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
            />
          </div>
          <div className="an__field">
            <label className="an__label">По дату</label>
            <input
              type="date"
              className={`an__input ${err ? "is-invalid" : ""}`}
              value={to}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
            />
          </div>

          <div className="an__field an__field--grow">
            <label className="an__label">Сотрудники</label>
            <Combo
              title="Сотрудники"
              items={employees}
              selected={empSel}
              onPick={onPickEmp}
              placeholder="Найти сотрудника…"
              bem="an"
            />
            {!!empSel.length && (
              <div className="an__chips">
                {empSel.map((id) => (
                  <span key={id} className="an__chip an__chip--soft">
                    {employees.find((e) => String(e.id) === String(id))?.label || id}
                    <button
                      type="button"
                      className="an__chipClose"
                      aria-label="Убрать"
                      onClick={() => removeEmp(id)}
                    >
                      <FaTimes />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="an__field an__field--grow">
            <label className="an__label">Услуги</label>
            <Combo
              title="Услуги"
              items={serviceOpts}
              selected={srvSel}
              onPick={onPickSrv}
              placeholder="Найти услугу…"
              bem="an"
            />
            {!!srvSel.length && (
              <div className="an__chips">
                {srvSel.map((id) => (
                  <span key={id} className="an__chip an__chip--soft">
                    {serviceOpts.find((s) => String(s.id) === String(id))?.label || id}
                    <button
                      type="button"
                      className="an__chipClose"
                      aria-label="Убрать"
                      onClick={() => removeSrv(id)}
                    >
                      <FaTimes />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {!!err && <div className="an__alert">{err}</div>}
      </div>

      {/* KPIs */}
      <div className="an__kpi">
        <div className="an__card">
          <div className="an__cardTitle">Выручка</div>
          <div className="an__cardValue">{money(revenue)}</div>
          <Sparkline data={sparkData} bem="an" />
        </div>
        <div className="an__card">
          <div className="an__cardTitle">Продаж</div>
          <div className="an__cardValue">{salesCount}</div>
          <div className="an__muted">средний чек: {money(avgCheck)}</div>
        </div>
        <div className="an__card">
          <div className="an__cardTitle">Заявок</div>
          <div className="an__cardValue">{reqCount}</div>
          <div className="an__muted">конверсия: {pct(salesCount, reqCount)}</div>
        </div>
        <div className="an__card an__card--donut">
          <div className="an__cardTitle">Статусы заявок</div>
          <div
            className="an__donut"
            style={{ backgroundImage: `conic-gradient(${statusCounts.seg})` }}
            aria-label="Диаграмма статусов"
          />
          <ul className="an__legend">
            <li><i className="c--blue" /> Новые — {statusCounts.m.new}</li>
            <li><i className="c--primary" /> В работе — {statusCounts.m.in_work}</li>
            <li><i className="c--green" /> Завершены — {statusCounts.m.done}</li>
            <li><i className="c--danger" /> Отменены — {statusCounts.m.canceled}</li>
          </ul>
        </div>
      </div>

      {/* Scrollable detail */}
      <div className="an__body">
        <section className="an__section">
          <h3 className="an__sectionTitle">ТОП услуг (по выручке)</h3>
          <ul className="an__list">
            {byService.length ? (
              byService.map((s) => (
                <li key={s.name} className="an__row">
                  <div className="an__rowMain">
                    <div className="an__rowTitle" title={s.name}>{s.name}</div>
                    <div className="an__barWrap" aria-hidden>
                      <div
                        className="an__bar"
                        style={{
                          width: `${Math.min(100, (s.sum / (byService[0]?.sum || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="an__rowMeta">
                    <b>{money(s.sum)}</b>
                    <span className="an__muted"> · {s.count} шт.</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="an__empty">Нет данных</li>
            )}
          </ul>
        </section>

        <section className="an__section">
          <h3 className="an__sectionTitle">ТОП сотрудников (по выручке)</h3>
          <ul className="an__list">
            {byEmployee.length ? (
              byEmployee.map((e) => (
                <li key={e.name} className="an__row">
                  <div className="an__rowMain">
                    <div className="an__rowTitle" title={e.name}>{e.name}</div>
                    <div className="an__barWrap" aria-hidden>
                      <div
                        className="an__bar"
                        style={{
                          width: `${Math.min(100, (e.sum / (byEmployee[0]?.sum || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="an__rowMeta">
                    <b>{money(e.sum)}</b>
                    <span className="an__muted"> · {e.count} шт.</span>
                  </div>
                </li>
              ))
            ) : (
              <li className="an__empty">Нет данных</li>
            )}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default ConsultingAnalytics;
