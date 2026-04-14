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
  warehouse: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 7,
  },
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
  signatures: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: {
    flex: 1,
    fontSize: 7,
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

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands >= 100) result += hundreds[Math.floor(thousands / 100)] + " ";
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

  const remainder = n % 1000;
  if (remainder >= 100) result += hundreds[Math.floor(remainder / 100)] + " ";
  const remainder100 = remainder % 100;
  if (remainder100 >= 20) {
    result += tens[Math.floor(remainder100 / 10)] + " ";
    if (remainder100 % 10 > 0) result += ones[remainder100 % 10] + " ";
  } else if (remainder100 >= 10) {
    result += teens[remainder100 - 10] + " ";
  } else if (remainder100 > 0) {
    result += ones[remainder100] + " ";
  }

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

  result += kopecks > 0 ? ` ${kopecks}` : " 00";
  return result.trim();
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

const renderInlineValue = (label, value) => {
  if (!value) return null;
  return `${label}: ${safe(value)}`;
};

export default function ProductionInvoicePdfDocument({ data }) {
  registerPdfFonts();

  const doc = data?.document || {};
  const seller = data?.seller || {};
  const buyer = data?.buyer || null;
  const agent = data?.agent || null;

  const total = Number(data?.totals?.total ?? data?.total ?? 0);
  const subtotal = Number(
    data?.totals?.subtotal ?? data?.totals?.amount ?? data?.subtotal ?? 0,
  );
  const totalDiscount = Number(
    data?.totals?.discount_total ??
      data?.totals?.order_discount_total ??
      data?.sale?.discount_total ??
      data?.discount_total ??
      0,
  );

  const sourceItems = Array.isArray(data?.sale?.items)
    ? data.sale.items
    : Array.isArray(data?.items)
      ? data.items
      : [];

  const items = sourceItems.map((it) => {
    const qty = Number(it.qty || it.quantity || 0);
    const unit = Number(it.unit_price ?? it.price ?? 0);
    const lineTotal = Number(it.line_total ?? it.total ?? qty * unit);
    const itemDiscountAmount = Number(
      it.line_discount ?? it.discount_total ?? it.line_discount_total ?? 0,
    );
    const baseLineTotal = unit * qty;

    const itemDiscountPercent =
      itemDiscountAmount > 0 && baseLineTotal > 0
        ? (itemDiscountAmount / baseLineTotal) * 100
        : 0;

    return {
      id: it.id,
      name: it.name || it.product_name || "Товар",
      qty,
      unit_price: qty > 0 ? lineTotal / qty : unit,
      price_no_discount: unit,
      discount: itemDiscountPercent,
      discount_amount: itemDiscountAmount,
      total: lineTotal,
      unit: it.unit || "ШТ",
      article: it.article || "",
    };
  });

  const invoiceNumber =
    doc.number || data?.number || data?.id?.slice(0, 8) || "";
  const invoiceDate = doc.datetime || doc.date || data?.created_at || "";

  const clientMetaLine1 = [
    renderInlineValue(
      "ФИО",
      buyer?.full_name || buyer?.name || buyer?.display_name,
    ),
    renderInlineValue("ИНН", buyer?.inn),
  ]
    .filter(Boolean)
    .join("   ");

  const clientMetaLine2 = [
    renderInlineValue("Телефон", buyer?.phone),
    renderInlineValue("Email", buyer?.email),
  ]
    .filter(Boolean)
    .join("   ");

  const clientMetaLine3 = [
    renderInlineValue("Адрес", buyer?.address),
    renderInlineValue("ОсОО", buyer?.llc),
  ]
    .filter(Boolean)
    .join("   ");

  const sellerMetaLine = [
    renderInlineValue("Телефон", seller?.phone),
    renderInlineValue("Email", seller?.email),
    renderInlineValue("ИНН", seller?.inn),
  ]
    .filter(Boolean)
    .join("   ");

  const agentName = agent?.full_name || agent?.name;
  const agentMetaLine = [
    renderInlineValue("Телефон", agent?.phone),
    renderInlineValue("Email", agent?.email),
  ]
    .filter(Boolean)
    .join("   ");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={{ fontSize: 7, marginBottom: 4 }}>
          {fmtDateTime(new Date().toISOString())}
        </Text>

        <View style={s.header}>
          <Text style={s.title}>
            Расходная накладная № {invoiceNumber || "—"} от{" "}
            {fmtDate(invoiceDate)}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "column",
            gap: 4,
            marginTop: 6,
            marginBottom: 6,
          }}
        >
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Поставщик: </Text>
            <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
            {seller.address && (
              <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
            )}
          </View>

          {!!sellerMetaLine && (
            <Text style={{ fontSize: 7, marginLeft: 54 }}>
              {sellerMetaLine}
            </Text>
          )}

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

          {!!clientMetaLine1 && (
            <Text style={{ fontSize: 7, marginLeft: 58 }}>
              {clientMetaLine1}
            </Text>
          )}
          {!!clientMetaLine2 && (
            <Text style={{ fontSize: 7, marginLeft: 58 }}>
              {clientMetaLine2}
            </Text>
          )}
          {!!clientMetaLine3 && (
            <Text style={{ fontSize: 7, marginLeft: 58 }}>
              {clientMetaLine3}
            </Text>
          )}

          {(agentName || agentMetaLine) && (
            <>
              <View style={{ flexDirection: "row", fontSize: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                  Продавец:{" "}
                </Text>
                <Text style={{ fontSize: 8 }}>{safe(agentName)}</Text>
              </View>
              {!!agentMetaLine && (
                <Text style={{ fontSize: 7, marginLeft: 50 }}>
                  {agentMetaLine}
                </Text>
              )}
            </>
          )}
        </View>

        {data?.warehouse && (
          <View style={s.warehouse}>
            <Text>Склад: «{safe(data.warehouse)}»</Text>
          </View>
        )}

        <View style={s.goodsTable}>
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
                  {it.discount > 0
                    ? `${n2(it.discount)}%`
                    : it.discount_amount > 0
                      ? `${n2(it.discount_amount)}`
                      : "—"}
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
                {fmtQty(
                  items.reduce((sum, it) => sum + Number(it.qty || 0), 0),
                )}
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

        <View style={s.totalsSection}>
          {subtotal > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Подытог:</Text>
              <Text style={s.totalValue}>{n2(subtotal)}</Text>
            </View>
          )}
          {totalDiscount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Скидка:</Text>
              <Text style={s.totalValue}>-{n2(totalDiscount)}</Text>
            </View>
          )}
          <View style={[s.totalRow, s.totalBold]}>
            <Text style={[s.totalLabel, s.totalBold]}>ИТОГО:</Text>
            <Text style={[s.totalValue, s.totalBold]}>{n2(total)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 4, fontSize: 7 }}>
          <Text style={{ fontSize: 7 }}>
            Всего наименований {items.length}, на сумму {n2(total)} KGS
          </Text>
        </View>

        <View style={{ marginTop: 2, fontSize: 7 }}>
          <Text style={{ fontSize: 7, textTransform: "capitalize" }}>
            {numToWords(total)}
          </Text>
        </View>

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
