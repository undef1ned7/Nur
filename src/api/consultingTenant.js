/**
 * Консалтинг: CRM-аккаунт клиента (tenant lifecycle).
 *
 * Контракт: docs/consulting/backend-money-tenant/scenario-tenant.md,
 * docs/consulting/backend-money-tenant/04-tenant-lifecycle.md
 */
import { BASE, cGet, cPost } from "./consultingHttp";

/**
 * GET /consalting/clients/{id}/tenant-account/
 * @returns {Promise<object>}
 */
export const getClientTenantAccount = (clientId, config) =>
  cGet(
    "Get Client Tenant Account Error",
    `${BASE}/clients/${clientId}/tenant-account/`,
    {},
    config,
  );

/**
 * POST /consalting/clients/{id}/provision-tenant/
 * Ручной retry создания аккаунта (owner/admin).
 *
 * @param {string} clientId
 * @param {{ crm_sector?: number }} [payload] - `crm_sector` — id сектора из
 *   `/users/industries/` (sectors[].id). Необязательно; при отсутствии бэк
 *   берёт сектор тарифа, иначе дефолт «Маркет». См.
 *   docs/consulting/backend-money-tenant/11-provision-market-sector.md.
 */
export const provisionClientTenant = (clientId, payload = {}) =>
  cPost(
    "Provision Client Tenant Error",
    `${BASE}/clients/${clientId}/provision-tenant/`,
    payload,
  );
