import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { emptyBankAccountRow } from "../counterpartyBankAccounts";

const CounterpartyBankAccountsFields = ({
  bankAccounts,
  onChange,
  disabled = false,
}) => {
  const rows = Array.isArray(bankAccounts) ? bankAccounts : [];

  const updateRow = (index, field, value) => {
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => {
    onChange([...rows, emptyBankAccountRow()]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) {
      onChange([emptyBankAccountRow()]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="warehouse-filter-modal__section counterparty-bank-accounts">
      <div className="counterparty-bank-accounts__head">
        <label className="warehouse-filter-modal__label">
          Банковские реквизиты
        </label>
        <button
          type="button"
          className="counterparty-bank-accounts__add-btn"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus size={14} />
          Добавить счёт
        </button>
      </div>
      <p className="counterparty-bank-accounts__hint">
        Р/С и БИК указываются парой в одной строке.
      </p>
      {rows.map((row, index) => (
        <div key={row.id || `bank-${index}`} className="counterparty-bank-accounts__row">
          <div className="counterparty-bank-accounts__field">
            <label className="warehouse-filter-modal__label">Р/с</label>
            <input
              type="text"
              className="warehouse-filter-modal__select"
              placeholder="Введите расчётный счёт"
              value={row.score ?? ""}
              onChange={(e) => updateRow(index, "score", e.target.value)}
              disabled={disabled}
              autoComplete="off"
            />
          </div>
          <div className="counterparty-bank-accounts__field">
            <label className="warehouse-filter-modal__label">БИК</label>
            <input
              type="text"
              className="warehouse-filter-modal__select"
              placeholder="Введите БИК"
              value={row.bik ?? ""}
              onChange={(e) => updateRow(index, "bik", e.target.value)}
              disabled={disabled}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="counterparty-bank-accounts__remove-btn"
            onClick={() => removeRow(index)}
            disabled={disabled}
            aria-label="Удалить счёт"
            title="Удалить счёт"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default CounterpartyBankAccountsFields;
