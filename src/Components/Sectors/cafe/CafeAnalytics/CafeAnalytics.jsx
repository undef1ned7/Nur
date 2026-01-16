// src/.../CafeAnalytics.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaChartLine,
  FaSync,
  FaFilter,
  FaBoxOpen,
  FaShoppingCart,
  FaUsers,
} from "react-icons/fa";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import api from "../../../../api";
import "./CafeAnalytics.scss";
import { CafeAnalyticsModal, CafeAnalyticsModalContent } from "./CafeAnalyticsModals";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Legend
);

/* ===== helpers ===== */
const listFrom = (res) => res?.data?.results || res?.data || [];
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtInt = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0)
  );

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0)
  ) + " сом";

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDays = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const clampRangeDays = (fromStr, toStr, maxDays = 62) => {
  if (!fromStr || !toStr) return { ok: true, days: 0 };
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  const diff = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  return { ok: diff <= maxDays, days: diff };
};

const buildBuckets = (fromStr, toStr) => {
  if (!fromStr || !toStr) return [];
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);

  const { ok } = clampRangeDays(fromStr, toStr, 62);
  const step = ok ? 1 : 7;

  const buckets = [];
  let cur = new Date(from);

  while (cur.getTime() <= to.getTime()) {
    const start = new Date(cur);
    const end = addDays(cur, step - 1);
    const endClamped = end.getTime() > to.getTime() ? new Date(to) : end;

    buckets.push({
      key: step === 1 ? isoDate(start) : `${isoDate(start)}—${isoDate(endClamped)}`,
      date_from: isoDate(start),
      date_to: isoDate(endClamped),
    });

    cur = addDays(cur, step);
  }

  return buckets;
};

