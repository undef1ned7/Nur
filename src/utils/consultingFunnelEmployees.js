import api from "../api";
import { employeeDisplayName } from "./consultingFunnelLeadUtils";

function normalizeEmployeeRow(e = {}) {
  return {
    id: e.id,
    name: employeeDisplayName(e),
    custom_role: e.custom_role ?? e.custom_role_id ?? null,
    custom_role_name: e.custom_role_name || e.role_name || null,
  };
}

/**
 * Сотрудники воронки (для привязки к лиду).
 * Fallback: все сотрудники компании при 404/501 на funnel endpoint.
 */
export async function fetchFunnelEmployees(funnelId) {
  try {
    const { data } = await api.get(`/consalting/funnels/${funnelId}/employees/`);
    const rows = Array.isArray(data)
      ? data
      : data.results || data.employees || [];
    return rows.map(normalizeEmployeeRow);
  } catch (e) {
    const status = e?.response?.status;
    if (status !== 404 && status !== 501) throw e;
  }

  const { data } = await api.get("/users/employees/");
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map(normalizeEmployeeRow);
}
