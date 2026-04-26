import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";

registerPdfFonts();

const RU_MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function parseYmd(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) {
    return { day: "—", monthName: "—", year: "—" };
  }
  const year = m[1];
  const mi = parseInt(m[2], 10);
  const day = String(parseInt(m[3], 10));
  const monthName = RU_MONTHS_GEN[mi - 1] ?? "—";
  return { day, monthName, year };
}

function splitRubKop(amountNumber) {
  const s = amountNumber.replace(/\s/g, "").replace(",", ".");
  const parts = s.split(".");
  if (parts.length === 1) {
    return { rub: parts[0] || "0", kop: "00" };
  }
  const kop = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
  return { rub: parts[0] || "0", kop };
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    padding: 12,
    fontSize: 7,
    fontFamily: "Roboto",
  },
  leftSection: {
    flex: 7,
    paddingRight: 6,
  },
  dividerColumn: {
    width: 18,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
  },
  dividerLine: {
    width: 1,
    backgroundColor: "#000",
  },
  dividerCenter: {
    width: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dividerCutLine: {
    fontSize: 5.5,
    letterSpacing: 0.5,
    transform: "rotate(90deg)",
  },
  rightSection: {
    flex: 3,
    paddingLeft: 6,
  },
  metaSmall: {
    fontSize: 6,
    marginBottom: 2,
  },
  metaBold: {
    fontSize: 6,
    fontWeight: "bold",
  },
  orgNameBold: {
    fontWeight: "bold",
  },
  okudLeftCol: {
    flex: 2,
    marginRight: 8,
  },
  okudInnerRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  okudLabelFixed: {
    fontSize: 6,
    width: 90,
  },
  okpoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  okpoUnderline: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 10,
  },
  docMetaCell: {
    width: "40%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
  },
  docNumberText: {
    fontSize: 8,
    fontWeight: "bold",
  },
  docDateText: {
    fontSize: 8,
  },
  thLast: {
    fontSize: 5.5,
    fontWeight: "bold",
    padding: 2,
    textAlign: "center",
    borderRightWidth: 0,
  },
  amountWordsMultiline: {
    fontSize: 6,
    lineHeight: 1.3,
  },
  receiptHint: {
    fontSize: 6,
    color: "#333",
    marginBottom: 4,
  },
  receiptSigLabel: {
    fontSize: 7,
    width: 70,
  },
  signLineName7: {
    fontSize: 7,
  },
  signLineName6: {
    fontSize: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
    alignItems: "flex-end",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  label: {
    fontSize: 7,
  },
  valueLine: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    marginLeft: 4,
    minHeight: 10,
    fontSize: 7,
    paddingBottom: 1,
  },
  okudRow: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 4,
  },
  okudBox: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 4,
    flex: 1,
  },
  okudLabel: {
    fontSize: 6,
  },
  okudValue: {
    fontSize: 7,
    fontWeight: "bold",
    marginTop: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 4,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 18,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 18,
  },
  th: {
    fontSize: 5.5,
    fontWeight: "bold",
    padding: 2,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "center",
  },
  td: {
    fontSize: 6,
    padding: 2,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  tdLast: {
    fontSize: 6,
    padding: 2,
  },
  colDebit: { width: "14%" },
  colCr1: { width: "16%" },
  colCr2: { width: "20%" },
  colCr3: { width: "16%" },
  colSum: { width: "18%" },
  colPurp: { width: "16%" },
  fieldBlock: {
    marginTop: 5,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 5,
  },
  fieldLabel: {
    fontSize: 7,
    width: 85,
  },
  fieldValue: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    fontSize: 7,
    minHeight: 12,
    paddingBottom: 1,
  },
  signatureBlock: {
    marginTop: 10,
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "flex-end",
  },
  signatureLabel: {
    fontSize: 7,
    width: 100,
  },
  signCell: {
    flex: 1,
    marginHorizontal: 4,
  },
  signLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    minHeight: 12,
  },
  signHint: {
    fontSize: 5,
    textAlign: "center",
    color: "#444",
    marginTop: 2,
  },
  receiptTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  receiptText: {
    fontSize: 7,
    marginBottom: 4,
  },
  receiptCenter: {
    fontSize: 6,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
});

