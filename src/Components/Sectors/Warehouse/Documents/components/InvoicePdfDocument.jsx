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
  // Накладная на перемещение: 5 колонок (№, Наименование, Арт., Ед. изм., Кол-во)
  colNoTransfer: { width: "5%" },
  colNameTransfer: { width: "52%" },
  colArtTransfer: { width: "8%" },
  colUnitTransfer: { width: "10%" },
  colQtyTransfer: { width: "25%", textAlign: "right" },

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

// Функция для получения названия документа по типу
function getDocumentTitle(docType) {
  const titles = {
    SALE: "Расходная накладная",
    PURCHASE: "Приходная накладная",
    SALE_RETURN: "Расходная накладная на возврат",
    PURCHASE_RETURN: "Приходная накладная на возврат",
    INVENTORY: "Бланк инвентаризации",
    RECEIPT: "Оприходование",
    WRITE_OFF: "Списание",
    TRANSFER: "Накладная на перемещение",
  };
  return titles[docType] || "Накладная";
}

// Функция для определения, нужны ли колонки с ценой и суммой
function needsPriceColumns(docType) {
  return !["INVENTORY", "TRANSFER"].includes(docType);
}

// Функция для определения, нужны ли колонки со скидкой
function needsDiscountColumns(docType) {
  return ["SALE", "PURCHASE", "SALE_RETURN", "PURCHASE_RETURN"].includes(docType);
}

