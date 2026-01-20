// MastersPayoutsContainer.jsx
import React from "react";
import RecordaRates from "../../RecordaRates";

const MastersPayoutsContainer = ({
  year,
  month,
  onChangeYear,
  onChangeMonth,
  employees,
  appointments,
  services,
  rates,
  ratesLoading,
  ratesError,
  onChangeRate,
  onSaveRates,
}) => {
  return (
    <div className="barbermasterspayouts__inner">
      <RecordaRates
        year={year}
        month={month}
        onChangeYear={onChangeYear}
        onChangeMonth={onChangeMonth}
        employees={employees}
        appointments={appointments}
        services={services}
        rates={rates}
        ratesLoading={ratesLoading}
        ratesError={ratesError}
        onChangeRate={onChangeRate}
        onSaveRates={onSaveRates}
      />
    </div>
  );
};

export default MastersPayoutsContainer;
