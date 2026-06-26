import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";
import { normalizeSummary, toNum } from "./summaryAggregation";

registerPdfFonts();

// Базовые стили согласованы с invoicePdfDocumentStyles (Roboto, сетка, A4).
const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 8.5,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
    color: "#000",
  },
  title: { fontSize: 12, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginTop: 10, marginBottom: 4 },

  metaWrap: { marginBottom: 6, gap: 1.5 },
  metaRow: { flexDirection: "row", fontSize: 8.5 },
  metaLabel: { fontWeight: "bold", width: 110, flexShrink: 0 },
  metaValue: { flex: 1 },
  comment: { marginTop: 4, fontSize: 8.5, fontStyle: "italic" },

  table: { borderWidth: 1, borderColor: "#000", marginTop: 2 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 13,
  },
  rowLast: { borderBottomWidth: 0 },
  headRow: { backgroundColor: "#f0f0f0", fontWeight: "bold" },
  cell: {
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 7.5,
    justifyContent: "center",
  },
  cellLast: { borderRightWidth: 0 },
  cCenter: { textAlign: "center" },
  cRight: { textAlign: "right" },
  cLeft: { textAlign: "left" },
  footCell: {
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 7.5,
    fontWeight: "bold",
    justifyContent: "center",
  },

  totalsBlock: { marginTop: 8, alignSelf: "flex-end", minWidth: 220, gap: 2 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 9 },
  totalsRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    fontWeight: "bold",
  },

  signatures: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: { flex: 1, fontSize: 8 },
  signatureLabel: { marginBottom: 10, fontSize: 8 },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 2 },

  pageNumber: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 16,
    textAlign: "right",
    fontSize: 7.5,
    color: "#555",
  },
});

// Колонки таблицы №1 — Сводка товаров
const P_COLS = [
  { w: "4%", a: "center" }, // №
  { w: "26%", a: "left" }, // Номенклатура
  { w: "8%", a: "center" }, // Ед.изм
  { w: "9%", a: "right" }, // Упаковки
  { w: "11%", a: "right" }, // Ед. в упаковке
  { w: "11%", a: "right" }, // Количество
  { w: "10%", a: "right" }, // Цена
  { w: "12%", a: "right" }, // Сумма
  { w: "9%", a: "right" }, // Вес
];
const P_HEAD = [
  "№",
  "Номенклатура",
  "Ед. изм.",
  "Упаковки",
  "Ед. в упак.",
  "Кол-во",
  "Цена",
  "Сумма",
  "Вес",
];

// Колонки таблицы №2 — Накладные
const D_COLS = [
  { w: "4%", a: "center" }, // №
  { w: "13%", a: "left" }, // Номер
  { w: "11%", a: "center" }, // Дата
  { w: "13%", a: "left" }, // Агент
  { w: "16%", a: "left" }, // Контрагент
  { w: "17%", a: "left" }, // Адрес
  { w: "8%", a: "right" }, // Кол-во
  { w: "8%", a: "right" }, // Вес
  { w: "10%", a: "right" }, // Сумма
];
const D_HEAD = [
  "№",
  "Номер",
  "Дата",
  "Агент",
  "Контрагент",
  "Адрес",
  "Кол-во",
  "Вес",
  "Сумма",
];

const n2 = (v) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(v));
const nInt = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(toNum(v));

