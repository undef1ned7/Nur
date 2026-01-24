import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 8,
    padding: 16,
    color: "#000",
  },
  header: {
    textAlign: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    marginTop: 1,
  },
  parties: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 8,
    lineHeight: 1.25,
  },
  // Таблица в стиле "классического" акта (как на фото)
  table: { borderWidth: 1, borderColor: "#000" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 14,
  },
  rowLast: { borderBottomWidth: 0 },
  head: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  cell: {
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 3,
    justifyContent: "center",
  },
  cellLast: { borderRightWidth: 0 },
  // 2 блока по 4 колонки:
  // Date | Doc | Debit | Credit  (company)
  // Date | Doc | Debit | Credit  (client)
  cDate: { width: "9%" },
  cDoc: { width: "20%" },
  cMoney: { width: "9%" },
  // Служебные строки
  sectionRow: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  sectionCell: { padding: 3, fontWeight: "bold" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  signatures: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signCol: { flex: 1, fontSize: 8 },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 16,
    marginTop: 10,
  },
});

function safe(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function n2(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function extractLines(data) {
  const candidates = [
    data?.rows,
    data?.items,
    data?.lines,
    data?.entries,
    data?.table,
    data?.results,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function getNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function pickDate(row) {
  return pickFirst(row, ["date", "datetime", "created_at", "document_date"]);
}

function pickDoc(row) {
  return pickFirst(row, ["document", "doc", "title", "description", "content", "name"]);
}

function renderSaldoCells(value, { TextComp, styles }) {
  // value: number, >0 => Debit, <0 => Credit
  const v = getNumber(value);
  const debit = v > 0 ? v : 0;
  const credit = v < 0 ? Math.abs(v) : 0;
  return (
    <>
      <View style={[styles.cell, styles.cMoney]}>
        <TextComp style={styles.right}>{debit ? n2(debit) : ""}</TextComp>
      </View>
      <View style={[styles.cell, styles.cMoney]}>
        <TextComp style={styles.right}>{credit ? n2(credit) : ""}</TextComp>
      </View>
    </>
  );
}

export default function ReconciliationPdfDocument({ data, meta }) {
  registerPdfFonts();
  const lines = extractLines(data);

  const companyName = safe(
    pick(data, ["company_name", "company", "seller", "our_company_name"], meta?.companyName)
  );
  const clientName = safe(pick(data, ["client_name", "client", "buyer", "counterparty"], meta?.clientName));

  const start = pick(data, ["start", "date_from", "period_start"], meta?.start);
  const end = pick(data, ["end", "date_to", "period_end"], meta?.end);
  const currency = safe(pick(data, ["currency"], meta?.currency || "KGS"));

  // Обороты по данным проводок
  const totalCompanyDebit = lines.reduce(
    (sum, r) => sum + getNumber(r?.company_debit ?? r?.debit_company ?? r?.company_dt ?? 0),
    0
  );
  const totalCompanyCredit = lines.reduce(
    (sum, r) => sum + getNumber(r?.company_credit ?? r?.credit_company ?? r?.company_kt ?? 0),
    0
  );
  const totalClientDebit = lines.reduce(
    (sum, r) => sum + getNumber(r?.client_debit ?? r?.debit_client ?? r?.client_dt ?? 0),
    0
  );
  const totalClientCredit = lines.reduce(
    (sum, r) => sum + getNumber(r?.client_credit ?? r?.credit_client ?? r?.client_kt ?? 0),
    0
  );

  // Сальдо начальное (если API отдаёт) — иначе 0
  const openingCompany = getNumber(
    pick(data, ["opening_company", "opening_company_balance", "opening_balance_company", "opening_balance"], 0)
  );
  const openingClient = getNumber(
    pick(data, ["opening_client", "opening_client_balance", "opening_balance_client"], 0)
  );

  // Сальдо конечное = сальдо начальное + Дт - Кт
  const closingCompany = openingCompany + totalCompanyDebit - totalCompanyCredit;
  const closingClient = openingClient + totalClientDebit - totalClientCredit;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Акт сверки</Text>
          <Text style={s.subtitle}>
            взаимных расчетов за период: {fmtDate(start)} — {fmtDate(end)} ({currency})
          </Text>
        </View>

        <View style={s.parties}>
          <Text>
            Мы, нижеподписавшиеся, {companyName}, с одной стороны, и {clientName}, с другой стороны,
            составили настоящий акт сверки о состоянии взаимных расчетов по данным учета следующим
            образом:
          </Text>
        </View>

        <View style={s.table}>
          {/* Заголовок: две части как на фото */}
          <View style={[s.row, s.head]}>
            <View style={[s.cell, { width: "47%" }]}>
              <Text style={s.center}>По данным {companyName}</Text>
            </View>
            <View style={[s.cell, { width: "53%" }, s.cellLast]}>
              <Text style={s.center}>По данным {clientName}</Text>
            </View>
          </View>

          {/* Заголовок колонок */}
          <View style={[s.row, s.head]}>
            <View style={[s.cell, s.cDate]}>
              <Text style={s.center}>Дата</Text>
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text style={s.center}>Документ</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Дебет</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Кредит</Text>
            </View>

            <View style={[s.cell, s.cDate]}>
              <Text style={s.center}>Дата</Text>
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text style={s.center}>Документ</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Дебет</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text style={s.center}>Кредит</Text>
            </View>
          </View>

          {/* Сальдо начальное */}
          <View style={[s.row, s.sectionRow]}>
            <View style={[s.cell, { width: "100%" }, s.cellLast]}>
              <Text>Сальдо начальное</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            {renderSaldoCells(openingCompany, { TextComp: Text, styles: s })}
            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            {renderSaldoCells(openingClient, { TextComp: Text, styles: s })}
            {/* последняя ячейка уже в helper */}
            <View style={{ width: 0 }} />
          </View>

          {/* Операции */}
          {lines.map((r, idx) => {
            const dt = pickDate(r);
            const doc = pickDoc(r);
            const companyDebit = getNumber(r?.company_debit ?? r?.debit_company ?? r?.company_dt ?? 0);
            const companyCredit = getNumber(r?.company_credit ?? r?.credit_company ?? r?.company_kt ?? 0);
            const clientDebit = getNumber(r?.client_debit ?? r?.debit_client ?? r?.client_dt ?? 0);
            const clientCredit = getNumber(r?.client_credit ?? r?.credit_client ?? r?.client_kt ?? 0);

            return (
              <View key={idx} style={s.row}>
                <View style={[s.cell, s.cDate]}>
                  <Text>{dt ? fmtDate(dt) : ""}</Text>
                </View>
                <View style={[s.cell, s.cDoc]}>
                  <Text>{safe(doc)}</Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>{companyDebit ? n2(companyDebit) : ""}</Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>{companyCredit ? n2(companyCredit) : ""}</Text>
                </View>

                <View style={[s.cell, s.cDate]}>
                  <Text>{dt ? fmtDate(dt) : ""}</Text>
                </View>
                <View style={[s.cell, s.cDoc]}>
                  <Text>{safe(doc)}</Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>{clientDebit ? n2(clientDebit) : ""}</Text>
                </View>
                <View style={[s.cell, s.cMoney, s.cellLast]}>
                  <Text style={s.right}>{clientCredit ? n2(clientCredit) : ""}</Text>
                </View>
              </View>
            );
          })}

          {/* Обороты за период */}
          <View style={[s.row, s.sectionRow]}>
            <View style={[s.cell, { width: "100%" }, s.cellLast]}>
              <Text>Обороты за период</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalCompanyDebit)}</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalCompanyCredit)}</Text>
            </View>

            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalClientDebit)}</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text style={s.right}>{n2(totalClientCredit)}</Text>
            </View>
          </View>

          {/* Сальдо конечное */}
          <View style={[s.row, s.sectionRow]}>
            <View style={[s.cell, { width: "100%" }, s.cellLast]}>
              <Text>Сальдо конечное</Text>
            </View>
          </View>
          <View style={[s.row, s.rowLast]}>
            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            {renderSaldoCells(closingCompany, { TextComp: Text, styles: s })}
            <View style={[s.cell, s.cDate]}>
              <Text />
            </View>
            <View style={[s.cell, s.cDoc]}>
              <Text />
            </View>
            {/* client */}
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{closingClient > 0 ? n2(closingClient) : ""}</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text style={s.right}>{closingClient < 0 ? n2(Math.abs(closingClient)) : ""}</Text>
            </View>
          </View>
        </View>

        <View style={s.signatures}>
          <View style={s.signCol}>
            <Text>От {companyName}</Text>
            <View style={s.signLine} />
          </View>
          <View style={s.signCol}>
            <Text>От {clientName}</Text>
            <View style={s.signLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}


