import { useEffect, useState } from "react";

const readFromSessionStorage = (key, initialValue) => {
  if (!key || typeof sessionStorage === "undefined") return initialValue;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return initialValue;
    return JSON.parse(raw);
  } catch {
    return initialValue;
  }
};

const writeToSessionStorage = (key, value) => {
  if (!key || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
};

/**
 * Замена useState, сохраняющая значение в sessionStorage по ключу —
 * переживает переход на другую страницу и возврат назад в рамках вкладки браузера.
 * @param {string} key — уникальный ключ (например, "warehouse:stocks:filters")
 * @param {*} initialValue
 */
export const usePersistedState = (key, initialValue) => {
  const [state, setState] = useState(() =>
    readFromSessionStorage(key, initialValue),
  );

  useEffect(() => {
    writeToSessionStorage(key, state);
  }, [key, state]);

  return [state, setState];
};

export default usePersistedState;
