/**
 * Консалтинг: Лиды из WhatsApp (входящие) и настройки их распределения.
 *
 * Лиды приходят автоматически по webhook от WhatsApp-провайдера (Wazzup/др.)
 * и распределяются между сотрудниками с выбранными ролями «поровну»
 * (round-robin) либо по наименьшей загрузке. Бэкенд ещё не реализован —
 * полная спецификация: docs/consulting/leads-whatsapp.md
 */
import api from ".";

const BASE = "/consalting";

const reject = (label) => (error) => {
  if (error.response) {
    console.error(`${label}:`, error.response.data);
    const data = error.response.data;
    const payload =
      data && typeof data === "object" ? { ...data } : { detail: data };
    payload.status = error.response.status;
    return Promise.reject(payload);
  }
  return Promise.reject(error);
};

// ==================== ВХОДЯЩИЕ ЛИДЫ ====================

/**
 * Список входящих лидов.
 * GET /consalting/inbound-leads/
 * @param {Object} params - status, owner, source, search, page, page_size
 * @returns {{results, count}}
 */
export const listInboundLeads = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/inbound-leads/`, { params });
    return data;
  } catch (error) {
    return reject("List Inbound Leads Error")(error);
  }
};

/**
 * Ручное создание лида (когда не из WhatsApp).
 * POST /consalting/inbound-leads/
 * @param {Object} payload - { full_name, phone, source, message, note }
 */
export const createInboundLead = async (payload) => {
  try {
    const { data } = await api.post(`${BASE}/inbound-leads/`, payload);
    return data;
  } catch (error) {
    return reject("Create Inbound Lead Error")(error);
  }
};

/**
 * Переназначить лид другому сотруднику вручную.
 * POST /consalting/inbound-leads/{id}/assign/
 * @param {string} id
 * @param {Object} payload - { owner: <user uuid> }
 */
export const assignInboundLead = async (id, payload) => {
  try {
    const { data } = await api.post(
      `${BASE}/inbound-leads/${id}/assign/`,
      payload,
    );
    return data;
  } catch (error) {
    return reject("Assign Inbound Lead Error")(error);
  }
};

/**
 * Обновить статус/поля лида.
 * PATCH /consalting/inbound-leads/{id}/
 */
export const updateInboundLead = async (id, payload) => {
  try {
    const { data } = await api.patch(`${BASE}/inbound-leads/${id}/`, payload);
    return data;
  } catch (error) {
    return reject("Update Inbound Lead Error")(error);
  }
};

// ==================== НАСТРОЙКИ РАСПРЕДЕЛЕНИЯ ====================

/**
 * Текущие настройки авто-распределения лидов компании.
 * GET /consalting/lead-distribution/
 * @returns {{ enabled, strategy, role_ids, recipients }}
 */
export const getLeadDistribution = async () => {
  try {
    const { data } = await api.get(`${BASE}/lead-distribution/`);
    return data;
  } catch (error) {
    return reject("Get Lead Distribution Error")(error);
  }
};

/**
 * Сохранить настройки распределения.
 * PUT /consalting/lead-distribution/
 * @param {Object} payload - { enabled: bool, strategy: "round_robin"|"least_loaded"|"manual", role_ids: string[] }
 */
export const updateLeadDistribution = async (payload) => {
  try {
    const { data } = await api.put(`${BASE}/lead-distribution/`, payload);
    return data;
  } catch (error) {
    return reject("Update Lead Distribution Error")(error);
  }
};
