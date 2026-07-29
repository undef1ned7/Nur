/**
 * Консалтинг → Лиды → Аналитика.
 *
 * Отвечает на главный вопрос отдела продаж: сколько обращений пришло и сколько
 * из них купили. Лид учитывается в периоде, КОГДА ОН ПРИШЁЛ (когортный
 * принцип), поэтому «конверсия за июль» честно означает «из июльских лидов
 * купили столько-то», даже если оплата прошла позже.
 */
import { useEffect, useMemo, useState } from "react";
import {
  DEFER_REASONS,
  REJECT_REASONS,
  getLeadsAnalytics,
  reasonLabel,
} from "../../../../api/consultingLeads";
import { LEAD_SOURCES, leadSourceLabel } from "../../../../utils/consultingLeadSources";
import { isNotReadyError, listErrorText } from "../common/useConsultingList";
import { PeriodFilter, StatCard } from "../common/ListControls";
import {
  employeeName,
  fmtDuration,
  fmtInt,
  fmtMoney,
  fmtPercent,
  num,
  periodRange,
} from "../common/listUtils";

/** Конверсия считается на фронте, если сервер прислал только сырые числа. */
const conversionOf = (row) =>
  num(row?.conversion) ||
  (num(row?.leads) ? (num(row?.converted) / num(row.leads)) * 100 : 0);

