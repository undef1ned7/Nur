import React from "react";
import "./PaymentCategoryTable.scss";

const PaymentCategoryTable = ({
  categories,
  loading,
  onCategoryClick,
  getRowNumber,
}) => {
  if (loading) {
    return (
      <div className="payment-category-table-wrap">
        <table className="warehouse-table payment-category-table">
          <tbody>
            <tr>
              <td colSpan={2} className="warehouse-table__loading">
                Загрузка...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (!categories?.length) {
    return (
      <div className="payment-category-table-wrap">
        <table className="warehouse-table payment-category-table">
          <tbody>
            <tr>
              <td colSpan={2} className="warehouse-table__empty">
                Категории платежей не найдены
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="payment-category-table-wrap">
      <table className="warehouse-table payment-category-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Название</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, index) => (
            <tr
              key={cat.id}
              className="warehouse-table__row payment-category-table__row"
              onClick={() => onCategoryClick(cat)}
            >
              <td>{getRowNumber(index, categories.length)}</td>
              <td className="warehouse-table__name">
                <span>{cat.title ?? cat.name ?? "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(PaymentCategoryTable);
