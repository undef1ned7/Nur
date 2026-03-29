import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import { fmtQty, goodsRowKey, n2 } from "./invoicePdfDocumentUtils";

function TableHeaderRow({ columns }) {
  return (
    <View style={[s.tableRow, s.tableHeader]}>
      {columns.map((col, i) => (
        <View
          key={col.key}
          style={[
            ...col.cellStyle,
            i === columns.length - 1 ? s.tableCellLast : null,
          ]}
        >
          <Text style={col.headerTextStyle || {}}>{col.header}</Text>
        </View>
      ))}
    </View>
  );
}

function DataRow({ columns, it, idx, rowStyle }) {
  return (
    <View style={rowStyle}>
      {columns.map((col, i) => (
        <View
          key={col.key}
          style={[
            ...col.cellStyle,
            i === columns.length - 1 ? s.tableCellLast : null,
          ]}
        >
          {col.renderCell(it, idx)}
        </View>
      ))}
    </View>
  );
}

function buildTransferColumns() {
  return [
    {
      key: "no",
      cellStyle: [s.tableCell, s.colNoTransfer],
      header: "№",
      headerTextStyle: {},
      renderCell: (it, idx) => <Text>{idx + 1}</Text>,
    },
    {
      key: "name",
      cellStyle: [s.tableCell, s.colNameTransfer],
      header: "Наименование",
      headerTextStyle: {},
      renderCell: (it) => <Text>{it.name}</Text>,
    },
    {
      key: "art",
      cellStyle: [s.tableCell, s.colArtTransfer],
      header: "Арт.",
      headerTextStyle: {},
      renderCell: (it) => <Text>{it.article || ""}</Text>,
    },
    {
      key: "unit",
      cellStyle: [s.tableCell, s.colUnitTransfer],
      header: "Ед. изм.",
      headerTextStyle: {},
      renderCell: (it) => <Text>{it.unit || "ШТ"}</Text>,
    },
    {
      key: "qty",
      cellStyle: [s.tableCell, s.colQtyTransfer],
      header: "Кол-во",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>{fmtQty(it.qty)}</Text>
      ),
    },
  ];
}

function buildStandardColumns({
  isInventory,
  showPriceColumns,
  showDiscountColumns,
}) {
  const base = [
    {
      key: "no",
      cellStyle: [s.tableCell, s.colNo],
      header: "№",
      headerTextStyle: {},
      renderCell: (it, idx) => <Text>{idx + 1}</Text>,
    },
    {
      key: "name",
      cellStyle: [s.tableCell, s.colName],
      header: "Наименование",
      headerTextStyle: {},
      renderCell: (it) => <Text>{it.name}</Text>,
    },
    {
      key: "art",
      cellStyle: [s.tableCell, s.colArt],
      header: "Арт.",
      headerTextStyle: {},
      renderCell: (it) => <Text>{it.article || "—"}</Text>,
    },
    {
      key: "unit",
      cellStyle: [s.tableCell, s.colUnit],
      header: "Ед. изм.",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>{it.unit || "ШТ"}</Text>
      ),
    },
  ];

  if (isInventory) {
    return [
      ...base,
      {
        key: "fact",
        cellStyle: [s.tableCell, { width: "55%", textAlign: "right" }],
        header: "Остаток факт.",
        headerTextStyle: { textAlign: "right" },
        renderCell: () => (
          <Text style={{ textAlign: "right" }}>—</Text>
        ),
      },
    ];
  }

  if (!showPriceColumns) {
    return [
      ...base,
      {
        key: "filler",
        cellStyle: [s.tableCell, { width: "47%", textAlign: "right" }],
        header: "",
        headerTextStyle: {},
        renderCell: () => <Text />,
      },
    ];
  }

  const qtyCol = {
    key: "qty",
    cellStyle: [s.tableCell, s.colQty],
    header: "Кол-во",
    headerTextStyle: { textAlign: "right" },
    renderCell: (it) => (
      <Text style={{ textAlign: "right" }}>{fmtQty(it.qty)}</Text>
    ),
  };

  if (!showDiscountColumns) {
    return [
      ...base,
      qtyCol,
      {
        key: "price",
        cellStyle: [s.tableCell, s.colPrice],
        header: "Цена",
        headerTextStyle: { textAlign: "right" },
        renderCell: (it) => (
          <Text style={{ textAlign: "right" }}>{n2(it.unit_price)}</Text>
        ),
      },
      {
        key: "sum",
        cellStyle: [s.tableCell, s.colSum],
        header: "Сумма",
        headerTextStyle: { textAlign: "right" },
        renderCell: (it) => (
          <Text style={{ textAlign: "right" }}>{n2(it.total)}</Text>
        ),
      },
    ];
  }

  return [
    ...base,
    qtyCol,
    {
      key: "priceNoDisc",
      cellStyle: [s.tableCell, s.colPriceNoDiscount],
      header: "Цена без скидки",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>{n2(it.price_no_discount)}</Text>
      ),
    },
    {
      key: "disc",
      cellStyle: [s.tableCell, s.colDiscount],
      header: "Скидка",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>
          {it.discount > 0 ? `${n2(it.discount)}%` : "—"}
        </Text>
      ),
    },
    {
      key: "price",
      cellStyle: [s.tableCell, s.colPrice],
      header: "Цена",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>{n2(it.unit_price)}</Text>
      ),
    },
    {
      key: "sum",
      cellStyle: [s.tableCell, s.colSum],
      header: "Сумма",
      headerTextStyle: { textAlign: "right" },
      renderCell: (it) => (
        <Text style={{ textAlign: "right" }}>{n2(it.total)}</Text>
      ),
    },
  ];
}