export default function InvoicePdfDocument({ data }) {
  registerPdfFonts();
  const doc = data?.document || {};
  const seller = data?.seller || {};
  const buyer = data?.buyer || null;
  const docType = data?.doc_type || doc.doc_type || doc.type || "SALE";

  const totals = data?.totals || {};
  const subtotal = Number(totals.subtotal || 0);
  const discountTotal = Number(totals.discount_total || 0);
  const tax = Number(totals.tax_total || 0);
  const total = Number(totals.total || 0);

  // Определяем структуру документа
  const documentTitle = getDocumentTitle(docType);
  const showPriceColumns = needsPriceColumns(docType);
  const showDiscountColumns = needsDiscountColumns(docType);
  const isInventory = docType === "INVENTORY";
  const isTransfer = docType === "TRANSFER";

  // Скидка на уровне документа (процент 0–100 или сумма в валюте)
  const docPercent = Number(doc.discount_percent);
  const hasExplicitPercent =
    !Number.isNaN(docPercent) && docPercent >= 0 && docPercent <= 100;
  const documentDiscount = Number(
    doc.order_discount_total ??
    doc.discount_total ??
    doc.discount_amount ??
    doc.discount_percent ??
    data.order_discount_total ??
    0
  );

  let documentDiscountPercent = 0;
  if (hasExplicitPercent) {
    // Явно передан процент (например 10%) — используем его
    documentDiscountPercent = docPercent;
  } else if (documentDiscount > 0 && subtotal > 0) {
    // Иначе выводим процент из суммы: если число > 100, считаем суммой в валюте
    if (documentDiscount > 100) {
      documentDiscountPercent = (documentDiscount / subtotal) * 100;
    } else {
      documentDiscountPercent = documentDiscount;
    }
  }

  // Поддержка обоих форматов: unit_price (API) и price (если где-то уже нормализовали)
  const items = Array.isArray(data?.items)
    ? data.items.map((it) => {
      const qty = Number(it.qty || it.quantity || 0);
      const unit = Number(it.unit_price ?? it.price ?? 0);
      const total = Number(it.total ?? qty * unit);

      // Скидка на уровне товара (если есть) - используем discount_percent в процентах
      const itemDiscountPercent = Number(it.discount_percent ?? 0);

      // Цена без скидки товара (если есть original_price или price_before_discount)
      let priceNoDiscount = Number(
        it.original_price ??
        it.price_before_discount ??
        it.price_without_discount ??
        0
      );

      // Если цена без скидки не указана, вычисляем её из текущей цены и скидок
      if (priceNoDiscount === 0 || priceNoDiscount === unit) {
        // Если есть скидка на товар, вычисляем цену без скидки товара
        if (itemDiscountPercent > 0) {
          priceNoDiscount = unit / (1 - itemDiscountPercent / 100);
        } else if (documentDiscountPercent > 0) {
          // Если есть скидка на документ, вычисляем цену без скидки документа
          priceNoDiscount = unit / (1 - documentDiscountPercent / 100);
        } else {
          // Если скидок нет, цена без скидки = текущая цена
          priceNoDiscount = unit;
        }
      }

      // Общая скидка для товара (скидка товара + скидка документа)
      let finalDiscountPercent = itemDiscountPercent;
      if (documentDiscountPercent > 0 && itemDiscountPercent === 0) {
        // Если есть только скидка документа, используем её
        finalDiscountPercent = documentDiscountPercent;
      } else if (documentDiscountPercent > 0 && itemDiscountPercent > 0) {
        // Если есть обе скидки, вычисляем общую эффективную скидку
        const itemPriceBeforeDiscount = priceNoDiscount;
        const itemPriceAfterItemDiscount =
          itemPriceBeforeDiscount * (1 - itemDiscountPercent / 100);
        const itemPriceAfterDocumentDiscount =
          itemPriceAfterItemDiscount * (1 - documentDiscountPercent / 100);
        finalDiscountPercent =
          ((itemPriceBeforeDiscount - itemPriceAfterDocumentDiscount) /
            itemPriceBeforeDiscount) *
          100;
      }

      return {
        id: it.id,
        name: it.name || it.product_name || "Товар",
        qty,
        unit_price: unit,
        price_no_discount: priceNoDiscount,
        discount: finalDiscountPercent,
        total,
        unit: it.unit || "ШТ",
        article: it.article || "",
      };
    })
    : [];

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
        {/* Дата и время — слева сверху (как в образце накладной на перемещение) */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <Text style={{ fontSize: 7 }}>
            {fmtDateTime(invoiceDate || new Date().toISOString())}
          </Text>
        </View>

        {/* Заголовок — жирный, крупнее */}
        <View style={s.header}>
          <Text style={s.title}>
            {documentTitle} № {invoiceNumber || "—"} от{" "}
            {fmtDate(invoiceDate)}
          </Text>
        </View>

        {/* Автор — не показываем для накладной на перемещение */}
        {seller?.name && !isTransfer && (
          <Text style={{ fontSize: 7, textAlign: "right", marginBottom: 4 }}>
            Автор: {safe(seller.name)}
          </Text>
        )}

        {/* Организация (для INVENTORY и для TRANSFER — как в образце) */}
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

        {/* Поставщик и Покупатель (для документов с контрагентами) */}
        {!isInventory && !isTransfer && (
          <View
            style={{
              flexDirection: "column",
              gap: 4,
              marginTop: 6,
              marginBottom: 6,
            }}
          >
            {/* Для PURCHASE и PURCHASE_RETURN: Поставщик и Покупатель */}
            {["PURCHASE", "PURCHASE_RETURN"].includes(docType) && (
              <>
                <View style={{ flexDirection: "row", fontSize: 8 }}>
                  <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                    Поставщик:{" "}
                  </Text>
                  {buyer ? (
                    <Text style={{ fontSize: 8 }}>
                      {safe(buyer.name || buyer.full_name)}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 8 }}>—</Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", fontSize: 8 }}>
                  <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                    Покупатель:{" "}
                  </Text>
                  <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
                  {seller.address && (
                    <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
                  )}
                </View>
              </>
            )}
            {/* Для SALE и SALE_RETURN: Поставщик и Покупатель */}
            {["SALE", "SALE_RETURN"].includes(docType) && (
              <>
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
              </>
            )}
            {/* Для RECEIPT и WRITE_OFF: только Организация и Склад */}
            {["RECEIPT", "WRITE_OFF"].includes(docType) && seller?.name && (
              <View style={{ flexDirection: "row", fontSize: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                  Организация:{" "}
                </Text>
                <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
                {seller.address && (
                  <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Склад (для всех кроме TRANSFER) */}
        {!isTransfer && data?.warehouse && (
          <View style={s.warehouse}>
            <Text>Склад: «{safe(data.warehouse)}»</Text>
          </View>
        )}

        {/* Склады для накладной на перемещение — как в образце */}
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

        {/* Таблица товаров */}
        <View style={s.goodsTable}>
          {/* Накладная на перемещение: 5 колонок — №, Наименование, Арт., Ед. изм., Кол-во */}
          {isTransfer ? (
            <>
              <View style={[s.tableRow, s.tableHeader]}>
                <View style={[s.tableCell, s.colNoTransfer]}>
                  <Text>№</Text>
                </View>
                <View style={[s.tableCell, s.colNameTransfer]}>
                  <Text>Наименование</Text>
                </View>
                <View style={[s.tableCell, s.colArtTransfer]}>
                  <Text>Арт.</Text>
                </View>
                <View style={[s.tableCell, s.colUnitTransfer]}>
                  <Text>Ед. изм.</Text>
                </View>
                <View style={[s.tableCell, s.colQtyTransfer, s.tableCellLast]}>
                  <Text style={{ textAlign: "right" }}>Кол-во</Text>
                </View>
              </View>
              {(items.length > 0 ? items : []).map((it, idx) => (
                <View key={it.id || idx} style={idx === items.length - 1 ? [s.tableRow, s.tableRowLast] : s.tableRow}>
                  <View style={[s.tableCell, s.colNoTransfer]}>
                    <Text>{idx + 1}</Text>
                  </View>
                  <View style={[s.tableCell, s.colNameTransfer]}>
                    <Text>{it.name}</Text>
                  </View>
                  <View style={[s.tableCell, s.colArtTransfer]}>
                    <Text>{it.article || ""}</Text>
                  </View>
                  <View style={[s.tableCell, s.colUnitTransfer]}>
                    <Text>{it.unit || "ШТ"}</Text>
                  </View>
                  <View style={[s.tableCell, s.colQtyTransfer, s.tableCellLast]}>
                    <Text style={{ textAlign: "right" }}>{fmtQty(it.qty)}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              {/* Заголовок таблицы (не TRANSFER) */}
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
                {isInventory ? (
                  <View style={[s.tableCell, { width: "55%", textAlign: "right" }, s.tableCellLast]}>
                    <Text style={{ textAlign: "right" }}>Остаток факт.</Text>
                  </View>
                ) : (
                  <>
                    <View style={[s.tableCell, s.colQty]}>
                      <Text style={{ textAlign: "right" }}>Кол-во</Text>
                    </View>
                    {showPriceColumns && (
                      <>
                        {showDiscountColumns && (
                          <>
                            <View style={[s.tableCell, s.colPriceNoDiscount]}>
                              <Text style={{ textAlign: "right" }}>Цена без скидки</Text>
                            </View>
                            <View style={[s.tableCell, s.colDiscount]}>
                              <Text style={{ textAlign: "right" }}>Скидка</Text>
                            </View>
                            <View style={[s.tableCell, s.colPrice]}>
                              <Text style={{ textAlign: "right" }}>Цена</Text>
                            </View>
                          </>
                        )}
                        {!showDiscountColumns && (
                          <View style={[s.tableCell, s.colPrice]}>
                            <Text style={{ textAlign: "right" }}>Цена</Text>
                          </View>
                        )}
                        <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                          <Text style={{ textAlign: "right" }}>Сумма</Text>
                        </View>
                      </>
                    )}
                    {!showPriceColumns && (
                      <View style={[s.tableCell, { width: "47%", textAlign: "right" }, s.tableCellLast]}>
                        <Text></Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Строки товаров (не TRANSFER) */}
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
                  {isInventory ? (
                    <View style={[s.tableCell, { width: "55%", textAlign: "right" }, s.tableCellLast]}>
                      <Text style={{ textAlign: "right" }}>—</Text>
                    </View>
                  ) : (
                    <>
                      <View style={[s.tableCell, s.colQty]}>
                        <Text style={{ textAlign: "right" }}>{fmtQty(it.qty)}</Text>
                      </View>
                      {showPriceColumns && (
                        <>
                          {showDiscountColumns && (
                            <>
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
                            </>
                          )}
                          {!showDiscountColumns && (
                            <View style={[s.tableCell, s.colPrice]}>
                              <Text style={{ textAlign: "right" }}>{n2(it.unit_price)}</Text>
                            </View>
                          )}
                          <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                            <Text style={{ textAlign: "right" }}>{n2(it.total)}</Text>
                          </View>
                        </>
                      )}
                      {!showPriceColumns && (
                        <View style={[s.tableCell, { width: "47%", textAlign: "right" }, s.tableCellLast]}>
                          <Text></Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Строка "Итого:" (только для документов с ценой и суммой) */}
          {showPriceColumns && !isTransfer && (
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
              {showDiscountColumns && (
                <>
                  <View style={[s.tableCell, s.colPriceNoDiscount]}>
                    <Text></Text>
                  </View>
                  <View style={[s.tableCell, s.colDiscount]}>
                    <Text></Text>
                  </View>
                  <View style={[s.tableCell, s.colPrice]}>
                    <Text></Text>
                  </View>
                </>
              )}
              {!showDiscountColumns && (
                <View style={[s.tableCell, s.colPrice]}>
                  <Text></Text>
                </View>
              )}
              <View style={[s.tableCell, s.colSum, s.tableCellLast]}>
                <Text style={{ textAlign: "right", fontWeight: "bold" }}>
                  {n2(total)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Итоги (только для документов с ценой и суммой) */}
        {showPriceColumns && (
          <>
            <View style={s.totalsSection}>
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
          </>
        )}

        {/* Для INVENTORY: Всего позиций и дата печати */}
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
