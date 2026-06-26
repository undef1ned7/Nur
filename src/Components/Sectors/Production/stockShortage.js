import api from "../../../api";

/**
 * Задача №6 — Уведомление о нехватке готовой продукции.
 *
 * Вызывается, когда выдача/передача заблокирована из-за нехватки остатка
 * (запрошено больше, чем есть на складе). Создаёт запись в журнале событий
 * и уведомляет ответственных сотрудников на бэкенде — они видят уведомление
 * в колокольчике (GET /main/notifications/).
 *
 * Best-effort: НЕ блокирует UI и НЕ бросает исключений — основная нехватка уже
 * заблокирована и показана пользователю понятной ошибкой. Если эндпоинта ещё
 * нет — тихо логируем в консоль (не как единственный канал ошибки, а как
 * запасной для разработчика).
 *
 * Эндпоинт: POST /main/stock-shortages/ (см. 06-stock-shortage-notifications.md)
 */
export const reportStockShortage = async ({
  product,
  productName,
  requested,
  available,
  agent = null,
  agentName = "",
  source = "transfer",
} = {}) => {
  try {
    await api.post("/main/stock-shortages/", {
      product: product ?? null,
      product_name: productName ?? "",
      requested_qty: Number(requested) || 0,
      available_qty: Number(available) || 0,
      agent,
      agent_name: agentName,
      source, // transfer | request | sale — откуда пришёл запрос
    });
  } catch (e) {
    // Не мешаем основному потоку: нехватка уже заблокирована в UI.
    console.warn("reportStockShortage failed", e);
  }
};
