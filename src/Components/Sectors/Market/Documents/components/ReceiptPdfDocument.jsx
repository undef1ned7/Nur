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
const BASE = process.env.PUBLIC_URL || ""; // Для CRA/Vite

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
  subtitle: {
    fontSize: 10,
    marginBottom: 10,
  },
  table: {
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f3f3",
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 20,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 9,
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  colNo: { width: "8%" },
  colName: { width: "40%" },
  colUnit: { width: "12%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "14%", textAlign: "right" },
  colSum: { width: "14%", textAlign: "right" },

  total: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
  },
  totalText: {
    marginTop: 8,
    fontSize: 9,
    textAlign: "left",
  },
  footer: {
    marginTop: 20,
    fontSize: 10,
    textAlign: "center",
  },
  signature: {
    marginTop: 15,
    fontSize: 9,
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 15,
    gap: 20,
  },
  signatureCol: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginTop: 20,
    minHeight: 20,
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
  const itemsCount = items.length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Дата и время создания */}
        <Text style={s.subtitle}>{fmtDateTime(new Date().toISOString())}</Text>

        {/* Заголовок - только один раз */}
        <View style={s.header}>
          <Text style={s.title}>
            ТОВАРНЫЙ ЧЕК №{doc.number || doc.doc_no || ""} от{" "}
            {fmtDate(doc.date || doc.created_at)}
          </Text>
        </View>

        {/* Информация о продавце */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 12, textAlign: "left" }}>
            {company?.name || "market"}
          </Text>
          <Text style={{ fontSize: 10, textAlign: "left" }}>
            {company?.address || "Балыкчы"}
          </Text>
        </View>

        {/* Таблица товаров */}
        <View style={s.table}>
          {/* Заголовок таблицы */}
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.tableCell, s.colNo]}>
              <Text>№</Text>
            </View>
            <View style={[s.tableCell, s.colName]}>
              <Text>Наименование</Text>
            </View>
            <View style={[s.tableCell, s.colUnit]}>
              <Text>Ед. изм.</Text>
            </View>
            <View style={[s.tableCell, s.colQty]}>
              <Text style={{ textAlign: "right" }}>Кол-во</Text>
            </View>
            <View style={[s.tableCell, s.colPrice]}>
              <Text style={{ textAlign: "right" }}>Цена</Text>
            </View>
            <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
              <Text style={{ textAlign: "right" }}>Сумма</Text>
            </View>
          </View>

          {/* Строки товаров */}
          {items.map((item, idx, arr) => (
            <View
              key={item.id || idx}
              style={[
                s.tableRow,
                idx === arr.length - 1 ? s.tableRowLast : null,
              ]}
            >
              <View style={[s.tableCell, s.colNo]}>
                <Text>{idx + 1}</Text>
              </View>
              <View style={[s.tableCell, s.colName]}>
                <Text>{item.name}</Text>
              </View>
              <View style={[s.tableCell, s.colUnit]}>
                <Text>{item.unit}</Text>
              </View>
              <View style={[s.tableCell, s.colQty]}>
                <Text style={{ textAlign: "right" }}>{n2(item.qty)}</Text>
              </View>
              <View style={[s.tableCell, s.colPrice]}>
                <Text style={{ textAlign: "right" }}>
                  {n2(item.unit_price)}
                </Text>
              </View>
              <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                <Text style={{ textAlign: "right" }}>{n2(item.total)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Итого */}
        <Text style={s.total}>ИТОГО: {n2(total)}</Text>

        {/* Текстовая сумма */}
        <Text style={s.totalText}>
          Итого: {itemsCount} позиций на сумму {n2(total)} сом
        </Text>

        {/* Подписи в две колонки */}
        <View style={s.signatureRow}>
          <View style={s.signatureCol}>
            <Text>Продавец: {company?.name || "—"}</Text>
            {/* <View style={s.signatureLine} /> */}
            <Text style={{ marginTop: 4, fontSize: 8 }}>Подпись:</Text>
            <View style={s.signatureLine} />
          </View>
          <View style={s.signatureCol}>
            <Text>Покупатель: {client?.full_name || client?.name || "—"}</Text>
            {/* <View style={s.signatureLine} /> */}
            <Text style={{ marginTop: 4, fontSize: 8 }}>Подпись:</Text>
            <View style={s.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
