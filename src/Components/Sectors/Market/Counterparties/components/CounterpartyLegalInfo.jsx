import React from "react";
import { COUNTERPARTY_LEGAL_FIELDS } from "../constants";
import { bankAccountsFromCounterparty } from "../counterpartyBankAccounts";

const displayValue = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || "—";
};

/**
 * Блок реквизитов контрагента для страницы детального просмотра
 */
const CounterpartyLegalInfo = ({ counterparty }) => {
  if (!counterparty) return null;

  const bankAccounts = bankAccountsFromCounterparty(counterparty).filter(
    (row) => String(row.score || "").trim() || String(row.bik || "").trim(),
  );

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

      {bankAccounts.length > 0 ? (
        <div className="counterparty-detail-page__bank-accounts">
          <h3 className="counterparty-detail-page__bank-accounts-title">
            Банковские счета
          </h3>
          <div className="counterparty-detail-page__bank-accounts-list">
            {bankAccounts.map((row, index) => (
              <div
                key={row.id || `bank-${index}`}
                className="counterparty-detail-page__bank-account"
              >
                <div>
                  <span className="counterparty-detail-page__legal-label">Р/с</span>
                  <div className="counterparty-detail-page__legal-value">
                    {displayValue(row.score)}
                  </div>
                </div>
                <div>
                  <span className="counterparty-detail-page__legal-label">БИК</span>
                  <div className="counterparty-detail-page__legal-value">
                    {displayValue(row.bik)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CounterpartyLegalInfo;
