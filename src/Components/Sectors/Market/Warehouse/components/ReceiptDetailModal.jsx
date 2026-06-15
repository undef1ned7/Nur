import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../../../../../api";
import {
  formatBatchDateTime,
  formatBatchMoney,
  formatBatchNumber,
  receiptItemLabel,
} from "./purchaseBatchUtils";
import "../SupplierReceiptPage.scss";

const ReceiptDetailModal = ({ receiptSeed, onClose }) => {
  const [receipt, setReceipt] = useState(receiptSeed || null);
  const [loading, setLoading] = useState(false);

  const receiptId = receiptSeed?.id ?? receiptSeed?.receipt_id ?? receiptSeed?.uuid;

  useEffect(() => {
    if (!receiptId) return;

    const existingItems = Array.isArray(receiptSeed?.items) ? receiptSeed.items : [];
    if (existingItems.length > 0) {
      setReceipt({ ...receiptSeed, items: existingItems });
      return;
    }

    let cancelled = false;

    const loadReceipt = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(
          `/main/suppliers/receipts/${encodeURIComponent(String(receiptId))}/`,
        );
        if (cancelled) return;
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.lines)
            ? data.lines
            : [];
        setReceipt({ ...receiptSeed, ...data, items });
      } catch {
        if (!cancelled) {
          setReceipt((prev) => prev || receiptSeed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadReceipt();

    return () => {
      cancelled = true;
    };
  }, [receiptId, receiptSeed]);

  if (!receiptSeed) return null;

  const items = Array.isArray(receipt?.items) ? receipt.items : [];

  return (
    <div
      className="market-receipt-page__modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="market-receipt-page__modal-card market-receipt-page__modal-card--detail"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-batch-receipt-title"
      >
        <div className="market-receipt-page__detail-head">
          <h3
            id="purchase-batch-receipt-title"
            className="market-receipt-page__modal-title"
          >
            Позиции прихода
          </h3>
          <button
            type="button"
            className="market-receipt-page__detail-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <div className="market-receipt-page__detail-meta">
          <span>
            <strong>Поставщик:</strong> {receipt?.supplier_name || "—"}
          </span>
          <span>
            <strong>Создал:</strong> {receipt?.created_by_name || "—"}
          </span>
          <span>
            <strong>Дата:</strong> {formatBatchDateTime(receipt?.created_at)}
          </span>
        </div>
        {loading ? (
          <p className="market-receipt-page__detail-empty">Загрузка позиций…</p>
        ) : items.length === 0 ? (
          <p className="market-receipt-page__detail-empty">
            Нет позиций для отображения.
          </p>
        ) : (
          <div className="market-receipt-page__detail-table-wrap">
            <table className="market-receipt-page__detail-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Наименование</th>
                  <th>Кол-во</th>
                  <th>Цена закупки</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const qty = Number(item.qty || 0);
                  const price = Number(item.purchase_price || 0);
                  const lineTotal =
                    item.line_total != null && item.line_total !== ""
                      ? Number(item.line_total)
                      : qty * price;

                  return (
                    <tr key={`${receiptId}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{receiptItemLabel(item)}</td>
                      <td>{formatBatchNumber(qty)}</td>
                      <td>{formatBatchMoney(price, 3)}</td>
                      <td>{formatBatchMoney(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="market-receipt-page__actions">
          <button
            type="button"
            className="market-receipt-page__secondary-button"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptDetailModal;
