/**
 * Карточка сотрудника: показатели работы и КПД (ТЗ №6) + личные финансы:
 * продажи, принятые и сданные деньги (ТЗ №7).
 *
 * Зачем вместе: «сколько человек продал» и «где эти деньги» — один вопрос.
 * Разнеся их по разным экранам, мы заставили бы руководителя сводить руками.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaMoneyBillWave } from "react-icons/fa";
import {
  calcKpiScore,
  getEmployeeFinance,
  getEmployeeStats,
  listEmployeeDebts,
  listEmployeeHandovers,
  listEmployeeSales,
} from "../../../../api/consultingEmployees";
import { createCashHandover } from "../../../../api/consultingCashbox";
import { useAlert } from "../../../../hooks/useDialog";
import {
  CounterTabs,
  ListState,
  Pagination,
  PeriodFilter,
  StatCard,
} from "../common/ListControls";
import {
  employeeName,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtInt,
  fmtMoney,
  fmtPercent,
  num,
  periodRange,
  plural,
} from "../common/listUtils";
import useConsultingList, {
  isNotReadyError,
  listErrorText,
} from "../common/useConsultingList";

const CARD_TABS = [
  { value: "work", label: "Работа и КПД" },
  { value: "finance", label: "Финансы" },
  { value: "sales", label: "Продажи" },
  { value: "debts", label: "Долги клиентов" },
];

export default function EmployeeCard({ employee, onBack, isManager }) {
  const alert = useAlert();
  const [tab, setTab] = useState("work");
  const [range, setRange] = useState({ date_from: "", date_to: "" });

  useEffect(() => {
    setRange(periodRange("month"));
  }, []);

  const employeeId = employee?.id;

  return (
    <div className="teachers__card">
      <div className="teachers__cardHead">
        <button type="button" className="teachers__btn" onClick={onBack}>
          <FaArrowLeft aria-hidden /> К списку
        </button>
        <div className="teachers__cardTitle">
          <h3>{employeeName(employee)}</h3>
          <span className="teachers__cardRole">
            {employee?.role_display || employee?.custom_role_name || "Сотрудник"}
            {employee?.email ? ` · ${employee.email}` : ""}
            {employee?.phone ? ` · ${employee.phone}` : ""}
          </span>
        </div>
      </div>

      <div className="cList__toolbar">
        <PeriodFilter
          dateFrom={range.date_from}
          dateTo={range.date_to}
          onChange={setRange}
        />
      </div>

      <CounterTabs tabs={CARD_TABS} value={tab} onChange={setTab} />

      {tab === "work" && <WorkTab employeeId={employeeId} range={range} />}
      {tab === "finance" && (
        <FinanceTab
          employeeId={employeeId}
          range={range}
          isManager={isManager}
          alert={alert}
        />
      )}
      {tab === "sales" && <SalesTab employeeId={employeeId} range={range} />}
      {tab === "debts" && <DebtsTab employeeId={employeeId} />}
    </div>
  );
}

/* ==================== Работа и КПД ==================== */

