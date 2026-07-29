/**
 * Консалтинг → Лиды.
 *
 * Верхние разделы: Очередь (входящие) · Аналитика · Распределение · Интеграция.
 * Сама очередь разложена по табам-статусам со счётчиками, есть отложенные лиды
 * с напоминанием, фильтры по сотруднику/источнику/периоду и серверная
 * пагинация — всё состояние живёт в query-параметрах (ссылку можно переслать).
 *
 * ТЗ: docs/consulting/tz-consulting-2026-07.md §ТЗ-1
 * Контракт бэкенда: docs/consulting/backend/01-leads.md
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  { value: "inbox", label: "Очередь" },
  { value: "analytics", label: "Аналитика" },
  { value: "settings", label: "Распределение" },
  { value: "integration", label: "Интеграция" },
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

  /* Справочники: нужны для фильтра по сотруднику, назначения и настроек. */
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get(ROLES_URL, { signal: controller.signal })
      .then((res) =>
        setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "—" }))),
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

  // Разрешение на десктоп-пуш спрашиваем один раз при открытии раздела:
  // напоминания по отложенным лидам приходят именно так.
  useEffect(() => {
    ensurePushPermission();
  }, []);

  return (
    <section className="leads">
      <header className="leads__header">
        <div className="leads__heading">
          <h2 className="leads__title">Лиды</h2>
          <p className="leads__subtitle">
            Входящие из WhatsApp, Instagram и Telegram — очередь, отложенные и
            результат по каждому обращению
          </p>
        </div>
      </header>

      <div className="leads__tabsRow">
        <div className="leads__tabs" role="tablist" aria-label="Разделы лидов">
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={section === s.value}
              className={`leads__tab ${section === s.value ? "is-active" : ""}`}
              onClick={() => selectSection(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
    </section>
  );
}
