import * as XLSX from "xlsx";
import { amountToWordsKgs } from "./amountToWordsKgs";
import {
  buildInvoiceItemsFromData,
  fmtTitleDateTime,
  getDocumentTitle,
  needsPriceColumns,
  n2,
  fmtQty,
  resolveDocumentDiscount,
  resolvePartiesForDocType,
  safe,
  usesPartyBlocks,
} from "./invoicePdfDocumentUtils";

const COLS_PRICE = 7;
const COLS_SIMPLE = 5;

function padRow(cells, colCount) {
  const row = [...cells];
  while (row.length < colCount) row.push("");
  return row;
}

function mergeRow(merges, rowIndex, colStart, colEnd) {
  if (colEnd <= colStart) return;
  merges.push({
    s: { r: rowIndex, c: colStart },
    e: { r: rowIndex, c: colEnd },
  });
}

function pushPartyBlock(aoa, merges, colCount, label, party) {
  if (!party?.name || party.name === "—") return;

  const colLast = colCount - 1;
  const labelRow = aoa.length;
  aoa.push(padRow([label, party.name], colCount));
  mergeRow(merges, labelRow, 1, colLast);

  if (party.addressLine) {
    const addrRow = aoa.length;
    aoa.push(padRow(["", party.addressLine], colCount));
    mergeRow(merges, addrRow, 1, colLast);
  }
  if (party.phoneLine) {
    const phoneRow = aoa.length;
    aoa.push(padRow(["", party.phoneLine], colCount));
    mergeRow(merges, phoneRow, 1, colLast);
  }
}

function pushMetaLine(aoa, merges, colCount, label, value) {
  if (!value || value === "—") return;
  const colLast = colCount - 1;
  const row = aoa.length;
  aoa.push(padRow([label, value], colCount));
  mergeRow(merges, row, 1, colLast);
}

/**
 * Excel-накладная в том же макете, что PDF (InvoicePdfDocument).
 * @param {object} data — тот же объект, что передаётся в InvoicePdfDocument
 * @returns {Blob}
 */
