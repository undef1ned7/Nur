import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import {
  fmtDate,
  fmtDateTime,
  getDocumentTitle,
  needsDiscountColumns,
  needsPriceColumns,
  resolveDocumentDiscount,
  safe,
} from "./invoicePdfDocumentUtils";
import InvoicePdfGoodsTable from "./InvoicePdfGoodsTable";
import InvoicePdfParties from "./InvoicePdfParties";
import InvoicePdfSignatures from "./InvoicePdfSignatures";
import InvoicePdfTotalsSection from "./InvoicePdfTotalsSection";

registerPdfFonts();

// Генерируем PDF накладной
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
  const showDiscountColumns = needsDiscountColumns(docType);
  const isInventory = docType === "INVENTORY";
  const isTransfer = docType === "TRANSFER";

  const { documentDiscountPercent, documentDiscountAmount, showDocumentDiscountLine } =
    resolveDocumentDiscount(doc, data, subtotal, data?.items);

  const docDiscountPctForLines = Number(doc.discount_percent ?? 0);

  const items = Array.isArray(data?.items)
    ? data.items.map((it) => {
        const qty = Number(it.qty || it.quantity || 0);
        const unitBase = Number(it.price ?? it.unit_price ?? 0);
        const lineDisc = Number(it.discount_percent ?? it.discount ?? 0);
        const discount =
          it.effective_discount_percent != null && it.effective_discount_percent !== ""
            ? Number(it.effective_discount_percent)
            : lineDisc > 0
              ? lineDisc
              : docDiscountPctForLines;

        let priceNoDiscount = Number(
          it.original_price ??
            it.price_before_discount ??
            it.price_without_discount ??
            unitBase
        );
        if (!priceNoDiscount) {
          priceNoDiscount = unitBase;
        }

        const priceAfterDiscount =
          priceNoDiscount * (1 - Number(discount || 0) / 100);
        const rowTotal = qty * priceAfterDiscount;

        return {
          id: it.id,
          name: it.name || it.product_name || "Товар",
          qty,
          unit_price: priceAfterDiscount,
          price_no_discount: priceNoDiscount,
          discount,
          total: rowTotal,
          unit: it.unit || "ШТ",
          article: it.article || "",
        };
      })
    : [];

  const invoiceNumber = doc.number || "";
  const invoiceDate = doc.datetime || doc.date || "";
  const docComment = String(doc.comment ?? data?.comment ?? "").trim();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 7 }}>
            {fmtDateTime(invoiceDate || new Date().toISOString())}
          </Text>
        </View>

        <View style={s.header}>
          <Text style={s.title}>
            {documentTitle} № {invoiceNumber || "—"} от {fmtDate(invoiceDate)}
          </Text>
        </View>

        {seller?.name && !isTransfer && (
          <Text style={{ fontSize: 7, textAlign: "right", marginBottom: 4 }}>
            Автор: {safe(seller.name)}
          </Text>
        )}

        {(isInventory || isTransfer) && seller?.name && (
          <View style={{ marginTop: 4, marginBottom: 6 }}>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>
              Организация: {safe(seller.name)}
            </Text>
            {seller.address && (
              <Text style={{ fontSize: 8 }}>{safe(seller.address)}</Text>
            )}
          </View>
        )}

        <InvoicePdfParties
          docType={docType}
          seller={seller}
          buyer={buyer}
          isInventory={isInventory}
          isTransfer={isTransfer}
        />

        {!isTransfer && data?.warehouse && (
          <View style={s.warehouse}>
            <Text>Склад: «{safe(data.warehouse)}»</Text>
          </View>
        )}

        {isTransfer && (
          <View style={{ marginTop: 4, marginBottom: 8, gap: 4 }}>
            {data?.warehouse && (
              <Text style={{ fontSize: 8 }}>
                Со склада: «{safe(data.warehouse)}»
              </Text>
            )}
            {data?.warehouse_to && (
              <Text style={{ fontSize: 8 }}>
                На склад: «{safe(data.warehouse_to)}»
              </Text>
            )}
          </View>
        )}

        {docComment ? (
          <View style={{ marginTop: 4, marginBottom: 6 }}>
            <Text style={{ fontSize: 8 }}>Комментарий: {safe(docComment)}</Text>
          </View>
        ) : null}

        <InvoicePdfGoodsTable
          items={items}
          isTransfer={isTransfer}
          isInventory={isInventory}
          showPriceColumns={showPriceColumns}
          showDiscountColumns={showDiscountColumns}
          invoiceNumber={invoiceNumber}
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
          <View style={{ marginTop: 4, fontSize: 7, gap: 2 }}>
            <Text style={{ fontSize: 7 }}>
              Всего позиций: {items.length}
            </Text>
            <Text style={{ fontSize: 7 }}>
              Дата печати: {fmtDateTime(new Date().toISOString())}
            </Text>
            <Text style={{ fontSize: 7, marginTop: 4 }}>
              Заполнил: _________
            </Text>
          </View>
        )}

        <InvoicePdfSignatures />
      </Page>
    </Document>
  );
}