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
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 8,
    marginTop: 2,
  },
  contractInfo: {
    fontSize: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  // Таблица в стиле классического акта сверки
  table: { borderWidth: 1, borderColor: "#000" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 16,
  },
  rowLast: { borderBottomWidth: 0 },
  head: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  cell: {
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 4,
    justifyContent: "center",
  },
  cellLast: { borderRightWidth: 0 },
  // Колонки: № | Содержание | Company (Дт | Кт) | Client (Дт | Кт)
  cNum: { width: "4%" },
  cContent: { width: "28%" },
  cMoney: { width: "8.5%" },
  // Служебные строки
  sectionRow: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  summary: {
    marginTop: 12,
    fontSize: 8,
    lineHeight: 1.4,
  },
  signatures: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signCol: { flex: 1, fontSize: 8 },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 18,
    marginTop: 12,
  },
});

function safe(v) {
  if (v === null || v === undefined || v === "") return "—";

  // Если это объект, пытаемся извлечь строковое значение
  if (typeof v === "object" && v !== null) {
    // Пробуем найти строковое поле
    if (v.name !== undefined && v.name !== null && v.name !== "") {
      return String(v.name);
    }
    if (v.title !== undefined && v.title !== null && v.title !== "") {
      return String(v.title);
    }
    if (v.label !== undefined && v.label !== null && v.label !== "") {
      return String(v.label);
    }
    if (v.value !== undefined && v.value !== null && v.value !== "") {
      return String(v.value);
    }
    // Если это массив, пробуем взять первый элемент
    if (Array.isArray(v) && v.length > 0) {
      return safe(v[0]);
    }
    // Если ничего не найдено, возвращаем дефолтное значение
    return "—";
  }

  // Если это уже строка или число, преобразуем в строку
  return String(v);
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
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getNextDay(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  return d;
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") {
      // Если это объект, пытаемся извлечь строковое значение
      if (typeof v === "object" && v !== null) {
        // Пробуем найти строковое поле
        if (v.name !== undefined && v.name !== null && v.name !== "") {
          return v.name;
        }
        if (v.title !== undefined && v.title !== null && v.title !== "") {
          return v.title;
        }
        if (v.label !== undefined && v.label !== null && v.label !== "") {
          return v.label;
        }
        if (v.value !== undefined && v.value !== null && v.value !== "") {
          return v.value;
        }
        // Если это массив, пробуем взять первый элемент
        if (Array.isArray(v) && v.length > 0) {
          return v[0];
        }
        // Если объект не имеет строковых полей, пропускаем
        continue;
      }
      return v;
    }
  }
  // Если fallback тоже объект, обрабатываем его
  if (typeof fallback === "object" && fallback !== null) {
    if (
      fallback.name !== undefined &&
      fallback.name !== null &&
      fallback.name !== ""
    ) {
      return fallback.name;
    }
    if (
      fallback.title !== undefined &&
      fallback.title !== null &&
      fallback.title !== ""
    ) {
      return fallback.title;
    }
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
  return pickFirst(row, [
    "document",
    "doc",
    "title",
    "description",
    "content",
    "name",
  ]);
}

function pickDocType(row) {
  return pickFirst(row, ["ref_type", "doc_type", "type", "document_type"]);
}

