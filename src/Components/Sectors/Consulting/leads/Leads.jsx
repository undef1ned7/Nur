/**
 * Консалтинг → Лиды.
 *
 * Верхние разделы: Очередь · Аналитика · Распределение · Интеграция.
 * Состояние разделов — в query (`tab`), очередь и фильтры живут в LeadsInbox.
 *
 * ТЗ: docs/consulting/tz-consulting-2026-07.md §ТЗ-1
 * Контракт бэкенда: docs/consulting/backend/01-leads.md
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaChartPie,
  FaInbox,
  FaPlug,
  FaRandom,
} from "react-icons/fa";
import api from "../../../../api";
import { useAlert } from "../../../../hooks/useDialog";
import { useUser } from "../../../../store/slices/userSlice";
import { isConsultingFunnelManager } from "../../../../utils/consultingFunnelAccess";
import { ensurePushPermission } from "../common/useConsultingRealtime";
import LeadsAnalytics from "./LeadsAnalytics";
import LeadsDistribution from "./LeadsDistribution";
import LeadsInbox from "./LeadsInbox";
import WazzupAccountsTab from "./WazzupAccountsTab";
import "./leads.scss";

const ROLES_URL = "/users/roles/";
const EMPLOYEES_URL = "/users/employees/";

const SECTIONS = [
  {
    value: "inbox",
    label: "Очередь",
    hint: "Входящие и отложенные",
    icon: FaInbox,
  },
  {
    value: "analytics",
    label: "Аналитика",
    hint: "Конверсия по когортам",
    icon: FaChartPie,
  },
  {
    value: "settings",
    label: "Распределение",
    hint: "Кто получает лиды",
    icon: FaRandom,
  },
  {
    value: "integration",
    label: "Интеграция",
    hint: "Wazzup и каналы",
    icon: FaPlug,
  },
];

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const employeeName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

export default function ConsultingLeads() {
  const alert = useAlert();
  const { profile } = useUser();
  const isManager = isConsultingFunnelManager(profile);
  const [searchParams, setSearchParams] = useSearchParams();

  const sectionFromUrl = searchParams.get("tab");
  const section = SECTIONS.some((s) => s.value === sectionFromUrl)
    ? sectionFromUrl
    : "inbox";
  const activeSection = SECTIONS.find((s) => s.value === section) || SECTIONS[0];

  const selectSection = (next) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "inbox") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );
  };

  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(ROLES_URL, { signal: controller.signal })
      .then((res) =>
        setRoles(
          asArray(res.data).map((r) => ({ id: r.id, name: r.name || "—" })),
        ),
      )
      .catch(() => {});
    api
      .get(EMPLOYEES_URL, { signal: controller.signal })
      .then((res) => setEmployees(asArray(res.data)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), employeeName(e)));
    return m;
  }, [employees]);

  useEffect(() => {
    ensurePushPermission();
  }, []);

  return (
    <section className="leads">
      <header className="leads__header">
        <div className="leads__heading">
          <p className="leads__eyebrow">Консалтинг · Входящие</p>
          <h1 className="leads__title">Лиды</h1>
          <p className="leads__subtitle">
            WhatsApp, Instagram и Telegram — от первого сообщения до покупки
            или отказа
          </p>
        </div>
        <div className="leads__headerMeta" aria-hidden>
          <span className="leads__channelDot leads__channelDot--wa" />
          <span className="leads__channelDot leads__channelDot--ig" />
          <span className="leads__channelDot leads__channelDot--tg" />
        </div>
      </header>

      <nav className="leads__nav" aria-label="Разделы лидов">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.value;
          return (
            <button
              key={s.value}
              type="button"
              className={`leads__navItem${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => selectSection(s.value)}
            >
              <span className="leads__navIcon" aria-hidden>
                <Icon />
              </span>
              <span className="leads__navText">
                <span className="leads__navLabel">{s.label}</span>
                <span className="leads__navHint">{s.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="leads__panel">
        <div className="leads__panelHead">
          <h2 className="leads__panelTitle">{activeSection.label}</h2>
          <p className="leads__panelHint">{activeSection.hint}</p>
        </div>

        {section === "inbox" && (
          <LeadsInbox
            employees={employees}
            empById={empById}
            isManager={isManager}
            alert={alert}
          />
        )}
        {section === "analytics" && (
          <LeadsAnalytics employees={employees} isManager={isManager} />
        )}
        {section === "settings" && (
          <LeadsDistribution roles={roles} employees={employees} alert={alert} />
        )}
        {section === "integration" && <WazzupAccountsTab />}
      </div>
    </section>
  );
}
