import React from "react";
import { COUNTERPARTY_LEGAL_FIELDS } from "../constants";

/**
 * Поля реквизитов контрагента для форм создания и редактирования
 */
const CounterpartyLegalFields = ({ formData, onChange, disabled = false }) => (
  <>
    {COUNTERPARTY_LEGAL_FIELDS.map(({ name, label, placeholder }) => (
      <div key={name} className="warehouse-filter-modal__section">
        <label className="warehouse-filter-modal__label" htmlFor={`counterparty-${name}`}>
          {label}
        </label>
        <input
          id={`counterparty-${name}`}
          type="text"
          name={name}
          className="warehouse-filter-modal__select"
          placeholder={placeholder}
          value={formData[name] ?? ""}
          onChange={onChange}
          disabled={disabled}
          autoComplete="off"
        />
      </div>
    ))}
  </>
);

export default CounterpartyLegalFields;