const TYPE_LABEL = { general: "Общая", by_agents: "По агентам" };

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString("ru-RU");
};
const fmtDateTime = (d) => {
  if (!d) return { date: "—", time: "—" };
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return { date: String(d), time: "" };
  return {
    date: dt.toLocaleDateString("ru-RU"),
    time: dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
};

const Cell = ({ col, last, head, children }) => (
  <View
    style={[
      head ? s.cell : s.cell,
      { width: col.w },
      col.a === "right" ? s.cRight : col.a === "center" ? s.cCenter : s.cLeft,
      last && s.cellLast,
    ]}
  >
    <Text>{children}</Text>
  </View>
);

const TableHead = ({ cols, heads }) => (
  <View style={[s.row, s.headRow]} fixed>
    {cols.map((c, i) => (
      <Cell key={i} col={c} last={i === cols.length - 1} head>
        {heads[i]}
      </Cell>
    ))}
  </View>
);

export default function SummaryPdfDocument({ summary }) {
  const data = normalizeSummary(summary || {});
  const products = data.products || [];
  const documents = data.documents || [];
  const totals = data.totals || {};

  const created = fmtDateTime(data.created_at);
  const typeLabel = TYPE_LABEL[data.type] || data.type || "—";
  const warehouseName = data.warehouse?.name || "—";
  const author = data.created_by?.full_name || "—";
  const agentsLine =
    data.type === "by_agents"
      ? (data.agents || []).map((a) => a.full_name || a.code || a.id).join(", ") ||
        "—"
      : null;
  const comment = String(data.comment || "").trim();

  const totalAmount = toNum(totals.total_amount);
  const totalWeight = toNum(totals.total_weight);
  const totalQty = toNum(totals.total_quantity);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Шапка — повторяется на каждой странице */}
        <View fixed>
          <Text style={s.title}>
            {`${data.name || "Сводка"} № ${data.number || "—"}`}
          </Text>
          <View style={s.metaWrap}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Дата сводки:</Text>
              <Text style={s.metaValue}>{fmtDate(data.date)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Сформирован:</Text>
              <Text style={s.metaValue}>{`${created.date} ${created.time}`}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Склад:</Text>
              <Text style={s.metaValue}>{warehouseName}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Тип сводки:</Text>
              <Text style={s.metaValue}>{typeLabel}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Автор:</Text>
              <Text style={s.metaValue}>{author}</Text>
            </View>
            {agentsLine != null && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Агенты:</Text>
                <Text style={s.metaValue}>{agentsLine}</Text>
              </View>
            )}
            {!!comment && <Text style={s.comment}>{`Комментарий: ${comment}`}</Text>}
          </View>
        </View>

        {/* Таблица №1 — Сводка товаров */}
        <Text style={s.sectionTitle}>Таблица №1. Сводка товаров</Text>
        <View style={s.table}>
          <TableHead cols={P_COLS} heads={P_HEAD} />
          {products.map((p, i) => {
            const last = i === products.length - 1;
            const cells = [
              String(i + 1),
              p.name,
              p.unit,
              nInt(p.packages),
              nInt(p.per_package),
              nInt(p.quantity),
              n2(p.price),
              n2(p.amount),
              nInt(p.weight),
            ];
            return (
              <View key={i} style={[s.row, last && s.rowLast]} wrap={false}>
                {P_COLS.map((c, ci) => (
                  <Cell key={ci} col={c} last={ci === P_COLS.length - 1}>
                    {cells[ci]}
                  </Cell>
                ))}
              </View>
            );
          })}
          {/* Итоги таблицы №1 */}
          <View style={[s.row, s.rowLast, s.headRow]} wrap={false}>
            <View style={[s.footCell, { width: "38%" }]}>
              <Text>Итого</Text>
            </View>
            <View style={[s.footCell, s.cRight, { width: "11%" }]}>
              <Text>{nInt(totalQty)}</Text>
            </View>
            <View style={[s.footCell, s.cRight, { width: "10%" }]}>
              <Text />
            </View>
            <View style={[s.footCell, s.cRight, { width: "12%" }]}>
              <Text>{n2(totalAmount)}</Text>
            </View>
            <View style={[s.footCell, s.cellLast, s.cRight, { width: "9%" }]}>
              <Text>{nInt(totalWeight)}</Text>
            </View>
          </View>
        </View>

        {/* Таблица №2 — Накладные */}
        <Text style={s.sectionTitle} break={documents.length > 12}>
          Таблица №2. Накладные
        </Text>
        <View style={s.table}>
          <TableHead cols={D_COLS} heads={D_HEAD} />
          {documents.map((d, i) => {
            const last = i === documents.length - 1;
            const cells = [
              String(i + 1),
              d.number,
              fmtDate(d.date),
              d.agent,
              d.client,
              d.address,
              nInt(d.quantity),
              nInt(d.weight),
              n2(d.amount),
            ];
            return (
              <View key={i} style={[s.row, last && s.rowLast]} wrap={false}>
                {D_COLS.map((c, ci) => (
                  <Cell key={ci} col={c} last={ci === D_COLS.length - 1}>
                    {cells[ci]}
                  </Cell>
                ))}
              </View>
            );
          })}
          {/* Итоги таблицы №2 */}
          <View style={[s.row, s.rowLast, s.headRow]} wrap={false}>
            <View style={[s.footCell, { width: "57%" }]}>
              <Text>{`Накладных: ${toNum(totals.documents_count)}`}</Text>
            </View>
            <View style={[s.footCell, s.cRight, { width: "8%" }]}>
              <Text>{nInt(totalQty)}</Text>
            </View>
            <View style={[s.footCell, s.cRight, { width: "8%" }]}>
              <Text>{nInt(totalWeight)}</Text>
            </View>
            <View style={[s.footCell, s.cellLast, s.cRight, { width: "10%" }]}>
              <Text>{n2(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Итоги */}
        <View style={s.totalsBlock}>
          <View style={s.totalsRow}>
            <Text>Накладных:</Text>
            <Text>{nInt(totals.documents_count)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text>Позиций товаров:</Text>
            <Text>{nInt(totals.products_count)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text>Общий вес:</Text>
            <Text>{nInt(totalWeight)}</Text>
          </View>
          <View style={s.totalsRowBold}>
            <Text>Итоговая сумма:</Text>
            <Text>{n2(totalAmount)}</Text>
          </View>
        </View>

        {!!comment && (
          <Text style={s.comment}>{`Комментарий: ${comment}`}</Text>
        )}

        {/* Подписи */}
        <View style={s.signatures} wrap={false}>
          <View style={s.signatureCol}>
            <Text style={s.signatureLabel}>Сформировал: {author}</Text>
            <Text style={s.signatureLine}>Подпись</Text>
          </View>
          <View style={s.signatureCol}>
            <Text style={s.signatureLabel}>Проверил:</Text>
            <Text style={s.signatureLine}>Подпись</Text>
          </View>
        </View>

        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Стр. ${pageNumber} из ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
