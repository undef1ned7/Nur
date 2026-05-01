/** Права из MENU_CONFIG.additional / доп. услуг — новому сотруднику не выдаём по умолчанию. */
export const NEW_EMPLOYEE_DENIED_ADDITIONAL_SERVICE_KEYS = [
  "can_view_whatsapp",
  "can_view_instagram",
  "can_view_telegram",
  "can_view_documents",
  "can_view_market_label",
  "can_view_market_scales",
];

const BARBER_LIKE_SECTORS = new Set(["Барбершоп", "Услуги", "Стоматология"]);

/**
 * Дефолтные флаги доступа при создании сотрудника: настройки — да, доп. услуги — нет.
 * @param {string | undefined} sectorName — company.sector.name
 */
export function getNewEmployeeAccessDefaults(sectorName) {
  const out = { can_view_settings: true };
  for (const key of NEW_EMPLOYEE_DENIED_ADDITIONAL_SERVICE_KEYS) {
    out[key] = false;
  }
  if (BARBER_LIKE_SECTORS.has(String(sectorName || "").trim())) {
    out.can_view_barber_services = false;
  }
  return out;
}
