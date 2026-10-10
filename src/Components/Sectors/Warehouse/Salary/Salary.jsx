import { Percent, RefreshCw, Save, Search, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import { fetchBranchesAsync } from "../../../../store/creators/branchCreators";
import {
  listCashRegisters,
  listCompanyAgentRequests,
  listWarehouses,
} from "../../../../api/warehouse";
import {
  createSalaryPayout,
  getSalarySummary,
  listSalaryAccruals,
  listSalaryPayouts,
  listSalaryRates,
  updateSalaryRate,
} from "../../../../api/warehouseSalary";
import { usePersistedState } from "../../../../hooks/usePersistedState";
import { monthAgoLocalISODate, toLocalISODate } from "../utils/localDate";
import { companyAgentOptions } from "../utils/useCompanyAgents";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./Salary.scss";

const TABS = {
  ACCRUALS: "accruals",
  RATES: "rates",
  PAYOUTS: "payouts",
};

const SALE_TYPE_LABELS = {
  retail: "Розница",
  wholesale: "Опт",
};

const STATUS_LABELS = {
  pending: "Ожидает оплаты",
  accrued: "Начислено",
  paid: "Выплачено",
  canceled: "Отменено",
};

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const fmtMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Локальная дата: toISOString() давал UTC, и с 00:00 до 06:00 по Бишкеку «сегодня» было вчера
const monthAgoISO = () => monthAgoLocalISODate();

const todayISO = () => toLocalISODate();

const errorText = (e) => {
  const detail = e?.detail || e?.message;
  return typeof detail === "string" && detail
    ? detail
    : "Не удалось загрузить данные";
};

/** Раздел ещё не реализован на сервере (404 от API). */
const isNotReady = (e) => e?.status === 404;

const Salary = () => {
  const dispatch = useDispatch();
  const { profile } = useUser();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  const { list: branches = [] } = useSelector(
    (state) => state.branches || { list: [] },
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab =
    isOwnerOrAdmin && tabParam === TABS.RATES
      ? TABS.RATES
      : tabParam === TABS.PAYOUTS
        ? TABS.PAYOUTS
        : TABS.ACCRUALS;

  const setTab = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next === TABS.ACCRUALS) sp.delete("tab");
          else sp.set("tab", next);
          sp.delete("page");
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // ---------- Фильтры ----------
  const [dateFrom, setDateFrom] = usePersistedState(
    "warehouse:salary:dateFrom",
    monthAgoISO,
  );
  const [dateTo, setDateTo] = usePersistedState(
    "warehouse:salary:dateTo",
    todayISO,
  );
  const [agentFilter, setAgentFilter] = usePersistedState(
    "warehouse:salary:agentFilter",
    "",
  );
  const [warehouseFilter, setWarehouseFilter] = usePersistedState(
    "warehouse:salary:warehouseFilter",
    "",
  );
  const [branchFilter, setBranchFilter] = usePersistedState(
    "warehouse:salary:branchFilter",
    "",
  );
  const effectiveBranchFilter = isOwnerOrAdmin ? branchFilter : "";
  const [saleTypeFilter, setSaleTypeFilter] = usePersistedState(
    "warehouse:salary:saleTypeFilter",
    "",
  );
  const [statusFilter, setStatusFilter] = usePersistedState(
    "warehouse:salary:statusFilter",
    "",
  );
  const [search, setSearch] = usePersistedState("warehouse:salary:search", "");
  const [page, setPage] = useState(1);
  const didInitBranchFilter = useRef(false);

  // ---------- Справочники ----------
  const [agents, setAgents] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { page_size: 1000 };
        if (effectiveBranchFilter) params.branch = effectiveBranchFilter;
        const data = await listWarehouses(params);
        if (!cancelled) setWarehouses(normalizeList(data));
      } catch {
        if (!cancelled) setWarehouses([]);
      }
    })();
    if (isOwnerOrAdmin) {
      (async () => {
        try {
          const data = await listCompanyAgentRequests({ status: "active" });
          // QA B17: у одного агента бывает несколько членств (заявок) —
          // companyAgentOptions схлопывает их по id пользователя
          if (!cancelled) setAgents(companyAgentOptions(data));
        } catch {
          if (!cancelled) setAgents([]);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchFilter, isOwnerOrAdmin]);

  useEffect(() => {
    if (isOwnerOrAdmin && branches.length === 0) {
      dispatch(fetchBranchesAsync({ page_size: 1000 }));
    }
  }, [branches.length, dispatch, isOwnerOrAdmin]);

  const agentOptions = useMemo(
    () => agents.map((a) => ({ id: a.id, label: a.name })),
    [agents],
  );

  const agentLabelById = useMemo(() => {
    const map = new Map();
    agentOptions.forEach((a) => map.set(String(a.id), a.label));
    return map;
  }, [agentOptions]);

  // ---------- Сводка ----------
  const [summary, setSummary] = useState(null);

  // ---------- Начисления ----------
  const [accruals, setAccruals] = useState([]);
  const [accrualsCount, setAccrualsCount] = useState(0);
  const [accrualsHasNext, setAccrualsHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);

  const periodParams = useMemo(() => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (effectiveBranchFilter) params.branch = effectiveBranchFilter;
    return params;
  }, [dateFrom, dateTo, effectiveBranchFilter]);

  const loadAccruals = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = { ...periodParams, page };
    if (agentFilter) params.agent = agentFilter;
    if (warehouseFilter) params.warehouse = warehouseFilter;
    if (saleTypeFilter) params.sale_type = saleTypeFilter;
    if (statusFilter) params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    try {
      const [accrualsData, summaryData] = await Promise.all([
        listSalaryAccruals(params),
        getSalarySummary({
          ...periodParams,
          ...(agentFilter ? { agent: agentFilter } : {}),
          ...(warehouseFilter ? { warehouse: warehouseFilter } : {}),
        }),
      ]);
      setAccruals(normalizeList(accrualsData));
      setAccrualsCount(
        accrualsData?.count ?? normalizeList(accrualsData).length,
      );
      setAccrualsHasNext(Boolean(accrualsData?.next));
      setSummary(summaryData || null);
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setError(errorText(e));
      setAccruals([]);
      setAccrualsCount(0);
      setAccrualsHasNext(false);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [
    periodParams,
    page,
    agentFilter,
    warehouseFilter,
    saleTypeFilter,
    statusFilter,
    search,
  ]);

  useEffect(() => {
    if (tab === TABS.ACCRUALS) loadAccruals();
  }, [tab, loadAccruals]);

  // ---------- Ставки складов ----------
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [rateDrafts, setRateDrafts] = useState({});
  const [rateSaving, setRateSaving] = useState({});
  const [ratesSearch, setRatesSearch] = usePersistedState(
    "warehouse:salary:ratesSearch",
    "",
  );

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const data = await listSalaryRates(
        effectiveBranchFilter ? { branch: effectiveBranchFilter } : {},
      );
      setRates(normalizeList(data));
      setRateDrafts({});
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setRatesError(errorText(e));
      setRates([]);
    } finally {
      setRatesLoading(false);
    }
  }, [effectiveBranchFilter]);

  useEffect(() => {
    if (tab === TABS.RATES && isOwnerOrAdmin) loadRates();
  }, [tab, isOwnerOrAdmin, loadRates]);

  const visibleRates = useMemo(() => {
    const q = ratesSearch.trim().toLowerCase();
    if (!q) return rates;
    return rates.filter((r) =>
      String(r.warehouse_name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [rates, ratesSearch]);

  const getDraft = (rate) =>
    rateDrafts[rate.warehouse] ?? {
      retail_percent: rate.retail_percent ?? "0",
      wholesale_percent: rate.wholesale_percent ?? "0",
    };

  const setDraftField = (warehouseId, field, value) => {
    setRateDrafts((prev) => {
      const rate = rates.find((r) => r.warehouse === warehouseId);
      const base = prev[warehouseId] ?? {
        retail_percent: rate?.retail_percent ?? "0",
        wholesale_percent: rate?.wholesale_percent ?? "0",
      };
      return { ...prev, [warehouseId]: { ...base, [field]: value } };
    });
  };

  const isDraftDirty = (rate) => {
    const draft = rateDrafts[rate.warehouse];
    if (!draft) return false;
    return (
      String(draft.retail_percent) !== String(rate.retail_percent ?? "0") ||
      String(draft.wholesale_percent) !== String(rate.wholesale_percent ?? "0")
    );
  };

  const validPercent = (value) => {
    const num = Number(String(value).replace(",", "."));
    return Number.isFinite(num) && num >= 0 && num <= 100;
  };

  const handleSaveRate = async (rate) => {
    const draft = getDraft(rate);
    if (
      !validPercent(draft.retail_percent) ||
      !validPercent(draft.wholesale_percent)
    ) {
      setRatesError("Процент должен быть числом от 0 до 100");
      return;
    }
    setRatesError("");
    setRateSaving((prev) => ({ ...prev, [rate.warehouse]: true }));
    try {
      const updated = await updateSalaryRate(rate.warehouse, {
        retail_percent: String(draft.retail_percent).replace(",", "."),
        wholesale_percent: String(draft.wholesale_percent).replace(",", "."),
      });
      setRates((prev) =>
        prev.map((r) =>
          r.warehouse === rate.warehouse ? { ...r, ...updated } : r,
        ),
      );
      setRateDrafts((prev) => {
        const next = { ...prev };
        delete next[rate.warehouse];
        return next;
      });
    } catch (e) {
      console.error(e);
      setRatesError(errorText(e));
    } finally {
      setRateSaving((prev) => ({ ...prev, [rate.warehouse]: false }));
    }
  };

  // ---------- Выплаты ----------
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState("");
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    agent: "",
    amount: "",
    comment: "",
    cash_register: "",
  });
  // Кассы для выплаты: при выборе кассы бэкенд проводит расход «Зарплата агентам»
  const [cashRegisters, setCashRegisters] = useState([]);
  const [cashRegistersLoading, setCashRegistersLoading] = useState(false);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutFormError, setPayoutFormError] = useState("");

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    setPayoutsError("");
    try {
      const data = await listSalaryPayouts(periodParams);
      setPayouts(normalizeList(data));
      setNotReady(false);
    } catch (e) {
      console.error(e);
      if (isNotReady(e)) setNotReady(true);
      else setPayoutsError(errorText(e));
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, [periodParams]);

  useEffect(() => {
    if (tab === TABS.PAYOUTS) loadPayouts();
  }, [tab, loadPayouts]);

  useEffect(() => {
    if (!didInitBranchFilter.current) {
      didInitBranchFilter.current = true;
      return;
    }
    setWarehouseFilter("");
    setCashRegisters([]);
    setPayoutForm((prev) => ({ ...prev, cash_register: "" }));
    setPage(1);
  }, [effectiveBranchFilter, setWarehouseFilter]);

  const agentBalances = useMemo(() => {
    const byAgent = Array.isArray(summary?.by_agent) ? summary.by_agent : [];
    const map = new Map();
    byAgent.forEach((row) => {
      map.set(String(row.agent), row);
    });
    return map;
  }, [summary]);

  const loadCashRegisters = useCallback(async () => {
    setCashRegistersLoading(true);
    try {
      const params = { page_size: 200 };
      if (effectiveBranchFilter) params.branch = effectiveBranchFilter;
      const data = await listCashRegisters(params);
      setCashRegisters(normalizeList(data));
    } catch (e) {
      console.error(e);
      setCashRegisters([]);
    } finally {
      setCashRegistersLoading(false);
    }
  }, [effectiveBranchFilter]);

  const openPayoutModal = () => {
    setPayoutForm({ agent: "", amount: "", comment: "", cash_register: "" });
    setPayoutFormError("");
    setPayoutModalOpen(true);
    if (!cashRegisters.length) loadCashRegisters();
  };

  const handlePayoutAgentChange = (agentId) => {
    const balance = agentBalances.get(String(agentId));
    setPayoutForm((prev) => ({
      ...prev,
      agent: agentId,
      amount:
        balance?.balance != null && Number(balance.balance) > 0
          ? String(balance.balance)
          : prev.amount,
    }));
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutForm.agent) {
      setPayoutFormError("Выберите агента");
      return;
    }
    const amountNum = Number(String(payoutForm.amount).replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPayoutFormError("Сумма должна быть больше нуля");
      return;
    }
    setPayoutFormError("");
    setPayoutSubmitting(true);
    try {
      await createSalaryPayout({
        agent: payoutForm.agent,
        amount: String(amountNum),
        comment: payoutForm.comment.trim() || undefined,
        cash_register: payoutForm.cash_register || undefined,
        branch: effectiveBranchFilter || undefined,
      });
      setPayoutModalOpen(false);
      await loadPayouts();
    } catch (err) {
      console.error(err);
      setPayoutFormError(
        validateResErrors(err, "Не удалось выполнить выплату"),
      );
    } finally {
      setPayoutSubmitting(false);
    }
  };

  // ---------- Рендер ----------
  const totals = summary?.totals || {};

  const renderSummaryCards = () => (
    <div className="warehouse-salary__cards">
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">
          Начислено за период
        </span>
        <span className="warehouse-salary__card-value">
          {fmtMoney(totals.accrued_total)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">К выплате</span>
        <span className="warehouse-salary__card-value warehouse-salary__card-value--accent">
          {fmtMoney(totals.balance)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">Выплачено</span>
        <span className="warehouse-salary__card-value">
          {fmtMoney(totals.paid_total)}
        </span>
      </div>
      <div className="warehouse-salary__card">
        <span className="warehouse-salary__card-label">Продаж с процентом</span>
        <span className="warehouse-salary__card-value">
          {totals.accruals_count ?? "—"}
        </span>
      </div>
    </div>
  );

  const renderAgentSummaryTable = () => {
    const byAgent = Array.isArray(summary?.by_agent) ? summary.by_agent : [];
    if (!isOwnerOrAdmin || byAgent.length === 0) return null;
    return (
      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">Итоги по агентам</h3>
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Агент</th>
                <th>Розница</th>
                <th>Опт</th>
                <th>Начислено</th>
                <th>Выплачено</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {byAgent.map((row) => (
                <tr key={row.agent}>
                  <td>
                    {row.agent_name ||
                      agentLabelById.get(String(row.agent)) ||
                      row.agent}
                  </td>
                  <td>{fmtMoney(row.retail_amount)}</td>
                  <td>{fmtMoney(row.wholesale_amount)}</td>
                  <td>{fmtMoney(row.accrued_total)}</td>
                  <td>{fmtMoney(row.paid_total)}</td>
                  <td className="warehouse-salary__cell-accent">
                    {fmtMoney(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAccrualsTab = () => (
    <>
      <div className="warehouse-salary__filters">
        <label className="warehouse-salary__filter">
          С
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="warehouse-salary__filter">
          По
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {isOwnerOrAdmin && (
          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value);
              setPage(1);
            }}
            className="warehouse-salary__select"
          >
            <option value="">Все агенты</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        )}
        {isOwnerOrAdmin && (
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="warehouse-salary__select"
          >
            <option value="">Все филиалы</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name || branch.code || branch.id}
              </option>
            ))}
          </select>
        )}
        <select
          value={warehouseFilter}
          onChange={(e) => {
            setWarehouseFilter(e.target.value);
            setPage(1);
          }}
          className="warehouse-salary__select"
        >
          <option value="">Все склады</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={saleTypeFilter}
          onChange={(e) => {
            setSaleTypeFilter(e.target.value);
            setPage(1);
          }}
          className="warehouse-salary__select"
        >
          <option value="">Розница и опт</option>
          <option value="retail">Розница</option>
          <option value="wholesale">Опт</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="warehouse-salary__select"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="warehouse-salary__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по продаже…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {renderSummaryCards()}
      {renderAgentSummaryTable()}

      <div className="warehouse-salary__block">
        <h3 className="warehouse-salary__block-title">
          История начислений{accrualsCount ? ` (${accrualsCount})` : ""}
        </h3>
        {error && <div className="warehouse-salary__error">{error}</div>}
        <div className="warehouse-salary__table-wrap">
          <table className="warehouse-salary__table">
            <thead>
              <tr>
                <th>Дата</th>
                {isOwnerOrAdmin && <th>Агент</th>}
                <th>Продажа</th>
                <th>Склад</th>
                <th>Тип</th>
                <th>Сумма продажи</th>
                <th>Ставка</th>
                <th>Начислено</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 9 : 8}
                    className="warehouse-salary__empty"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : accruals.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 9 : 8}
                    className="warehouse-salary__empty"
                  >
                    Начислений за выбранный период нет.
                  </td>
                </tr>
              ) : (
                accruals.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.created_at)}</td>
                    {isOwnerOrAdmin && (
                      <td>
                        {a.agent_name ||
                          agentLabelById.get(String(a.agent)) ||
                          a.agent}
                      </td>
                    )}
                    <td>{a.sale_number || a.sale || "—"}</td>
                    <td>{a.warehouse_name || "—"}</td>
                    <td>{SALE_TYPE_LABELS[a.sale_type] || a.sale_type}</td>
                    <td>{fmtMoney(a.sale_amount)}</td>
                    <td>{fmtPercent(a.percent)}</td>
                    <td className="warehouse-salary__cell-accent">
                      {fmtMoney(a.amount)}
                    </td>
                    <td>
                      <span
                        className={`warehouse-salary__status warehouse-salary__status--${a.status}`}
                      >
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(page > 1 || accrualsHasNext) && (
          <div className="warehouse-salary__pagination">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span>Стр. {page}</span>
            <button
              type="button"
              disabled={!accrualsHasNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </button>
          </div>
        )}
      </div>
    </>
  );

  const renderRatesTab = () => (
    <div className="warehouse-salary__block">
      <div className="warehouse-salary__block-head">
        <h3 className="warehouse-salary__block-title">
          Процентные ставки складов
        </h3>
        <div className="warehouse-salary__block-head-actions">
          {isOwnerOrAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="warehouse-salary__select"
            >
              <option value="">Все филиалы</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.code || branch.id}
                </option>
              ))}
            </select>
          )}
          <div className="warehouse-salary__search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Поиск склада…"
              value={ratesSearch}
              onChange={(e) => setRatesSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <p className="warehouse-salary__hint">
        Ставка применяется к продажам агентов с товаром этого склада. Розница и
        опт считаются отдельно. Изменение ставки действует только на новые
        продажи — уже созданные начисления не пересчитываются.
      </p>
      {ratesError && (
        <div className="warehouse-salary__error">{ratesError}</div>
      )}
      <div className="warehouse-salary__table-wrap">
        <table className="warehouse-salary__table">
          <thead>
            <tr>
              <th>Склад</th>
              <th>Розница, %</th>
              <th>Опт, %</th>
              <th>Обновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ratesLoading ? (
              <tr>
                <td colSpan={5} className="warehouse-salary__empty">
                  Загрузка…
                </td>
              </tr>
            ) : visibleRates.length === 0 ? (
              <tr>
                <td colSpan={5} className="warehouse-salary__empty">
                  Склады не найдены.
                </td>
              </tr>
            ) : (
              visibleRates.map((rate) => {
                const draft = getDraft(rate);
                const dirty = isDraftDirty(rate);
                return (
                  <tr key={rate.warehouse}>
                    <td>{rate.warehouse_name}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="warehouse-salary__percent-input"
                        value={draft.retail_percent}
                        onChange={(e) =>
                          setDraftField(
                            rate.warehouse,
                            "retail_percent",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="warehouse-salary__percent-input"
                        value={draft.wholesale_percent}
                        onChange={(e) =>
                          setDraftField(
                            rate.warehouse,
                            "wholesale_percent",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>{fmtDateTime(rate.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="warehouse-salary__save-btn"
                        disabled={!dirty || rateSaving[rate.warehouse]}
                        onClick={() => handleSaveRate(rate)}
                      >
                        <Save size={14} />
                        {rateSaving[rate.warehouse]
                          ? "Сохранение…"
                          : "Сохранить"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPayoutsTab = () => (
    <div className="warehouse-salary__block">
      <div className="warehouse-salary__block-head">
        <h3 className="warehouse-salary__block-title">История выплат</h3>
        <div className="warehouse-salary__block-head-actions">
          <label className="warehouse-salary__filter">
            С
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="warehouse-salary__filter">
            По
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {isOwnerOrAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="warehouse-salary__select"
            >
              <option value="">Все филиалы</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.code || branch.id}
                </option>
              ))}
            </select>
          )}
          {isOwnerOrAdmin && (
            <button
              type="button"
              className="warehouse-salary__primary-btn"
              onClick={openPayoutModal}
            >
              <Wallet size={16} />
              Выплатить агенту
            </button>
          )}
        </div>
      </div>
      {payoutsError && (
        <div className="warehouse-salary__error">{payoutsError}</div>
      )}
      <div className="warehouse-salary__table-wrap">
        <table className="warehouse-salary__table">
          <thead>
            <tr>
              <th>Дата</th>
              {isOwnerOrAdmin && <th>Агент</th>}
              <th>Сумма</th>
              <th>Касса</th>
              <th>Комментарий</th>
              {isOwnerOrAdmin && <th>Кто выплатил</th>}
            </tr>
          </thead>
          <tbody>
            {payoutsLoading ? (
              <tr>
                <td
                  colSpan={isOwnerOrAdmin ? 6 : 4}
                  className="warehouse-salary__empty"
                >
                  Загрузка…
                </td>
              </tr>
            ) : payouts.length === 0 ? (
              <tr>
                <td
                  colSpan={isOwnerOrAdmin ? 6 : 4}
                  className="warehouse-salary__empty"
                >
                  Выплат за выбранный период нет.
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDateTime(p.created_at)}</td>
                  {isOwnerOrAdmin && (
                    <td>
                      {p.agent_name ||
                        agentLabelById.get(String(p.agent)) ||
                        p.agent}
                    </td>
                  )}
                  <td className="warehouse-salary__cell-accent">
                    {fmtMoney(p.amount)}
                  </td>
                  <td>
                    {p.cash_register_name ||
                      (p.money_document || p.cash_register
                        ? "Касса"
                        : "Вне кассы")}
                  </td>
                  <td>{p.comment || "—"}</td>
                  {isOwnerOrAdmin && <td>{p.created_by_name || "—"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPayoutModal = () => {
    if (!payoutModalOpen) return null;
    const balance = agentBalances.get(String(payoutForm.agent));
    return (
      <div
        className="warehouse-salary__modal-overlay"
        onClick={() => setPayoutModalOpen(false)}
      >
        <div
          className="warehouse-salary__modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="warehouse-salary__modal-head">
            <h3>Выплата агенту</h3>
            <button
              type="button"
              className="warehouse-salary__icon-btn"
              onClick={() => setPayoutModalOpen(false)}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handlePayoutSubmit}>
            <label className="warehouse-salary__field">
              Агент
              <select
                value={payoutForm.agent}
                onChange={(e) => handlePayoutAgentChange(e.target.value)}
              >
                <option value="">Выберите агента</option>
                {agentOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            {balance && (
              <p className="warehouse-salary__hint">
                К выплате по начислениям: {fmtMoney(balance.balance)}
              </p>
            )}
            <label className="warehouse-salary__field">
              Сумма
              <input
                type="number"
                min="0"
                step="0.01"
                value={payoutForm.amount}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
              />
            </label>
            <label className="warehouse-salary__field">
              Касса
              <select
                value={payoutForm.cash_register}
                disabled={cashRegistersLoading}
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    cash_register: e.target.value,
                  }))
                }
              >
                <option value="">Без кассы (выплата вне кассы)</option>
                {cashRegisters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.id}
                  </option>
                ))}
              </select>
            </label>
            <p className="warehouse-salary__hint">
              {payoutForm.cash_register
                ? "Из кассы будет проведён расход «Зарплата агентам» — он попадёт в кассу и аналитику."
                : "Выплата не попадёт в кассу и в «Расход по кассе»."}
            </p>
            <label className="warehouse-salary__field">
              Комментарий
              <input
                type="text"
                value={payoutForm.comment}
                placeholder="Необязательно"
                onChange={(e) =>
                  setPayoutForm((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
              />
            </label>
            {payoutFormError && (
              <div className="warehouse-salary__error">{payoutFormError}</div>
            )}
            <div className="warehouse-salary__modal-actions">
              <button
                type="button"
                className="warehouse-salary__secondary-btn"
                onClick={() => setPayoutModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="warehouse-salary__primary-btn"
                disabled={payoutSubmitting}
              >
                {payoutSubmitting ? "Выплата…" : "Выплатить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="warehouse-salary">
      <div className="warehouse-salary__header">
        <h2 className="warehouse-salary__title">
          {isOwnerOrAdmin ? "Зарплата агентов" : "Моя зарплата"}
        </h2>
        <button
          type="button"
          className="warehouse-salary__refresh"
          onClick={() => {
            if (tab === TABS.RATES) loadRates();
            else if (tab === TABS.PAYOUTS) loadPayouts();
            else loadAccruals();
          }}
          disabled={loading || ratesLoading || payoutsLoading}
          title="Обновить"
        >
          <RefreshCw size={18} />
          Обновить
        </button>
      </div>

      <div className="warehouse-salary__tabs">
        <button
          type="button"
          className={`warehouse-salary__tab ${tab === TABS.ACCRUALS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.ACCRUALS)}
        >
          Начисления
        </button>
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`warehouse-salary__tab ${tab === TABS.RATES ? "is-active" : ""}`}
            onClick={() => setTab(TABS.RATES)}
          >
            <Percent size={14} />
            Ставки складов
          </button>
        )}
        <button
          type="button"
          className={`warehouse-salary__tab ${tab === TABS.PAYOUTS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.PAYOUTS)}
        >
          Выплаты
        </button>
      </div>

      {notReady && (
        <div className="warehouse-salary__notice">
          Раздел «Зарплата» ещё не активирован на сервере. Данные появятся после
          обновления бэкенда (см. docs/warehouse/salary.md).
        </div>
      )}

      {tab === TABS.RATES && isOwnerOrAdmin
        ? renderRatesTab()
        : tab === TABS.PAYOUTS
          ? renderPayoutsTab()
          : renderAccrualsTab()}

      {renderPayoutModal()}
    </div>
  );
};

export default Salary;
