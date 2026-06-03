import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import {
  fmtDiscountPct,
  fmtQty,
  goodsRowKey,
  n2,
} from "./invoicePdfDocumentUtils";

function HeaderCell({ style, children, align, isLast }) {
  return (
    <View style={[s.tableCell, style, isLast ? s.tableCellLast : null]}>
      <Text style={align ? { textAlign: align, fontWeight: "bold" } : { fontWeight: "bold" }}>
        {children}
      </Text>
    </View>
  );
}

function DataCell({ style, children, align, isLast }) {
  return (
    <View style={[s.tableCell, style, isLast ? s.tableCellLast : null]}>
      <Text style={align ? { textAlign: align } : {}}>{children}</Text>
    </View>
  );
}

function buildPriceColumns() {
  return {
    keys: [
      "no",
      "art",
      "name",
      "qty",
      "unit",
      "priceNoDisc",
      "discount",
      "price",
      "sum",
    ],
    headers: [
      "п/п",
      "Артикул",
      "Название",
      "Кол-во",
      "Ед.",
      "Цена без скидки",
      "Скидка",
      "Цена",
      "Сумма",
    ],
    styles: [
      s.colNo,
      s.colArt,
      s.colName,
      s.colQty,
      s.colUnit,
      s.colPriceNoDisc,
      s.colDiscount,
      s.colPrice,
      s.colSum,
    ],
    aligns: [
      "center",
      "left",
      "left",
      "right",
      "center",
      "right",
      "right",
      "right",
      "right",
    ],
    render: (it, idx) => [
      String(idx + 1),
      it.article || "",
      it.name || "",
      fmtQty(it.qty),
      (it.unit || "шт").toLowerCase(),
      n2(it.price_no_discount),
      fmtDiscountPct(it.discount),
      n2(it.unit_price),
      n2(it.total),
    ],
    footerSpan: 7,
  };
}

function buildTransferColumns() {
  return {
    keys: ["no", "art", "name", "qty", "unit"],
    headers: ["п/п", "Артикул", "Название", "Кол-во", "Ед."],
    styles: [s.colNoWide, s.colArtWide, s.colNameWide, s.colQtyWide, s.colUnitWide],
    aligns: ["center", "left", "left", "right", "center"],
    render: (it, idx) => [
      String(idx + 1),
      it.article || "",
      it.name || "",
      fmtQty(it.qty),
      (it.unit || "шт").toLowerCase(),
    ],
    footerSpan: null,
  };
}

function buildInventoryColumns() {
  return {
    keys: ["no", "art", "name", "qty", "unit"],
    headers: ["п/п", "Артикул", "Название", "Кол-во", "Ед."],
    styles: [s.colNoWide, s.colArtWide, s.colNameWide, s.colQtyWide, s.colUnitWide],
    aligns: ["center", "left", "left", "right", "center"],
    render: (it, idx) => [
      String(idx + 1),
      it.article || "",
      it.name || "",
      fmtQty(it.qty),
      (it.unit || "шт").toLowerCase(),
    ],
    footerSpan: null,
  };
}

export default function InvoicePdfGoodsTable({
  items,
  isTransfer,
  isInventory,
  showPriceColumns,
  invoiceNumber,
  total,
}) {
  const layout = isTransfer
    ? buildTransferColumns()
    : isInventory
      ? buildInventoryColumns()
      : showPriceColumns
        ? buildPriceColumns()
        : buildTransferColumns();

  const itemsSum = items.reduce((sum, it) => sum + Number(it.total || 0), 0);
  const grandTotal = Number(total) > 0 ? Number(total) : itemsSum;

  return (
    <View style={s.goodsTable}>
      <View style={[s.tableRow, s.tableHeader]}>
        {layout.headers.map((h, i) => (
          <HeaderCell
            key={layout.keys[i]}
            style={layout.styles[i]}
            align={layout.aligns[i]}
            isLast={i === layout.headers.length - 1}
          >
            {h}
          </HeaderCell>
        ))}
      </View>

      {items.map((it, idx) => {
        const cells = layout.render(it, idx);
        const isLastRow = idx === items.length - 1 && !layout.footerSpan;
        return (
          <View
            key={goodsRowKey(it, idx, invoiceNumber)}
            style={[s.tableRow, isLastRow ? s.tableRowLast : null]}
          >
            {cells.map((cell, ci) => (
              <DataCell
                key={`${layout.keys[ci]}-${ci}`}
                style={layout.styles[ci]}
                align={layout.aligns[ci]}
                isLast={ci === cells.length - 1}
              >
                {cell}
              </DataCell>
            ))}
          </View>
        );
      })}

      {layout.footerSpan != null && (
        <View style={[s.tableRow, s.tableRowLast, s.tableHeader]}>
          {layout.styles.map((colStyle, i) => {
            if (i < layout.footerSpan) {
              return (
                <View key={`ft-empty-${i}`} style={[s.tableCell, colStyle]}>
                  <Text />
                </View>
              );
            }
            if (i === layout.footerSpan) {
              return (
                <View
                  key="ft-label"
                  style={[
                    s.footerLabelCell,
                    colStyle,
                    { borderRightWidth: 1, borderRightColor: "#000" },
                  ]}
                >
                  <Text style={{ textAlign: "right" }}>Итого:</Text>
                </View>
              );
            }
            if (i === layout.footerSpan + 1) {
              return (
                <View key="ft-sum" style={[s.footerSumCell, colStyle, s.tableCellLast]}>
                  <Text>{n2(grandTotal)}</Text>
                </View>
              );
            }
            return (
              <View key={`ft-pad-${i}`} style={[s.tableCell, colStyle]}>
                <Text />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
