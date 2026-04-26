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

const TENS = [
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

function pluralForm(n, one, few, many) {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 19) {
    return many;
  }
  if (n10 === 1) {
    return one;
  }
  if (n10 >= 2 && n10 <= 4) {
    return few;
  }
  return many;
}

/**
 * Число 1–999 прописью; female — формы «одна/две» для единиц и десятков-единиц.
 */
function triplet(n, female) {
  if (n === 0) {
    return "";
  }
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const ones = female ? ONES_F : ONES_M;
  const parts = [];
  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }
  if (t === 1) {
    parts.push(TEENS[u]);
  } else {
    if (t > 0) {
      parts.push(TENS[t]);
    }
    if (u > 0) {
      parts.push(ones[u]);
    }
  }
  return parts.join(" ");
}

function intToWordsNonNegative(n) {
  if (n === 0) {
    return "ноль";
  }
  const parts = [];
  let i = 0;
  let num = n;
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk !== 0) {
      if (i === 0) {
        parts.unshift(triplet(chunk, false));
      } else if (i === 1) {
        parts.unshift(
          `${triplet(chunk, true)} ${pluralForm(chunk, "тысяча", "тысячи", "тысяч")}`,
        );
      } else if (i === 2) {
        parts.unshift(
          `${triplet(chunk, false)} ${pluralForm(chunk, "миллион", "миллиона", "миллионов")}`,
        );
      } else {
        parts.unshift(
          `${triplet(chunk, false)} ${pluralForm(chunk, "миллиард", "миллиарда", "миллиардов")}`,
        );
      }
    }
    num = Math.floor(num / 1000);
    i += 1;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function capitalizeFirst(s) {
  if (!s) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Конвертирует число в строку прописью на русском (целая часть — сом прописью, тыйын — цифрами).
 * Пример: 1500.5 → "Одна тысяча пятьсот сом 50 тыйын"
 */
export function numberToWords(amount) {
  if (!Number.isFinite(amount)) {
    return "Ноль сом 00 тыйын";
  }

  const sign = amount < 0 ? "Минус " : "";
  const abs = Math.abs(amount);
  const rubles = Math.floor(abs + 1e-9);
  let kopecks = Math.round((abs - rubles) * 100);
  if (kopecks >= 100) {
    kopecks = 0;
  }

  const rubText = capitalizeFirst(intToWordsNonNegative(rubles));
  const tyiynDigits = String(kopecks).padStart(2, "0");

  return `${sign}${rubText} сом ${tyiynDigits} тыйын`;
}
