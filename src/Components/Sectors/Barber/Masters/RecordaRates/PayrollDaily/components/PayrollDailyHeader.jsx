// PayrollDailyHeader.jsx
import React from "react";
import { FaCalendarAlt, FaDownload, FaSync } from "react-icons/fa";
import BarberSelect from "../../../../common/BarberSelect";
import { fmtInt, fmtMoney } from "../PayrollDailyUtils";

const PayrollDailyHeader = ({
  date,
  onChangeDate,
  employeeOptions,
  selectedEmployee,
  onChangeEmployee,
  onRefresh,
  onExport,
  loading,
  totals,
  masterCount,
}) => {
  return (
    <header className="barberpayrolldaily__head">
      <div className="barberpayrolldaily__titleWrap">
        <h2 className="barberpayrolldaily__title">Ежедневные выплаты</h2>
        <span className="barberpayrolldaily__subtitle" aria-live="polite">
          {loading
            ? "Загрузка…"
            : `${fmtInt(masterCount)} мастеров · ${fmtInt(
                totals.records
              )} записей · ${fmtMoney(totals.payout)} к выплате`}
        </span>
      </div>

      <div className="barberpayrolldaily__filters">
        <div className="barberpayrolldaily__date">
          <FaCalendarAlt className="barberpayrolldaily__dateIcon" />
          <input
            type="date"
            className="barberpayrolldaily__dateInput"
            value={date}
            onChange={(e) => onChangeDate(e.target.value)}
            aria-label="Дата"
          />
        </div>

        <div className="barberpayrolldaily__filter">
          <BarberSelect
            value={selectedEmployee}
            onChange={onChangeEmployee}
            options={employeeOptions}
            placeholder="Все сотрудники"
          />
        </div>

        <button
          type="button"
          className="barberpayrolldaily__btn barberpayrolldaily__btn--secondary"
          onClick={onRefresh}
          title="Обновить данные"
        >
          <FaSync />
          <span className="barberpayrolldaily__btnText">Обновить</span>
        </button>

        <button
          type="button"
          className="barberpayrolldaily__btn barberpayrolldaily__btn--primary barberpayrolldaily__btn--icon"
          onClick={onExport}
          title="Экспорт CSV"
          aria-label="Экспорт CSV"
        >
          <FaDownload />
          <span className="barberpayrolldaily__btnText">Экспорт</span>
        </button>
      </div>
    </header>
  );
};

export default PayrollDailyHeader;
