import React from "react";
import {
  formatBatchDateTime,
  formatBatchMoney,
  formatBatchNumber,
} from "./purchaseBatchUtils";

const PurchaseBatchTable = ({
  batches = [],
  loading = false,
  emptyMessage = "История закупок пуста",
  onReceiptClick,
}) => {
  const rows = Array.isArray(batches) ? batches : [];

  return (
    <div className="purchase-batch-history__table-wrap">
      <table className="purchase-batch-history__table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Поставщик</th>
            <th>Кол-во</th>
            <th>Цена закупки</th>
            <th>Сумма</th>
            <th>Сотрудник</th>
            <th>Документ</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="purchase-batch-history__empty">
                Загрузка...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="purchase-batch-history__empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((batch, index) => {
              const rowKey = batch.id || `${batch.receipt_id}-${index}`;
              const receiptId = batch.receipt_id;
              const canOpenReceipt =
                Boolean(receiptId) && typeof onReceiptClick === "function";

              return (
                <tr key={rowKey}>
                  <td>{formatBatchDateTime(batch.created_at)}</td>
                  <td>{batch.supplier_name || "—"}</td>
                  <td>{formatBatchNumber(batch.qty)}</td>
                  <td>{formatBatchMoney(batch.purchase_price, 3)}</td>
                  <td>{formatBatchMoney(batch.line_total)}</td>
                  <td>{batch.created_by_name || "—"}</td>
                  <td>
                    {canOpenReceipt ? (
                      <button
                        type="button"
                        className="purchase-batch-history__receipt-link"
                        onClick={() => onReceiptClick(batch)}
                      >
                        Приход
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PurchaseBatchTable;
