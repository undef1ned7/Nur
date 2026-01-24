// RecordaRatesHeader.jsx
import React from "react";
import { FaSave, FaDownload } from "react-icons/fa";
import BarberSelect from "../../../common/BarberSelect";

const MONTHS = [
  { value: "1", label: "Январь" },
  { value: "2", label: "Февраль" },
  { value: "3", label: "Март" },
  { value: "4", label: "Апрель" },
  { value: "5", label: "Май" },
  { value: "6", label: "Июнь" },
  { value: "7", label: "Июль" },
  { value: "8", label: "Август" },
  { value: "9", label: "Сентябрь" },
  { value: "10", label: "Октябрь" },
  { value: "11", label: "Ноябрь" },
  { value: "12", label: "Декабрь" },
];

const RecordaRatesHeader = ({
  year,
  month,
  yearOptions,
  onChangeYear,
  onChangeMonth,
  onSave,
  onExport,
  ratesLoading,
}) => {
  const yearOpts = yearOptions.map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <header className="barberrecordarates__header">
      <div className="barberrecordarates__filters">
        <div className="barberrecordarates__filter">
          <span className="barberrecordarates__filterLabel">Месяц</span>
          <BarberSelect
            value={String(month)}
            onChange={(val) => onChangeMonth?.(Number(val))}
            options={MONTHS}
            placeholder="Выберите месяц"
          />
        </div>

        <div className="barberrecordarates__filter">
          <span className="barberrecordarates__filterLabel">Год</span>
          <BarberSelect
            value={String(year)}
            onChange={(val) => onChangeYear?.(Number(val))}
            options={yearOpts}
            placeholder="Выберите год"
          />
        </div>
      </div>

      <div className="barberrecordarates__headerBtns">
        <button
          className="barberrecordarates__btn barberrecordarates__btn--primary"
          onClick={onSave}
          disabled={ratesLoading}
          type="button"
          title="Сохранить ставки"
        >
          <FaSave />
          <span className="barberrecordarates__btnText">
            {ratesLoading ? "Сохранение…" : "Сохранить"}
          </span>
        </button>

        <button
          className="barberrecordarates__btn barberrecordarates__btn--secondary"
          onClick={onExport}
          type="button"
          title="Скачать отчёт"
        >
          <FaDownload />
          <span className="barberrecordarates__btnText">Скачать</span>
        </button>
      </div>
    </header>
  );
};

export default RecordaRatesHeader;
