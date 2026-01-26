import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    padding: 20,
    color: "#000",
  },

  // Заголовок
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 2,
  },
  periodInfo: {
    fontSize: 9,
    marginBottom: 8,
  },

  // Таблица
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 14,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    fontSize: 8,
  },
  tableCell: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 8,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },

  // Колонки
  colName: { width: "20%" },
  colCompleted: { width: "10%", textAlign: "right" },
  colRevenue: { width: "12%", textAlign: "right" },
  colPerRecord: { width: "14%", textAlign: "right" },
  colPercent: { width: "14%", textAlign: "right" },
  colFixed: { width: "10%", textAlign: "right" },
  colProduct: { width: "10%", textAlign: "right" },
  colPayout: { width: "10%", textAlign: "right" },

  // Итоги
  totalsRow: {
    backgroundColor: "#e8f4f8",
    fontWeight: "bold",
  },

  // Подпись
  signature: {
    marginTop: 20,
    fontSize: 8,
  },
  signatureLine: {
    marginTop: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    width: 200,
  },
  signatureLabel: {
    marginTop: 3,
    fontSize: 8,
  },
});

function safe(v) {
  return v ? String(v) : "—";
}

function n2(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function money(v) {
  return `${n2(v)} с`;
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

export default function PayoutsPdfDocument({ data }) {
  registerPdfFonts();

  const { startDate, endDate, monthKey, rows = [], totals = {} } = data;

  return (
    <Document>
      <Page size="A4" style={s.page} orientation="landscape">
        {/* Дата создания */}
        <Text style={{ fontSize: 7, marginBottom: 6 }}>
          {fmtDateTime(new Date().toISOString())}
        </Text>

        {/* Заголовок */}
        <View style={s.header}>
          <Text style={s.title}>Отчёт о выплатах мастерам</Text>
          <Text style={s.subtitle}>
            {startDate} — {endDate}
          </Text>
          {monthKey && (
            <Text style={s.periodInfo}>
              Месяц (для Фикс/Товар): {monthKey}
            </Text>
          )}
        </View>

        {/* Таблица */}
        <View style={s.table}>
          {/* Заголовок таблицы */}
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.tableCell, s.colName]}>
              <Text>Мастер</Text>
            </View>
            <View style={[s.tableCell, s.colCompleted]}>
              <Text style={{ textAlign: "right" }}>Записей</Text>
            </View>
            <View style={[s.tableCell, s.colRevenue]}>
              <Text style={{ textAlign: "right" }}>Выручка</Text>
            </View>
            <View style={[s.tableCell, s.colPerRecord]}>
              <Text style={{ textAlign: "right" }}>За запись</Text>
            </View>
            <View style={[s.tableCell, s.colPercent]}>
              <Text style={{ textAlign: "right" }}>Процент</Text>
            </View>
            <View style={[s.tableCell, s.colFixed]}>
              <Text style={{ textAlign: "right" }}>Фикс (мес)</Text>
            </View>
            <View style={[s.tableCell, s.colProduct]}>
              <Text style={{ textAlign: "right" }}>Товар (мес)</Text>
            </View>
            <View style={[s.tableCell, s.colPayout, s.tableCellLast]}>
              <Text style={{ textAlign: "right" }}>К выплате</Text>
            </View>
          </View>

          {/* Строки данных */}
          {rows.map((row, idx) => {
            const perRecordLabel =
              row.perRecordRate > 0
                ? `${row.completed}×${n2(row.perRecordRate)}=${money(
                    row.perRecordPayout
                  )}`
                : "—";

            const percentLabel =
              row.percentRate > 0
                ? `${n2(row.percentRate)}%=${money(row.percentPayout)}`
                : "—";

            return (
              <View key={idx} style={s.tableRow}>
                <View style={[s.tableCell, s.colName]}>
                  <Text>{safe(row.name)}</Text>
                </View>
                <View style={[s.tableCell, s.colCompleted]}>
                  <Text style={{ textAlign: "right" }}>{n2(row.completed)}</Text>
                </View>
                <View style={[s.tableCell, s.colRevenue]}>
                  <Text style={{ textAlign: "right" }}>{money(row.revenue)}</Text>
                </View>
                <View style={[s.tableCell, s.colPerRecord]}>
                  <Text style={{ textAlign: "right" }}>{perRecordLabel}</Text>
                </View>
                <View style={[s.tableCell, s.colPercent]}>
                  <Text style={{ textAlign: "right" }}>{percentLabel}</Text>
                </View>
                <View style={[s.tableCell, s.colFixed]}>
                  <Text style={{ textAlign: "right" }}>
                    {money(row.fixedMonth)}
                  </Text>
                </View>
                <View style={[s.tableCell, s.colProduct]}>
                  <Text style={{ textAlign: "right" }}>
                    {money(row.productMonth)}
                  </Text>
                </View>
                <View style={[s.tableCell, s.colPayout, s.tableCellLast]}>
                  <Text style={{ textAlign: "right" }}>
                    {money(row.payoutTotal)}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Строка итогов */}
          <View style={[s.tableRow, s.tableRowLast, s.totalsRow]}>
            <View style={[s.tableCell, s.colName]}>
              <Text style={{ fontWeight: "bold" }}>ИТОГО</Text>
            </View>
            <View style={[s.tableCell, s.colCompleted]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {n2(totals.completed)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colRevenue]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.revenue)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colPerRecord]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.perRecordPayout)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colPercent]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.percentPayout)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colFixed]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.fixed)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colProduct]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.product)}
              </Text>
            </View>
            <View style={[s.tableCell, s.colPayout, s.tableCellLast]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {money(totals.payout)}
              </Text>
            </View>
          </View>
        </View>

        {/* Подпись */}
        <View style={s.signature}>
          <Text style={{ marginBottom: 20 }}>Руководитель:</Text>
          <View style={s.signatureLine} />
          <Text style={s.signatureLabel}>________________________</Text>
        </View>
      </Page>
    </Document>
  );
}
