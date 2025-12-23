import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Регистрируем шрифты Roboto из public папки
let robotoRegistered = false;
try {
  const fontBase = process.env.PUBLIC_URL || "";
  const regularPath = fontBase
    ? `${fontBase}/fonts/roboto/Roboto-Regular.ttf`
    : "/fonts/roboto/Roboto-Regular.ttf";
  const boldPath = fontBase
    ? `${fontBase}/fonts/roboto/Roboto-Bold.ttf`
    : "/fonts/roboto/Roboto-Bold.ttf";

  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: regularPath,
        fontWeight: "normal",
      },
      {
        src: boldPath,
        fontWeight: "bold",
      },
    ],
  });
  robotoRegistered = true;
} catch (error) {
  console.warn(
    "Не удалось зарегистрировать шрифты Roboto, используем Helvetica:",
    error
  );
}

const s = StyleSheet.create({
  page: {
    fontFamily: robotoRegistered ? "Roboto" : "Helvetica", // Используем Roboto если зарегистрирован, иначе Helvetica
    fontSize: 10,
    padding: 30,
    color: "#000",
  },

  // Заголовок
  header: {
    marginBottom: 12,
    textAlign: "center",
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
    marginTop: 2,
  },

  // Две колонки (поставщик и покупатель)
  partiesRow: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  partyBox: {
    flex: 1,
    padding: 10,
  },
  partyTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  partyField: {
    marginBottom: 4,
    fontSize: 9,
  },
  partyLabel: {
    width: 70,
    fontSize: 9,
  },
  partyValue: {
    fontSize: 9,
  },
  warehouse: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 9,
  },

  // Таблица товаров
  goodsTable: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#000",
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
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    fontSize: 9,
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 9,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  colNo: { width: "5%" },
  colName: { width: "35%" },
  colUnit: { width: "10%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colSum: { width: "15%", textAlign: "right" },

  // Итоги
  totalsSection: {
    marginTop: 12,
    marginLeft: "auto",
    width: 280,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  totalLabel: {
    fontSize: 9,
  },
  totalValue: {
    fontSize: 9,
    fontWeight: "normal",
  },
  totalBold: {
    fontWeight: "bold",
    fontSize: 10,
  },

  // Подписи
  signatures: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: {
    flex: 1,
    fontSize: 9,
    // display: "flex",
    // alignItems: "flex-end",
  },
  signatureLabel: {
    marginBottom: 10,
    fontSize: 9,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginBottom: 2,
    minHeight: 20,
  },
  signatureSeal: {
    fontSize: 8,
    marginTop: 4,
    fontStyle: "italic",
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

function numToWords(num) {
  // Простая функция для преобразования числа в слова (базовая версия)
  // Можно расширить для полной поддержки
  const ones = [
    "",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
  ];
  const tens = [
    "",
    "десять",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
  ];
  const hundreds = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
  ];
  const teens = [
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
  ];

  if (num === 0) return "ноль";
  if (num < 10) return ones[num];
  if (num < 20) {
    return teens[num - 10];
  }

  const n = Math.floor(num);
  const kopecks = Math.round((num - n) * 100);

  let result = "";
  if (n >= 100) {
    result += hundreds[Math.floor(n / 100)] + " ";
  }
  if (n % 100 >= 20) {
    result += tens[Math.floor((n % 100) / 10)] + " ";
    if (n % 10 > 0) result += ones[n % 10] + " ";
  } else if (n % 100 >= 10) {
    result += teens[(n % 100) - 10] + " ";
  } else if (n % 10 > 0) {
    result += ones[n % 10] + " ";
  }

  // Определяем правильное окончание для рублей
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    result += "рублей";
  } else if (lastDigit === 1) {
    result += "рубль";
  } else if (lastDigit >= 2 && lastDigit <= 4) {
    result += "рубля";
  } else {
    result += "рублей";
  }

  if (kopecks > 0) {
    result += ` ${kopecks} копеек`;
  } else {
    result += " 00 копеек";
  }

  return result.trim();
}

export default function InvoicePdfDocument({ data }) {
  const doc = data?.document || {};
  const seller = data?.seller || {};
  const buyer = data?.buyer || null;

  // Поддержка обоих форматов: unit_price (API) и price (если где-то уже нормализовали)
  const items = Array.isArray(data?.items)
    ? data.items.map((it) => {
        const qty = Number(it.qty || it.quantity || 0);
        const unit = Number(it.unit_price ?? it.price ?? 0);
        const total = Number(it.total ?? qty * unit);
        return {
          id: it.id,
          name: it.name || it.product_name || "Товар",
          qty,
          unit_price: unit,
          total,
          unit: it.unit || "ШТ",
        };
      })
    : [];

  const totals = data?.totals || {};
  const subtotal = Number(totals.subtotal || 0);
  const discount = Number(totals.discount_total || 0);
  const tax = Number(totals.tax_total || 0);
  const total = Number(totals.total || 0);

  const invoiceNumber = doc.number || "";
  const invoiceDate = doc.datetime || doc.date || "";

  // Форматирование даты и времени для отображения
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

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Дата и время создания */}
        <Text style={{ fontSize: 9, marginBottom: 8 }}>
          {fmtDateTime(new Date().toISOString())}
        </Text>

        {/* Заголовок */}
        <View style={s.header}>
          <Text style={s.title}>
            Расходная накладная № {invoiceNumber || "—"} от{" "}
            {fmtDate(invoiceDate)}
          </Text>
        </View>

        {/* Автор */}
        {seller?.name && (
          <Text style={{ fontSize: 9, textAlign: "right", marginBottom: 12 }}>
            Автор: {safe(seller.name)}
          </Text>
        )}

        {/* Поставщик и Покупатель */}
        <View style={s.partiesRow}>
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Поставщик</Text>
            <View style={s.partyField}>
              <Text style={s.partyValue}>{safe(seller.name)}</Text>
            </View>
            {seller.address && (
              <View style={s.partyField}>
                <Text style={s.partyValue}>{safe(seller.address)}</Text>
              </View>
            )}
          </View>

          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Покупатель</Text>
            {buyer ? (
              <View style={s.partyField}>
                <Text style={s.partyValue}>
                  {safe(buyer.name || buyer.full_name)}
                </Text>
              </View>
            ) : (
              <View style={s.partyField}>
                <Text style={s.partyValue}>—</Text>
              </View>
            )}
          </View>
        </View>

        {/* Склад */}
        {data?.warehouse && (
          <View style={s.warehouse}>
            <Text>Склад: «{safe(data.warehouse)}»</Text>
          </View>
        )}

        {/* Таблица товаров */}
        <View style={s.goodsTable}>
          {/* Заголовок таблицы */}
          <View style={[s.tableRow, s.tableHeader]}>
            <View style={[s.tableCell, s.colNo]}>
              <Text>№</Text>
            </View>
            <View style={[s.tableCell, s.colName]}>
              <Text>Наименование</Text>
            </View>
            <View style={[s.tableCell, { width: "10%" }]}>
              <Text>Арт.</Text>
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
          {(items.length > 0 ? items : []).map((it, idx, arr) => (
            <View
              key={it.id || idx}
              style={[
                s.tableRow,
                idx === arr.length - 1 ? s.tableRowLast : null,
              ]}
            >
              <View style={[s.tableCell, s.colNo]}>
                <Text>{idx + 1}</Text>
              </View>
              <View style={[s.tableCell, s.colName]}>
                <Text>{it.name}</Text>
              </View>
              <View style={[s.tableCell, { width: "10%" }]}>
                <Text>—</Text>
              </View>
              <View style={[s.tableCell, s.colUnit]}>
                <Text>{it.unit || "ШТ"}</Text>
              </View>
              <View style={[s.tableCell, s.colQty]}>
                <Text style={{ textAlign: "right" }}>{n2(it.qty)}</Text>
              </View>
              <View style={[s.tableCell, s.colPrice]}>
                <Text style={{ textAlign: "right" }}>{n2(it.unit_price)}</Text>
              </View>
              <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                <Text style={{ textAlign: "right" }}>{n2(it.total)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Итоги */}
        <View style={s.totalsSection}>
          <View style={[s.totalRow, s.totalBold]}>
            <Text style={[s.totalLabel, s.totalBold]}>ИТОГО:</Text>
            <Text style={[s.totalValue, s.totalBold]}>{n2(total)}</Text>
          </View>
        </View>

        {/* Подписи */}
        <View style={s.signatures}>
          <View style={s.signatureCol}>
            <Text style={s.signatureLabel}>Отпустил</Text>
            <View style={s.signatureLine} />
          </View>
          <View style={s.signatureCol}>
            <Text style={s.signatureLabel}>Получил</Text>
            <View style={s.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