function isUUID(str) {
  if (!str || typeof str !== "string") return false;
  // Проверяем формат UUID (с дефисами или без)
  const uuidRegex =
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function removeUUID(str) {
  if (!str || typeof str !== "string") return str;
  // Удаляем UUID из строки (может быть в начале, середине или конце)
  // Формат: 8-4-4-4-12 символов hex, разделенных дефисами или без них
  const uuidPattern =
    /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi;
  let cleaned = str.replace(uuidPattern, "");

  // Убираем лишние пробелы (двойные, тройные и т.д.)
  cleaned = cleaned.replace(/\s+/g, " ");

  // Убираем пробелы перед знаками препинания
  cleaned = cleaned.replace(/\s+([.,:;])/g, "$1");

  // Убираем пробелы после знаков препинания (кроме случаев, где нужен пробел)
  cleaned = cleaned.replace(/([.,:;])\s+/g, "$1 ");

  // Убираем пробелы в начале и конце
  cleaned = cleaned.trim();

  return cleaned;
}

function pickDocNumber(row) {
  // Ищем номер документа в различных полях
  return pickFirst(row, [
    "doc_number",
    "document_number",
    "number",
    "num",
    "doc_num",
    "invoice_number",
    "order_number",
  ]);
}

function formatDocDescription(row) {
  const docType = pickDocType(row);
  const title = row?.title; // В новой структуре используется title
  const doc = pickDoc(row);
  const docNumber = pickDocNumber(row);
  const date = pickDate(row);
  const dateStr = date ? fmtDate(date) : "";

  // Если есть title, используем его (это полное описание из API)
  if (title) {
    // Очищаем title от UUID
    let cleanedTitle = removeUUID(String(title));

    // Если в title уже есть дата, не добавляем её повторно
    // Проверяем, есть ли дата в формате "от DD.MM.YYYY г." в title
    const dateInTitle = /от\s+\d{2}\.\d{2}\.\d{4}\s+г\./i.test(cleanedTitle);

    if (dateInTitle || !dateStr) {
      return cleanedTitle;
    }

    // Добавляем дату, если её нет в title
    return cleanedTitle + (dateStr ? ` от ${dateStr} г.` : "");
  }

  // Если нет title, формируем описание на основе типа документа
  let cleanedDoc = doc ? removeUUID(String(doc)) : null;

  // Если после очистки осталась пустая строка или только UUID, используем docNumber
  if (!cleanedDoc || cleanedDoc.trim() === "" || isUUID(doc)) {
    cleanedDoc = docNumber || null;
  }

  // Определяем тип документа и формируем описание
  const docTypeLower = docType ? String(docType).toLowerCase() : "";

  if (docTypeLower === "receipt" || docTypeLower === "поступление") {
    return `Поступление (товаров, услуг)${
      cleanedDoc ? ` № ${cleanedDoc}` : ""
    }${dateStr ? ` от ${dateStr} г.` : ""}`;
  } else if (
    docTypeLower === "payment" ||
    docTypeLower === "платеж" ||
    docTypeLower === "платежное поручение"
  ) {
    return `Платежное поручение исходящее${
      cleanedDoc ? ` № ${cleanedDoc}` : ""
    }${dateStr ? ` от ${dateStr} г.` : ""}`;
  } else if (docTypeLower === "sale" || docTypeLower === "продажа") {
    return `Продажа${cleanedDoc ? ` № ${cleanedDoc}` : ""}${
      dateStr ? ` от ${dateStr} г.` : ""
    }`;
  } else if (
    docTypeLower === "deal" ||
    docTypeLower === "transaction" ||
    docTypeLower === "сделка"
  ) {
    // Обрабатываем формат "Сделка: Долг ЭЛМИРБЕК (Долг)"
    if (cleanedDoc) {
      // Убираем UUID из описания сделки
      const cleanedTransaction = removeUUID(cleanedDoc);
      return cleanedTransaction + (dateStr ? ` от ${dateStr} г.` : "");
    }
    return `Сделка${dateStr ? ` от ${dateStr} г.` : ""}`;
  } else if (
    docTypeLower === "deal_prepayment" ||
    docTypeLower === "предоплата"
  ) {
    if (cleanedDoc) {
      const cleanedPrepayment = removeUUID(cleanedDoc);
      return cleanedPrepayment + (dateStr ? ` от ${dateStr} г.` : "");
    }
    return `Предоплата${dateStr ? ` от ${dateStr} г.` : ""}`;
  } else if (
    docTypeLower === "installment_payment" ||
    docTypeLower === "оплата по рассрочке"
  ) {
    if (cleanedDoc) {
      const cleanedPayment = removeUUID(cleanedDoc);
      return cleanedPayment + (dateStr ? ` от ${dateStr} г.` : "");
    }
    return `Оплата по рассрочке${dateStr ? ` от ${dateStr} г.` : ""}`;
  } else if (cleanedDoc) {
    // Для других типов документов очищаем описание от UUID
    const finalDoc = removeUUID(cleanedDoc);
    if (finalDoc && finalDoc.trim() !== "") {
      return finalDoc + (dateStr ? ` от ${dateStr} г.` : "");
    }
  }

  // Если есть только дата, формируем базовое описание
  if (dateStr) {
    return `Документ от ${dateStr} г.`;
  }

  return "—";
}

function renderSaldoCells(
  value,
  { TextComp, styles, showZero = false, isLast = false }
) {
  // value: number, >0 => Debit, <0 => Credit
  const v = getNumber(value);
  const debit = v > 0 ? n2(v) : showZero && v === 0 ? n2(0) : "";
  const credit = v < 0 ? n2(Math.abs(v)) : showZero && v === 0 ? n2(0) : "";
  return (
    <>
      <View style={[styles.cell, styles.cMoney]}>
        <TextComp style={styles.right}>{debit}</TextComp>
      </View>
      <View
        style={[styles.cell, styles.cMoney, isLast ? styles.cellLast : null]}
      >
        <TextComp style={styles.right}>{credit}</TextComp>
      </View>
    </>
  );
}

function numberToWords(num) {
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
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
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

  const n = Math.floor(num);
  const decimals = Math.round((num - n) * 100);

  if (n === 0) return "ноль";

  let result = "";

  // Тысячи
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    if (thousands === 1) result += "одна тысяча ";
    else if (thousands === 2) result += "две тысячи ";
    else if (thousands >= 3 && thousands <= 4)
      result += ones[thousands] + " тысячи ";
    else if (thousands >= 5) result += ones[thousands] + " тысяч ";
  }

  // Сотни
  const h = Math.floor((n % 1000) / 100);
  if (h > 0) result += hundreds[h] + " ";

  // Десятки и единицы
  const remainder = n % 100;
  if (remainder >= 10 && remainder < 20) {
    result += teens[remainder - 10] + " ";
  } else {
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    if (t > 0) result += tens[t] + " ";
    if (o > 0) result += ones[o] + " ";
  }

  result += "сом ";
  if (decimals > 0) {
    result += decimals.toString().padStart(2, "0") + " тыйын";
  } else {
    result += "00 тыйын";
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

export default function ReconciliationPdfDocument({ data, meta }) {
  registerPdfFonts();
  const lines = extractLines(data);

  // Извлекаем названия компаний из новой структуры
  const companyName = safe(
    data?.company?.name ??
      pick(
        data,
        ["company_name", "company", "seller", "our_company_name"],
        meta?.companyName
      )
  );
  const clientName = safe(
    data?.client?.name ??
      pick(
        data,
        ["client_name", "client", "buyer", "counterparty"],
        meta?.clientName
      )
  );

  // Извлекаем период из новой структуры
  const start =
    data?.period?.start ??
    pick(data, ["start", "date_from", "period_start"], meta?.start);
  const end =
    data?.period?.end ??
    pick(data, ["end", "date_to", "period_end"], meta?.end);
  const currency = safe(
    data?.period?.currency ?? pick(data, ["currency"], meta?.currency || "KGS")
  );
  const contract = safe(
    pick(data, ["contract", "contract_name", "agreement"], meta?.contract || "")
  );

  // Обороты по данным проводок (используем a_debit/a_credit для компании, b_debit/b_credit для клиента)
  const totalCompanyDebit = data?.totals?.a_debit
    ? getNumber(data.totals.a_debit)
    : lines.reduce(
        (sum, r) =>
          sum +
          getNumber(
            r?.a_debit ??
              r?.company_debit ??
              r?.debit_company ??
              r?.company_dt ??
              0
          ),
        0
      );
  const totalCompanyCredit = data?.totals?.a_credit
    ? getNumber(data.totals.a_credit)
    : lines.reduce(
        (sum, r) =>
          sum +
          getNumber(
            r?.a_credit ??
              r?.company_credit ??
              r?.credit_company ??
              r?.company_kt ??
              0
          ),
        0
      );
  const totalClientDebit = data?.totals?.b_debit
    ? getNumber(data.totals.b_debit)
    : lines.reduce(
        (sum, r) =>
          sum +
          getNumber(
            r?.b_debit ??
              r?.client_debit ??
              r?.debit_client ??
              r?.client_dt ??
              0
          ),
        0
      );
  const totalClientCredit = data?.totals?.b_credit
    ? getNumber(data.totals.b_credit)
    : lines.reduce(
        (sum, r) =>
          sum +
          getNumber(
            r?.b_credit ??
              r?.client_credit ??
              r?.credit_client ??
              r?.client_kt ??
              0
          ),
        0
      );

  // Сальдо начальное (если API отдаёт) — иначе 0
  const openingBalance = getNumber(
    data?.opening_balance ??
      pick(
        data,
        [
          "opening_company",
          "opening_company_balance",
          "opening_balance_company",
          "opening_balance",
        ],
        0
      )
  );
  // В новой структуре opening_balance - это сальдо для компании (a)
  const openingCompany = openingBalance;
  const openingClient = -openingBalance; // Для клиента противоположное значение

  // Сальдо конечное из API или вычисляем
  const closingBalanceFromAPI = data?.closing_balance
    ? getNumber(data.closing_balance)
    : null;
  const closingCompany =
    closingBalanceFromAPI ??
    openingCompany + totalCompanyDebit - totalCompanyCredit;
  const closingClient =
    closingBalanceFromAPI !== null
      ? -closingBalanceFromAPI
      : openingClient + totalClientDebit - totalClientCredit;

  // Определяем, кто кому должен (используем данные из debt или вычисляем)
  const debtInfo = data?.debt;
  const debtAmount = debtInfo?.amount
    ? getNumber(debtInfo.amount)
    : Math.abs(closingClient);
  const debtor =
    debtInfo?.debtor ?? (closingClient > 0 ? clientName : companyName);
  const creditor =
    debtInfo?.creditor ?? (closingClient > 0 ? companyName : clientName);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>АКТ СВЕРКИ ВЗАИМОРАСЧЕТОВ</Text>
          <Text style={s.subtitle}>
            за период с {fmtDate(start)} по {fmtDate(end)}
          </Text>
          {contract && (
            <Text style={s.contractInfo}>по договору: {contract}</Text>
          )}
          <Text style={s.subtitle}>Валюта: {currency}</Text>
        </View>

        <View style={s.table}>
          {/* Заголовок таблицы - первая строка с названиями компаний */}
          <View style={[s.row, s.head]}>
            <View style={[s.cell, s.cNum]}>
              <Text style={s.center}>№</Text>
            </View>
            <View style={[s.cell, s.cContent]}>
              <Text style={s.center}>Содержание записи</Text>
            </View>
            <View style={[s.cell, { width: "17%", borderRightWidth: 0 }]}>
              <Text style={s.center}>{companyName}</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text />
            </View>
            <View style={[s.cell, { width: "17%", borderRightWidth: 0 }]}>
              <Text style={s.center}>{clientName}</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text />
            </View>
          </View>

          {/* Подзаголовок с Дт и Кт */}
          <View style={[s.row, s.head]}>
            <View style={[s.cell, s.cNum]}>
              <Text />
            </View>
            <View style={[s.cell, s.cContent]}>
              <Text />
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Дт</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Кт</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.center}>Дт</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text style={s.center}>Кт</Text>
            </View>
          </View>

          {/* Сальдо начальное */}
          <View style={[s.row, s.sectionRow]}>
            <View style={[s.cell, s.cNum]}>
              <Text />
            </View>
            <View style={[s.cell, s.cContent]}>
              <Text>Сальдо начальное</Text>
            </View>
            {renderSaldoCells(openingCompany, {
              TextComp: Text,
              styles: s,
              showZero: true,
            })}
            {renderSaldoCells(openingClient, {
              TextComp: Text,
              styles: s,
              showZero: true,
              isLast: true,
            })}
          </View>

          {/* Операции */}
          {lines.map((r, idx) => {
            // Используем новую структуру: a_debit/a_credit для компании, b_debit/b_credit для клиента
            const companyDebit = getNumber(
              r?.a_debit ??
                r?.company_debit ??
                r?.debit_company ??
                r?.company_dt ??
                0
            );
            const companyCredit = getNumber(
              r?.a_credit ??
                r?.company_credit ??
                r?.credit_company ??
                r?.company_kt ??
                0
            );
            const clientDebit = getNumber(
              r?.b_debit ??
                r?.client_debit ??
                r?.debit_client ??
                r?.client_dt ??
                0
            );
            const clientCredit = getNumber(
              r?.b_credit ??
                r?.client_credit ??
                r?.credit_client ??
                r?.client_kt ??
                0
            );
            const description = formatDocDescription(r);

            return (
              <View key={idx} style={s.row}>
                <View style={[s.cell, s.cNum]}>
                  <Text style={s.center}>{idx + 1}</Text>
                </View>
                <View style={[s.cell, s.cContent]}>
                  <Text>{description}</Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>
                    {companyDebit ? n2(companyDebit) : ""}
                  </Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>
                    {companyCredit ? n2(companyCredit) : ""}
                  </Text>
                </View>
                <View style={[s.cell, s.cMoney]}>
                  <Text style={s.right}>
                    {clientDebit ? n2(clientDebit) : ""}
                  </Text>
                </View>
                <View style={[s.cell, s.cMoney, s.cellLast]}>
                  <Text style={s.right}>
                    {clientCredit ? n2(clientCredit) : ""}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Итого обороты */}
          <View style={[s.row, s.sectionRow]}>
            <View style={[s.cell, s.cNum]}>
              <Text />
            </View>
            <View style={[s.cell, s.cContent]}>
              <Text>Итого обороты:</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalCompanyDebit)}</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalCompanyCredit)}</Text>
            </View>
            <View style={[s.cell, s.cMoney]}>
              <Text style={s.right}>{n2(totalClientDebit)}</Text>
            </View>
            <View style={[s.cell, s.cMoney, s.cellLast]}>
              <Text style={s.right}>{n2(totalClientCredit)}</Text>
            </View>
          </View>

          {/* Сальдо конечное */}
          <View style={[s.row, s.sectionRow, s.rowLast]}>
            <View style={[s.cell, s.cNum]}>
              <Text />
            </View>
            <View style={[s.cell, s.cContent]}>
              <Text>Сальдо конечное:</Text>
            </View>
            {renderSaldoCells(closingCompany, { TextComp: Text, styles: s })}
            {renderSaldoCells(closingClient, {
              TextComp: Text,
              styles: s,
              isLast: true,
            })}
          </View>
        </View>

        {/* Текст о задолженности */}
        {debtAmount > 0 && (
          <View style={s.summary}>
            <Text style={{ fontWeight: "bold" }}>
              Задолженность {debtor} перед {creditor} на{" "}
              {fmtDate(
                data?.as_of_date ??
                  data?.debt?.as_of_date ??
                  getNextDay(end) ??
                  end
              )}{" "}
              составляет {n2(debtAmount)} {currency}
            </Text>
            <Text style={{ marginTop: 4 }}>({numberToWords(debtAmount)})</Text>
          </View>
        )}

        {/* Подписи */}
        <View style={s.signatures}>
          <View style={s.signCol}>
            <Text>{companyName}</Text>
            <Text style={{ marginTop: 8 }}>Главный бухгалтер:</Text>
            <View style={s.signLine} />
          </View>
          <View style={s.signCol}>
            <Text>{clientName}</Text>
            <Text style={{ marginTop: 8 }}>Главный бухгалтер:</Text>
            <View style={s.signLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
