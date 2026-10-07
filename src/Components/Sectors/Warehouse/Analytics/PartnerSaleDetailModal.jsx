import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getPartnerSale } from "../../../../api/warehousePartnership";
import { extractPartnershipError } from "../Warehouses/partnership/partnershipHelpers";
import { formatNum } from "./warehouseAnalyticsShared";
import {
  paymentKindLabel,
  saleLineAmount,
  saleStatusMeta,
} from "./partnerSalesModel";
import "../../Market/Warehouse/Warehouse.scss";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("ru-RU");
};

/**
 * Состав документа продажи партнёра. Монтируется только открытым.
 * `summaryRow` — строка из списка: шапку показываем сразу, строки дозагружаем.
 */
const PartnerSaleDetailModal = ({ partnerId, summaryRow, onClose }) => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPartnerSale(partnerId, summaryRow.id)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((e) => {
        if (!cancelled) setError(extractPartnershipError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, summaryRow.id]);

  const head = doc || summaryRow;
  const items = Array.isArray(doc?.items) ? doc.items : [];
  const isReturn = head.doc_type === "SALE_RETURN";
  const status = saleStatusMeta(head.status);

  return (
    <div className="warehouse-filter-overlay" onClick={onClose} role="presentation">
      <div
        className="warehouse-filter-modal partner-sale-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${isReturn ? "Возврат" : "Продажа"} ${head.number || ""}`}
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">
            {isReturn ? "Возврат продажи" : "Продажа"} № {head.number || "—"}
          </h3>
          <button
            type="button"
            className="warehouse-filter-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="warehouse-filter-modal__content">
          <dl className="partner-sale-modal__meta">
            <div>
              <dt>Дата</dt>
              <dd>{fmtDate(head.date)}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>
                <span className={`partner-sales__status ${status.className}`}>
                  {status.label}
                </span>
              </dd>
            </div>
            <div>
              <dt>Склад</dt>
              <dd>
                {head.warehouse_from_name || "—"}
                {head.branch_name ? ` (${head.branch_name})` : ""}
              </dd>
            </div>
            <div>
              <dt>Покупатель</dt>
              <dd>{head.counterparty_display_name || "—"}</dd>
            </div>
            <div>
              <dt>Агент</dt>
              <dd>{head.agent_display || "—"}</dd>
            </div>
            <div>
              <dt>Оплата</dt>
              <dd>{paymentKindLabel(head.payment_kind)}</dd>
            </div>
          </dl>

          {loading ? (
            <div className="warehouse-analytics__loading">Загрузка позиций…</div>
          ) : error ? (
            <div className="warehouse-analytics__error">{error}</div>
          ) : (
            <div className="warehouse-analytics-tableWrap">
              <div className="warehouse-analytics-tableScroll">
                <table className="warehouse-analytics-table">
                  <thead>
                    <tr>
                      <th scope="col">Товар</th>
                      <th scope="col">Артикул</th>
                      <th scope="col">Кол-во</th>
                      <th scope="col">Цена</th>
                      <th scope="col">Скидка</th>
                      <th scope="col">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>{it.product_name || "—"}</td>
                        <td>{it.product_article || "—"}</td>
                        <td className="is-num">
                          {formatNum(it.qty)} {it.unit || ""}
                        </td>
                        <td className="is-num">{formatNum(it.price)}</td>
                        <td className="is-num">
                          {Number(it.discount_amount) > 0
                            ? `${formatNum(it.discount_amount)} сом`
                            : "—"}
                        </td>
                        <td className="is-num">{formatNum(saleLineAmount(it))} сом</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {items.length === 0 && (
                <div className="warehouse-analytics-table__empty">Нет позиций.</div>
              )}
            </div>
          )}

          <div className="partner-sale-modal__total">
            {Number(head.discount_amount) > 0 && (
              <span>Скидка: {formatNum(head.discount_amount)} сом</span>
            )}
            <strong>Итого: {formatNum(head.total)} сом</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerSaleDetailModal;
