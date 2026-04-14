import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 8,
    padding: 15,
    color: "#000",
  },

  // Заголовок
  header: {
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 1,
  },

  // Две колонки (поставщик и покупатель)
  partiesRow: {
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 6,
    gap: 6,
  },
  partyBox: {
    flex: 1,
    padding: 5,
  },
  partyTitle: {
    fontSize: 8,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  partyField: {
    marginBottom: 2,
    fontSize: 7,
  },
  partyLabel: {
    width: 70,
    fontSize: 7,
  },
  partyValue: {
    fontSize: 7,
  },
  warehouse: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 7,
  },

  // Таблица товаров
  goodsTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 12,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    fontSize: 7,
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 7,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  colNo: { width: "4%" },
  colName: { width: "25%" },
  colUnit: { width: "8%" },
  colQty: { width: "8%", textAlign: "right" },
  colPriceNoDiscount: { width: "12%", textAlign: "right" },
  colDiscount: { width: "8%", textAlign: "right" },
  colPrice: { width: "12%", textAlign: "right" },
  colSum: { width: "13%", textAlign: "right" },

  // Итоги
  totalsSection: {
    marginTop: 6,
    marginLeft: "auto",
    width: 280,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
    fontSize: 7,
  },
  totalLabel: {
    fontSize: 7,
  },
  totalValue: {
    fontSize: 7,
    fontWeight: "normal",
  },
  totalBold: {
    fontWeight: "bold",
    fontSize: 8,
  },

  // Подписи
  signatures: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: {
    flex: 1,
    fontSize: 7,
    // display: "flex",
    // alignItems: "flex-end",
  },
  signatureLabel: {
    marginBottom: 5,
    fontSize: 7,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginBottom: 2,
    minHeight: 15,
  },
  signatureSeal: {
    fontSize: 6,
    marginTop: 2,
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

function fmtQty(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
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
  // Функция для преобразования числа в слова с поддержкой тысяч
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
  const onesFeminine = [
    "",
    "одна",
    "две",
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

  const n = Math.floor(num);
  const kopecks = Math.round((num - n) * 100);

  let result = "";

  // Обработка тысяч
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands >= 100) {
      result += hundreds[Math.floor(thousands / 100)] + " ";
    }
    const thousandsRemainder = thousands % 100;
    if (thousandsRemainder >= 20) {
      result += tens[Math.floor(thousandsRemainder / 10)] + " ";
      if (thousandsRemainder % 10 > 0) {
        result += onesFeminine[thousandsRemainder % 10] + " ";
      }
    } else if (thousandsRemainder >= 10) {
      result += teens[thousandsRemainder - 10] + " ";
    } else if (thousandsRemainder > 0) {
      result += onesFeminine[thousandsRemainder] + " ";
    }

    // Окончание для тысяч
    const lastThousandDigit = thousands % 10;
    const lastTwoThousandDigits = thousands % 100;
    if (lastTwoThousandDigits >= 11 && lastTwoThousandDigits <= 19) {
      result += "тысяч ";
    } else if (lastThousandDigit === 1) {
      result += "тысяча ";
    } else if (lastThousandDigit >= 2 && lastThousandDigit <= 4) {
      result += "тысячи ";
    } else {
      result += "тысяч ";
    }
  }

  // Обработка сотен, десятков и единиц
  const remainder = n % 1000;
  if (remainder >= 100) {
    result += hundreds[Math.floor(remainder / 100)] + " ";
  }
  const remainder100 = remainder % 100;
  if (remainder100 >= 20) {
    result += tens[Math.floor(remainder100 / 10)] + " ";
    if (remainder100 % 10 > 0) result += ones[remainder100 % 10] + " ";
  } else if (remainder100 >= 10) {
    result += teens[remainder100 - 10] + " ";
  } else if (remainder100 > 0) {
    result += ones[remainder100] + " ";
  }

  // Определяем правильное окончание для сомов
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    result += "сом";
  } else if (lastDigit === 1) {
    result += "сом";
  } else if (lastDigit >= 2 && lastDigit <= 4) {
    result += "сома";
  } else {
    result += "сом";
  }

  if (kopecks > 0) {
    result += ` ${kopecks}`;
  } else {
    result += " 00";
  }

  return result.trim();
}

function resolveDocumentDiscount(doc, data, subtotal, rawItems) {
  const rawPercent = Number(doc.discount_percent);
  const percentProvided =
    doc.discount_percent != null &&
    doc.discount_percent !== "" &&
    !Number.isNaN(rawPercent) &&
    rawPercent >= 0 &&
    rawPercent <= 100;

  const explicitAmount = Number(
    doc.order_discount_total ??
      doc.discount_total ??
      doc.discount_amount ??
      data?.order_discount_total ??
      0
  );

  let documentDiscountPercent = 0;
  let documentDiscountAmount = 0;

  if (percentProvided) {
    documentDiscountPercent = rawPercent;
    if (explicitAmount > 0) {
      documentDiscountAmount = explicitAmount;
    } else if (subtotal > 0) {
      documentDiscountAmount = (subtotal * rawPercent) / 100;
    }
  } else if (explicitAmount > 0) {
    documentDiscountAmount = explicitAmount;
    if (subtotal > 0) {
      documentDiscountPercent = (explicitAmount / subtotal) * 100;
    }
  }

  const docPctRaw = Number(doc.discount_percent);
  const hasLinesWithDocDiscount =
    docPctRaw > 0 &&
    Array.isArray(rawItems) &&
    rawItems.some((item) => {
      const dp = item.discount_percent;
      return dp == 0 || !dp;
    });

  const baseShow = documentDiscountAmount > 0 || documentDiscountPercent > 0;
  const showDocumentDiscountLine =
    baseShow && (docPctRaw <= 0 || hasLinesWithDocDiscount);

  return {
    documentDiscountPercent,
    documentDiscountAmount,
    showDocumentDiscountLine,
  };
}

