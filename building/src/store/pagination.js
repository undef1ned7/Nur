// Универсальные утилиты для работы с пагинацией в redux-slices

// Применяет стандартный ответ с пагинацией к состоянию с ключами:
// list, count, next, previous
export const applyPagination = (state, payload, listKey = "list") => {
  if (!payload) {
    state[listKey] = [];
    state.count = 0;
    state.next = null;
    state.previous = null;
    return;
  }

  const results = Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload)
    ? payload
    : [];

  state[listKey] = results;
  state.count = typeof payload.count === "number" ? payload.count : results.length;
  state.next = payload.next ?? null;
  state.previous = payload.previous ?? null;
};


