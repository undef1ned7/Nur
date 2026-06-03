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

  const discountValueText = showDiscountLine
    ? n2(documentDiscountAmount) +
      (documentDiscountPercent > 0
        ? ` (${n2(documentDiscountPercent)}%)`
        : "")
    : null;

  return (
    <View>
      {/* Правый блок: Скидка документа + ИТОГО */}
      <View style={s.totalsRightSection}>
        {showDiscountLine && (
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Скидка документа:</Text>
            <Text style={s.totalsValue}>{discountValueText}</Text>
          </View>
        )}
        <View style={s.totalsRowBold}>
          <Text style={s.totalsLabel}>ИТОГО:</Text>
          <Text style={s.totalsValue}>{sumFormatted}</Text>
        </View>
      </View>

      {/* Левый блок: кол-во наименований + сумма прописью */}
      <View style={[s.summaryBlock, { marginTop: 8 }]}>
        <Text style={s.summaryLine}>
          Всего наименований {count}, на сумму {sumFormatted} KGS
        </Text>
        <Text style={s.summaryAmountWords}>
          {amountToWordsKgs(total)}
        </Text>
      </View>
    </View>
  );
}
