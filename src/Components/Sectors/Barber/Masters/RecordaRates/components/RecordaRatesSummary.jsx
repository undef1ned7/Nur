// RecordaRatesSummary.jsx
import React from "react";
import { fmtMoney } from "../RecordaRates.utils";

const RecordaRatesSummary = ({ totals }) => {
  return (
    <div className="barberrecordarates__summary">
      <span className="barberrecordarates__summaryLabel">Итого фонд выплат:</span>
      <span className="barberrecordarates__summaryValue">{fmtMoney(totals)}</span>
    </div>
  );
};

export default RecordaRatesSummary;
