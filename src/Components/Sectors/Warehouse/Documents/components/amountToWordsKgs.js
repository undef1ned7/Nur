/**
 * Сумма прописью для KGS: целая часть (сом, включая миллионы) + тыйын 0–99 словами.
 */

const ONES_M = [
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
const ONES_F = [
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
const TENS = [
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
const HUNDREDS = [
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
const TEENS = [
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

function pluralRu(n, one, few, many) {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return many;
  if (n10 === 1) return one;
  if (n10 >= 2 && n10 <= 4) return few;
  return many;
}

function under100(n, feminine) {
  const ones = feminine ? ONES_F : ONES_M;
  if (n >= 20) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    return o ? `${t} ${ones[o]}` : t;
  }
  if (n >= 10) return TEENS[n - 10];
  return ones[n] || "";
}

/** 1–999, feminine — для тысяч (одна тысяча / две тысячи) */
function tripleToWords(n, feminine) {
  if (n <= 0 || n > 999) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)]);
    const o = rest % 10;
    if (o) parts.push((feminine ? ONES_F : ONES_M)[o]);
  } else if (rest >= 10) {
    parts.push(TEENS[rest - 10]);
  } else if (rest > 0) {
    parts.push((feminine ? ONES_F : ONES_M)[rest]);
  }
  return parts.join(" ").trim();
}

function somEnding(n) {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return "сом";
  if (last === 1) return "сом";
  if (last >= 2 && last <= 4) return "сома";
  return "сом";
}

/** Целое 0 … 999 999 999 — без валюты */
function integerToWords(n) {
  if (n === 0) return "ноль";
  if (n < 0 || n > 999_999_999) return String(n);

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rem = n % 1000;

  const chunks = [];

  if (billions > 0) {
    chunks.push(
      `${tripleToWords(billions, false)} ${pluralRu(billions, "миллиард", "миллиарда", "миллиардов")}`,
    );
  }
  if (millions > 0) {
    chunks.push(
      `${tripleToWords(millions, false)} ${pluralRu(millions, "миллион", "миллиона", "миллионов")}`,
    );
  }
  if (thousands > 0) {
    chunks.push(
      `${tripleToWords(thousands, true)} ${pluralRu(thousands, "тысяча", "тысячи", "тысяч")}`,
    );
  }
  if (rem > 0) {
    const tail = tripleToWords(rem, false);
    if (tail) chunks.push(tail);
  }

  return chunks.filter(Boolean).join(" ").trim();
}

/**
 * @param {number|string} amount — сумма в сомах (дробная часть — тыйын)
 * @returns {string}
 */
export function amountToWordsKgs(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";

  const totalTyiyn = Math.round(num * 100);
  const som = Math.floor(totalTyiyn / 100);
  const tyiyn = totalTyiyn % 100;

  const somPart = `${integerToWords(som)} ${somEnding(som)}`.trim();
  const tyiynPart = tyiyn === 0 ? "ноль" : under100(tyiyn, false);

  return `${somPart} ${tyiynPart} тыйын`.trim();
}
