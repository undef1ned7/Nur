// src/components/Autosalon/Analytics/Analytics.jsx
import React, { useMemo, useState } from "react";
import "./Analytics.scss";
import { useAutosalon } from "../context/AutosalonContext";

const fmtMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") + " сом" : "—";
};

const fmtPercent = (num, den) => {
  const a = Number(num) || 0;
  const b = Number(den) || 0;
  if (!b) return "0%";
  return `${((a * 100) / b).toFixed(1)}%`;
};

/* ===================== Sparkline (pure SVG) ===================== */
const Sparkline = ({ data = [] }) => {
  const w = 200;
  const h = 60;
  const p = 4;
  
  if (data.length === 0) return null;
  
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
    <svg className="as-an__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon 
        points={`${p},${h - p} ${pts.join(" ")} ${w - p},${h - p}`} 
        fill="url(#sparkGrad)" 
      />
      <polyline points={pts.join(" ")} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* ===================== Progress Bar ===================== */
const ProgressBar = ({ value, max, color = "#3b82f6" }) => {
  const pctVal = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="as-an__progressWrap">
      <div 
        className="as-an__progressBar" 
        style={{ width: `${pctVal}%`, background: color }}
      />
    </div>
  );
};

/* ===================== Main ===================== */
const AutosalonAnalytics = () => {
  const { data, stats, brandStats, dailyStats } = useAutosalon();
  
  const [period, setPeriod] = useState("all");

  // Фильтрация по периоду
  const filteredData = useMemo(() => {
    if (period === "all") return data;
    
    const now = new Date();
    const days = period === "7" ? 7 : period === "30" ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return data.filter(d => {
      const date = new Date(d.date);
      return date >= cutoff;
    });
  }, [data, period]);

  // Расчёт метрик
  const metrics = useMemo(() => {
    const sold = filteredData.filter(d => d.status === "sold");
    const reserved = filteredData.filter(d => d.status === "reserved");
    const available = filteredData.filter(d => d.status === "available");
    
    const revenue = sold.reduce((sum, d) => sum + (d.price || 0), 0);
    const reservedSum = reserved.reduce((sum, d) => sum + (d.price || 0), 0);
    const availableSum = available.reduce((sum, d) => sum + (d.price || 0), 0);
    const serviceTotal = filteredData.reduce((sum, d) => sum + (d.service || 0), 0);
    const avgCheck = sold.length ? revenue / sold.length : 0;
    
    // Расчёт прибыли (выручка + услуги)
    const totalProfit = revenue + serviceTotal;
    
    return {
      total: filteredData.length,
      soldCount: sold.length,
      reservedCount: reserved.length,
      availableCount: available.length,
      revenue,
      reservedSum,
      availableSum,
      serviceTotal,
      avgCheck,
      totalProfit,
      conversionRate: filteredData.length ? (sold.length / filteredData.length) * 100 : 0,
    };
  }, [filteredData]);

  // ТОП марки по продажам
  const topBrands = useMemo(() => {
    const sold = filteredData.filter(d => d.status === "sold");
    const byBrand = new Map();
    
    sold.forEach(d => {
      const brand = d.car?.split(" ")[0] || "Другое";
      const prev = byBrand.get(brand) || { count: 0, sum: 0 };
      byBrand.set(brand, { 
        count: prev.count + 1, 
        sum: prev.sum + (d.price || 0) 
      });
    });
    
    return Array.from(byBrand, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 5);
  }, [filteredData]);

  // ТОП клиенты по сумме покупок
  const topClients = useMemo(() => {
    const sold = filteredData.filter(d => d.status === "sold" && d.client);
    const byClient = new Map();
    
    sold.forEach(d => {
      const prev = byClient.get(d.client) || { count: 0, sum: 0 };
      byClient.set(d.client, { 
        count: prev.count + 1, 
        sum: prev.sum + (d.price || 0) 
      });
    });
    
    return Array.from(byClient, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 5);
  }, [filteredData]);

  // Динамика продаж по датам
  const sparkData = useMemo(() => {
    const sold = filteredData.filter(d => d.status === "sold");
    const byDate = new Map();
    
    sold.forEach(d => {
      const date = d.date || "unknown";
      const prev = byDate.get(date) || 0;
      byDate.set(date, prev + (d.price || 0));
    });
    
    const sorted = Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, sum]) => sum);
    
    return sorted.length > 0 ? sorted : [0];
  }, [filteredData]);

  // Статусы для круговой диаграммы
  const statusDonut = useMemo(() => {
    const total = metrics.total || 1;
    const segs = [];
    let acc = 0;
    
    const addSeg = (count, color) => {
      const part = (count * 100) / total;
      segs.push(`${color} ${acc}% ${acc + part}%`);
      acc += part;
    };
    
    addSeg(metrics.availableCount, "#3b82f6");
    addSeg(metrics.reservedCount, "#f59e0b");
    addSeg(metrics.soldCount, "#22c55e");
    
    return segs.join(", ");
  }, [metrics]);

  return (
    <section className="as-an">
      <header className="as-an__header">
        <div>
          <h2 className="as-an__title">Аналитика продаж</h2>
          <p className="as-an__subtitle">
            Всего записей: {metrics.total} | Период: {period === "all" ? "всё время" : `${period} дней`}
          </p>
        </div>

        <div className="as-an__periodBtns">
          {[
            { id: "7", label: "7 дней" },
            { id: "30", label: "30 дней" },
            { id: "90", label: "90 дней" },
            { id: "all", label: "Всё время" },
          ].map((p) => (
            <button
              key={p.id}
              className={`as-an__periodBtn ${period === p.id ? "as-an__periodBtn--active" : ""}`}
              onClick={() => setPeriod(p.id)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Основные показатели */}
      <div className="as-an__kpiGrid">
        <div className="as-an__kpiCard as-an__kpiCard--primary">
          <div className="as-an__kpiContent">
            <div className="as-an__kpiLabel">Выручка от продаж</div>
            <div className="as-an__kpiValue">{fmtMoney(metrics.revenue)}</div>
            <div className="as-an__kpiSub">Продано: {metrics.soldCount} авто</div>
          </div>
          <Sparkline data={sparkData} />
        </div>

        <div className="as-an__kpiCard">
          <div className="as-an__kpiContent">
            <div className="as-an__kpiLabel">Средний чек</div>
            <div className="as-an__kpiValue">{fmtMoney(metrics.avgCheck)}</div>
            <div className="as-an__kpiSub">На одну сделку</div>
          </div>
        </div>

        <div className="as-an__kpiCard">
          <div className="as-an__kpiContent">
            <div className="as-an__kpiLabel">Доход от услуг</div>
            <div className="as-an__kpiValue">{fmtMoney(metrics.serviceTotal)}</div>
            <div className="as-an__kpiSub">Дополнительные услуги</div>
          </div>
        </div>

        <div className="as-an__kpiCard">
          <div className="as-an__kpiContent">
            <div className="as-an__kpiLabel">Конверсия</div>
            <div className="as-an__kpiValue">{metrics.conversionRate.toFixed(1)}%</div>
            <div className="as-an__kpiSub">Доля проданных</div>
          </div>
        </div>
      </div>

      {/* Сводка по статусам */}
      <div className="as-an__summaryRow">
        <div className="as-an__summaryCard as-an__summaryCard--blue">
          <div className="as-an__summaryNum">{metrics.availableCount}</div>
          <div className="as-an__summaryText">В наличии</div>
          <div className="as-an__summarySum">{fmtMoney(metrics.availableSum)}</div>
        </div>
        <div className="as-an__summaryCard as-an__summaryCard--orange">
          <div className="as-an__summaryNum">{metrics.reservedCount}</div>
          <div className="as-an__summaryText">Забронировано</div>
          <div className="as-an__summarySum">{fmtMoney(metrics.reservedSum)}</div>
        </div>
        <div className="as-an__summaryCard as-an__summaryCard--green">
          <div className="as-an__summaryNum">{metrics.soldCount}</div>
          <div className="as-an__summaryText">Продано</div>
          <div className="as-an__summarySum">{fmtMoney(metrics.revenue)}</div>
        </div>
        <div className="as-an__summaryCard as-an__summaryCard--total">
          <div className="as-an__summaryNum">{fmtMoney(metrics.totalProfit)}</div>
          <div className="as-an__summaryText">Общий доход</div>
          <div className="as-an__summarySum">Продажи + услуги</div>
        </div>
      </div>

      {/* Детальная аналитика */}
      <div className="as-an__detailGrid">
        {/* Статусы */}
        <div className="as-an__detailCard">
          <h3 className="as-an__detailTitle">Распределение по статусам</h3>
          <div className="as-an__donutWrap">
            <div
              className="as-an__donut"
              style={{ backgroundImage: `conic-gradient(${statusDonut})` }}
            />
            <div className="as-an__donutCenter">
              <div className="as-an__donutValue">{metrics.total}</div>
              <div className="as-an__donutLabel">всего</div>
            </div>
          </div>
          <ul className="as-an__legend">
            <li>
              <span className="as-an__legendDot as-an__legendDot--blue"></span> 
              В наличии — {metrics.availableCount} ({fmtPercent(metrics.availableCount, metrics.total)})
            </li>
            <li>
              <span className="as-an__legendDot as-an__legendDot--orange"></span> 
              Забронировано — {metrics.reservedCount} ({fmtPercent(metrics.reservedCount, metrics.total)})
            </li>
            <li>
              <span className="as-an__legendDot as-an__legendDot--green"></span> 
              Продано — {metrics.soldCount} ({fmtPercent(metrics.soldCount, metrics.total)})
            </li>
          </ul>
        </div>

        {/* ТОП марки */}
        <div className="as-an__detailCard">
          <h3 className="as-an__detailTitle">Продажи по маркам</h3>
          {topBrands.length > 0 ? (
            <ul className="as-an__rankList">
              {topBrands.map((b, i) => (
                <li key={b.name} className="as-an__rankItem">
                  <span className="as-an__rankNum">{i + 1}</span>
                  <div className="as-an__rankContent">
                    <div className="as-an__rankName">{b.name}</div>
                    <ProgressBar value={b.sum} max={topBrands[0]?.sum || 1} />
                  </div>
                  <div className="as-an__rankMeta">
                    <div className="as-an__rankValue">{fmtMoney(b.sum)}</div>
                    <div className="as-an__rankSub">{b.count} шт.</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-an__empty">Нет данных о продажах</div>
          )}
        </div>

        {/* ТОП клиенты */}
        <div className="as-an__detailCard">
          <h3 className="as-an__detailTitle">Крупнейшие покупатели</h3>
          {topClients.length > 0 ? (
            <ul className="as-an__rankList">
              {topClients.map((c, i) => (
                <li key={c.name} className="as-an__rankItem">
                  <span className="as-an__rankNum">{i + 1}</span>
                  <div className="as-an__rankContent">
                    <div className="as-an__rankName">{c.name}</div>
                    <ProgressBar value={c.sum} max={topClients[0]?.sum || 1} color="#22c55e" />
                  </div>
                  <div className="as-an__rankMeta">
                    <div className="as-an__rankValue">{fmtMoney(c.sum)}</div>
                    <div className="as-an__rankSub">{c.count} {c.count === 1 ? "покупка" : "покупок"}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-an__empty">Нет данных о клиентах</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AutosalonAnalytics;
