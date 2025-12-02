// BarberAnalitikaData.js
import { useEffect, useMemo, useState } from "react";
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
import {
  toNum,
  take,
  asArray,
  clean,
  keyOf,
  pad2,
  monthRange,
  tsOf,
  fetchAllConstructionCashflows,
} from "./BarberAnalitikaUtils";

const SALE_PAYOUTS_EP = "/barbershop/sale-payouts/";

export const useBarberAnalitikaData = ({ year, monthIdx }) => {
  const dispatch = useDispatch();
  const { history, historyObjects } = useSale();
  const { list: products } = useSelector((s) => s.product);

  const { startTs, endTs } = useMemo(
    () => monthRange(year, monthIdx),
    [year, monthIdx]
  );

  const periodLabel = useMemo(
    () => `${year}-${pad2(monthIdx + 1)}`,
    [year, monthIdx]
  );

  /* ===== загрузка каталога (продажи + товары) ===== */
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(historySellObjects({ search: "" }));
    dispatch(fetchProductsAsync({}));
  }, [dispatch]);

  /* ===== загрузка данных барбершопа ===== */
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
            const disp =
              [last, first].filter(Boolean).join(" ").trim() ||
              e.email ||
              "—";
            return { id: e.id, name: disp };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "ru"));

        const normSvc = svcs.map((s) => ({
          id: s.id,
          name: s.service_name || s.name || "—",
          price: s.price,
        }));

        if (!cancelled) {
          setAppointments(apps);
          setEmployees(normEmp);
          setServices(normSvc);
          setClientsBarber(clBarber);
          setClientsMarket(clMarket);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setErrorMsg("Не удалось загрузить данные барбершопа.");
          setAppointments([]);
          setEmployees([]);
          setServices([]);
          setClientsBarber([]);
          setClientsMarket([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, monthIdx]);

  /* ===== фонд выплат из /barbershop/sale-payouts/ ===== */
  const [saleFund, setSaleFund] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(SALE_PAYOUTS_EP);

        // только текущий период
        const rows = asArray(data).filter(
          (r) => String(r.period) === String(periodLabel)
        );

        if (cancelled) return;

        if (!rows.length) {
          setSaleFund(0);
          return;
        }

        // если несколько записей — берём последнюю
        const last = rows[rows.length - 1];
        const fund = toNum(
          last?.new_total_fund ?? last?.total_fund ?? last?.total ?? 0
        );

        setSaleFund(fund);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSaleFund(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodLabel]);

  /* ===== lookups ===== */
  const svcById = (id) =>
    services.find((x) => String(x.id) === String(id));

  const priceOf = (a) => {
    const svc = svcById(a.service);
    const p = a?.service_price ?? a?.price ?? svc?.price;
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  };

  const servicesOfAppointment = (a) => {
    const rows = [];

    if (Array.isArray(a.services) && a.services.length) {
      a.services.forEach((s) => {
        if (!s) return;

        const rawId =
          typeof s === "object" ? s.id ?? s.service ?? s.service_id : s;
        const id = rawId != null ? String(rawId) : "";

        const meta = typeof s === "object" ? s : svcById(id);
        const name =
          meta?.service_name ||
          meta?.name ||
          a.service_name ||
          (id ? svcById(id)?.name : "") ||
          "—";

        const price = toNum(
          (typeof s === "object" && (s.price ?? s.amount ?? s.total)) ??
            a.service_price ??
            a.price ??
            meta?.price ??
            0
        );

        if (!id && name === "—") return;
        rows.push({ key: id || name, name, price });
      });

      return rows;
    }

    if (a.service || a.service_name) {
      const id = a.service ? String(a.service) : "";
      const meta = svcById(id);
      const name =
        a.service_name || meta?.name || (id ? `ID ${id}` : "—");
      const price = priceOf(a);
      rows.push({ key: id || name, name, price });
    }

    return rows;
  };

  const empName = (id) =>
    employees.find((x) => String(x.id) === String(id))?.name ||
    `ID ${id}`;

  const clientNameBarber = (id) => {
    const c = clientsBarber.find((x) => String(x.id) === String(id));
    return c?.full_name || c?.name || `ID ${id}`;
  };

  const isSupplierLike = (c = {}) => {
    if (
      c.is_supplier === true ||
      c.isVendor === true ||
      c.supplier === true
    )
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

  /* ===== фильтр за период ===== */
  const filteredApps = useMemo(
    () =>
      appointments.filter((a) => {
        const t = tsOf(a);
        return t >= startTs && t <= endTs;
      }),
    [appointments, startTs, endTs]
  );

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

  /* ===== агрегаты по мастерам (для рейтингов) ===== */
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

  /* ===== рейтинги ===== */
  const COUNTABLE_FOR_RANK = useMemo(
    () => new Set(["booked", "confirmed", "completed", "no_show"]),
    []
  );

  const rankBarbers = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.barber);
      if (!key) return;
      const rec =
        m.get(key) || { id: key, name: empName(key), count: 0, sum: 0 };
      if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
      if (a.status === "completed") rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort(
      (x, y) => y.sum - x.sum || y.count - x.count
    );
  }, [filteredApps, employees, COUNTABLE_FOR_RANK]);

  const rankServices = useMemo(() => {
    const m = new Map();

    filteredApps.forEach((a) => {
      const svcList = servicesOfAppointment(a);
      if (!svcList.length) return;

      svcList.forEach(({ key, name, price }) => {
        const id = key || name;
        const rec =
          m.get(id) || {
            id,
            name,
            count: 0,
            sum: 0,
          };

        if (COUNTABLE_FOR_RANK.has(a.status)) rec.count += 1;
        if (a.status === "completed") rec.sum += price;

        m.set(id, rec);
      });
    });

    return [...m.values()].sort(
      (x, y) => y.sum - x.sum || y.count - x.count
    );
  }, [filteredApps, services, COUNTABLE_FOR_RANK]);

  const rankClientsVisits = useMemo(() => {
    const m = new Map();
    filteredApps.forEach((a) => {
      const key = String(a.client);
      if (!key || a.status !== "completed") return;
      const rec =
        m.get(key) || {
          id: key,
          name: clientNameBarber(key),
          count: 0,
          sum: 0,
        };
      rec.count += 1;
      rec.sum += priceOf(a);
      m.set(key, rec);
    });
    return [...m.values()].sort(
      (x, y) => y.sum - x.sum || y.count - x.count
    );
  }, [filteredApps, clientsBarber]);

  /* ===== helper для направления кэшфлоу ===== */
  const dirOf = (cf) => {
    const raw = String(cf.type ?? cf.kind ?? cf.direction ?? "")
      .trim()
      .toLowerCase();
    if (raw === "income" || raw === "приход") return "income";
    if (raw === "expense" || raw === "расход") return "expense";

    const amt = toNum(cf.amount ?? cf.value ?? cf.sum ?? 0);
    return amt >= 0 ? "income" : "expense";
  };

  /* ===== кассы (без “Выплаты мастерам YYYY-MM”) ===== */
  const [cashRows, setCashRows] = useState([]);
  const [cashflowsPeriod, setCashflowsPeriod] = useState([]);
  const [loadingCash, setLoadingCash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCash(true);
      try {
        const flows = await fetchAllConstructionCashflows();

        const label = `Выплаты мастерам ${periodLabel}`;
        const isMasterPayoutFlow = (cf) => {
          const desc = String(
            cf.description ?? cf.note ?? cf.comment ?? ""
          ).toLowerCase();
          return desc.includes(label.toLowerCase());
        };

        const periodFlowsRaw = flows.filter((cf) => {
          const t = tsOf(cf);
          return t >= startTs && t <= endTs;
        });

        // выкидываем запись “Выплаты мастерам YYYY-MM”
        const periodFlows = periodFlowsRaw.filter(
          (cf) => !isMasterPayoutFlow(cf)
        );

        if (!cancelled) setCashflowsPeriod(periodFlows);

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
          const direction = dirOf(cf);
          const amountAbs = Math.abs(
            toNum(cf.amount ?? cf.value ?? cf.sum ?? 0)
          );

          const prev = m.get(id) || { income: 0, expense: 0, ops: 0 };
          m.set(id, {
            income:
              prev.income + (direction === "income" ? amountAbs : 0),
            expense:
              prev.expense + (direction === "expense" ? amountAbs : 0),
            ops: prev.ops + 1,
          });
        }

        const rows = Array.from(m, ([id, v]) => {
          const meta = boxes.find(
            (b) => String(b.id || b.uuid) === id
          );
          const name = clean(
            meta?.department_name ||
              meta?.name ||
              (id ? `Касса #${id}` : "—"),
            "—"
          );
          return {
            name,
            ops: v.ops,
            income: v.income,
            expense: v.expense,
          };
        }).sort((a, b) => b.income - a.income);

        if (!cancelled) setCashRows(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setCashRows([]);
          setCashflowsPeriod([]);
        }
      } finally {
        if (!cancelled) setLoadingCash(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startTs, endTs, periodLabel]);

  const cashTotals = useMemo(() => {
    const income = cashRows.reduce((a, r) => a + toNum(r.income), 0);
    const expense = cashRows.reduce((a, r) => a + toNum(r.expense), 0);
    return { income, expense, net: income - expense };
  }, [cashRows]);

  /* ===== продажи товаров ===== */
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
        m.set(k, {
          qty: prev.qty + qty,
          revenue: prev.revenue + revenue,
        });
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
            const d1 = await dispatch(
              historySellProductDetail(id)
            ).unwrap();
            (Array.isArray(d1?.items) ? d1.items : []).forEach(addItem);
          } catch (e) {
            console.error(e);
          }
          try {
            const d2 = await dispatch(
              historySellObjectDetail(id)
            ).unwrap();
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
    return () => {
      cancelled = true;
    };
  }, [periodSales, dispatch]);

  /* ===== KPI склада ===== */
  const stockKpis = useMemo(() => {
    const list = products || [];
    const positions = list.length;
    const totalQty = list.reduce(
      (a, p) => a + toNum(p.quantity),
      0
    );
    const stockValueRetail = list.reduce(
      (a, p) => a + toNum(p.price) * toNum(p.quantity),
      0
    );
    return { positions, totalQty, stockValueRetail };
  }, [products]);

  /* ===== поставщики и клиенты продаж ===== */
  const suppliersRows = useMemo(() => {
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
      const unit =
        p.purchase_price != null
          ? toNum(p.purchase_price)
          : toNum(p.price);
      const sum = unit * toNum(p.quantity);
      const prev = m.get(k) || { sum: 0, items: 0 };
      m.set(k, { sum: prev.sum + sum, items: prev.items + 1 });
    }
    return Array.from(m, ([k, v]) => ({
      name: names.get(k) || "—",
      items: v.items,
      amount: v.sum,
    })).sort((a, b) => b.amount - a.amount);
  }, [products, startTs, endTs]);

  const clientsSalesRows = useMemo(() => {
    const m = new Map();
    const names = new Map();
    for (const s of periodSales) {
      const disp = clean(s.client_name || s.client, "Без имени");
      const k = keyOf(disp, "без имени");
      names.set(k, disp);
      const prev = m.get(k) || { sum: 0, cnt: 0 };
      m.set(k, {
        sum: prev.sum + toNum(s.total),
        cnt: prev.cnt + 1,
      });
    }
    return Array.from(m, ([k, v]) => ({
      name: names.get(k) || "—",
      orders: v.cnt,
      revenue: v.sum,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [periodSales]);

  /* ===== доп. агрегаты для новых блоков интерфейса ===== */
  const goodsSummary = useMemo(() => {
    const totalQty = productsRowsAgg.reduce(
      (a, r) => a + toNum(r.qty),
      0
    );
    const totalRevenue = productsRowsAgg.reduce(
      (a, r) => a + toNum(r.revenue),
      0
    );
    return { totalQty, totalRevenue };
  }, [productsRowsAgg]);

  const salesClientsSummary = useMemo(() => {
    const activeClients = clientsSalesRows.length;
    const totalRevenue = clientsSalesRows.reduce(
      (a, r) => a + toNum(r.revenue),
      0
    );
    return { activeClients, totalRevenue };
  }, [clientsSalesRows]);

  /* ===== записи по дням недели (Пн–Вс) ===== */
  const weekChart = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredApps.forEach((a) => {
      const t = tsOf(a);
      if (!t) return;
      const d = new Date(t);
      const idx = (d.getDay() + 6) % 7; // 0=Пн
      counts[idx] += 1;
    });
    return counts;
  }, [filteredApps]);

  /* ===== динамика доходов/расходов по дням месяца ===== */
  const dayLineChart = useMemo(() => {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const income = Array(daysInMonth).fill(0);
    const expense = Array(daysInMonth).fill(0);

    // 1) Доход от завершённых записей
    filteredApps.forEach((a) => {
      if (a.status !== "completed") return;
      const t = tsOf(a);
      if (!t) return;
      const d = new Date(t);
      const idx = d.getDate() - 1;
      if (idx < 0 || idx >= daysInMonth) return;
      income[idx] += priceOf(a);
    });

    // 2) Кассовые операции (уже без “Выплаты мастерам YYYY-MM”)
    cashflowsPeriod.forEach((cf) => {
      const t = tsOf(cf);
      if (!t) return;
      const d = new Date(t);
      const idx = d.getDate() - 1;
      if (idx < 0 || idx >= daysInMonth) return;

      const direction = dirOf(cf);
      const amountAbs = Math.abs(
        toNum(cf.amount ?? cf.value ?? cf.sum ?? 0)
      );

      if (direction === "income") income[idx] += amountAbs;
      else if (direction === "expense") expense[idx] += amountAbs;
    });

    return {
      labels: Array.from({ length: daysInMonth }, (_, i) =>
        String(i + 1)
      ),
      income,
      expense,
    };
  }, [filteredApps, cashflowsPeriod, year, monthIdx]);

  /* ===== итог: единый приход/расход ===== */
  const unifiedIncome = completedSum + cashTotals.income;
  const unifiedExpense = saleFund + cashTotals.expense;

  return {
    loading,
    errorMsg,
    totalApps,
    totalServices,
    totalClientsBarber,
    totalClientsMarket,
    completedCount,
    completedSum,
    canceledCount,
    noShowCount,
    rankBarbers,
    rankServices,
    rankClientsVisits,
    stockKpis,
    cashRows,
    loadingCash,
    cashTotals,
    productsRowsAgg,
    loadingProducts,
    suppliersRows,
    clientsSalesRows,
    unifiedIncome,
    unifiedExpense,
    goodsSummary,
    salesClientsSummary,
    saleFund,
    weekChart,
    dayLineChart,
  };
};
