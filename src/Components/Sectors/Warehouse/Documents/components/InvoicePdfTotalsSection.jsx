import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { amountToWordsKgs } from "./amountToWordsKgs";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import { n2 } from "./invoicePdfDocumentUtils";

export default function InvoicePdfTotalsSection({
  items,
  total,
  documentDiscountPercent,
  documentDiscountAmount,
  showDocumentDiscountLine = true,
}) {
  const showDiscountLine =
    showDocumentDiscountLine &&
    (documentDiscountAmount > 0 || documentDiscountPercent > 0);

  return (
    <>
      <View style={s.totalsSection}>
        {showDiscountLine && (
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Скидка документа:</Text>
            <Text style={s.totalValue}>
              {n2(documentDiscountAmount)}{" "}
              {documentDiscountPercent > 0
                ? `(${n2(documentDiscountPercent)}%)`
                : ""}
            </Text>
          </View>
        )}
        <View style={[s.totalRow, s.totalBold]}>
          <Text style={[s.totalLabel, s.totalBold]}>ИТОГО:</Text>
          <Text style={[s.totalValue, s.totalBold]}>{n2(total)}</Text>
        </View>
      </View>

      <View style={{ marginTop: 4, fontSize: 7 }}>
        <Text style={{ fontSize: 7 }}>
          Всего наименований {items.length}, на сумму {n2(total)} KGS
        </Text>
      </View>

      <View style={{ marginTop: 2, fontSize: 7 }}>
        <Text style={{ fontSize: 7, textTransform: "capitalize" }}>
          {amountToWordsKgs(total)}
        </Text>
      </View>
    </>
  );
}
