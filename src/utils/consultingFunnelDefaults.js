import api from "../api";

const BASE = "/consalting";

/** Три обязательные системные стадии воронки роли (нельзя удалять/редактировать). */
export const CONSULTING_SYSTEM_STAGES = [
  {
    system_key: "intake",
    name: "Новые заявки",
    order: 0,
    color: "#3b82f6",
    is_system: true,
    stage_type: "new_lead",
    is_final: false,
    is_success: false,
  },
  {
    system_key: "in_progress",
    name: "В работе",
    order: 1,
    color: "#f59e0b",
    is_system: true,
    stage_type: "nurture",
    is_final: false,
    is_success: false,
  },
  {
    system_key: "completed",
    name: "Завершено",
    order: 2,
    color: "#16a34a",
    is_system: true,
    stage_type: "won",
    is_final: true,
    is_success: true,
  },
];

export function isSystemStage(stage) {
  if (!stage) return false;
  if (stage.is_system) return true;
  return ["intake", "in_progress", "completed"].includes(stage.system_key);
}

/** Системная финальная стадия «Завершено». */
export function isCompletedStage(stage) {
  if (!stage) return false;
  if (stage.system_key === "completed") return true;
  return !!(stage.is_final && stage.is_success);
}

export function funnelNameForRole(roleName) {
  return String(roleName || "").trim();
}

/** Отображаемое имя воронки (для старых записей убирает префикс «Воронка:»). */
export function getFunnelDisplayName(funnel) {
  if (!funnel) return "—";
  if (funnel.custom_role_name) {
    return String(funnel.custom_role_name).trim();
  }
  const name = String(funnel.name || "").trim();
  if (isRoleFunnel(funnel)) {
    return name.replace(/^Воронка:\s*/iu, "") || name;
  }
  return name;
}

export const MAIN_FUNNEL_DEFAULT_NAME = "Основная воронка";

/** Основная (компанийная) воронка — статична, нельзя удалить/переименовать. */
export function isMainFunnel(funnel) {
  if (!funnel) return false;
  if (funnel.is_main === true || funnel.funnel_kind === "main") return true;
  return String(funnel.name || "").trim() === MAIN_FUNNEL_DEFAULT_NAME;
}

/** Воронка, привязанная к кастомной роли — статична. */
export function isRoleFunnel(funnel) {
  return !!funnel?.custom_role;
}

/** Воронки, которые владелец/админ не может удалять или менять метаданные. */
export function isProtectedFunnel(funnel) {
  if (!funnel) return false;
  if (funnel.is_static === true) return true;
  return isMainFunnel(funnel) || isRoleFunnel(funnel);
}

export function funnelProtectionLabel(funnel) {
  if (isMainFunnel(funnel)) return "Основная";
  if (isRoleFunnel(funnel)) return "Роль";
  if (funnel?.is_static) return "Системная";
  return null;
}

/**
 * Создаёт воронку для кастомной роли с тремя системными стадиями.
 * Предпочитает POST /consalting/funnels/for-role/; при 404 — fallback на ручное создание.
 */
export async function provisionFunnelForCustomRole(customRoleId, roleName) {
  const name = funnelNameForRole(roleName);

  try {
    const { data } = await api.post(`${BASE}/funnels/for-role/`, {
      custom_role: customRoleId,
      name,
      role_name: roleName,
    });
    return data;
  } catch (err) {
    if (err?.response?.status !== 404 && err?.response?.status !== 501) {
      throw err;
    }
  }

  const { data: funnel } = await api.post(`${BASE}/funnels/`, {
    name,
    description: `Воронка продаж для роли «${roleName}»`,
    is_active: true,
    custom_role: customRoleId,
  });

  for (const stage of CONSULTING_SYSTEM_STAGES) {
    await api.post(`${BASE}/funnel-stages/`, {
      funnel: funnel.id,
      ...stage,
    });
  }

  return funnel;
}
