/**
 * Держит /ws/wazzup/ открытым на всём консалтинге (realtime чат).
 *
 * Колокольчик по новым сообщениям и SLA — через /ws/notifications/
 * (бэкенд: create_and_publish_notification + signals no_activity / sla_breach /
 * task_overdue). Здесь только соединение чата, без дублей в колокольчике.
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import { useWazzupChatSocket } from "../../../../hooks/useWazzupChatSocket";
import { mapSectorNameToSlug } from "../../../../utils/sectorMapping";

function isConsultingSector(company) {
  const slug = mapSectorNameToSlug(company?.sector?.name);
  if (slug === "consulting") return true;
  const name = String(company?.sector?.name || "").toLowerCase().trim();
  const key = String(company?.sector?.key || company?.sector?.slug || "")
    .toLowerCase()
    .trim();
  return (
    key === "consulting" ||
    name === "консалтинг" ||
    name === "consulting" ||
    name.includes("консалт")
  );
}

export default function ConsultingWazzupNotifyBridge() {
  const { company, profile } = useUser();
  const location = useLocation();

  const onConsultingRoute = String(location.pathname || "").startsWith(
    "/crm/consulting",
  );

  const enabled = useMemo(
    () => !!profile && (isConsultingSector(company) || onConsultingRoute),
    [profile, company, onConsultingRoute],
  );

  useWazzupChatSocket({ enabled });

  return null;
}