function WorkTab({ employeeId, range }) {
  const { data, loading, error, notReady } = useResource(
    getEmployeeStats,
    employeeId,
    range,
  );

  const kpi = useMemo(() => {
    if (!data) return null;
    // Сервер может прислать готовый КПД; если нет — считаем по той же формуле.
    return data.kpi?.score != null ? data.kpi : calcKpiScore(data);
  }, [data]);

  if (loading) return <div className="cList__state">Загрузка показателей…</div>;
  if (error) return <div className="cList__state cList__state--error">{error}</div>;
  if (notReady)
    return (
      <div className="cList__notice">
        <b>Показатели сотрудника подключаются</b>
        <p>
          После реализации на сервере здесь появятся лиды, конверсия, скорость
          ответа и КПД.
        </p>
      </div>
    );
  if (!data) return null;

  const leads = data.leads || {};
  const sales = data.sales || {};
  const speed = data.speed || {};

  return (
    <div className="teachers__cardBody">
      <section className="teachers__section">
        <h4 className="teachers__sectionTitle">Лиды и работа</h4>
        <div className="cList__stats">
          <StatCard label="Получено лидов" value={fmtInt(leads.received)} />
          <StatCard label="Взято из пула" value={fmtInt(leads.claimed)} />
          <StatCard label="В работе" value={fmtInt(leads.in_work)} />
          <StatCard label="Отложено" value={fmtInt(leads.deferred)} />
          <StatCard
            label="Просрочено"
            value={fmtInt(leads.overdue)}
            tone={num(leads.overdue) ? "danger" : undefined}
          />
          <StatCard label="Обработано" value={fmtInt(leads.processed)} />
          <StatCard
            label="Не отвечено вовремя"
            value={fmtInt(leads.no_reply_in_time)}
            tone={num(leads.no_reply_in_time) ? "warn" : undefined}
          />
        </div>
      </section>

      <section className="teachers__section">
        <h4 className="teachers__sectionTitle">Продажи</h4>
        <div className="cList__stats">
          <StatCard label="Сделок закрыто" value={fmtInt(sales.deals)} />
          <StatCard label="Выручка" value={fmtMoney(sales.revenue)} />
          <StatCard label="Средний чек" value={fmtMoney(sales.avg_check)} />
          <StatCard
            label="Конверсия лид → продажа"
            value={fmtPercent(sales.conversion)}
            tone="accent"
          />
          <StatCard
            label="Выполнение плана"
            value={fmtPercent(sales.plan_done_percent)}
            hint={sales.plan ? `план ${fmtMoney(sales.plan)}` : undefined}
          />
          <StatCard
            label="Отменённые продажи"
            value={fmtInt(sales.canceled)}
            hint={
              num(sales.cancel_rate)
                ? `доля отмен ${fmtPercent(sales.cancel_rate)}`
                : undefined
            }
            tone={num(sales.canceled) ? "warn" : undefined}
          />
        </div>
      </section>

      <section className="teachers__section">
        <h4 className="teachers__sectionTitle">Скорость</h4>
        <div className="cList__stats">
          <StatCard
            label="До первого ответа"
            value={fmtDuration(speed.first_reply_avg_minutes)}
            hint="в среднем"
          />
          <StatCard
            label="Срок сделки"
            value={
              speed.deal_cycle_avg_days
                ? `${num(speed.deal_cycle_avg_days).toFixed(1)} дн.`
                : "—"
            }
            hint="от лида до оплаты"
          />
        </div>
        {!!(speed.by_stage || []).length && (
          <div className="cList__tableWrap">
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Стадия</th>
                  <th className="cList__num">Среднее время</th>
                </tr>
              </thead>
              <tbody>
                {speed.by_stage.map((s) => (
                  <tr key={s.stage}>
                    <td>{s.stage_display || s.stage}</td>
                    <td className="cList__num">{fmtDuration(num(s.avg_hours) * 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {kpi && (
        <section className="teachers__section">
          <h4 className="teachers__sectionTitle">КПД</h4>
          <div className="teachers__kpi">
            <div className="teachers__kpiScore">
              <span className="teachers__kpiValue">{fmtInt(kpi.score)}</span>
              <span className="teachers__kpiOf">из 100</span>
              {data.kpi?.rank && (
                <span className="teachers__kpiRank">
                  {data.kpi.rank} место{data.kpi.of ? ` из ${data.kpi.of}` : ""}
                </span>
              )}
            </div>
            <div className="teachers__kpiBars">
              <KpiBar label="Конверсия" value={kpi.conversion_score} />
              <KpiBar label="Выполнение плана" value={kpi.plan_score} />
              <KpiBar label="Скорость ответа" value={kpi.speed_score} />
              <KpiBar label="Дисциплина" value={kpi.discipline_score} />
            </div>
          </div>
        </section>
      )}

      {!!data.salary && (
        <section className="teachers__section">
          <h4 className="teachers__sectionTitle">Зарплата за период</h4>
          <div className="cList__stats">
            <StatCard label="Начислено" value={fmtMoney(data.salary.accrued)} />
            <StatCard label="Выплачено" value={fmtMoney(data.salary.paid)} />
            <StatCard label="Остаток" value={fmtMoney(data.salary.remaining)} />
          </div>
        </section>
      )}
    </div>
  );
}

function KpiBar({ label, value }) {
  const v = Math.max(0, Math.min(100, num(value)));
  return (
    <div className="teachers__kpiBar">
      <div className="teachers__kpiBarHead">
        <span>{label}</span>
        <b>{fmtInt(v)}</b>
      </div>
      <div className="teachers__kpiBarTrack">
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/* ==================== Финансы ==================== */

function FinanceTab({ employeeId, range, isManager, alert }) {
  const { data, loading, error, notReady, reload } = useResource(
    getEmployeeFinance,
    employeeId,
    range,
  );
  const [handoverOpen, setHandoverOpen] = useState(false);

  const handovers = useConsultingList({
    fetcher: useCallback(
      (params, config) => listEmployeeHandovers(employeeId, params, config),
      [employeeId],
    ),
    filters: { status: "" },
    prefix: "ho",
    syncUrl: false,
    pageSize: 20,
  });

  if (loading) return <div className="cList__state">Загрузка финансов…</div>;
  if (error) return <div className="cList__state cList__state--error">{error}</div>;
  if (notReady)
    return (
      <div className="cList__notice">
        <b>Финансы сотрудника подключаются</b>
        <p>
          После реализации на сервере здесь будет видно, сколько наличных принял
          сотрудник, сколько сдал в кассу и что осталось на руках.
        </p>
      </div>
    );

  const onHands = num(data?.on_hands);

  return (
    <div className="teachers__cardBody">
      <div className="cList__stats">
        <StatCard label="Продал за период" value={fmtMoney(data?.sold)} />
        <StatCard label="Принято наличными" value={fmtMoney(data?.cash_received)} />
        <StatCard
          label="Принято переводом"
          value={fmtMoney(data?.transfer_received)}
          hint="сверять не нужно"
        />
        <StatCard label="Сдано в кассу" value={fmtMoney(data?.handed_over)} />
        <StatCard
          label="Остаток на руках"
          value={fmtMoney(onHands)}
          tone={onHands > 0 ? "warn" : "success"}
          hint="подотчёт"
        />
        <StatCard
          label="Ожидает подтверждения"
          value={fmtMoney(data?.pending_handover)}
        />
      </div>

      <div className="teachers__financeActions">
        <button
          type="button"
          className="teachers__btn teachers__btn--primary"
          onClick={() => setHandoverOpen(true)}
          disabled={onHands <= 0}
          title={
            onHands <= 0 ? "Нет наличных на руках" : "Сдать наличные в кассу"
          }
        >
          <FaMoneyBillWave aria-hidden /> Сдать в кассу
        </button>
        {isManager && onHands > 0 && (
          <span className="teachers__financeHint">
            Остаток можно удержать из зарплаты во вкладке «Штрафы и премии».
          </span>
        )}
      </div>

      <section className="teachers__section">
        <h4 className="teachers__sectionTitle">История сдачи наличных</h4>
        {handovers.loading || !handovers.items.length ? (
          <ListState
            loading={handovers.loading}
            error={handovers.error}
            notReady={handovers.notReady}
            empty={!handovers.items.length}
            emptyTitle="Сдач ещё не было"
            emptyText="Внесения появятся здесь после первой сдачи наличных."
          />
        ) : (
          <div className="cList__tableWrap">
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th className="cList__num">Сумма</th>
                  <th>Принял</th>
                  <th>Статус</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {handovers.items.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDateTime(h.created_at)}</td>
                    <td className="cList__num">{fmtMoney(h.amount)}</td>
                    <td>{h.confirmed_by_display || "—"}</td>
                    <td>
                      <span className={`kassa__reqStatus kassa__reqStatus--${h.status}`}>
                        {h.status_display || h.status}
                      </span>
                    </td>
                    <td className="cList__muted">{h.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={handovers.page}
          totalPages={handovers.totalPages}
          count={handovers.count}
          pageSize={handovers.pageSize}
          onPage={handovers.setPage}
          unitLabel={plural.operations}
          loading={handovers.loading}
        />
      </section>

      {handoverOpen && (
        <HandoverModal
          maxAmount={onHands}
          onClose={() => setHandoverOpen(false)}
          onSaved={() => {
            setHandoverOpen(false);
            reload();
            handovers.refresh();
            alert("Внесение отправлено — ожидает подтверждения кассой.");
          }}
          onError={(m) => alert(m, true)}
        />
      )}
    </div>
  );
}

function HandoverModal({ maxAmount, onClose, onSaved, onError }) {
  const [amount, setAmount] = useState(String(maxAmount || ""));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = num(amount);
    if (value <= 0) return onError?.("Укажите сумму больше нуля.");
    if (maxAmount && value > maxAmount)
      return onError?.("Сумма больше, чем числится на руках.");

    setSaving(true);
    try {
      await createCashHandover({ amount: value, comment: comment.trim() });
      onSaved?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось оформить внесение.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="salary__overlay" onClick={() => !saving && onClose()}>
      <div
        className="salary__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="salary__modalTitle">Сдать наличные в кассу</h3>
        <p className="salary__formNote">
          На руках {fmtMoney(maxAmount)}. Ответственный за кассу подтвердит
          внесение — только после этого деньги войдут в остаток.
        </p>
        <form className="salary__form" onSubmit={submit}>
          <label className="salary__label">Сумма</label>
          <input
            className="cList__input"
            type="number"
            min="0"
            max={maxAmount || undefined}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <label className="salary__label">Комментарий (необязательно)</label>
          <textarea
            className="cList__input"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="salary__formActions">
            <button
              type="button"
              className="salary__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="salary__btn salary__btn--primary"
              disabled={saving}
            >
              {saving ? "Отправка…" : "Сдать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== Продажи сотрудника ==================== */

function SalesTab({ employeeId, range }) {
  const extraParams = useMemo(
    () => ({
      date_from: range.date_from || undefined,
      date_to: range.date_to || undefined,
    }),
    [range.date_from, range.date_to],
  );

  const list = useConsultingList({
    fetcher: useCallback(
      (params, config) => listEmployeeSales(employeeId, params, config),
      [employeeId],
    ),
    filters: { status: "" },
    extraParams,
    prefix: "es",
    syncUrl: false,
  });

  const totals = useMemo(() => {
    let revenue = 0;
    let accrued = 0;
    for (const r of list.items) {
      revenue += num(r.total);
      accrued += num(r.accrual_amount);
    }
    return { revenue, accrued };
  }, [list.items]);

  return (
    <div className="teachers__cardBody">
      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="История продаж подключается"
          emptyTitle="Продаж за период нет"
        />
      ) : (
        <>
          <div className="teachers__totalsRow">
            <span>
              На странице: <b>{fmtMoney(totals.revenue)}</b>
            </span>
            <span>
              Начислено ему: <b>{fmtMoney(totals.accrued)}</b>
            </span>
          </div>
          <div className="cList__tableWrap">
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Клиент</th>
                  <th>Услуга / тариф</th>
                  <th className="cList__num">Сумма</th>
                  <th>Оплата</th>
                  <th>Статус</th>
                  <th className="cList__num">Начислено</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>{r.client_display || "—"}</td>
                    <td className="cList__muted">
                      {[r.service_display, r.tariff_display]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                    <td className="cList__num">{fmtMoney(r.total)}</td>
                    <td>{r.payment_display || r.payment_mode || "—"}</td>
                    <td>
                      <span className={`sale__status sale__status--${r.status || "completed"}`}>
                        {r.status_display || "Проведена"}
                      </span>
                    </td>
                    <td className="cList__num">{fmtMoney(r.accrual_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        count={list.count}
        pageSize={list.pageSize}
        onPage={list.setPage}
        onPageSize={list.setPageSize}
        unitLabel={plural.sales}
        loading={list.loading}
      />
    </div>
  );
}

/* ==================== Долги клиентов ==================== */

function DebtsTab({ employeeId }) {
  const list = useConsultingList({
    fetcher: useCallback(
      (params, config) => listEmployeeDebts(employeeId, params, config),
      [employeeId],
    ),
    filters: { overdue: "" },
    prefix: "ed",
    syncUrl: false,
  });

  return (
    <div className="teachers__cardBody">
      <div className="cList__toolbar">
        <button
          type="button"
          className={`teachers__chip${list.filters.overdue ? " is-active" : ""}`}
          onClick={() =>
            list.setFilter("overdue", list.filters.overdue ? "" : "true")
          }
        >
          Только просроченные
        </button>
      </div>

      {list.loading || list.error || list.notReady || !list.items.length ? (
        <ListState
          loading={list.loading}
          error={list.error}
          notReady={list.notReady}
          empty={!list.items.length}
          notReadyTitle="Долги клиентов подключаются"
          emptyTitle="Долгов нет"
          emptyText="Здесь будут сделки в долг и рассрочку, которые оформил этот сотрудник."
          hasActiveFilters={list.hasActiveFilters}
          onResetFilters={list.resetFilters}
        />
      ) : (
        <div className="cList__tableWrap">
          <table className="cList__table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Услуга</th>
                <th className="cList__num">Сумма сделки</th>
                <th className="cList__num">Осталось</th>
                <th>Следующий платёж</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((d) => (
                <tr key={d.id} className={d.is_overdue ? "teachers__row--overdue" : undefined}>
                  <td>{d.client_display || "—"}</td>
                  <td className="cList__muted">{d.service_display || "—"}</td>
                  <td className="cList__num">{fmtMoney(d.total)}</td>
                  <td className="cList__num">
                    <b>{fmtMoney(d.remaining)}</b>
                  </td>
                  <td>{fmtDate(d.next_payment_date)}</td>
                  <td>
                    {d.is_overdue ? (
                      <span className="teachers__badgeDanger">Просрочено</span>
                    ) : (
                      <span className="cList__muted">По графику</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        count={list.count}
        pageSize={list.pageSize}
        onPage={list.setPage}
        onPageSize={list.setPageSize}
        unitLabel={plural.records}
        loading={list.loading}
      />
    </div>
  );
}

/* ==================== Общая загрузка сводных данных ==================== */

/** Одиночный ресурс «по сотруднику за период» с отменой устаревших запросов. */
function useResource(fetcher, employeeId, range) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!employeeId || !range.date_from) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");
    setNotReady(false);

    fetcher(
      employeeId,
      { date_from: range.date_from, date_to: range.date_to },
      { signal: controller.signal },
    )
      .then((res) => {
        if (!cancelled) setData(res || null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (isNotReadyError(e)) {
          setNotReady(true);
          setData(null);
        } else {
          setError(listErrorText(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, employeeId, range.date_from, range.date_to, token]);

  const reload = useCallback(() => setToken((v) => v + 1), []);

  return { data, loading, error, notReady, reload };
}