export default function InvoicePdfDocument({ data }) {
  registerPdfFonts();
  const doc = data?.document || data || {};
  const seller = data?.seller || {};
  const buyer =
    data?.buyer ||
    (data?.client_name
      ? { name: data.client_name, full_name: data.client_name }
      : null);

  const totals = data?.totals || {};
  const subtotal = Number(data?.subtotal ?? totals.subtotal ?? 0);
  const discountTotal = Number(data?.discount_total ?? totals.discount_total ?? 0);
  const tax = Number(data?.tax_total ?? totals.tax_total ?? 0);
  const total = Number(data?.total ?? totals.total ?? 0);
  const docDiscountPctForLines = Number(doc.discount_percent ?? 0);

  // Поддержка обоих форматов: unit_price (API) и price (если где-то уже нормализовали)
  const items = Array.isArray(data?.items)
    ? data.items.map((it) => {
        const toNum = (v) => {
          const n = Number(String(v ?? "").replace(",", "."));
          return Number.isFinite(n) ? n : 0;
        };

        const qty = toNum(it.qty || it.quantity || 0);
        const unitBase = toNum(it.unit_price ?? it.price ?? 0);
        const baseLineTotal = unitBase * qty;
        const rowTotalRaw =
          it.line_total != null && it.line_total !== ""
            ? toNum(it.line_total)
            : it.total != null && it.total !== ""
              ? toNum(it.total)
              : null;

        // Скидка только по товару (процент 0–100)
        const lineDiscount = toNum(it.discount_percent ?? it.discount ?? 0);
        const lineDiscountAmount = toNum(
          it.line_discount ??
            it.line_discount_total ??
            it.discount_amount ??
            it.discount_total ??
            0
        );
        const discountFromRowTotal =
          rowTotalRaw != null && baseLineTotal > 0 && rowTotalRaw < baseLineTotal
            ? ((baseLineTotal - rowTotalRaw) / baseLineTotal) * 100
            : 0;
        const itemDiscountPercentRaw =
          it.effective_discount_percent != null &&
          it.effective_discount_percent !== ""
            ? toNum(it.effective_discount_percent)
            : lineDiscount > 0
              ? lineDiscount
              : lineDiscountAmount > 0 && baseLineTotal > 0
                ? (lineDiscountAmount / baseLineTotal) * 100
              : discountFromRowTotal > 0
                ? discountFromRowTotal
              : docDiscountPctForLines;
        const itemDiscountPercent = Number.isFinite(itemDiscountPercentRaw)
          ? itemDiscountPercentRaw
          : 0;

        // Базовая цена без скидки — берём явное поле, иначе текущую цену
        let priceNoDiscount = Number(
          it.original_price ??
            it.price_before_discount ??
            it.price_without_discount ??
            unitBase
        );
        if (!priceNoDiscount) {
          priceNoDiscount = unitBase;
        }

        const fallbackLineTotal = Math.max(
          0,
          baseLineTotal * (1 - Number(itemDiscountPercent || 0) / 100)
        );
        const rowTotal = Number(
          rowTotalRaw != null && !Number.isNaN(rowTotalRaw)
            ? rowTotalRaw
            : fallbackLineTotal
        );
        const priceAfterDiscount =
          qty > 0
            ? rowTotal / qty
            : priceNoDiscount * (1 - Number(itemDiscountPercent || 0) / 100);

        console.log("item debug:", it.name_snapshot, {
          qty,
          unitBase,
          baseLineTotal,
          lineDiscountAmount,
          discountFromRowTotal,
          itemDiscountPercent,
        });

        return {
          id: it.id,
          name: it.name_snapshot || it.name || it.product_name || "Товар",
          qty,
          unit_price: priceAfterDiscount,
          price_no_discount: priceNoDiscount,
          // В колонке «Скидка» отображаем только скидку по позиции.
          discount: itemDiscountPercent,
          total: rowTotal,
          unit: it.unit || "ШТ",
          article: it.article || it.barcode_snapshot || "",
        };
      })
    : [];

  const invoiceNumber = doc.number || "";
  const invoiceDate = doc.datetime || doc.date || data?.created_at || "";
  const { documentDiscountPercent, documentDiscountAmount, showDocumentDiscountLine } =
    resolveDocumentDiscount(doc, data, subtotal, data?.items);

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
        <Text style={{ fontSize: 7, marginBottom: 4 }}>
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
        {/* {seller?.name && (
          <Text style={{ fontSize: 9, textAlign: "right", marginBottom: 12 }}>
            Автор: {safe(seller.name)}
          </Text>
        )} */}

        {/* Поставщик и Покупатель */}
        <View
          style={{
            flexDirection: "column",
            gap: 4,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>
              Поставщик:{" "}
            </Text>
            <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
            {seller.address && (
              <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>
              Покупатель:{" "}
            </Text>
            {buyer ? (
              <Text style={{ fontSize: 8 }}>
                {safe(buyer.name || buyer.full_name)}
              </Text>
            ) : (
              <Text style={{ fontSize: 8 }}>—</Text>
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
            <View style={[s.tableCell, { width: "8%" }]}>
              <Text>Арт.</Text>
            </View>
            <View style={[s.tableCell, s.colUnit]}>
              <Text>Ед. изм.</Text>
            </View>
            <View style={[s.tableCell, s.colQty]}>
              <Text style={{ textAlign: "right" }}>Кол-во</Text>
            </View>
            <View style={[s.tableCell, s.colPriceNoDiscount]}>
              <Text style={{ textAlign: "right" }}>Цена без скидки</Text>
            </View>
            <View style={[s.tableCell, s.colDiscount]}>
              <Text style={{ textAlign: "right" }}>Скидка</Text>
            </View>
            <View style={[s.tableCell, s.colPrice]}>
              <Text style={{ textAlign: "right" }}>Цена</Text>
            </View>
            <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
              <Text style={{ textAlign: "right" }}>Сумма</Text>
            </View>
          </View>

          {/* Строки товаров */}
          {(items.length > 0 ? items : []).map((it, idx) => (
            <View key={it.id || idx} style={s.tableRow}>
              <View style={[s.tableCell, s.colNo]}>
                <Text>{idx + 1}</Text>
              </View>
              <View style={[s.tableCell, s.colName]}>
                <Text>{it.name}</Text>
              </View>
              <View style={[s.tableCell, { width: "8%" }]}>
                <Text>{it.article || "—"}</Text>
              </View>
              <View style={[s.tableCell, s.colUnit]}>
                <Text style={{ textAlign: "right" }}>{it.unit || "ШТ"}</Text>
              </View>
              <View style={[s.tableCell, s.colQty]}>
                <Text style={{ textAlign: "right" }}>{fmtQty(it.qty)}</Text>
              </View>
              <View style={[s.tableCell, s.colPriceNoDiscount]}>
                <Text style={{ textAlign: "right" }}>
                  {n2(it.price_no_discount)}
                </Text>
              </View>
              <View style={[s.tableCell, s.colDiscount]}>
                <Text style={{ textAlign: "right" }}>
                  {it.discount > 0 ? `${n2(it.discount)}%` : "—"}
                </Text>
              </View>
              <View style={[s.tableCell, s.colPrice]}>
                <Text style={{ textAlign: "right" }}>{n2(it.unit_price)}</Text>
              </View>
              <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                <Text style={{ textAlign: "right" }}>{n2(it.total)}</Text>
              </View>
            </View>
          ))}

          {/* Строка "Итого:" */}
          <View style={[s.tableRow, s.tableRowLast, s.tableHeader]}>
            <View style={[s.tableCell, s.colNo]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colName]}>
              <Text style={{ fontWeight: "bold" }}>Итого:</Text>
            </View>
            <View style={[s.tableCell, { width: "8%" }]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colUnit]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colQty]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {fmtQty(items.reduce((sum, it) => sum + Number(it.qty || 0), 0))}
              </Text>
            </View>
            <View style={[s.tableCell, s.colPriceNoDiscount]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colDiscount]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colPrice]}>
              <Text></Text>
            </View>
            <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
              <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                {n2(total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Итоги */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Подытог:</Text>
            <Text style={s.totalValue}>{n2(subtotal)}</Text>
          </View>
          {showDocumentDiscountLine && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>
                Скидка документа
                {documentDiscountPercent > 0
                  ? ` (${n2(documentDiscountPercent)}%)`
                  : ""}:
              </Text>
              <Text style={s.totalValue}>
                -{n2(documentDiscountAmount || discountTotal)}
              </Text>
            </View>
          )}
          {tax > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Налог:</Text>
              <Text style={s.totalValue}>{n2(tax)}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.totalBold]}>
            <Text style={[s.totalLabel, s.totalBold]}>ИТОГО:</Text>
            <Text style={[s.totalValue, s.totalBold]}>{n2(total)}</Text>
          </View>
        </View>

        {/* Текст с количеством наименований и суммой */}
        <View style={{ marginTop: 4, fontSize: 7 }}>
          <Text style={{ fontSize: 7 }}>
            Всего наименований {items.length}, на сумму {n2(total)} KGS
          </Text>
        </View>

        {/* Сумма прописью */}
        <View style={{ marginTop: 2, fontSize: 7 }}>
          <Text style={{ fontSize: 7, textTransform: "capitalize" }}>
            {numToWords(total)}
          </Text>
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
