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
import { Navigate, useSearchParams } from "react-router-dom";
import {
  FaChartPie,
  FaFileExcel,
  FaInbox,
  FaPlug,
  FaRandom,
} from "react-icons/fa";
import api from "../../../../api";
import { useAlert } from "../../../../hooks/useDialog";
import { useUser } from "../../../../store/slices/userSlice";
import {
  canAccessConsultingLeadInbox,
  canManageConsultingLeadFinance,
  isConsultingFunnelManager,
} from "../../../../utils/consultingFunnelAccess";
import { ensurePushPermission } from "../common/useConsultingRealtime";
import LeadFinanceModal from "./modals/LeadFinanceModal";
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
    managerOnly: true,
  },
  {
    value: "integration",
    label: "Интеграция",
    hint: "Wazzup и каналы",
    icon: FaPlug,
    managerOnly: true,
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
  const canFinance = canManageConsultingLeadFinance(profile);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.managerOnly || isManager),
    [isManager],
  );

  const sectionFromUrl = searchParams.get("tab");
  const section = visibleSections.some((s) => s.value === sectionFromUrl)
    ? sectionFromUrl
    : "inbox";
  const activeSection =
    visibleSections.find((s) => s.value === section) || visibleSections[0];

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
  const [funnels, setFunnels] = useState([]);

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
    api
      .get("/consalting/funnels/", { signal: controller.signal })
      .then((res) => setFunnels(asArray(res.data)))
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

  if (!canAccessConsultingLeadInbox(profile)) {
    return <Navigate to="/crm/consulting/funnel" replace />;
  }

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
        {canFinance && (
          <button
            type="button"
            className="leads__btn leads__btn--finance"
            onClick={() => setFinanceOpen(true)}
            title="Рекламный отчёт: показы, лиды, затраты, стоимость лида"
          >
            <FaFileExcel aria-hidden /> Финансы
          </button>
        )}
      </header>

      <nav className="leads__nav" aria-label="Разделы лидов">
        {visibleSections.map((s) => {
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
          <LeadsDistribution
            roles={roles}
            employees={employees}
            funnels={funnels}
            alert={alert}
          />
        )}
        {section === "integration" && <WazzupAccountsTab />}
      </div>

      {financeOpen && canFinance && (
        <LeadFinanceModal alert={alert} onClose={() => setFinanceOpen(false)} />
      )}
    </section>
  );
}
