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

  const count = items.length;
  const sumFormatted = n2(total);

  return (
    <View style={s.summaryBlock}>
      {showDiscountLine && (
        <Text style={s.summaryLine}>
          Скидка по документу: {n2(documentDiscountAmount)}
          {documentDiscountPercent > 0
            ? ` (${n2(documentDiscountPercent)}%)`
            : ""}
        </Text>
      )}
      <Text style={s.summaryLine}>
        Всего наименований {count}, на сумму {sumFormatted} сом
      </Text>
      <Text style={s.summaryAmountWords}>
        {amountToWordsKgs(total)}
      </Text>
    </View>
  );
}
