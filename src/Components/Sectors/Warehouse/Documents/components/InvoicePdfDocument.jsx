import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import {
  buildInvoiceItemsFromData,
  fmtTitleDateTime,
  getDocumentTitle,
  needsPriceColumns,
  resolveDocumentDiscount,
  safe,
} from "./invoicePdfDocumentUtils";
import InvoicePdfGoodsTable from "./InvoicePdfGoodsTable";
import InvoicePdfParties from "./InvoicePdfParties";
import InvoicePdfSignatures from "./InvoicePdfSignatures";
import InvoicePdfTotalsSection from "./InvoicePdfTotalsSection";

registerPdfFonts();

export default function InvoicePdfDocument({ data }) {
  const doc = data?.document || {};
  const seller = data?.seller || {};
  const buyer = data?.buyer || null;
  const docType = data?.doc_type || doc.doc_type || doc.type || "SALE";

  const totals = data?.totals || {};
  const subtotal = Number(totals.subtotal || 0);
  const total = Number(totals.total || 0);

  const documentTitle = getDocumentTitle(docType);
  const showPriceColumns = needsPriceColumns(docType);
  const isInventory = docType === "INVENTORY";
  const isTransfer = docType === "TRANSFER";

  const { documentDiscountPercent, documentDiscountAmount, showDocumentDiscountLine } =
    resolveDocumentDiscount(doc, data, subtotal, data?.items);

  const items = buildInvoiceItemsFromData(data);

  const invoiceNumber = doc.number || "";
  const invoiceDate = doc.datetime || doc.date || doc.created_at || "";
  const docComment = String(doc.comment ?? data?.comment ?? "").trim();

  const titleLine = `${documentTitle} № ${invoiceNumber || "—"} от ${fmtTitleDateTime(invoiceDate)}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{titleLine}</Text>

        <InvoicePdfParties
          docType={docType}
          seller={seller}
          buyer={buyer}
          isInventory={isInventory}
          isTransfer={isTransfer}
        />

        {isTransfer && (
          <View style={{ marginBottom: 6, gap: 2 }}>
            {data?.warehouse ? (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Со склада:</Text>
                <Text>{safe(data.warehouse)}</Text>
              </View>
            ) : null}
            {data?.warehouse_to ? (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>На склад:</Text>
                <Text>{safe(data.warehouse_to)}</Text>
              </View>
            ) : null}
          </View>
        )}

        {!isTransfer && !isInventory && data?.warehouse ? (
          <View style={[s.metaRow, { marginBottom: 6 }]}>
            <Text style={s.metaLabel}>Склад:</Text>
            <Text>{safe(data.warehouse)}</Text>
          </View>
        ) : null}

        {docComment ? (
          <View style={[s.metaRow, { marginBottom: 6 }]}>
            <Text style={s.metaLabel}>Комментарий:</Text>
            <Text>{safe(docComment)}</Text>
          </View>
        ) : null}

        <InvoicePdfGoodsTable
          items={items}
          isTransfer={isTransfer}
          isInventory={isInventory}
          showPriceColumns={showPriceColumns}
          invoiceNumber={invoiceNumber}
          total={total}
        />

        {showPriceColumns && (
          <InvoicePdfTotalsSection
            items={items}
            total={total}
            documentDiscountPercent={documentDiscountPercent}
            documentDiscountAmount={documentDiscountAmount}
            showDocumentDiscountLine={showDocumentDiscountLine}
          />
        )}

        {isInventory && (
          <View style={s.inventoryNote}>
            <Text>Всего позиций: {items.length}</Text>
            <Text>Заполнил: _________________</Text>
          </View>
        )}

        {!isInventory && <InvoicePdfSignatures />}
      </Page>
    </Document>
  );
}
