import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { registerPdfFonts } from "@/pdf/registerFonts";
import { numberToWords } from "../../../../../utils/numberToWords.js";

registerPdfFonts();

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    paddingTop: 24,
    paddingRight: 26,
    paddingBottom: 24,
    paddingLeft: 26,
    color: "#111",
  },
  topBlock: {
    marginBottom: 6,
    lineHeight: 1.2,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 4,
    lineHeight: 1.2,
  },
  table: {
    borderWidth: 1,
    borderColor: "#222",
    marginTop: 4,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    minHeight: 24,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 24,
  },
  th: {
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#222",
  },
  td: {
    fontSize: 8,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#222",
    justifyContent: "center",
  },
  tdLast: {
    fontSize: 8,
    padding: 3,
    justifyContent: "center",
  },
  cNum: { width: 22 },
  cImage: { width: 52 },
  cName: { width: 138 },
  cCharacteristic: { width: 118 },
  cQty: { width: 38 },
  cUnit: { width: 32 },
  cPrice: { width: 58 },
  cSum: { width: 58 },
  imageBox: {
    width: 42,
    height: 42,
    objectFit: "contain",
    alignSelf: "center",
  },
  noImage: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontSize: 6,
    color: "#777",
    textAlign: "center",
  },
  rightText: {
    textAlign: "right",
  },
  centerText: {
    textAlign: "center",
  },
  totals: {
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  conditions: {
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 1.2,
  },
  footer: {
    marginTop: 6,
    lineHeight: 1.2,
  },
});

function safe(value, fallback = "—") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function money(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getPrimaryImage(item) {
  // Сначала смотрим на готовый base64 (подготовленный заранее)
  if (item.imageDataUrl) return item.imageDataUrl;
  return "";
}

function formatCharacteristic(item) {
  const explicit = safe(
    item.characteristic ||
      item.characteristics_text ||
      item.description ||
      item.product_description,
    "",
  );
  if (explicit) return explicit;

  const ch = item.product_characteristics || item.characteristics || {};
  const parts = [];
  if (ch.height_cm) parts.push(`Высота: ${ch.height_cm} см`);
  if (ch.width_cm) parts.push(`Ширина: ${ch.width_cm} см`);
  if (ch.depth_cm) parts.push(`Глубина: ${ch.depth_cm} см`);
  if (ch.factual_weight_kg) parts.push(`Вес: ${ch.factual_weight_kg} кг`);
  if (ch.description) parts.push(String(ch.description));
  return parts.join("; ") || "—";
}

export default function CommercialOfferPdfDocument({ data }) {
  const doc = data?.document || {};
  const seller = data?.seller || {};
  const buyer = data?.buyer || {};
  const totals = data?.totals || {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number(totals.total || 0);
  const itemsCount = items.length;
  const totalQty = items.reduce(
    (sum, item) => sum + Number(item.qty || item.quantity || 0),
    0,
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topBlock}>
          <Text>от: {safe(seller.name)}</Text>
          {seller.address ? <Text>{safe(seller.address)}</Text> : null}
          {seller.phone ? <Text>Тел.: {safe(seller.phone)}</Text> : null}
          {seller.email ? <Text>Email: {safe(seller.email)}</Text> : null}
        </View>

        <Text style={s.title}>Коммерческое предложение</Text>

        <Text style={s.paragraph}>
          Подготовлено: {safe(buyer.name, "клиент")}, № {safe(doc.number)} от{" "}
          {fmtDate(doc.date || doc.datetime || doc.created_at)}
        </Text>

        <Text style={s.paragraph}>
          Компания {safe(seller.name, "—")} предлагает Вам ознакомиться с
          предложением по следующим позициям:
        </Text>

        <View style={s.table}>
          <View style={s.tableRow} fixed>
            <Text style={[s.th, s.cNum]}>№</Text>
            <Text style={[s.th, s.cImage]}>Изображение</Text>
            <Text style={[s.th, s.cName]}>Наименование</Text>
            <Text style={[s.th, s.cCharacteristic]}>Характеристика</Text>
            <Text style={[s.th, s.cQty]}>Кол-во</Text>
            <Text style={[s.th, s.cUnit]}>Ед.</Text>
            <Text style={[s.th, s.cPrice]}>Цена</Text>
            <Text style={[s.th, s.cSum, { borderRightWidth: 0 }]}>Сум</Text>
          </View>
          {items.map((item, index) => {
            const qty = Number(item.qty || item.quantity || 0);
            const price = Number(item.unit_price || item.price || 0);
            const rowTotal = Number(item.total || qty * price);
            const imageSrc = getPrimaryImage(item);
            const rowStyle =
              index === items.length - 1 ? s.tableRowLast : s.tableRow;

            return (
              <View key={item.id || index} style={rowStyle} wrap={false}>
                <Text style={[s.td, s.cNum, s.centerText]}>{index + 1}</Text>
                <View style={[s.td, s.cImage]}>
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      style={s.imageBox}
                      onError={() => {}}
                    />
                  ) : (
                    <View style={s.noImage}>
                      <Text style={s.noImageText}>Нет фото</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.td, s.cName]}>
                  {safe(item.name || item.product_name)}
                </Text>
                <Text style={[s.td, s.cCharacteristic]}>
                  {formatCharacteristic(item)}
                </Text>
                <Text style={[s.td, s.cQty, s.centerText]}>{qty}</Text>
                <Text style={[s.td, s.cUnit, s.centerText]}>
                  {safe(item.unit, "шт")}
                </Text>
                <Text style={[s.td, s.cPrice, s.rightText]}>
                  {money(price)}
                </Text>
                <Text style={[s.tdLast, s.cSum, s.rightText]}>
                  {money(rowTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={s.totals}>
          <Text>
            Всего наименований {itemsCount}, на сумму {money(total)} сом
          </Text>
          <Text>{numberToWords(total)}</Text>
        </View>

        <View style={s.conditions}>
          <Text>
            Также предлагаем Вам ознакомиться с остальными условиями нашего
            предложения:
          </Text>
          {data?.paymentLabel ? (
            <Text>График оплаты: {safe(data.paymentLabel)}</Text>
          ) : null}
          {data?.warehouse ? <Text>Склад: {safe(data.warehouse)}</Text> : null}
          <Text>Общее количество: {money(totalQty)}</Text>
        </View>

        <View style={s.footer}>
          <Text>С уважением,</Text>
          <Text>{safe(seller.name)}</Text>
          {seller.address ? <Text>{safe(seller.address)}</Text> : null}
          {seller.phone ? <Text>Тел.: {safe(seller.phone)}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
