import api from "./index";
import {
  EMPTY_CLIENT_KPIS,
  mapClientKpis,
} from "../tools/clientKpis";

export const CLIENT_KPIS_URL = (clientId) => `/main/clients/${clientId}/kpis/`;

/**
 * GET /main/clients/{id}/kpis/
 * При 404/405/сети вызывающий код должен перейти на aggregateClientKpisFromDeals.
 */
export async function fetchClientKpis(clientId) {
  const { data } = await api.get(CLIENT_KPIS_URL(clientId));
  return mapClientKpis(data) ?? EMPTY_CLIENT_KPIS;
}