function safe(v) {
  return v != null && String(v).trim() !== "" ? String(v).trim() : "";
}

/**
 * @param {{ data: object }} props
 */
export default function Ko1PdfDocument({ data }) {
  const { day, monthName, year } = parseYmd(data.date);
  const { rub, kop } = splitRubKop(data.amountNumber);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.leftSection}>
          <Text style={styles.metaSmall}>
            Унифицированная форма № КО-1{"\n"}
            Утверждена постановлением Госкомстата России от 18.08.98 № 88
          </Text>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>
              Организация:{" "}
              <Text style={styles.orgNameBold}>
                {safe(data.organization) || " "}
              </Text>
            </Text>
            <Text style={styles.label}>Код</Text>
          </View>

          <View style={styles.okudRow}>
            <View style={styles.okudLeftCol}>
              <View style={styles.okudInnerRow}>
                <Text style={styles.okudLabelFixed}>Форма по ОКУД</Text>
                <View style={styles.okudBox}>
                  <Text style={styles.okudValue}>0310001</Text>
                </View>
              </View>
              <View style={styles.okpoRow}>
                <Text style={styles.okudLabelFixed}>по ОКПО</Text>
                <View style={styles.okpoUnderline} />
              </View>
            </View>
          </View>

          {safe(data.structuralUnit) ? (
            <View style={styles.row}>
              <Text style={styles.label}>Структурное подразделение:</Text>
              <Text style={styles.valueLine}>{data.structuralUnit}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Text style={styles.label}>Структурное подразделение:</Text>
              <Text style={styles.valueLine}> </Text>
            </View>
          )}

          <Text style={styles.headerTitle}>ПРИХОДНЫЙ КАССОВЫЙ ОРДЕР</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Номер документа</Text>
            <Text style={styles.label}>Дата составления</Text>
          </View>
          <View style={styles.rowBetween}>
            <View style={styles.docMetaCell}>
              <Text style={styles.docNumberText}>
                {safe(data.documentNumber)}
              </Text>
            </View>
            <View style={styles.docMetaCell}>
              <Text style={styles.docDateText}>{data.date}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={[styles.th, styles.colDebit]}>
                <Text>Дебет</Text>
              </View>
              <View style={[styles.th, styles.colCr1]}>
                <Text>Кредит: код структ. подразд.</Text>
              </View>
              <View style={[styles.th, styles.colCr2]}>
                <Text>Корр. счёт, субсчёт</Text>
              </View>
              <View style={[styles.th, styles.colCr3]}>
                <Text>Код аналит. учёта</Text>
              </View>
              <View style={[styles.th, styles.colSum]}>
                <Text>Сумма сом тыйын</Text>
              </View>
              <View style={[styles.thLast, styles.colPurp]}>
                <Text>Код цел. назнач.</Text>
              </View>
            </View>
            <View style={styles.tableRowLast}>
              <View style={[styles.td, styles.colDebit]}>
                <Text>{safe(data.debit)}</Text>
              </View>
              <View style={[styles.td, styles.colCr1]}>
                <Text>{safe(data.creditStructural)}</Text>
              </View>
              <View style={[styles.td, styles.colCr2]}>
                <Text>{safe(data.creditCorr)}</Text>
              </View>
              <View style={[styles.td, styles.colCr3]}>
                <Text>{safe(data.creditAnalytic)}</Text>
              </View>
              <View style={[styles.td, styles.colSum]}>
                <Text>{safe(data.amount ?? data.amountNumber)}</Text>
              </View>
              <View style={[styles.tdLast, styles.colPurp]}>
                <Text>{safe(data.purposeCode)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Принято от</Text>
              <Text style={styles.fieldValue}>{data.receivedFrom}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Основание</Text>
              <Text style={styles.fieldValue}>{data.basis}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Сумма</Text>
              <Text style={styles.fieldValue}>{data.amountNumber}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}> </Text>
              <Text style={styles.fieldValue}>
                {rub} сом {kop} тыйын
              </Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}> </Text>
              <Text style={[styles.fieldValue, styles.amountWordsMultiline]}>
                {data.amountWords}
              </Text>
            </View>
            {safe(data.includingVat) ? (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>В том числе</Text>
                <Text style={styles.fieldValue}>{data.includingVat}</Text>
              </View>
            ) : (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>В том числе</Text>
                <Text style={styles.fieldValue}> </Text>
              </View>
            )}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Приложение</Text>
              <Text style={styles.fieldValue}>{safe(data.attachment)}</Text>
            </View>
          </View>

          <View style={styles.signatureBlock}>
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>Главный бухгалтер</Text>
              <View style={styles.signCell}>
                <View style={styles.signLine} />
                <Text style={styles.signHint}>(подпись)</Text>
              </View>
              <View style={styles.signCell}>
                <View style={styles.signLine}>
                  <Text style={styles.signLineName7}>
                    {safe(data.chiefAccountant)}
                  </Text>
                </View>
                <Text style={styles.signHint}>(расшифровка подписи)</Text>
              </View>
            </View>
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>Получил кассир</Text>
              <View style={styles.signCell}>
                <View style={styles.signLine} />
                <Text style={styles.signHint}>(подпись)</Text>
              </View>
              <View style={styles.signCell}>
                <View style={styles.signLine}>
                  <Text style={styles.signLineName7}>{safe(data.cashier)}</Text>
                </View>
                <Text style={styles.signHint}>(расшифровка подписи)</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.dividerColumn}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerCenter}>
            <Text style={styles.dividerCutLine}>
              Л И Н И Я О Т Р Е З А
            </Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.rightSection}>
          <Text style={styles.receiptTitle}>КВИТАНЦИЯ</Text>
          <Text style={styles.receiptText}>
            к приходному кассовому ордеру № {safe(data.documentNumber)}
          </Text>
          <Text style={styles.receiptText}>
            от &quot;{day}&quot; {monthName} {year} г.
          </Text>
          <Text style={styles.receiptText}>
            Принято от {data.receivedFrom}
          </Text>
          <Text style={styles.receiptText}>Основание: {data.basis}</Text>
          <Text style={styles.receiptText}>
            Сумма {rub} сом {kop} тыйын
          </Text>
          <Text style={styles.receiptHint}>(цифрами)</Text>
          <Text style={styles.receiptText}>{data.amountWords}</Text>
          <Text style={styles.receiptHint}>(прописью)</Text>
          {safe(data.includingVat) ? (
            <Text style={styles.receiptText}>
              В том числе {data.includingVat}
            </Text>
          ) : (
            <Text style={styles.receiptText}>В том числе _________</Text>
          )}
          <Text style={styles.receiptText}>
            &quot;{day}&quot; {monthName} {year} г.
          </Text>
          <Text style={styles.receiptCenter}>М.П.</Text>
          <View style={styles.signatureRow}>
            <Text style={styles.receiptSigLabel}>Главный бухгалтер</Text>
            <View style={styles.signCell}>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>(подпись)</Text>
            </View>
            <View style={styles.signCell}>
              <View style={styles.signLine}>
                <Text style={styles.signLineName6}>
                  {safe(data.chiefAccountant)}
                </Text>
              </View>
              <Text style={styles.signHint}>(расшифровка)</Text>
            </View>
          </View>
          <View style={styles.signatureRow}>
            <Text style={styles.receiptSigLabel}>Кассир</Text>
            <View style={styles.signCell}>
              <View style={styles.signLine} />
              <Text style={styles.signHint}>(подпись)</Text>
            </View>
            <View style={styles.signCell}>
              <View style={styles.signLine}>
                <Text style={styles.signLineName6}>{safe(data.cashier)}</Text>
              </View>
              <Text style={styles.signHint}>(расшифровка)</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
