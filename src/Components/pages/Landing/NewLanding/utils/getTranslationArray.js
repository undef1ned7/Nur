export function getTranslationArray(t, key) {
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? value : [];
}
