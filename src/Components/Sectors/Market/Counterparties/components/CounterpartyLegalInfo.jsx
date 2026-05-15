import React from "react";
import { COUNTERPARTY_LEGAL_FIELDS } from "../constants";

const displayValue = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || "—";
};

/**
 * Блок реквизитов контрагента для страницы детального просмотра
 */
const CounterpartyLegalInfo = ({ counterparty }) => {
  if (!counterparty) return null;

  return (
    <section className="counterparty-detail-page__legal" aria-label="Реквизиты контрагента">
      <h2 className="counterparty-detail-page__legal-title">Реквизиты</h2>
      <dl className="counterparty-detail-page__legal-grid">
        {COUNTERPARTY_LEGAL_FIELDS.map(({ name, label }) => (
          <div key={name} className="counterparty-detail-page__legal-item">
            <dt className="counterparty-detail-page__legal-label">{label}</dt>
            <dd className="counterparty-detail-page__legal-value">
              {displayValue(counterparty[name])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default CounterpartyLegalInfo;
