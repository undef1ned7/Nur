import { resolveCafeOrderFinancials } from "../../utils/cafeOrderFinancials";

export function CafeOrderFinancialTotals({
  order,
  itemsTotal,
  fmt,
  variant = "list",
}) {
  const fin = resolveCafeOrderFinancials(order, itemsTotal);
  const showBreakdown = fin.discount > 0;
  const totalLabel = showBreakdown ? "К оплате" : "ИТОГО";

  if (variant === "modal") {
    return (
      <>
        {showBreakdown ? (
          <div className="cafeOrdersPay__summary">
            <div className="cafeOrdersPay__summaryRow">
              <span>Сумма</span>
              <span>{fmt(fin.subtotal)}</span>
            </div>
            <div className="cafeOrdersPay__summaryRow">
              <span>Скидка</span>
              <span>−{fmt(fin.discount)}</span>
            </div>
          </div>
        ) : null}
        <div className="cafeOrdersPay__total">
          <span>{totalLabel}</span>
          <span>{fmt(fin.total)}</span>
        </div>
      </>
    );
  }

  return (
    <>
      {showBreakdown ? (
        <>
          <div className="cafeOrders__receiptSubline">
            <span>Сумма</span>
            <span>{fmt(fin.subtotal)}</span>
          </div>
          <div className="cafeOrders__receiptSubline">
            <span>Скидка</span>
            <span>−{fmt(fin.discount)}</span>
          </div>
        </>
      ) : null}
      <div className="cafeOrders__receiptTotal">
        <span className="cafeOrders__receiptTotalLabel">{totalLabel}</span>
        <span className="cafeOrders__receiptTotalAmount">{fmt(fin.total)}</span>
      </div>
    </>
  );
}
