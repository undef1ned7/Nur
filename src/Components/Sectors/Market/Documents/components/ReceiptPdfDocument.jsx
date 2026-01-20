import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Регистрируем шрифты
const BASE = import.meta.env.PUBLIC_URL || ""; // Для CRA/Vite

Font.register({
  family: "Roboto",
  fonts: [
    { src: `${BASE}/fonts/robot/Roboto-Regular.ttf`, fontWeight: "normal" },
    { src: `${BASE}/fonts/robot/Roboto-Bold.ttf`, fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    padding: 30,
    color: "#000",
  },
  createdDate: {
    fontSize: 8,
    textAlign: "center",
    marginBottom: 8,
    color: "#666",
  },
  header: {
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  companyInfo: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 11,
    textAlign: "left",
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 9,
    textAlign: "left",
    color: "#666",
  },
  items: {
    marginTop: 12,
    marginBottom: 12,
  },
  item: {
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  itemName: {
    flex: 1,
    fontSize: 10,
    textAlign: "left",
  },
  itemPrice: {
    fontSize: 10,
    textAlign: "right",
    marginLeft: 12,
  },
  itemTotal: {
    fontSize: 10,
    textAlign: "right",
    fontWeight: "bold",
    marginTop: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginTop: 8,
    marginBottom: 8,
  },
  dividerDashed: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderStyle: "dashed",
    marginTop: 8,
    marginBottom: 8,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "right",
  },
  receiptInfo: {
    marginTop: 8,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  receiptPayment: {
    marginTop: 8,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 10,
  },
  receiptFooter: {
    marginTop: 12,
    textAlign: "center",
  },
  thankYou: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 6,
  },
});

function safe(v) {
  return v ? String(v) : "—";
}

function n2(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReceiptPdfDocument({ data }) {
  const doc = data?.document || data?.sale || {};
  const company = data?.company || {};
  const cashier = data?.cashier || {};
  const client = data?.client || null;

  const items = Array.isArray(data?.items)
    ? data.items.map((item) => ({
        id: item.id,
        name: item.name || item.product_name || "Товар",
        qty: Number(item.qty || item.quantity || 0),
        unit_price: Number(item.unit_price || item.price || 0),
        total: Number(item.total || 0),
        unit: item.unit || "ШТ",
      }))
    : [];

  const totals = data?.totals || {};
  const total = Number(totals.total || 0);
  const subtotal = Number(totals.subtotal || 0);
  const discount = Number(totals.discount_total || 0);
  const tax = Number(totals.tax_total || 0);

  const payment = data?.payment || {};
  const paidCash =
    payment.method === "cash" ? Number(payment.cash_received || 0) : 0;
  const paidCard = payment.method === "card" ? Number(total) : 0;
  const change = Number(payment.change || 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Дата и время создания */}
        <Text style={s.createdDate}>
          {fmtDate(new Date().toISOString())}
        </Text>

        {/* Заголовок чека */}
        <View style={s.header}>
          <Text style={s.title}>
            ЧЕК №{doc.number || doc.doc_no || ""} от{" "}
            {fmtDate(doc.date || doc.created_at)}
          </Text>
        </View>

        {/* Информация о продавце */}
        <View style={s.companyInfo}>
          <Text style={s.companyName}>{company?.name || "market"}</Text>
          {company?.address && (
            <Text style={s.companyAddress}>{company.address}</Text>
          )}
        </View>

        {/* Список товаров */}
        <View style={s.items}>
          {items.length > 0 ? (
            items.map((item, index) => (
              <View key={item.id || index} style={s.item}>
                <View style={s.itemRow}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemPrice}>
                    {n2(item.qty)} X {n2(item.unit_price)} =
                  </Text>
                </View>
                <Text style={s.itemTotal}>{n2(item.total)}</Text>
              </View>
            ))
          ) : (
            <View style={s.item}>
              <Text style={s.itemName}>Нет товаров</Text>
            </View>
          )}
        </View>

        {/* Пунктирная линия перед итогом */}
        <View style={s.dividerDashed} />

        {/* Итого */}
        <View style={s.totalSection}>
          <Text style={s.totalLabel}>ИТОГ</Text>
          <Text style={s.totalAmount}>{n2(total)}</Text>
        </View>

        {/* Информация о кассире и клиенте */}
        {(cashier?.name || client?.full_name) && (
          <View style={s.receiptInfo}>
            {cashier?.name && (
              <View style={s.infoRow}>
                <Text>Кассир:</Text>
                <Text>{cashier.name}</Text>
              </View>
            )}
            {client?.full_name && (
              <View style={s.infoRow}>
                <Text>Покупатель:</Text>
                <Text>{client.full_name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Оплата */}
        {(paidCash > 0 || paidCard > 0 || change > 0) && (
          <>
            <View style={s.divider} />
            <View style={s.receiptPayment}>
              {paidCash > 0 && (
                <View style={s.paymentRow}>
                  <Text>Наличными:</Text>
                  <Text>{n2(paidCash)}</Text>
                </View>
              )}
              {paidCard > 0 && (
                <View style={s.paymentRow}>
                  <Text>Картой:</Text>
                  <Text>{n2(paidCard)}</Text>
                </View>
              )}
              {change > 0 && (
                <View style={s.paymentRow}>
                  <Text>Сдача:</Text>
                  <Text>{n2(change)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Футер чека */}
        <View style={s.receiptFooter}>
          <View style={s.divider} />
          <Text style={s.thankYou}>Спасибо за покупку!</Text>
        </View>
      </Page>
    </Document>
  );
}