function TotalsFooterRow({
  items,
  showDiscountColumns,
  showPriceColumns,
}) {
  if (!showPriceColumns) return null;

  return (
    <View style={[s.tableRow, s.tableRowLast, s.tableHeader]}>
      <View style={[s.tableCell, s.colNo]}>
        <Text />
      </View>
      <View style={[s.tableCell, s.colName]}>
        <Text style={{ fontWeight: "bold" }}>Итого:</Text>
      </View>
      <View style={[s.tableCell, s.colArt]}>
        <Text />
      </View>
      <View style={[s.tableCell, s.colUnit]}>
        <Text />
      </View>
      <View style={[s.tableCell, s.colQty]}>
        <Text style={{ textAlign: "right", fontWeight: "bold" }}>
          {fmtQty(items.reduce((sum, it) => sum + Number(it.qty || 0), 0))}
        </Text>
      </View>
      {showDiscountColumns && (
        <>
          <View style={[s.tableCell, s.colPriceNoDiscount]}>
            <Text />
          </View>
          <View style={[s.tableCell, s.colDiscount]}>
            <Text />
          </View>
          <View style={[s.tableCell, s.colPrice]}>
            <Text />
          </View>
        </>
      )}
      {!showDiscountColumns && (
        <View style={[s.tableCell, s.colPrice]}>
          <Text />
        </View>
      )}
      <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
        <Text style={{ textAlign: "right", fontWeight: "bold" }}>
          {n2(items.reduce((sum, it) => sum + Number(it.total || 0), 0))}
        </Text>
      </View>
    </View>
  );
}

export default function InvoicePdfGoodsTable({
  items,
  isTransfer,
  isInventory,
  showPriceColumns,
  showDiscountColumns,
  invoiceNumber,
}) {
  const columns = isTransfer
    ? buildTransferColumns()
    : buildStandardColumns({
        isInventory,
        showPriceColumns,
        showDiscountColumns,
      });

  return (
    <View style={s.goodsTable}>
      <TableHeaderRow columns={columns} />
      {items.map((it, idx) => (
        <DataRow
          key={goodsRowKey(it, idx, invoiceNumber)}
          columns={columns}
          it={it}
          idx={idx}
          rowStyle={
            isTransfer && idx === items.length - 1
              ? [s.tableRow, s.tableRowLast]
              : s.tableRow
          }
        />
      ))}
      {!isTransfer && (
        <TotalsFooterRow
          items={items}
          showDiscountColumns={showDiscountColumns}
          showPriceColumns={showPriceColumns}
        />
      )}
    </View>
  );
}
