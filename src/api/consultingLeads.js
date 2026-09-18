/**
 * Консалтинг: входящие лиды (Wazzup WhatsApp/Instagram/Telegram),
 * работа с очередью (отложить / вернуть / купил / отказ), счётчики по статусам,
 * аналитика по лидам и настройки авто-распределения.
 *
 * Контракт: docs/consulting/backend/01-leads.md,
 * docs/consulting/leads-whatsapp.md, docs/consulting/wazzup-integration.md.
 * Аккаунты Wazzup / send-message — src/api/consultingWazzup.js.
 *
 * Пока эндпоинт отвечает 404/501, UI показывает понятную заглушку.
 */
import { BASE, cGet, cPatch, cPost, cPut } from "./consultingHttp";
import { isMainFunnel } from "../utils/consultingFunnelDefaults";

const URL_LEADS = `${BASE}/inbound-leads/`;

/* ==================== СПРАВОЧНИКИ ==================== */

/** Статусы лида. `deferred` — новый (ТЗ №1, «отложенные»). */
export const LEAD_STATUS = {
  NEW: "new",
  ASSIGNED: "assigned",
  IN_WORK: "in_work",
  DEFERRED: "deferred",
  CONVERTED: "converted",
  REJECTED: "rejected",
};

export const LEAD_STATUS_LABELS = {
  [LEAD_STATUS.NEW]: "Новый",
  [LEAD_STATUS.ASSIGNED]: "Назначен",
  [LEAD_STATUS.IN_WORK]: "В работе",
  [LEAD_STATUS.DEFERRED]: "Отложен",
  [LEAD_STATUS.CONVERTED]: "Купил",
  [LEAD_STATUS.REJECTED]: "Отказ",
};

/**
 * Табы очереди. «Новые» объединяют `new` и `assigned`: назначенный, но ещё не
 * взятый в работу лид для менеджера — та же самая задача «разобрать».
 */
export const LEAD_TABS = [
  { value: "all", label: "Все", statuses: [] },
  {
    value: "new",
    label: "Новые",
    statuses: [LEAD_STATUS.NEW, LEAD_STATUS.ASSIGNED],
  },
  { value: "in_work", label: "В работе", statuses: [LEAD_STATUS.IN_WORK] },
  { value: "deferred", label: "Отложенные", statuses: [LEAD_STATUS.DEFERRED] },
  { value: "converted", label: "Купили", statuses: [LEAD_STATUS.CONVERTED] },
  { value: "rejected", label: "Отказ", statuses: [LEAD_STATUS.REJECTED] },
];

export const leadTabByValue = (value) =>
  LEAD_TABS.find((t) => t.value === value) || LEAD_TABS[0];

/** Причины откладывания — список фиксированный, «other» требует комментария. */
export const DEFER_REASONS = [
  { value: "no_answer_call", label: "Не взял трубку" },
  { value: "no_answer_chat", label: "Не ответил в переписке" },
  { value: "call_later", label: "Просил перезвонить позже" },
  { value: "thinking", label: "Думает / советуется" },
  { value: "no_money", label: "Нет денег сейчас" },
  { value: "other", label: "Другое" },
];

/** Причины отказа — питают блок «причины потерь» в аналитике. */
export const REJECT_REASONS = [
  { value: "expensive", label: "Дорого" },
  { value: "competitor", label: "Ушёл к конкуренту" },
  { value: "no_need", label: "Не актуально" },
  { value: "no_contact", label: "Не выходит на связь" },
  { value: "spam", label: "Спам / нецелевой" },
  { value: "other", label: "Другое" },
];

/** Быстрые пресеты «напомнить через…» для окна откладывания. */
export const DEFER_PRESETS = [
  { value: "2h", label: "Через 2 часа", ms: 2 * 60 * 60 * 1000 },
  { value: "tomorrow", label: "Завтра", ms: 24 * 60 * 60 * 1000 },
  { value: "3d", label: "Через 3 дня", ms: 3 * 24 * 60 * 60 * 1000 },
  { value: "week", label: "Через неделю", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "Через месяц", ms: 30 * 24 * 60 * 60 * 1000 },
];

/* ==================== ВХОДЯЩИЕ ЛИДЫ ==================== */

/**
 * Список входящих лидов.
 * GET /consalting/inbound-leads/
 * @param {Object} params - status (можно список через запятую), owner, source,
 *   search, date_from, date_to, overdue, page, page_size, ordering
 * @param {Object} config - { signal }
 * @returns {{results: Array, count: number}}
 */
export const listInboundLeads = (params = {}, config) =>
  cGet("List Inbound Leads Error", URL_LEADS, params, config);

/**
 * Счётчики по табам очереди с учётом текущих фильтров.
 * GET /consalting/inbound-leads/counters/
 * @returns {{ all, new, in_work, deferred, converted, rejected, overdue }}
 */
export const getLeadCounters = (params = {}, config) =>
  cGet("Lead Counters Error", `${URL_LEADS}counters/`, params, config);

