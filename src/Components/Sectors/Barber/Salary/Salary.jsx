import { Percent, RefreshCw, Save, Search, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import api from "../../../../api";
import {
  createSalaryPayout,
  getSalarySummary,
  listSalaryAccruals,
  listSalaryPayouts,
  listSalaryRates,
  updateSalaryRate,
} from "../../../../api/servicesSalary";
import "./Salary.scss";

const TABS = {
  ACCRUALS: "accruals",
  RATES: "rates",
  PAYOUTS: "payouts",
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

const employeeName = (e) => {
  const name = [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim();
  return name || e?.email || "—";
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

const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const errorText = (e) => {
  const detail = e?.detail || e?.message;
  return typeof detail === "string" && detail
    ? detail
    : "Не удалось загрузить данные";
};

/** Раздел ещё не реализован на сервере (404 от API). */
const isNotReady = (e) => e?.status === 404;

const Salary = () => {
  const { profile } = useUser();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

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
  const [dateFrom, setDateFrom] = useState(monthAgoISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [masterFilter, setMasterFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ---------- Справочники ----------
  const [masters, setMasters] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/barbershop/services/", {
          params: { page_size: 1000, ordering: "service_name" },
        });
        if (!cancelled) setServices(normalizeList(data));
      } catch {
        if (!cancelled) setServices([]);
      }
    })();
    if (isOwnerOrAdmin) {
      (async () => {
        try {
          const { data } = await api.get("/users/employees/", {
            params: { page_size: 1000, ordering: "last_name,first_name" },
          });
          if (!cancelled) setMasters(normalizeList(data));
        } catch {
          if (!cancelled) setMasters([]);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [isOwnerOrAdmin]);

  const masterOptions = useMemo(
    () => masters.map((m) => ({ id: m.id, label: employeeName(m) })),
    [masters],
  );

  const masterLabelById = useMemo(() => {
    const map = new Map();
    masterOptions.forEach((m) => map.set(String(m.id), m.label));
    return map;
  }, [masterOptions]);

  const serviceOptions = useMemo(
    () =>
      services.map((s) => ({
        id: s.id,
        label: s.service_name || s.name || "—",
      })),
    [services],
  );

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
    return params;
  }, [dateFrom, dateTo]);

  const loadAccruals = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = { ...periodParams, page };
    if (masterFilter) params.master = masterFilter;
    if (serviceFilter) params.service = serviceFilter;
    if (statusFilter) params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    try {
      const [accrualsData, summaryData] = await Promise.all([
        listSalaryAccruals(params),
        getSalarySummary({
          ...periodParams,
          ...(masterFilter ? { master: masterFilter } : {}),
          ...(serviceFilter ? { service: serviceFilter } : {}),
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
  }, [periodParams, page, masterFilter, serviceFilter, statusFilter, search]);

  useEffect(() => {
    if (tab === TABS.ACCRUALS) loadAccruals();
  }, [tab, loadAccruals]);

  // ---------- Ставки услуг ----------
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [rateDrafts, setRateDrafts] = useState({});
  const [rateSaving, setRateSaving] = useState({});
  const [ratesSearch, setRatesSearch] = useState("");

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const data = await listSalaryRates();
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
  }, []);

  useEffect(() => {
    if (tab === TABS.RATES && isOwnerOrAdmin) loadRates();
  }, [tab, isOwnerOrAdmin, loadRates]);

  const visibleRates = useMemo(() => {
    const q = ratesSearch.trim().toLowerCase();
    if (!q) return rates;
    return rates.filter((r) =>
      String(r.service_name || "").toLowerCase().includes(q),
    );
  }, [rates, ratesSearch]);

  const getDraft = (rate) =>
    rateDrafts[rate.service] ?? { percent: rate.percent ?? "0" };

  const setDraftField = (serviceId, value) => {
    setRateDrafts((prev) => {
      const rate = rates.find((r) => r.service === serviceId);
      const base = prev[serviceId] ?? { percent: rate?.percent ?? "0" };
      return { ...prev, [serviceId]: { ...base, percent: value } };
    });
  };

  const isDraftDirty = (rate) => {
    const draft = rateDrafts[rate.service];
    if (!draft) return false;
    return String(draft.percent) !== String(rate.percent ?? "0");
  };

  const validPercent = (value) => {
    const num = Number(String(value).replace(",", "."));
    return Number.isFinite(num) && num >= 0 && num <= 100;
  };

  const handleSaveRate = async (rate) => {
    const draft = getDraft(rate);
    if (!validPercent(draft.percent)) {
      setRatesError("Процент должен быть числом от 0 до 100");
      return;
    }
    setRatesError("");
    setRateSaving((prev) => ({ ...prev, [rate.service]: true }));
    try {
      const updated = await updateSalaryRate(rate.service, {
        percent: String(draft.percent).replace(",", "."),
      });
      setRates((prev) =>
        prev.map((r) => (r.service === rate.service ? { ...r, ...updated } : r)),
      );
      setRateDrafts((prev) => {
        const next = { ...prev };
        delete next[rate.service];
        return next;
      });
    } catch (e) {
      console.error(e);
      setRatesError(errorText(e));
    } finally {
      setRateSaving((prev) => ({ ...prev, [rate.service]: false }));
    }
  };

  // ---------- Выплаты ----------
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState("");
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    master: "",
    amount: "",
    comment: "",
  });
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

  const masterBalances = useMemo(() => {
    const byMaster = Array.isArray(summary?.by_master) ? summary.by_master : [];
    const map = new Map();
    byMaster.forEach((row) => {
      map.set(String(row.master), row);
    });
    return map;
  }, [summary]);

  const openPayoutModal = () => {
    setPayoutForm({ master: "", amount: "", comment: "" });
    setPayoutFormError("");
    setPayoutModalOpen(true);
  };

  const handlePayoutMasterChange = (masterId) => {
    const balance = masterBalances.get(String(masterId));
    setPayoutForm((prev) => ({
      ...prev,
      master: masterId,
      amount:
        balance?.balance != null && Number(balance.balance) > 0
          ? String(balance.balance)
          : prev.amount,
    }));
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutForm.master) {
      setPayoutFormError("Выберите сотрудника");
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
        master: payoutForm.master,
        amount: String(amountNum),
        comment: payoutForm.comment.trim() || undefined,
      });
      setPayoutModalOpen(false);
      await loadPayouts();
    } catch (err) {
      console.error(err);
      setPayoutFormError(errorText(err));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  // ---------- Рендер ----------
  const totals = summary?.totals || {};

  const renderSummaryCards = () => (
    <div className="services-salary__cards">
      <div className="services-salary__card">
        <span className="services-salary__card-label">
          Начислено за период
        </span>
        <span className="services-salary__card-value">
          {fmtMoney(totals.accrued_total)}
        </span>
      </div>
      <div className="services-salary__card">
        <span className="services-salary__card-label">К выплате</span>
        <span className="services-salary__card-value services-salary__card-value--accent">
          {fmtMoney(totals.balance)}
        </span>
      </div>
      <div className="services-salary__card">
        <span className="services-salary__card-label">Выплачено</span>
        <span className="services-salary__card-value">
          {fmtMoney(totals.paid_total)}
        </span>
      </div>
      <div className="services-salary__card">
        <span className="services-salary__card-label">Услуг с процентом</span>
        <span className="services-salary__card-value">
          {totals.accruals_count ?? "—"}
        </span>
      </div>
    </div>
  );

  const renderMasterSummaryTable = () => {
    const byMaster = Array.isArray(summary?.by_master) ? summary.by_master : [];
    if (!isOwnerOrAdmin || byMaster.length === 0) return null;
    return (
      <div className="services-salary__block">
        <h3 className="services-salary__block-title">Итоги по сотрудникам</h3>
        <div className="services-salary__table-wrap">
          <table className="services-salary__table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Услуг</th>
                <th>Сумма услуг</th>
                <th>Начислено</th>
                <th>Выплачено</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {byMaster.map((row) => (
                <tr key={row.master}>
                  <td>
                    {row.master_name ||
                      masterLabelById.get(String(row.master)) ||
                      row.master}
                  </td>
                  <td>{row.accruals_count ?? "—"}</td>
                  <td>{fmtMoney(row.service_amount)}</td>
                  <td>{fmtMoney(row.accrued_total)}</td>
                  <td>{fmtMoney(row.paid_total)}</td>
                  <td className="services-salary__cell-accent">
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
      <div className="services-salary__filters">
        <label className="services-salary__filter">
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
        <label className="services-salary__filter">
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
            value={masterFilter}
            onChange={(e) => {
              setMasterFilter(e.target.value);
              setPage(1);
            }}
            className="services-salary__select"
          >
            <option value="">Все сотрудники</option>
            {masterOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        <select
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setPage(1);
          }}
          className="services-salary__select"
        >
          <option value="">Все услуги</option>
          {serviceOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="services-salary__select"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="services-salary__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по записи…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {renderSummaryCards()}
      {renderMasterSummaryTable()}

      <div className="services-salary__block">
        <h3 className="services-salary__block-title">
          История начислений{accrualsCount ? ` (${accrualsCount})` : ""}
        </h3>
        {error && <div className="services-salary__error">{error}</div>}
        <div className="services-salary__table-wrap">
          <table className="services-salary__table">
            <thead>
              <tr>
                <th>Дата</th>
                {isOwnerOrAdmin && <th>Сотрудник</th>}
                <th>Запись</th>
                <th>Услуга</th>
                <th>Сумма услуги</th>
                <th>Ставка</th>
                <th>Начислено</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 8 : 7}
                    className="services-salary__empty"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : accruals.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwnerOrAdmin ? 8 : 7}
                    className="services-salary__empty"
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
                        {a.master_name ||
                          masterLabelById.get(String(a.master)) ||
                          a.master}
                      </td>
                    )}
                    <td>{a.appointment_number || a.appointment || "—"}</td>
                    <td>{a.service_name || "—"}</td>
                    <td>{fmtMoney(a.service_amount)}</td>
                    <td>{fmtPercent(a.percent)}</td>
                    <td className="services-salary__cell-accent">
                      {fmtMoney(a.amount)}
                    </td>
                    <td>
                      <span
                        className={`services-salary__status services-salary__status--${a.status}`}
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
          <div className="services-salary__pagination">
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
    <div className="services-salary__block">
      <div className="services-salary__block-head">
        <h3 className="services-salary__block-title">
          Процентные ставки услуг
        </h3>
        <div className="services-salary__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск услуги…"
            value={ratesSearch}
            onChange={(e) => setRatesSearch(e.target.value)}
          />
        </div>
      </div>
      <p className="services-salary__hint">
        Ставка — процент, который получает мастер от стоимости оказанной услуги.
        Начисление создаётся при завершении записи. Изменение ставки действует
        только на новые записи — уже созданные начисления не пересчитываются.
      </p>
      {ratesError && <div className="services-salary__error">{ratesError}</div>}
      <div className="services-salary__table-wrap">
        <table className="services-salary__table">
          <thead>
            <tr>
              <th>Услуга</th>
              <th>Цена</th>
              <th>Ставка, %</th>
              <th>Обновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ratesLoading ? (
              <tr>
                <td colSpan={5} className="services-salary__empty">
                  Загрузка…
                </td>
              </tr>
            ) : visibleRates.length === 0 ? (
              <tr>
                <td colSpan={5} className="services-salary__empty">
                  Услуги не найдены.
                </td>
              </tr>
            ) : (
              visibleRates.map((rate) => {
                const draft = getDraft(rate);
                const dirty = isDraftDirty(rate);
                return (
                  <tr key={rate.service}>
                    <td>{rate.service_name}</td>
                    <td>{fmtMoney(rate.price)}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className="services-salary__percent-input"
                        value={draft.percent}
                        onChange={(e) =>
                          setDraftField(rate.service, e.target.value)
                        }
                      />
                    </td>
                    <td>{fmtDateTime(rate.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="services-salary__save-btn"
                        disabled={!dirty || rateSaving[rate.service]}
                        onClick={() => handleSaveRate(rate)}
                      >
                        <Save size={14} />
                        {rateSaving[rate.service] ? "Сохранение…" : "Сохранить"}
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
    <div className="services-salary__block">
      <div className="services-salary__block-head">
        <h3 className="services-salary__block-title">История выплат</h3>
        <div className="services-salary__block-head-actions">
          <label className="services-salary__filter">
            С
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="services-salary__filter">
            По
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {isOwnerOrAdmin && (
            <button
              type="button"
              className="services-salary__primary-btn"
              onClick={openPayoutModal}
            >
              <Wallet size={16} />
              Выплатить сотруднику
            </button>
          )}
        </div>
      </div>
      {payoutsError && (
        <div className="services-salary__error">{payoutsError}</div>
      )}
      <div className="services-salary__table-wrap">
        <table className="services-salary__table">
          <thead>
            <tr>
              <th>Дата</th>
              {isOwnerOrAdmin && <th>Сотрудник</th>}
              <th>Сумма</th>
              <th>Комментарий</th>
              {isOwnerOrAdmin && <th>Кто выплатил</th>}
            </tr>
          </thead>
          <tbody>
            {payoutsLoading ? (
              <tr>
                <td
                  colSpan={isOwnerOrAdmin ? 5 : 3}
                  className="services-salary__empty"
                >
                  Загрузка…
                </td>
              </tr>
            ) : payouts.length === 0 ? (
              <tr>
                <td
                  colSpan={isOwnerOrAdmin ? 5 : 3}
                  className="services-salary__empty"
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
                      {p.master_name ||
                        masterLabelById.get(String(p.master)) ||
                        p.master}
                    </td>
                  )}
                  <td className="services-salary__cell-accent">
                    {fmtMoney(p.amount)}
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
    const balance = masterBalances.get(String(payoutForm.master));
    return (
      <div
        className="services-salary__modal-overlay"
        onClick={() => setPayoutModalOpen(false)}
      >
        <div
          className="services-salary__modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="services-salary__modal-head">
            <h3>Выплата сотруднику</h3>
            <button
              type="button"
              className="services-salary__icon-btn"
              onClick={() => setPayoutModalOpen(false)}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handlePayoutSubmit}>
            <label className="services-salary__field">
              Сотрудник
              <select
                value={payoutForm.master}
                onChange={(e) => handlePayoutMasterChange(e.target.value)}
              >
                <option value="">Выберите сотрудника</option>
                {masterOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {balance && (
              <p className="services-salary__hint">
                К выплате по начислениям: {fmtMoney(balance.balance)}
              </p>
            )}
            <label className="services-salary__field">
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
            <label className="services-salary__field">
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
              <div className="services-salary__error">{payoutFormError}</div>
            )}
            <div className="services-salary__modal-actions">
              <button
                type="button"
                className="services-salary__secondary-btn"
                onClick={() => setPayoutModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="services-salary__primary-btn"
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
    <div className="services-salary">
      <div className="services-salary__header">
        <h2 className="services-salary__title">
          {isOwnerOrAdmin ? "Зарплата сотрудников" : "Моя зарплата"}
        </h2>
        <button
          type="button"
          className="services-salary__refresh"
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

      <div className="services-salary__tabs">
        <button
          type="button"
          className={`services-salary__tab ${tab === TABS.ACCRUALS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.ACCRUALS)}
        >
          Начисления
        </button>
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`services-salary__tab ${tab === TABS.RATES ? "is-active" : ""}`}
            onClick={() => setTab(TABS.RATES)}
          >
            <Percent size={14} />
            Ставки услуг
          </button>
        )}
        <button
          type="button"
          className={`services-salary__tab ${tab === TABS.PAYOUTS ? "is-active" : ""}`}
          onClick={() => setTab(TABS.PAYOUTS)}
        >
          Выплаты
        </button>
      </div>

      {notReady && (
        <div className="services-salary__notice">
          Раздел «Зарплата» ещё не активирован на сервере. Данные появятся после
          обновления бэкенда (см. docs/services/salary.md).
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
