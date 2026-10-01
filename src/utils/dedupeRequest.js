// Одинаковые запросы, пока первый ещё в полёте, получают тот же промис —
// по сети уходит один запрос. Нужно для загрузок, которые дёргают сразу несколько
// компонентов при старте (AuthGuard, Sidebar, Header), и для двойного прогона
// эффектов под React.StrictMode. После завершения ключ освобождается, поэтому
// последующие явные рефетчи (например, после сохранения настроек) работают как раньше.
const inFlight = new Map();

export const dedupeRequest = (key, request) => {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve()
    .then(request)
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
};
