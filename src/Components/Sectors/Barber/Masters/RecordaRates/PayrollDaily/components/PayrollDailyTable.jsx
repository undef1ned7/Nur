// PayrollDailyTable.jsx
import React from "react";
import { fmtInt, fmtMoney } from "../PayrollDailyUtils";

const PayrollDailyTable = ({
  rows,
  totals,
  loading,
  onOpenDetails,
}) => {
  return (
    <div className="barberpayrolldaily__tableWrap">
      <table className="barberpayrolldaily__table">
        <thead>
          <tr>
            <th>Мастер</th>
            <th>Записей</th>
            <th className="is-money">Выручка</th>
            <th>Режим</th>
            <th>Ставка/Процент</th>
            <th className="is-money">К выплате</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="barberpayrolldaily__muted">
                Загрузка…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="barberpayrolldaily__muted">
                Нет данных за выбранную дату.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="barberpayrolldaily__ellipsis" title={r.name}>
                  {r.name}
                </td>
                <td>{fmtInt(r.records)}</td>
                <td className="is-money">{fmtMoney(r.revenue)}</td>
                <td>{r.mode === "percent" ? "Процент" : "Ставка"}</td>
                <td>{r.rateLabel}</td>
                <td className="is-money">{fmtMoney(r.payout)}</td>
                <td className="barberpayrolldaily__actions">
                  <button
                    type="button"
                    className="barberpayrolldaily__link"
                    onClick={() => onOpenDetails(r)}
                    title="Показать записи"
                  >
                    Записи
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <th>Итого</th>
            <th>{fmtInt(totals.records)}</th>
            <th className="is-money">{fmtMoney(totals.revenue)}</th>
            <th />
            <th />
            <th className="is-money">{fmtMoney(totals.payout)}</th>
            <th />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PayrollDailyTable;
