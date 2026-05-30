/** Подпись системной роли (owner / admin). */
export const ruLabelSys = (code) => {
  const c = String(code || "").trim();
  if (!c) return "";
  if (c === "owner") return "Владелец";
  if (c === "admin") return "Администратор";
  return c;
};

/**
 * Подпись роли сотрудника для списка и карточки.
 * Приоритет: role → custom_role (только если id задан) → role_display с API → «Без роли».
 */
export function resolveEmployeeRoleLabel(employee, roleById) {
  if (!employee) return "—";

  const sysRole = employee.role;
  if (sysRole != null && String(sysRole).trim() !== "") {
    return ruLabelSys(sysRole);
  }

  const customRoleId = employee.custom_role;
  if (customRoleId != null && String(customRoleId).trim() !== "") {
    const customName = roleById?.get?.(customRoleId)?.name;
    if (customName && String(customName).trim()) {
      return String(customName).trim();
    }
  }

  const display = String(employee.role_display || "").trim();
  if (display) return display;

  return "Без роли";
}