/**
 * Аналитика по лидам за период.
 * GET /consalting/inbound-leads/analytics/
 * @param {Object} params - date_from, date_to, owner, source
 * @returns {{ totals, by_source, by_user, by_day, defer_reasons, reject_reasons }}
 */
export const getLeadsAnalytics = (params = {}, config) =>
  cGet("Leads Analytics Error", `${URL_LEADS}analytics/`, params, config);

/** Ручное создание лида (когда обращение пришло не из мессенджера). */
export const createInboundLead = (payload) =>
  cPost("Create Inbound Lead Error", URL_LEADS, payload);

/**
 * Фолбэк: гарантировать карточку в канбане воронки для inbound-лида.
 *
 * По спеке (docs/consulting/backend-main-funnel-inbound.md §2.3) параллельный
 * `Lead` на главной воронке должен создавать бэкенд. Пока ручной `POST
 * /inbound-leads/` этого не делает, создаём карточку с фронта: находим главную
 * воронку (`is_main`), её первую стадию (`intake`), создаём `Lead` и линкуем
 * обратно через `PATCH inbound-leads/{id}` (поле `lead`).
 *
 * Идемпотентность: если у inbound уже есть `lead` — ничего не делаем.
 * Ошибки не пробрасываем: создание самого inbound-лида уже прошло.
 *
 * @param {Object} inbound - объект из ответа createInboundLead
 * @param {Object} [overrides] - поля карточки воронки, заданные вручную в окне
 *   «Новый лид» на странице «Лиды»: { funnel, stage, title, email, address,
 *   estimated_value, probability, description, source, service, urgency,
 *   participant_ids }. Пустые / незаданные значения заменяются дефолтами.
 * @returns {Promise<string|null>} id карточки воронки или null
 */
export async function ensureFunnelLeadForInbound(inbound, overrides = {}) {
  if (!inbound?.id || inbound.lead) return inbound?.lead || null;

  try {
    let funnelId = overrides.funnel || null;
    if (!funnelId) {
      const funnelsRes = await cGet("List Funnels Error", `${BASE}/funnels/`);
      const funnels = Array.isArray(funnelsRes)
        ? funnelsRes
        : funnelsRes?.results || [];
      const main =
        funnels.find((f) => isMainFunnel(f) && f.is_active !== false) ||
        funnels.find((f) => isMainFunnel(f)) ||
        null;
      funnelId = main?.id || null;
    }
    if (!funnelId) return null;

    let stageId = overrides.stage || null;
    if (!stageId) {
      const stagesRes = await cGet(
        "List Funnel Stages Error",
        `${BASE}/funnel-stages/`,
        { funnel: funnelId },
      );
      const stages = Array.isArray(stagesRes)
        ? stagesRes
        : stagesRes?.results || [];
      const firstStage =
        stages.find((s) => s.system_key === "intake") ||
        stages
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ||
        null;
      stageId = firstStage?.id || null;
    }

    const fullName = String(inbound.full_name || "").trim();
    const phone = String(inbound.phone || "").trim();
    const description =
      overrides.description != null
        ? String(overrides.description).trim()
        : String(inbound.message || "").trim();

    const payload = {
      funnel: funnelId,
      stage: stageId,
      title:
        String(overrides.title || "").trim() ||
        fullName ||
        phone ||
        "Новый лид",
      full_name: fullName,
      phone,
      email: String(overrides.email || "").trim(),
      address: String(overrides.address || "").trim(),
      source: overrides.source || inbound.source || "manual",
      description,
      estimated_value: Number(overrides.estimated_value) || 0,
      probability: Number(overrides.probability) || 0,
    };
    if (overrides.service) payload.service = overrides.service;
    if (overrides.urgency) payload.urgency = overrides.urgency;

    const lead = await cPost(
      "Create Funnel Lead Error",
      `${BASE}/leads/`,
      payload,
    );

    if (lead?.id) {
      const participantIds = (overrides.participant_ids || []).filter(Boolean);
      if (participantIds.length) {
        try {
          await cPost(
            "Set Lead Participants Error",
            `${BASE}/leads/${lead.id}/participants/`,
            { participant_ids: participantIds },
          );
        } catch {
          /* участники не критичны для появления карточки */
        }
      }
      try {
        await cPatch("Link Inbound Lead Error", `${URL_LEADS}${inbound.id}/`, {
          lead: lead.id,
        });
      } catch {
        /* связь не критична для отображения карточки на доске */
      }
    }
    return lead?.id || null;
  } catch {
    return null;
  }
}

/**
 * Зеркало в обратную сторону: для лида, созданного в воронке, завести
 * связанный `InboundLead`, чтобы карточка появилась и на странице «Лиды».
 *
 * Промежуточное решение до перевода «Лидов» на единую модель `Lead`
 * (docs/consulting/backend-money-tenant/13-unify-leads-single-model.md §7).
 * Идемпотентность — по синтетическому `external_id = "funnel:<lead_id>"`.
 * Ошибки не пробрасываются.
 *
 * @param {Object} lead - объект из ответа createLead (нужны id/title/full_name/phone)
 * @returns {Promise<string|null>} id созданного InboundLead или null
 */
