// RecordaRates.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./RecordaRates.scss";
import { FaSync } from "react-icons/fa";
import api from "../../../../../api";

import { RRSelect } from "./RecordaRatesSelect";
import DaysModal from "./RecordaRatesDaysModal";
import ProductSaleModal from "./RecordaRatesProductSaleModal";

import {
  PAGE_SIZE,
  pad2,
  fmtInt,
  fmtMoney,
  asArray,
  toNum,
  y_m_fromISO,
  dateKG,
} from "./RecordaRates.utils";
import { useMasterAggregates, useYearOptions } from "./RecordaRates.hooks";

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

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

  // 🔥 суммарные товарные выплаты по сотрудникам за месяц
  const [productPayoutTotals, setProductPayoutTotals] = useState({});

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
          fixed:
            r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
          percent:
            r.percent == null && r.perPercent == null && r.perMonth != null
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
    return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [employees]);

  const { doneByMaster, revenueByMaster, daysByMaster } =
    useMasterAggregates(appointments, year, month);

  // 🔥 тянем все product-sale-payouts и собираем суммы по сотрудникам за текущий месяц
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/barbershop/product-sale-payouts/", {
          params: { page_size: 1000 },
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
          (base.percent == null &&
          base.perPercent == null &&
          base.perMonth != null
            ? Number(base.perMonth) || 0
            : Number(base.percent ?? base.perPercent ?? 0) || 0);

        const completed = Number(doneByMaster.get(String(e.id)) || 0);
        const revenue = Number(revenueByMaster.get(String(e.id)) || 0);

        // 🔥 товарные бонусы этого сотрудника за месяц
        const productBonus = Number(
          productPayoutTotals[String(e.id)] || 0
        );

        const total =
          completed * (Number(perRecord) || 0) +
          (Number(fixed) || 0) +
          Math.round((revenue * (Number(percent) || 0)) / 100) +
          productBonus; // 👈 добавили товарные продажи

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

    const nextVal =
      field === "percent" ? clampPercent(raw) : clampMoney(raw);

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
      totalFund: totals, // <-- фонд выплат с учётом товаров
    });
  };

  const openDays = (row) => {
    const perRecord = Number(row.perRecord) || 0;
    const percent = Number(row.percent) || 0;
    const map = daysByMaster.get(String(row.id)) || new Map();
    const list = Array.from(map, ([date, v]) => {
      const payout =
        v.records * perRecord +
        Math.round((v.revenue * percent) / 100);
      return { date, completed: v.records, revenue: v.revenue, payout };
    }).sort((a, b) => a.date.localeCompare(b.date));
    setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
  };

  const closeDays = () =>
    setDaysModal((p) => ({
      ...p,
      open: false,
    }));

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
      const salesRes = await api.get("/barbershop/product-sale-payouts/");
      setProductSales(asArray(salesRes.data));
    } catch {
      // нет продаж или ошибка — оставим пустой список
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

      // 🔥 после новой продажи перезагружаем агрегаты по товарам
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
    setProductModal({
      open: true,
      employeeId: row.id,
      employeeName: row.name,
    });
    // всегда грузим актуальные данные по товарам и продажам
    loadProductData();
  };

  const closeProductModal = () =>
    setProductModal((p) => ({
      ...p,
      open: false,
    }));

  const productPayoutsForModal = useMemo(() => {
    if (!productSales.length) return [];

    return productSales
      .filter((p) => {
        const ym = y_m_fromISO(p.created_at);
        if (!ym) return false;
        const samePeriod =
          ym.y === Number(year) && ym.m === Number(month);
        if (!samePeriod) return false;

        if (!productModal.employeeId) return true;

        const sameEmployeeId =
          String(p.employee) === String(productModal.employeeId);
        const sameEmployeeName =
          String(p.employee_name || "").trim() ===
          String(productModal.employeeName || "").trim();

        return sameEmployeeId || sameEmployeeName;
      })
      .sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      )
      .map((p) => ({
        ...p,
        dateFormatted: dateKG(p.created_at),
      }));
  }, [
    productSales,
    productModal.employeeId,
    productModal.employeeName,
    year,
    month,
  ]);

  const yearOptions = useYearOptions(year);

  return (
    <section className="recordarates" aria-label="Выплаты мастерам">
      <header className="recordarates__header">
        <div className="recordarates__filters">
          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Месяц</span>
            <RRSelect
              value={String(month)}
              onChange={(val) => {
                onChangeMonth?.(Number(val));
                setPage(1);
              }}
              options={MONTHS.map((m, i) => ({
                value: String(i + 1),
                label: m,
              }))}
              placeholder="Месяц"
            />
          </label>

          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Год</span>
            <RRSelect
              value={String(year)}
              onChange={(val) => {
                onChangeYear?.(Number(val));
                setPage(1);
              }}
              options={yearOptions.map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              placeholder="Год"
            />
          </label>
        </div>

        <button
          className="recordarates__btn recordarates__btn--primary"
          onClick={handleSave}
          disabled={ratesLoading}
          type="button"
        >
          <FaSync />
          <span className="recordarates__btnText">
            {ratesLoading ? "Сохранение…" : "Сохранить ставки"}
          </span>
        </button>
      </header>

      {ratesError && <div className="recordarates__alert">{ratesError}</div>}

      <div className="recordarates__tableWrap">
        <table className="recordarates__table">
          <thead>
            <tr>
              <th>Мастер</th>
              <th>Завершено</th>
              <th>Запись</th>
              <th>Фикс.</th>
              <th>%</th>
              <th>Выручка</th>
              <th>К выплате</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{fmtInt(r.completed)}</td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.perRecord}
                    onChange={(e) =>
                      handleRateChange(r.id, "perRecord", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.fixed}
                    onChange={(e) =>
                      handleRateChange(r.id, "fixed", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.percent}
                    onChange={(e) =>
                      handleRateChange(r.id, "percent", e.target.value)
                    }
                  />
                </td>
                <td>{fmtMoney(r.revenue)}</td>
                <td>
                  <b>{fmtMoney(r.total)}</b>
                </td>
                <td>
                  <div className="recordarates__actions">
                    <button
                      type="button"
                      className="recordarates__link"
                      onClick={() => openDays(r)}
                    >
                      Дни
                    </button>
                    <button
                      type="button"
                      className="recordarates__link"
                      onClick={() => openProductModal(r)}
                    >
                      Товар
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td className="recordarates__muted" colSpan={8}>
                  Нет мастеров.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <nav className="recordarates__pager" aria-label="Пагинация">
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            type="button"
          >
            Назад
          </button>
          <span className="recordarates__pageInfo">
            Стр. {safePage}/{totalPages}
          </span>
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            type="button"
          >
            Далее
          </button>
        </nav>
      )}

      <div className="recordarates__summary">
        <span className="recordarates__summaryLabel">
          Итого фонд выплат:
        </span>
        <span className="recordarates__summaryValue">
          {fmtMoney(totals)}
        </span>
      </div>

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
    </section>
  );
};

export default RecordaRates;