export function exportInvoiceToExcel(data) {
  const doc = data?.document || {};
  const docType = data?.doc_type || doc.doc_type || doc.type || "SALE";
  const seller = data?.seller || {};
  const buyer = data?.buyer || null;

  const isInventory = docType === "INVENTORY";
  const isTransfer = docType === "TRANSFER";
  const showPriceColumns = needsPriceColumns(docType);
  const colCount = showPriceColumns ? COLS_PRICE : COLS_SIMPLE;
  const colLast = colCount - 1;
  const footerLabelCol = showPriceColumns ? 5 : colCount - 2;

  const items = buildInvoiceItemsFromData(data);
  const totals = data?.totals || {};
  const itemsSum = items.reduce((sum, it) => sum + Number(it.total || 0), 0);
  const grandTotal = Number(totals.total || 0) > 0 ? Number(totals.total) : itemsSum;
  const subtotal = Number(totals.subtotal || 0) || itemsSum;

  const { documentDiscountAmount, showDocumentDiscountLine } =
    resolveDocumentDiscount(doc, data, subtotal, data?.items);

  const invoiceNumber = doc.number || "";
  const invoiceDate = doc.datetime || doc.date || doc.created_at || "";
  const docComment = String(doc.comment ?? data?.comment ?? "").trim();

  const titleLine = `${getDocumentTitle(docType)} № ${invoiceNumber || "—"} от ${fmtTitleDateTime(invoiceDate)}`;

  const aoa = [];
  const merges = [];

  const titleRow = aoa.length;
  aoa.push(padRow([titleLine], colCount));
  mergeRow(merges, titleRow, 0, colLast);

  aoa.push(padRow([], colCount));

  if (isTransfer) {
    if (seller?.name) {
      pushPartyBlock(aoa, merges, colCount, "Организация:", {
        name: safe(seller.name),
        addressLine: seller.address ? `Адрес: ${safe(seller.address)}` : "",
        phoneLine: seller.phone ? `Тел: ${safe(seller.phone)}` : "",
      });
    }
    pushMetaLine(aoa, merges, colCount, "Со склада:", safe(data?.warehouse));
    pushMetaLine(aoa, merges, colCount, "На склад:", safe(data?.warehouse_to));
  } else if (isInventory) {
    if (seller?.name) {
      pushPartyBlock(aoa, merges, colCount, "Организация:", {
        name: safe(seller.name),
        addressLine: seller.address ? `Адрес: ${safe(seller.address)}` : "",
        phoneLine: "",
      });
    }
  } else if (usesPartyBlocks(docType)) {
    const { supplier, buyer: buyerParty } = resolvePartiesForDocType(
      docType,
      seller,
      buyer,
    );
    if (["RECEIPT", "WRITE_OFF"].includes(docType)) {
      pushPartyBlock(aoa, merges, colCount, "Организация:", supplier);
    } else {
      pushPartyBlock(aoa, merges, colCount, "Поставщик:", supplier);
      pushPartyBlock(aoa, merges, colCount, "Покупатель:", buyerParty);
    }
    if (!isTransfer && !isInventory && data?.warehouse) {
      pushMetaLine(aoa, merges, colCount, "Склад:", safe(data.warehouse));
    }
  }

  if (docComment) {
    pushMetaLine(aoa, merges, colCount, "Комментарий:", safe(docComment));
  }

  aoa.push(padRow([], colCount));

  if (showPriceColumns) {
    aoa.push(
      padRow(
        ["п/п", "Артикул", "Название", "Кол-во", "Ед.", "Цена", "Сумма"],
        colCount,
      ),
    );
    items.forEach((it, idx) => {
      aoa.push(
        padRow(
          [
            idx + 1,
            it.article || "",
            it.name || "",
            fmtQty(it.qty),
            String(it.unit || "шт").toLowerCase(),
            n2(it.unit_price),
            n2(it.total),
          ],
          colCount,
        ),
      );
    });

    const footerEmpty = Array(footerLabelCol).fill("");
    aoa.push(padRow([...footerEmpty, "Итого:", n2(grandTotal)], colCount));
  } else {
    aoa.push(
      padRow(["п/п", "Артикул", "Название", "Кол-во", "Ед."], colCount),
    );
    items.forEach((it, idx) => {
      aoa.push(
        padRow(
          [
            idx + 1,
            it.article || "",
            it.name || "",
            fmtQty(it.qty),
            String(it.unit || "шт").toLowerCase(),
          ],
          colCount,
        ),
      );
    });
  }

  aoa.push(padRow([], colCount));

  if (showPriceColumns) {
    if (
      showDocumentDiscountLine &&
      (documentDiscountAmount > 0 || Number(doc.discount_percent || 0) > 0)
    ) {
      const discRow = aoa.length;
      const pct = Number(doc.discount_percent || 0);
      const discText = `Скидка по документу: ${n2(documentDiscountAmount)}${pct > 0 ? ` (${n2(pct)}%)` : ""}`;
      aoa.push(padRow([discText], colCount));
      mergeRow(merges, discRow, 0, colLast);
    }

    const summaryRow = aoa.length;
    aoa.push(
      padRow(
        [
          `Всего наименований ${items.length}, на сумму ${n2(grandTotal)} сом`,
        ],
        colCount,
      ),
    );
    mergeRow(merges, summaryRow, 0, colLast);

    const wordsRow = aoa.length;
    aoa.push(padRow([amountToWordsKgs(grandTotal)], colCount));
    mergeRow(merges, wordsRow, 0, colLast);
  }

  if (isInventory) {
    const invRow = aoa.length;
    aoa.push(padRow([`Всего позиций: ${items.length}`], colCount));
    mergeRow(merges, invRow, 0, colLast);
    const signRow = aoa.length;
    aoa.push(padRow(["Заполнил: _________________"], colCount));
    mergeRow(merges, signRow, 0, colLast);
  } else if (!isTransfer) {
    aoa.push(padRow([], colCount));
    const signRow = aoa.length;
    aoa.push(
      padRow(
        ["Отпустил: ___________", "", "", "Получил: ___________"],
        colCount,
      ),
    );
    mergeRow(merges, signRow, 0, Math.min(1, colLast));
    mergeRow(merges, signRow, 3, colLast);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;

  if (showPriceColumns) {
    ws["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 42 },
      { wch: 10 },
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
    ];
  } else {
    ws["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 48 },
      { wch: 10 },
      { wch: 8 },
    ];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Накладная");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
