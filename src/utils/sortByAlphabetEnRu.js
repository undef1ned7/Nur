const LATIN_FIRST_RE = /^[a-zA-Z]/;
const CYRILLIC_FIRST_RE = /^[а-яёА-ЯЁ]/;

export const getAlphabetEnRuGroup = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return 2;
  if (LATIN_FIRST_RE.test(text)) return 0;
  if (CYRILLIC_FIRST_RE.test(text)) return 1;
  return 2;
};

export const compareByAlphabetEnRu = (a, b, getLabel = (item) => item) => {
  const left = String(getLabel(a) ?? "").trim();
  const right = String(getLabel(b) ?? "").trim();
  const groupDiff = getAlphabetEnRuGroup(left) - getAlphabetEnRuGroup(right);
  if (groupDiff !== 0) return groupDiff;

  const locale = getAlphabetEnRuGroup(left) === 0 ? "en" : "ru";
  return left.localeCompare(right, locale, { sensitivity: "base" });
};

export const sortByAlphabetEnRu = (list, getLabel) =>
  [...(Array.isArray(list) ? list : [])].sort((a, b) =>
    compareByAlphabetEnRu(a, b, getLabel),
  );
