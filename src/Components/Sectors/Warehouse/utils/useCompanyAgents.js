import { useEffect, useState } from "react";
import { listCompanyAgentRequests } from "../../../../api/warehouse";

const STATUS_SUFFIX = {
  removed: " (отстранён)",
};

/**
 * Агенты компании для фильтров «Документы» / «Касса».
 * Берём активных и отстранённых (у отстранённых остаются документы в истории),
 * заявки pending/rejected — не агенты.
 * Раньше список собирался из топ-10 аналитики за месяц и терял остальных агентов.
 */
export const companyAgentOptions = (memberships) => {
  const list = Array.isArray(memberships)
    ? memberships
    : Array.isArray(memberships?.results)
      ? memberships.results
      : [];
  const byId = new Map();
  list.forEach((m) => {
    const status = String(m?.status || "").toLowerCase();
    if (status !== "active" && status !== "removed") return;
    // user бывает uuid-строкой или объектом { id, ... } — ключ всегда id пользователя,
    // иначе один сотрудник дублируется в фильтрах (QA B17)
    const rawUser = m.user ?? m.user_id;
    const id =
      rawUser && typeof rawUser === "object"
        ? rawUser.id ?? rawUser.uuid
        : rawUser;
    if (!id) return;
    const key = String(id);
    const prev = byId.get(key);
    // Активное членство важнее отстранённого (агент мог вернуться)
    if (prev && prev.status === "active") return;
    const name = m.user_display || m.user_email || key;
    byId.set(key, {
      id: key,
      name: `${name}${STATUS_SUFFIX[status] || ""}`,
      status,
    });
  });
  return Array.from(byId.values())
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map(({ id, name }) => ({ id, name }));
};

export const useCompanyAgents = (enabled = true) => {
  const [state, setState] = useState({ agents: [], loaded: false });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    listCompanyAgentRequests()
      .then((data) => {
        if (!cancelled) setState({ agents: companyAgentOptions(data), loaded: true });
      })
      .catch(() => {
        if (!cancelled) setState({ agents: [], loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    agents: enabled ? state.agents : [],
    loading: enabled && !state.loaded,
  };
};
