// RecordaRates.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./RecordaRates.scss";
import api from "../../../../../api";
import { pdf } from "@react-pdf/renderer";

import {
  RecordaRatesHeader,
  RecordaRatesTable,
  RecordaRatesPager,
  RecordaRatesSummary,
} from "./components";

import DaysModal from "./RecordaRatesDaysModal";
import ProductSaleModal from "./RecordaRatesProductSaleModal";
import ExportModal from "./RecordaRatesExportModal";
import PayoutsPdfDocument from "./components/PayoutsPdfDocument";

import {
  PAGE_SIZE,
  pad2,
  fmtMoney,
  asArray,
  toNum,
  y_m_fromISO,
  dateKG,
} from "./RecordaRates.utils";
import { useMasterAggregates, useYearOptions } from "./RecordaRates.hooks";

const getDraft = (draft, barberId, periodKey) =>
  draft?.[barberId]?.[periodKey] || {};

const RecordaRates = ({
  year,
  month,
  onChangeYear,
  onChangeMonth,
  employees = [],
  appointments = [],
  _services = [],
  rates = {},
  ratesLoading = false,
  ratesError = "",
  onChangeRate,
  onSaveRates,
}) => {
  const [page, setPage] = useState(1);
  const [draftRates, setDraftRates] = useState({});
  const [daysModal, setDaysModal] = useState({
    open: false,
    title: "",
    rows: [],
  });

  const [productModal, setProductModal] = useState({
    open: false,
    employeeId: "",
    employeeName: "",
  });
  const [products, setProducts] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [productDataLoading, setProductDataLoading] = useState(false);
  const [productDataError, setProductDataError] = useState("");
  const [productSaving, setProductSaving] = useState(false);

  const [productPayoutTotals, setProductPayoutTotals] = useState({});
  const [exportModal, setExportModal] = useState({ open: false });

  const period = `${year}-${pad2(month)}`;

  useEffect(() => {
    setDraftRates({});
    setPage(1);
  }, [period]);

  useEffect(() => {
    setDraftRates((prev) => {
      const next = { ...prev };
      for (const barberId of Object.keys(rates || {})) {
        const r = rates[barberId] || {};
        next[barberId] = next[barberId] || {};
        next[barberId][period] = {
          perRecord:
            r.perRecord === "" || r.perRecord == null
              ? 0
              : Number(r.perRecord) || 0,
          fixed: r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
          percent:
            r.perMonth != null && r.percent == null && r.perPercent == null
              ? Number(r.perMonth) || 0
              : Number(r.percent ?? r.perPercent ?? 0) || 0,
        };
      }
      return next;
    });
  }, [period, rates]);

  const normalizedEmployees = useMemo(() => {
    const seen = new Set();
    const arr = [];
    for (const e of Array.isArray(employees) ? employees : []) {
      const id = String(e?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      arr.push({ id, name: e?.name || "—" });
    }
    return arr;
  }, [employees]);

  const { doneByMaster, revenueByMaster, daysByMaster } = useMasterAggregates(
    appointments,
    year,
    month
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/barbershop/product-sale-payouts/", {
          params: { page_size: 5000 },
        });
        const items = asArray(res.data);
        const map = {};

        items.forEach((p) => {
          const ym = y_m_fromISO(p.created_at);
          if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) return;

          const empId = String(p.employee || "");
          if (!empId) return;

          const payout = toNum(p.payout_amount);
          if (!Number.isFinite(payout)) return;

          map[empId] = (map[empId] || 0) + payout;
        });

        setProductPayoutTotals(map);
      } catch (e) {
        console.error(e);
        setProductPayoutTotals({});
      }
    })();
  }, [year, month]);

  const rows = useMemo(
    () =>
      normalizedEmployees.map((e) => {
        const base = rates[e.id] || {};
        const draft = getDraft(draftRates, e.id, period);

        const perRecord =
          draft.perRecord ??
          (base.perRecord === "" || base.perRecord == null
            ? 0
            : Number(base.perRecord) || 0);

        const fixed =
          draft.fixed ??
          (base.fixed === "" || base.fixed == null
            ? 0
            : Number(base.fixed) || 0);

        const percent =
          draft.percent ??
          (base.perMonth != null &&
          base.percent == null &&
          base.perPercent == null
            ? Number(base.perMonth) || 0
            : Number(base.percent ?? base.perPercent ?? 0) || 0);

        const completed = Number(doneByMaster.get(String(e.id)) || 0);
        const revenue = Number(revenueByMaster.get(String(e.id)) || 0);

        const productBonus = Number(productPayoutTotals[String(e.id)] || 0);

        const total =
          completed * (Number(perRecord) || 0) +
          (Number(fixed) || 0) +
          Math.round((revenue * (Number(percent) || 0)) / 100) +
          productBonus;

        return {
          id: e.id,
          name: e.name,
          completed,
          revenue,
          perRecord,
          fixed,
          percent,
          total,
        };
      }),
    [
      normalizedEmployees,
      rates,
      draftRates,
      doneByMaster,
      revenueByMaster,
      period,
      productPayoutTotals,
    ]
  );

  const totals = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleRateChange = (barberId, field, raw) => {
    const clampMoney = (v, max = 10_000_000) => {
      if (v === "" || v == null) return "";
      const n = toNum(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), max);
    };
    const clampPercent = (v) => {
      if (v === "" || v == null) return "";
      const n = toNum(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), 100);
    };

    const nextVal = field === "percent" ? clampPercent(raw) : clampMoney(raw);

    setDraftRates((prev) => {
      const byUser = { ...(prev[barberId] || {}) };
      byUser[period] = { ...(byUser[period] || {}), [field]: nextVal };
      return { ...prev, [barberId]: byUser };
    });

    onChangeRate?.(barberId, field, nextVal);
  };

  const handleSave = () => {
    onSaveRates?.({
      perRecordPeriod: period,
      percentPeriods: [period],
      totalFund: totals,
    });
  };

  const openDays = (row) => {
    const perRecord = Number(row.perRecord) || 0;
    const percent = Number(row.percent) || 0;
    const fixed = Number(row.fixed) || 0;
    const productBonus = Number(productPayoutTotals[String(row.id)] || 0);

    const map = daysByMaster.get(String(row.id)) || new Map();

    const dayRows = Array.from(map, ([date, v]) => {
      const payout =
        v.records * perRecord + Math.round((v.revenue * percent) / 100);
      return { date, completed: v.records, revenue: v.revenue, payout };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const baseTotal = dayRows.reduce((s, r) => s + toNum(r.payout), 0);
    const sumCompleted = dayRows.reduce((s, r) => s + toNum(r.completed), 0);
    const sumRevenue = dayRows.reduce((s, r) => s + toNum(r.revenue), 0);

    const list = [...dayRows];

    list.push({ date: "Фикс (месяц)", completed: 0, revenue: 0, payout: fixed });
    list.push({
      date: "Товар (месяц)",
      completed: 0,
      revenue: 0,
      payout: productBonus,
    });
    list.push({
      date: "Итого",
      completed: sumCompleted,
      revenue: sumRevenue,
      payout: baseTotal + fixed + productBonus,
    });

    setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
  };

  const closeDays = () => setDaysModal((p) => ({ ...p, open: false }));

  const loadProductData = async () => {
    setProductDataLoading(true);
    setProductDataError("");

    try {
      const prodRes = await api.get("/main/products/list/");
      const rawProducts = asArray(prodRes.data);
      const mapped = rawProducts.map((p) => ({
        id: String(p.id),
        name: p.name || p.product_name || p.title || "Без названия",
        price: Number(p.price || 0),
      }));
      setProducts(mapped);
    } catch {
      setProductDataError("Не удалось загрузить список товаров.");
    }

    try {
      const salesRes = await api.get("/barbershop/product-sale-payouts/", {
        params: { page_size: 5000 },
      });
      setProductSales(asArray(salesRes.data));
    } catch {
      // ignore
    } finally {
      setProductDataLoading(false);
    }
  };

  const handleCreateProductSale = async ({
    employeeId,
    productId,
    percent,
    price,
  }) => {
    try {
      setProductSaving(true);
      setProductDataError("");
      const payload = {
        employee: employeeId,
        product: productId,
        percent: String(percent),
        price: String(price),
      };
      const { data } = await api.post(
        "/barbershop/product-sale-payouts/",
        payload
      );
      setProductSales((prev) => [data, ...prev]);

      setProductPayoutTotals((prev) => {
        const empId = String(employeeId);
        const payout = toNum(data.payout_amount);
        return {
          ...prev,
          [empId]: (prev[empId] || 0) + (Number.isFinite(payout) ? payout : 0),
        };
      });
    } catch {
      setProductDataError("Не удалось сохранить продажу товара.");
      throw new Error("save error");
    } finally {
      setProductSaving(false);
    }
  };

  const openProductModal = (row) => {
    setProductModal({ open: true, employeeId: row.id, employeeName: row.name });
    loadProductData();
  };

  const closeProductModal = () =>
    setProductModal((p) => ({ ...p, open: false }));

  const productPayoutsForModal = useMemo(() => {
    if (!productSales.length) return [];

    // NOTE: Client-side filtering is a temporary solution
    // TODO: Move filtering to backend with query params: ?period=YYYY-MM&employee=ID
    return productSales
      .filter((p) => {
        const ym = y_m_fromISO(p.created_at);
        if (!ym) return false;
        const samePeriod = ym.y === Number(year) && ym.m === Number(month);
        if (!samePeriod) return false;

        if (!productModal.employeeId) return true;

        const sameEmployeeId =
          String(p.employee) === String(productModal.employeeId);
        const sameEmployeeName =
          String(p.employee_name || "").trim() ===
          String(productModal.employeeName || "").trim();

        return sameEmployeeId || sameEmployeeName;
      })
      .map((p) => ({ ...p, dateFormatted: dateKG(p.created_at) }));
  }, [
    productSales,
    productModal.employeeId,
    productModal.employeeName,
    year,
    month,
  ]);

  const yearOptions = useYearOptions();

  const openExportModal = () => setExportModal({ open: true });
  const closeExportModal = () => setExportModal({ open: false });

  const handleExport = async ({ mode, date, weeks, format = "pdf" }) => {
    const clampInt = (v, min, max, def) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return def;
      return Math.max(min, Math.min(max, Math.trunc(n)));
    };

    const toIsoDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const parseIsoToUtcMs = (iso) => {
      const t = Date.parse(String(iso || ""));
      return Number.isFinite(t) ? t : NaN;
    };

    const num = (v) => Math.round(toNum(v));
    const money = (v) => `${num(v)}с`;

    const end = new Date(`${date}T00:00:00`);
    if (Number.isNaN(end.getTime())) return;

    let start = new Date(end);
    if (mode === "weeks") {
      const w = clampInt(weeks, 1, 52, 1);
      start = new Date(end);
      start.setDate(start.getDate() - (w * 7 - 1));
    }

    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    const inRangeIso = (iso) => iso >= startIso && iso <= endIso;

    const monthKey = endIso.slice(0, 7);

    // NOTE: Client-side filtering is a temporary solution for export
    // TODO: Backend should support ?status=completed&start_date=&end_date= params
    const rangeApps = (Array.isArray(appointments) ? appointments : []).filter(
      (a) => {
        const s = String(a?.status || "").trim().toLowerCase();
        if (s !== "completed") return false;

        const t = parseIsoToUtcMs(a?.start_at);
        if (!Number.isFinite(t)) return false;

        const iso = toIsoDate(new Date(t));
        return inRangeIso(iso);
      }
    );

    const byEmp = new Map();
    rangeApps.forEach((a) => {
      const empId = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!empId) return;

      const prev = byEmp.get(empId) || { completed: 0, revenue: 0 };
      byEmp.set(empId, {
        completed: prev.completed + 1,
        revenue: prev.revenue + toNum(a?.price),
      });
    });

    let prodItems = [];
    try {
      const res = await api.get("/barbershop/product-sale-payouts/", {
        params: { page_size: 5000 },
      });
      prodItems = asArray(res.data);
    } catch {
      prodItems = [];
    }

    const prodByEmpMonth = {};
    prodItems.forEach((p) => {
      const t = parseIsoToUtcMs(p?.created_at);
      if (!Number.isFinite(t)) return;

      const iso = toIsoDate(new Date(t));
      if (iso.slice(0, 7) !== monthKey) return;

      const empId = String(p.employee || "");
      if (!empId) return;

      const payout = toNum(p.payout_amount);
      if (!Number.isFinite(payout)) return;

      prodByEmpMonth[empId] = (prodByEmpMonth[empId] || 0) + payout;
    });

    const rowsOut = normalizedEmployees
      .map((e) => {
        const agg = byEmp.get(String(e.id)) || { completed: 0, revenue: 0 };

        const base = rates?.[e.id] || {};
        const draft = getDraft(draftRates, e.id, period);

        const fixed =
          draft.fixed ??
          (base.fixed === "" || base.fixed == null
            ? 0
            : Number(base.fixed) || 0);

        const perRecord =
          draft.perRecord ??
          (base.perRecord === "" || base.perRecord == null
            ? 0
            : Number(base.perRecord) || 0);

        const percent =
          draft.percent ??
          (base.percent == null &&
          base.perPercent == null &&
          base.perMonth != null
            ? Number(base.perMonth) || 0
            : Number(base.percent ?? base.perPercent ?? 0) || 0);

        const fixedMonth = toNum(fixed);
        const productMonth = toNum(prodByEmpMonth[String(e.id)] || 0);

        const perRecordPayout = agg.completed * toNum(perRecord);
        const percentPayout = Math.round((agg.revenue * toNum(percent)) / 100);
        const payoutRangePart = perRecordPayout + percentPayout;
        const payoutTotal = payoutRangePart + fixedMonth + productMonth;

        return {
          name: e.name,
          completed: agg.completed,
          revenue: agg.revenue,
          perRecordRate: toNum(perRecord),
          perRecordPayout,
          percentRate: toNum(percent),
          percentPayout,
          payoutTotal,
          fixedMonth,
          productMonth,
        };
      })
      .filter(
        (r) =>
          r.completed > 0 ||
          r.revenue > 0 ||
          r.payoutTotal > 0 ||
          r.fixedMonth > 0 ||
          r.productMonth > 0
      )
      .sort((a, b) => b.payoutTotal - a.payoutTotal || b.revenue - a.revenue);

    const totalsStat = rowsOut.reduce(
      (acc, r) => ({
        completed: acc.completed + num(r.completed),
        revenue: acc.revenue + num(r.revenue),
        perRecordPayout: acc.perRecordPayout + num(r.perRecordPayout),
        percentPayout: acc.percentPayout + num(r.percentPayout),
        payout: acc.payout + num(r.payoutTotal),
        fixed: acc.fixed + num(r.fixedMonth),
        product: acc.product + num(r.productMonth),
      }),
      { completed: 0, revenue: 0, perRecordPayout: 0, percentPayout: 0, payout: 0, fixed: 0, product: 0 }
    );

    const W = {
      name: 20,
      completed: 8,
      revenue: 10,
      perRecord: 12,
      percent: 12,
      payout: 10,
      fixed: 10,
      product: 10,
    };

    const cut = (s, w) => {
      const str = String(s ?? "");
      return str.length > w ? `${str.slice(0, w - 1)}…` : str;
    };

    const cellL = (v, w) => cut(v, w).padEnd(w, " ");
    const cellR = (v, w) => cut(v, w).padStart(w, " ");

    const header =
      `${cellL("Мастер", W.name)}  ` +
      `${cellR("Записей", W.completed)}  ` +
      `${cellR("Выручка", W.revenue)}  ` +
      `${cellR("За запись", W.perRecord)}  ` +
      `${cellR("Процент", W.percent)}  ` +
      `${cellR("К выплате", W.payout)}  ` +
      `${cellR("Фикс(мес)", W.fixed)}  ` +
      `${cellR("Товар(мес)", W.product)}`;

    const sep = "-".repeat(header.length);

    const lines = [];
    lines.push(`ОТЧЁТ: ${startIso} — ${endIso}`);
    lines.push(`Месяц (для Фикс/Товар): ${monthKey}`);
    lines.push("");
    lines.push(header);
    lines.push(sep);

    rowsOut.forEach((r) => {
      const perRecordLabel = r.perRecordRate > 0 
        ? `${r.completed}×${num(r.perRecordRate)}=${money(r.perRecordPayout)}`
        : "—";
      const percentLabel = r.percentRate > 0
        ? `${num(r.percentRate)}%=${money(r.percentPayout)}`
        : "—";
      
      lines.push(
        `${cellL(r.name, W.name)}  ` +
          `${cellR(r.completed, W.completed)}  ` +
          `${cellR(money(r.revenue), W.revenue)}  ` +
          `${cellR(perRecordLabel, W.perRecord)}  ` +
          `${cellR(percentLabel, W.percent)}  ` +
          `${cellR(money(r.payoutTotal), W.payout)}  ` +
          `${cellR(money(r.fixedMonth), W.fixed)}  ` +
          `${cellR(money(r.productMonth), W.product)}`
      );
    });

    lines.push(sep);
    lines.push(
      `${cellL("ИТОГО", W.name)}  ` +
        `${cellR(totalsStat.completed, W.completed)}  ` +
        `${cellR(money(totalsStat.revenue), W.revenue)}  ` +
        `${cellR(money(totalsStat.perRecordPayout), W.perRecord)}  ` +
        `${cellR(money(totalsStat.percentPayout), W.percent)}  ` +
        `${cellR(money(totalsStat.payout), W.payout)}  ` +
        `${cellR(money(totalsStat.fixed), W.fixed)}  ` +
        `${cellR(money(totalsStat.product), W.product)}`
    );

    if (format === "pdf") {
      // PDF Export
      const pdfData = {
        startDate: startIso,
        endDate: endIso,
        monthKey,
        rows: rowsOut,
        totals: totalsStat,
      };

      const fname = `report_${startIso}_to_${endIso}.pdf`;

      try {
        const blob = await pdf(<PayoutsPdfDocument data={pdfData} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      } catch (error) {
        console.error("PDF generation error:", error);
        alert("Ошибка при создании PDF");
      }
    } else {
      // TXT Export (original code)
      const text = lines.join("\n");
      const fname = `report_${startIso}_to_${endIso}.txt`;

      const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    }

    closeExportModal?.();
  };

  return (
    <section className="barberrecordarates" aria-label="Выплаты мастерам">
      <RecordaRatesHeader
        year={year}
        month={month}
        yearOptions={yearOptions}
        onChangeYear={(val) => {
          onChangeYear?.(val);
          setPage(1);
        }}
        onChangeMonth={(val) => {
          onChangeMonth?.(val);
          setPage(1);
        }}
        onSave={handleSave}
        onExport={openExportModal}
        ratesLoading={ratesLoading}
      />

      {ratesError && <div className="barberrecordarates__alert">{ratesError}</div>}

      <RecordaRatesTable
        visible={visible}
        onRateChange={handleRateChange}
        onOpenDays={openDays}
        onOpenProduct={openProductModal}
      />

      <RecordaRatesPager
        page={safePage}
        totalPages={totalPages}
        onChange={setPage}
      />

      <RecordaRatesSummary totals={totals} />

      <DaysModal
        open={daysModal.open}
        onClose={closeDays}
        title={daysModal.title}
        rows={daysModal.rows}
      />

      <ProductSaleModal
        open={productModal.open}
        onClose={closeProductModal}
        employeeId={productModal.employeeId}
        employeeName={productModal.employeeName}
        employees={normalizedEmployees}
        products={products}
        payouts={productPayoutsForModal}
        loading={productDataLoading}
        error={productDataError}
        saving={productSaving}
        onCreate={handleCreateProductSale}
        periodLabel={period}
      />

      <ExportModal
        open={exportModal.open}
        onClose={closeExportModal}
        onExport={handleExport}
      />
    </section>
  );
};

export default RecordaRates;
