/**
 * Консалтинг → Лиды → кнопка «Финансы».
 *
 * Скачивает пустой .xlsx-шаблон рекламного отчёта: одна строка-шапка
 * (Дата · Показы · Лиды · Сумма затрат · Стоимость лида) на зелёном фоне
 * и пустые строки под заполнение.
 *
 * `xlsx-js-style` (форк SheetJS со стилями) грузится динамически — только
 * при клике по кнопке, чтобы не тянуть его в основной бандл.
 */

const COLUMNS = ["Дата", "Показы", "Лиды", "Сумма затрат", "Стоимость лида"];
const EMPTY_ROWS = 60;

// ARGB: тёмно-зелёный фон шапки + белый жирный текст (как в примере).
const HEADER_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "FF217346" } },
  font: { bold: true, color: { rgb: "FFFFFFFF" }, sz: 11 },
  alignment: { horizontal: "center", vertical: "center" },
  border: {
    top: { style: "thin", color: { rgb: "FF1E5E3A" } },
    bottom: { style: "thin", color: { rgb: "FF1E5E3A" } },
    left: { style: "thin", color: { rgb: "FF1E5E3A" } },
    right: { style: "thin", color: { rgb: "FF1E5E3A" } },
  },
};

const COL_WIDTHS = [14, 12, 10, 14, 16];

/** Имя файла вида «Финансы_2026-09-10.xlsx». */
function fileName() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
  return `Финансы_${iso}.xlsx`;
}

/** Собрать шаблон и инициировать скачивание. */
export async function downloadFinanceTemplate() {
  const XLSX = (await import("xlsx-js-style")).default;

  const aoa = [
    COLUMNS.slice(),
    ...Array.from({ length: EMPTY_ROWS }, () => COLUMNS.map(() => "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  ws["!rows"] = [{ hpt: 22 }];

  COLUMNS.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = HEADER_STYLE;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Финансы");
  XLSX.writeFile(wb, fileName(), { bookType: "xlsx" });
}
