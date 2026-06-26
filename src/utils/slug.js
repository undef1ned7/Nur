// Утилиты для работы со slug компании.
// Формат: только латинские строчные буквы, цифры и одиночные дефисы (a-z, 0-9, -),
// без ведущего/замыкающего дефиса, без двойных дефисов, длина 3..50.
// Используется во вкладке «Онлайн» настроек (/crm/set) и для превью публичных ссылок.

export const SLUG_MIN = 3;
export const SLUG_MAX = 50;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Транслитерация кириллицы → латиница, чтобы пользователь мог вводить русские названия.
const TRANSLIT_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const transliterate = (str) =>
  str.replace(/[а-яё]/g, (ch) => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch));

/**
 * Приводит произвольный ввод к корректному slug:
 * lowercase, транслит кириллицы, пробелы→дефис, удаление недопустимых символов,
 * схлопывание повторяющихся дефисов. Ведущий/замыкающий дефис НЕ обрезается жёстко,
 * чтобы не мешать набирать "foo-" → "foo-bar" по ходу ввода; обрезаем только дубли.
 */
export const normalizeSlug = (raw) => {
  if (!raw) return "";
  let s = String(raw).toLowerCase();
  s = transliterate(s);
  s = s.replace(/[\s_.]+/g, "-"); // пробелы, подчёркивания, точки → дефис
  s = s.replace(/[^a-z0-9-]/g, ""); // выкидываем всё остальное (спецсимволы, остатки кириллицы)
  s = s.replace(/-{2,}/g, "-"); // двойные дефисы → один
  return s.slice(0, SLUG_MAX);
};

/** Финальная нормализация перед сохранением: дополнительно обрезает крайние дефисы. */
export const finalizeSlug = (raw) => normalizeSlug(raw).replace(/^-+|-+$/g, "");

/**
 * Валидирует slug. Возвращает { valid, error }.
 * error — готовое к показу сообщение на русском.
 */
export const validateSlug = (slug) => {
  const value = String(slug || "");
  if (!value) return { valid: false, error: "Введите slug" };
  if (/[^a-z0-9-]/.test(value))
    return { valid: false, error: "Недопустимые символы" };
  if (value.startsWith("-") || value.endsWith("-"))
    return { valid: false, error: "Дефис не может быть в начале или конце" };
  if (value.includes("--"))
    return { valid: false, error: "Двойной дефис недопустим" };
  if (value.length < SLUG_MIN)
    return { valid: false, error: "Слишком короткий" };
  if (value.length > SLUG_MAX) return { valid: false, error: "Слишком длинный" };
  if (!SLUG_PATTERN.test(value))
    return { valid: false, error: "Недопустимый формат" };
  return { valid: true, error: "" };
};