/* DRF fetch-all (для клиентов) */
async function fetchAllPages(url0) {
  let url = url0;
  const acc = [];
  let guard = 0;

  while (url && guard < 80) {
    // eslint-disable-next-line no-await-in-loop
    const { data } = await api.get(url);
    acc.push(...asArray(data));
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

/* ===== kitchen analytics normalizers ===== */
const pickName = (x) =>
  x?.name ||
  x?.full_name ||
  x?.fullName ||
  x?.username ||
  x?.user?.full_name ||
  x?.user?.username ||
  x?.user?.email ||
  x?.waiter?.full_name ||
  x?.cook?.full_name ||
  x?.title ||
  "—";

const pickId = (x, idx) =>
  x?.id || x?.user_id || x?.user?.id || x?.waiter_id || x?.cook_id || `${pickName(x)}_${idx}`;

const normalizeStaffRow = (x, idx) => {
  const revenue =
    toNum(x?.revenue) ||
    toNum(x?.sum) ||
    toNum(x?.total) ||
    toNum(x?.total_revenue) ||
    toNum(x?.total_amount);

  const orders =
    toNum(x?.orders_count) ||
    toNum(x?.orders) ||
    toNum(x?.count) ||
    toNum(x?.checks_count) ||
    toNum(x?.transactions);

  const items =
    toNum(x?.items_qty) ||
    toNum(x?.items) ||
    toNum(x?.qty) ||
    toNum(x?.positions) ||
    toNum(x?.positions_qty);

  const avgCheck =
    toNum(x?.avg_check) ||
    toNum(x?.avg) ||
    toNum(x?.average_check) ||
    (orders > 0 ? revenue / orders : 0);

  const prepared =
    toNum(x?.prepared_count) ||
    toNum(x?.done_count) ||
    toNum(x?.ready_count) ||
    toNum(x?.completed);

  const avgTime =
    toNum(x?.avg_time) ||
    toNum(x?.avg_cook_time) ||
    toNum(x?.avg_prepare_time) ||
    toNum(x?.avg_minutes);

  return {
    _id: pickId(x, idx),
    name: pickName(x),
    orders_count: orders,
    items_qty: items,
    revenue,
    avg_check: avgCheck,
    prepared_count: prepared,
    avg_time: avgTime,
    raw: x,
  };
};

const sumBy = (arr, key) => arr.reduce((acc, x) => acc + toNum(x?.[key]), 0);

/* ===== component ===== */
const CafeAnalytics = () => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // дефолт: последние 14 дней (включительно)
  const [dateFrom, setDateFrom] = useState(() => isoDate(addDays(new Date(), -13)));
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));

  // данные
  const [salesSummary, setSalesSummary] = useState({
    orders_count: 0,
    items_qty: 0,
    revenue: "0.00",
  });
  const [salesItems, setSalesItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  // гости
  const [guestsCount, setGuestsCount] = useState(0);

  // кухня аналитика
  const [cooksRows, setCooksRows] = useState([]);
  const [waitersRows, setWaitersRows] = useState([]);
  const [kitchenLoading, setKitchenLoading] = useState(false);

  // series для графика
  const [revenueSeries, setRevenueSeries] = useState([]);

  // modal
  const [modalKey, setModalKey] = useState(null); // revenue | avg | clients | stock | cooks | waiters
  const [staffQ, setStaffQ] = useState("");
  const [staffSort, setStaffSort] = useState("revenue_desc"); // revenue_desc | orders_desc | avg_desc | name_asc

  const params = useMemo(() => {
    const p = {};
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [dateFrom, dateTo]);

  const fetchGuestsCount = useCallback(async () => {
    try {
      const clients = await fetchAllPages("/cafe/clients/");
      setGuestsCount(Array.isArray(clients) ? clients.length : 0);
    } catch (e) {
      setGuestsCount(0);
    }
  }, []);

  const fetchKitchenAnalytics = useCallback(async () => {
    setKitchenLoading(true);
    try {
      const [rCooks, rWaiters] = await Promise.all([
        api.get("/cafe/kitchen/analytics/cooks/", { params }).catch(() => ({ data: [] })),
        api.get("/cafe/kitchen/analytics/waiters/", { params }).catch(() => ({ data: [] })),
      ]);

      const cooks = asArray(rCooks?.data).map(normalizeStaffRow);
      const waiters = asArray(rWaiters?.data).map(normalizeStaffRow);

      setCooksRows(Array.isArray(cooks) ? cooks : []);
      setWaitersRows(Array.isArray(waiters) ? waiters : []);
    } catch (e) {
      console.error("CafeAnalytics kitchen analytics error:", e);
      setCooksRows([]);
      setWaitersRows([]);
    } finally {
      setKitchenLoading(false);
    }
  }, [params]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rSalesSummary, rSalesItems, rLowStock] = await Promise.all([
        api.get("/cafe/analytics/sales/summary/", { params }).catch(() => ({ data: null })),
        api
          .get("/cafe/analytics/sales/items/", { params: { ...params, limit: 10 } })
          .catch(() => ({ data: [] })),
        api.get("/cafe/analytics/warehouse/low-stock/").catch(() => ({ data: [] })),
      ]);

      setSalesSummary(rSalesSummary?.data || { orders_count: 0, items_qty: 0, revenue: "0.00" });
      setSalesItems(Array.isArray(listFrom(rSalesItems)) ? listFrom(rSalesItems) : []);
      setLowStock(Array.isArray(listFrom(rLowStock)) ? listFrom(rLowStock) : []);

      fetchGuestsCount().catch(() => {});
      fetchKitchenAnalytics().catch(() => {});
    } catch (e) {
      console.error("CafeAnalytics fetchAll error:", e);
      setSalesSummary({ orders_count: 0, items_qty: 0, revenue: "0.00" });
      setSalesItems([]);
      setLowStock([]);
    } finally {
      setLoading(false);
    }
  }, [params, fetchGuestsCount, fetchKitchenAnalytics]);

  const fetchRevenueSeries = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setRevenueSeries([]);
      return;
    }
    const buckets = buildBuckets(dateFrom, dateTo);
    if (!buckets.length) {
      setRevenueSeries([]);
      return;
    }

    try {
      const chunkSize = 8;
      const out = [];

      for (let i = 0; i < buckets.length; i += chunkSize) {
        const part = buckets.slice(i, i + chunkSize);

        // eslint-disable-next-line no-await-in-loop
        const resArr = await Promise.all(
          part.map((b) =>
            api
              .get("/cafe/analytics/sales/summary/", {
                params: { date_from: b.date_from, date_to: b.date_to },
              })
              .catch(() => ({ data: null }))
          )
        );

        for (let j = 0; j < part.length; j += 1) {
          const b = part[j];
          const payload = resArr[j]?.data;
          out.push({ label: b.key, value: toNum(payload?.revenue) });
        }
      }

      setRevenueSeries(out);
    } catch (e) {
      console.error("CafeAnalytics fetchRevenueSeries error:", e);
      setRevenueSeries([]);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
    fetchRevenueSeries();
  }, [fetchAll, fetchRevenueSeries]);

  // Chart.js mount/update
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = revenueSeries.map((x) => x.label);
    const values = revenueSeries.map((x) => x.value);

    const ctx = canvas.getContext("2d");
    chartInstanceRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Выручка (сом)",
            data: values,
            tension: 0.35,
            fill: true,
            borderWidth: 3,
            borderColor: "#f7d74f",
            backgroundColor: "rgba(247, 215, 79, 0.16)",
            pointRadius: 3,
            pointHoverRadius: 4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#f7d74f",
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 30, boxHeight: 10, padding: 18 },
          },
          tooltip: {
            callbacks: {
              label: (ctx2) => ` ${ctx2.dataset.label}: ${fmtMoney(ctx2.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: true }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { display: true }, ticks: { callback: (v) => fmtInt(v) } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [revenueSeries]);

  const revenueTotal = useMemo(() => toNum(salesSummary?.revenue), [salesSummary]);
  const trxCount = useMemo(() => Number(salesSummary?.orders_count || 0), [salesSummary]);
  const avgCheck = useMemo(() => (trxCount > 0 ? revenueTotal / trxCount : 0), [revenueTotal, trxCount]);

  // кухонные KPI
  const cooksCount = useMemo(() => cooksRows.length, [cooksRows]);
  const waitersCount = useMemo(() => waitersRows.length, [waitersRows]);

  const openModal = (key) => {
    setModalKey(key);
    setStaffQ("");
    setStaffSort("revenue_desc");
  };
  const closeModal = () => setModalKey(null);

  const modalTitle = useMemo(() => {
    if (modalKey === "revenue") return "Выручка";
    if (modalKey === "avg") return "Средний чек";
    if (modalKey === "clients") return "Гости";
    if (modalKey === "stock") return "Склад";
    if (modalKey === "cooks") return "Аналитика по поварам";
    if (modalKey === "waiters") return "Аналитика по официантам";
    return "";
  }, [modalKey]);

  const modalSubtitle = useMemo(() => {
    const p = [];
    if (dateFrom) p.push(`от ${dateFrom}`);
    if (dateTo) p.push(`до ${dateTo}`);
    return p.join(" ");
  }, [dateFrom, dateTo]);

  const activeStaffRows = useMemo(() => {
    const base = modalKey === "cooks" ? cooksRows : modalKey === "waiters" ? waitersRows : [];
    const q = (staffQ || "").trim().toLowerCase();

    const filtered = q ? base.filter((x) => String(x?.name || "").toLowerCase().includes(q)) : base.slice();

    const sorted = filtered.sort((a, b) => {
      if (staffSort === "name_asc") return String(a.name).localeCompare(String(b.name), "ru");
      if (staffSort === "orders_desc") return toNum(b.orders_count) - toNum(a.orders_count);
      if (staffSort === "avg_desc") return toNum(b.avg_check) - toNum(a.avg_check);
      return toNum(b.revenue) - toNum(a.revenue);
    });

    return sorted;
  }, [modalKey, cooksRows, waitersRows, staffQ, staffSort]);

  const staffTotals = useMemo(() => {
    const rows = activeStaffRows;
    return {
      revenue: sumBy(rows, "revenue"),
      orders: sumBy(rows, "orders_count"),
      items: sumBy(rows, "items_qty"),
    };
  }, [activeStaffRows]);

  return (
    <section className="cafeAnalytics">
      <div className="cafeAnalytics__top">
        <div className="cafeAnalytics__head">
          <div className="cafeAnalytics__headLeft">
          </div>

          <div className="cafeAnalytics__headRight">
            <div className="cafeAnalytics__range">
              <div className="cafeAnalytics__rangeLabel">
                <FaFilter /> Период
              </div>

              <label className="cafeAnalytics__rangeField">
                <span>От</span>
                <input
                  type="date"
                  className="cafeAnalytics__input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>

              <label className="cafeAnalytics__rangeField">
                <span>До</span>
                <input
                  type="date"
                  className="cafeAnalytics__input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>

              <button
                className="cafeAnalytics__btn"
                onClick={() => {
                  fetchAll();
                  fetchRevenueSeries();
                }}
                disabled={loading || kitchenLoading}
                type="button"
              >
                <FaSync /> Обновить
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="cafeAnalytics__kpis cafeAnalytics__kpis--3">
          <button className="cafeAnalytics__kpi" type="button" onClick={() => openModal("revenue")}>
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ВЫРУЧКА</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaShoppingCart />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">
              <span className="cafeAnalytics__kpiCur">сом</span> {fmtInt(revenueTotal)}
            </div>
          </button>

          <div className="cafeAnalytics__kpi cafeAnalytics__kpi--static" aria-disabled="true">
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ТРАНЗАКЦИИ</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaShoppingCart />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(trxCount)}</div>
          </div>

          <button className="cafeAnalytics__kpi" type="button" onClick={() => openModal("clients")}>
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ГОСТИ</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaUsers />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(guestsCount)}</div>
          </button>
        </div>

        {/* KPI kitchen */}
        <div className="cafeAnalytics__kpis cafeAnalytics__kpis--2">
          <button
            className="cafeAnalytics__kpi cafeAnalytics__kpi--kitchen"
            type="button"
            onClick={() => openModal("cooks")}
            disabled={kitchenLoading}
          >
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ПОВАРА</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaUsers />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(cooksCount)}</div>
            <div className="cafeAnalytics__kpiHint">{kitchenLoading ? "Загрузка…" : "Сводка и рейтинг"}</div>
          </button>

          <button
            className="cafeAnalytics__kpi cafeAnalytics__kpi--kitchen"
            type="button"
            onClick={() => openModal("waiters")}
            disabled={kitchenLoading}
          >
            <div className="cafeAnalytics__kpiTop">
              <div className="cafeAnalytics__kpiLabel">ОФИЦИАНТЫ</div>
              <div className="cafeAnalytics__kpiIcon cafeAnalytics__kpiIcon--yellow">
                <FaUsers />
              </div>
            </div>
            <div className="cafeAnalytics__kpiValue">{fmtInt(waitersCount)}</div>
            <div className="cafeAnalytics__kpiHint">{kitchenLoading ? "Загрузка…" : "Выручка, чеки, позиции"}</div>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="cafeAnalytics__card">
        <div className="cafeAnalytics__cardHead">
          <div className="cafeAnalytics__cardTitle">Динамика продаж</div>
        </div>

        <div className="cafeAnalytics__cardBody">
          <div className="cafeAnalytics__chartWrap">
            <canvas ref={chartRef} />
          </div>

          {!loading && revenueSeries.length === 0 && (
            <div className="cafeAnalytics__note">Нет данных по выручке за выбранный период.</div>
          )}
          {loading && <div className="cafeAnalytics__note">Загрузка аналитики…</div>}
        </div>
      </div>

      {/* Bottom */}
      <div className="cafeAnalytics__bottom">
        <div className="cafeAnalytics__card cafeAnalytics__card--full">
          <div className="cafeAnalytics__cardHead cafeAnalytics__cardHead--tight">
            <div className="cafeAnalytics__cardTitle">Топ блюд по выручке</div>
          </div>

          <div className="cafeAnalytics__cardBody cafeAnalytics__cardBody--tight">
            <div className="cafeAnalytics__tableWrap">
              <table className="cafeAnalytics__table">
                <thead>
                  <tr>
                    <th>Блюдо</th>
                    <th>Кол-во</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {salesItems.map((x) => (
                    <tr key={x.menu_item_id || x.title}>
                      <td className="cafeAnalytics__tdTitle" title={x.title}>
                        {x.title}
                      </td>
                      <td>{fmtInt(x.qty)}</td>
                      <td>{fmtMoney(toNum(x.revenue))}</td>
                    </tr>
                  ))}
                  {!salesItems.length && (
                    <tr>
                      <td colSpan={3} className="cafeAnalytics__tdEmpty">
                        Нет данных.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <button className="cafeAnalytics__mini" type="button" onClick={() => openModal("stock")}>
          <div className="cafeAnalytics__miniTop">
            <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--red">
              <FaBoxOpen />
            </div>
            <div className="cafeAnalytics__miniLabel">СКЛАД</div>
          </div>
          <div className="cafeAnalytics__miniValue">{fmtInt(lowStock.length)}</div>
          <div className="cafeAnalytics__miniMeta">Позиции ниже минимума</div>
        </button>

        <button className="cafeAnalytics__mini" type="button" onClick={() => openModal("avg")}>
          <div className="cafeAnalytics__miniTop">
            <div className="cafeAnalytics__miniIcon cafeAnalytics__miniIcon--dark">
              <FaChartLine />
            </div>
            <div className="cafeAnalytics__miniLabel">СРЕДНИЙ ЧЕК</div>
          </div>
          <div className="cafeAnalytics__miniValue">{fmtMoney(avgCheck)}</div>
          <div className="cafeAnalytics__miniMeta">Выручка / транзакции</div>
        </button>
      </div>

      {/* Modal */}
      <CafeAnalyticsModal open={!!modalKey} title={modalTitle} subtitle={modalSubtitle} onClose={closeModal}>
        <CafeAnalyticsModalContent
          modalKey={modalKey}
          revenueTotal={revenueTotal}
          trxCount={trxCount}
          avgCheck={avgCheck}
          guestsCount={guestsCount}
          salesItems={salesItems}
          lowStock={lowStock}
          kitchenLoading={kitchenLoading}
          staffQ={staffQ}
          setStaffQ={setStaffQ}
          staffSort={staffSort}
          setStaffSort={setStaffSort}
          onRefreshKitchen={fetchKitchenAnalytics}
          activeStaffRows={activeStaffRows}
          staffTotals={staffTotals}
          fmtInt={fmtInt}
          fmtMoney={fmtMoney}
          toNum={toNum}
        />
      </CafeAnalyticsModal>
    </section>
  );
};

export default CafeAnalytics;
