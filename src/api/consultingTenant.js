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

/**
 * Поиск уже существующего NurCRM-аккаунта по email клиента — до провижна,
 * чтобы не пытаться завести дубль и не отправлять в platform-admin вручную.
 * GET /consalting/tenant-accounts/lookup/?email=…
 * @param {string} email
 * @returns {Promise<{ match: null | {
 *   nur_company_id: number, company_name: string, owner_email: string,
 *   sector?: { id: number, name: string }, end_date?: string|null,
 * } }>}
 * Контракт: docs/consulting/backend-money-tenant/23-tenant-account-auto-link.md
 */
export const lookupTenantAccountByEmail = (email, config) =>
  cGet(
    "Lookup Tenant Account Error",
    `${BASE}/tenant-accounts/lookup/`,
    { email },
    config,
  );

/**
 * Привязка клиента к УЖЕ существующему NurCRM-аккаунту (вместо создания
 * нового через provision-tenant). Пароль/учётка не создаются заново —
 * владелец аккаунта продолжает логиниться, чем логинился.
 * POST /consalting/clients/{id}/link-tenant/  { nur_company_id }
 */
export const linkClientTenant = (clientId, nurCompanyId) =>
  cPost(
    "Link Client Tenant Error",
    `${BASE}/clients/${clientId}/link-tenant/`,
    { nur_company_id: nurCompanyId },
  );