export async function ensureInboundLeadForFunnelLead(lead) {
  const leadId = lead?.id;
  if (!leadId) return null;
  if (lead.inbound_lead || lead.inbound_lead_id) {
    return lead.inbound_lead || lead.inbound_lead_id;
  }

  try {
    const fullName = String(lead.full_name || lead.contact_name || "").trim();
    const phone = String(lead.phone || "").trim();
    const created = await cPost("Mirror Inbound Lead Error", URL_LEADS, {
      full_name: fullName,
      phone,
      source: lead.source || lead.channel || "manual",
      message: String(lead.description || "").trim(),
      lead: leadId,
      external_id: `funnel:${leadId}`,
    });
    return created?.id || null;
  } catch {
    return null;
  }
}

/** Обновить произвольные поля лида. */
export const updateInboundLead = (id, payload) =>
  cPatch("Update Inbound Lead Error", `${URL_LEADS}${id}/`, payload);

/** Назначить лид сотруднику. */
export const assignInboundLead = (id, payload) =>
  cPost("Assign Inbound Lead Error", `${URL_LEADS}${id}/assign/`, payload);

/**
 * Отложить лид «на потом».
 * POST /consalting/inbound-leads/{id}/defer/
 * @param {Object} payload - { remind_at: ISO, reason, comment? }
 */
export const deferInboundLead = (id, payload) =>
  cPost("Defer Inbound Lead Error", `${URL_LEADS}${id}/defer/`, payload);

/** Вернуть отложенный лид в работу. */
export const resumeInboundLead = (id, payload = {}) =>
  cPost("Resume Inbound Lead Error", `${URL_LEADS}${id}/resume/`, payload);

/** Пометить лид покупкой (сделка оформляется на воронке/в продажах). */
export const markInboundLeadWon = (id, payload = {}) =>
  cPost("Mark Lead Won Error", `${URL_LEADS}${id}/won/`, payload);

/**
 * Отказ по лиду.
 * @param {Object} payload - { reason, comment? } — причина обязательна,
 *   иначе блок «причины отказов» в аналитике останется пустым.
 */
export const markInboundLeadLost = (id, payload) =>
  cPost("Mark Lead Lost Error", `${URL_LEADS}${id}/lost/`, payload);

/* ==================== НАСТРОЙКИ РАСПРЕДЕЛЕНИЯ ==================== */

/** GET /consalting/lead-distribution/ → { enabled, strategy, role_ids, recipients } */
export const getLeadDistribution = (config) =>
  cGet("Get Lead Distribution Error", `${BASE}/lead-distribution/`, {}, config);

/** PUT /consalting/lead-distribution/ ← { enabled, strategy, role_ids } */
export const updateLeadDistribution = (payload) =>
  cPut("Update Lead Distribution Error", `${BASE}/lead-distribution/`, payload);

/* ==================== РЕГИОНАЛЬНЫЕ ВОРОНКИ ==================== */

/** Коды регионов для маршрутизации inbound → воронка города. */
export const CONSULTING_REGIONS = [
  {
    code: "bishkek",
    label: "Бишкек",
    phonePrefixes: ["+996312", "+996313", "+996555", "+996700"],
  },
  {
    code: "osh",
    label: "Ош",
    phonePrefixes: ["+996322", "+996323"],
  },
  {
    code: "jalal_abad",
    label: "Джалал-Абад",
    phonePrefixes: ["+996772", "+996882"],
  },
];

/**
 * GET /consalting/regional-funnel-routing/
 * @see docs/consulting/regional-funnels-distribution.md
 */
export const getRegionalFunnelRouting = (config) =>
  cGet(
    "Get Regional Funnel Routing Error",
    `${BASE}/regional-funnel-routing/`,
    {},
    config,
  );

/** PUT /consalting/regional-funnel-routing/ */
export const updateRegionalFunnelRouting = (payload) =>
  cPut(
    "Update Regional Funnel Routing Error",
    `${BASE}/regional-funnel-routing/`,
    payload,
  );

/* ==================== ВСПОМОГАТЕЛЬНОЕ ==================== */

/** Просрочен ли отложенный лид (срок напоминания уже прошёл). */
export const isLeadOverdue = (lead) => {
  if (!lead || lead.status !== LEAD_STATUS.DEFERRED) return false;
  const at = lead.remind_at || lead.deferred_until;
  if (!at) return false;
  const ts = new Date(at).getTime();
  return Number.isFinite(ts) && ts <= Date.now();
};

/** Человекочитаемая причина откладывания/отказа по коду. */
export const reasonLabel = (list, value) =>
  list.find((r) => r.value === value)?.label || value || "—";