export default function LeadsAnalytics({ employees, isManager }) {
  // Период по умолчанию — последние 30 дней; вычисляем в эффекте, чтобы не
  // читать текущее время в рендере.
  const [range, setRange] = useState({ date_from: "", date_to: "" });
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    setRange(periodRange("month"));
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    if (!range.date_from || !range.date_to) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");
    setNotReady(false);

    getLeadsAnalytics(
      {
        date_from: range.date_from || undefined,
        date_to: range.date_to || undefined,
        owner: owner || undefined,
        source: source || undefined,
      },
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
          setError(listErrorText(e, "Не удалось загрузить аналитику."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range.date_from, range.date_to, owner, source]);

  const totals = data?.totals || {};
  const bySource = data?.by_source || [];
  const byUser = data?.by_user || [];
  const byDay = data?.by_day || [];
  const deferReasons = data?.defer_reasons || [];
  const rejectReasons = data?.reject_reasons || [];

  const maxDay = useMemo(
    () => Math.max(1, ...byDay.map((d) => num(d.leads))),
    [byDay],
  );

  return (
    <div className="leads__analytics">
      <div className="leads__toolbar">
        <PeriodFilter
          dateFrom={range.date_from}
          dateTo={range.date_to}
          onChange={setRange}
        />

        {isManager && (
          <select
            className="cList__input"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Сотрудник"
          >
            <option value="">Все сотрудники</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeName(e)}
              </option>
            ))}
          </select>
        )}

        <select
          className="cList__input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Источник"
        >
          <option value="">Все источники</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="cList__state">Загрузка аналитики…</div>}
      {!!error && <div className="cList__state cList__state--error">{error}</div>}

      {notReady && (
        <div className="cList__notice">
          <b>Аналитика по лидам подключается</b>
          <p>
            Отчёт появится здесь после реализации на сервере. Очередь лидов,
            фильтры и работа с отложенными доступны уже сейчас.
          </p>
        </div>
      )}

      {!loading && !error && !notReady && data && (
        <>
          <div className="cList__stats leads__statsGrid">
            <StatCard label="Всего лидов" value={fmtInt(totals.leads)} />
            <StatCard label="Новые" value={fmtInt(totals.new)} />
            <StatCard label="В работе" value={fmtInt(totals.in_work)} />
            <StatCard
              label="Отложено"
              value={fmtInt(totals.deferred)}
              hint={
                num(totals.overdue)
                  ? `просрочено: ${fmtInt(totals.overdue)}`
                  : undefined
              }
              tone={num(totals.overdue) ? "warn" : undefined}
            />
            <StatCard
              label="Купили"
              value={fmtInt(totals.converted)}
              tone="success"
            />
            <StatCard label="Отказ" value={fmtInt(totals.rejected)} />
            <StatCard
              label="Конверсия в покупку"
              value={fmtPercent(conversionOf({ ...totals, leads: totals.leads, converted: totals.converted }))}
              tone="accent"
            />
            <StatCard label="Сумма продаж" value={fmtMoney(totals.revenue)} />
            <StatCard label="Средний чек" value={fmtMoney(totals.avg_check)} />
            <StatCard
              label="Время до первого ответа"
              value={fmtDuration(totals.first_reply_avg_minutes)}
              hint="в среднем"
            />
            <StatCard
              label="Время до покупки"
              value={fmtDuration(totals.time_to_sale_avg_minutes)}
              hint="в среднем"
            />
          </div>

          <Section title="По источникам" empty={!bySource.length}>
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Источник</th>
                  <th className="cList__num">Лидов</th>
                  <th className="cList__num">Купили</th>
                  <th className="cList__num">Конверсия</th>
                  <th className="cList__num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((r) => (
                  <tr key={r.source}>
                    <td>{leadSourceLabel(r.source)}</td>
                    <td className="cList__num">{fmtInt(r.leads)}</td>
                    <td className="cList__num">{fmtInt(r.converted)}</td>
                    <td className="cList__num">{fmtPercent(conversionOf(r))}</td>
                    <td className="cList__num">{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="По сотрудникам" empty={!byUser.length}>
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th className="cList__num">Получено</th>
                  <th className="cList__num">В работе</th>
                  <th className="cList__num">Отложено</th>
                  <th className="cList__num">Просрочено</th>
                  <th className="cList__num">Купили</th>
                  <th className="cList__num">Конверсия</th>
                  <th className="cList__num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((r) => (
                  <tr key={r.user || r.name}>
                    <td>{r.name || r.user_display || "—"}</td>
                    <td className="cList__num">{fmtInt(r.leads)}</td>
                    <td className="cList__num">{fmtInt(r.in_work)}</td>
                    <td className="cList__num">{fmtInt(r.deferred)}</td>
                    <td
                      className={`cList__num${num(r.overdue) ? " leads__cellDanger" : ""}`}
                    >
                      {fmtInt(r.overdue)}
                    </td>
                    <td className="cList__num">{fmtInt(r.converted)}</td>
                    <td className="cList__num">{fmtPercent(conversionOf(r))}</td>
                    <td className="cList__num">{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Динамика по дням" empty={!byDay.length}>
            <div className="leads__chart">
              {byDay.map((d) => {
                const leads = num(d.leads);
                const converted = num(d.converted);
                return (
                  <div
                    className="leads__chartCol"
                    key={d.date}
                    title={`${d.date}: лидов ${leads}, купили ${converted}`}
                  >
                    <div className="leads__chartBars">
                      <span
                        className="leads__chartBar leads__chartBar--leads"
                        style={{ height: `${(leads / maxDay) * 100}%` }}
                      />
                      <span
                        className="leads__chartBar leads__chartBar--converted"
                        style={{ height: `${(converted / maxDay) * 100}%` }}
                      />
                    </div>
                    <div className="leads__chartLabel">
                      {String(d.date || "").slice(8, 10)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="leads__legend">
              <span className="leads__legendItem">
                <i className="leads__legendDot leads__legendDot--leads" /> лиды
              </span>
              <span className="leads__legendItem">
                <i className="leads__legendDot leads__legendDot--converted" />{" "}
                покупки
              </span>
            </div>
          </Section>

          <div className="leads__reasonsRow">
            <Section
              title="Причины откладывания"
              empty={!deferReasons.length}
              compact
            >
              <ReasonList rows={deferReasons} dict={DEFER_REASONS} />
            </Section>
            <Section title="Причины отказов" empty={!rejectReasons.length} compact>
              <ReasonList rows={rejectReasons} dict={REJECT_REASONS} />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children, empty, compact }) {
  return (
    <section className={`leads__section${compact ? " leads__section--compact" : ""}`}>
      <h3 className="leads__sectionTitle">{title}</h3>
      {empty ? (
        <p className="cList__muted">Нет данных за выбранный период.</p>
      ) : (
        <div className="cList__tableWrap">{children}</div>
      )}
    </section>
  );
}

function ReasonList({ rows, dict }) {
  const total = rows.reduce((acc, r) => acc + num(r.count), 0) || 1;
  return (
    <table className="cList__table">
      <thead>
        <tr>
          <th>Причина</th>
          <th className="cList__num">Кол-во</th>
          <th className="cList__num">Доля</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.reason}>
            <td>{reasonLabel(dict, r.reason)}</td>
            <td className="cList__num">{fmtInt(r.count)}</td>
            <td className="cList__num">
              {fmtPercent((num(r.count) / total) * 100)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
