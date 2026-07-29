/**
 * Зарплата → Расчётный лист (ТЗ №2).
 *
 * То, что реально нужно на выплате: оклад + процент + фикс + премии − штрафы −
 * выплачено = к выплате. Каждая строка раскрывается до количества оснований,
 * чтобы сотрудник видел, откуда взялась сумма.
 */
import { useEffect, useState } from "react";
import {
  ACCRUAL_KIND_LABELS,
  NEGATIVE_KINDS,
  getSalaryPayslip,
} from "../../../../api/consultingSalary";
import { StatCard } from "../common/ListControls";
import {
  currentMonth,
  employeeName,
  fmtMoney,
  num,
} from "../common/listUtils";
import { isNotReadyError, listErrorText } from "../common/useConsultingList";

export default function SalaryPayslip({ employees = [], isOwnerOrAdmin, myUserId }) {
  const [month, setMonth] = useState("");
  const [user, setUser] = useState(isOwnerOrAdmin ? "" : myUserId || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);

  // Текущий месяц вычисляем в эффекте: рендер должен быть чистым.
  useEffect(() => {
    setMonth(currentMonth());
  }, []);

  useEffect(() => {
    if (!month) return undefined;
    if (isOwnerOrAdmin && !user) {
      setData(null);
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");
    setNotReady(false);

    getSalaryPayslip(
      { month, user: user || undefined },
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
          setError(listErrorText(e, "Не удалось загрузить расчётный лист."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [month, user, isOwnerOrAdmin]);

  const lines = data?.lines || [];

  return (
    <div className="salary__pane">
      <div className="cList__toolbar">
        <label className="salary__filterField">
          <span>Месяц</span>
          <input
            type="month"
            className="cList__input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {isOwnerOrAdmin && (
          <label className="salary__filterField">
            <span>Сотрудник</span>
            <select
              className="cList__input"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isOwnerOrAdmin && !user && (
        <div className="cList__state">
          <strong>Выберите сотрудника</strong>
          <p>Расчётный лист формируется по одному человеку за месяц.</p>
        </div>
      )}

      {loading && <div className="cList__state">Загрузка расчётного листа…</div>}
      {!!error && <div className="cList__state cList__state--error">{error}</div>}

      {notReady && (
        <div className="cList__notice">
          <b>Расчётный лист подключается</b>
          <p>
            После реализации на сервере здесь будет полный расчёт: оклад,
            проценты, фикс, премии и удержания с расшифровкой по сделкам.
          </p>
        </div>
      )}

      {!loading && !error && !notReady && data && (
        <>
          <div className="cList__stats">
            <StatCard label="Начислено" value={fmtMoney(data.accrued)} />
            <StatCard label="Выплачено ранее" value={fmtMoney(data.paid)} />
            <StatCard
              label="К выплате"
              value={fmtMoney(data.to_pay)}
              tone="success"
            />
          </div>

          <div className="cList__tableWrap salary__payslip">
            <table className="cList__table">
              <thead>
                <tr>
                  <th>Строка</th>
                  <th className="cList__num">Оснований</th>
                  <th className="cList__num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const negative = NEGATIVE_KINDS.includes(line.kind);
                  return (
                    <tr key={`${line.kind}-${idx}`}>
                      <td>
                        {line.label || ACCRUAL_KIND_LABELS[line.kind] || line.kind}
                      </td>
                      <td className="cList__num cList__muted">
                        {line.count ? line.count : "—"}
                      </td>
                      <td className="cList__num">
                        <b className={negative ? "salary__neg" : undefined}>
                          {negative ? "−" : ""}
                          {fmtMoney(Math.abs(num(line.amount)))}
                        </b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th>Итого начислено</th>
                  <th />
                  <th className="cList__num">{fmtMoney(data.accrued)}</th>
                </tr>
                <tr>
                  <th>К выплате</th>
                  <th />
                  <th className="cList__num">{fmtMoney(data.to_pay)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
