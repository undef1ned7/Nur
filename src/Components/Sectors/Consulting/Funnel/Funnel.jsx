// src/Components/Sectors/Consulting/Funnel/Funnel.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Funnel.scss";
import { useDispatch } from "react-redux";
import {
  getFunnels,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  createStage,
  updateStage,
  deleteStage,
  createLead,
  updateLead,
  deleteLead,
  moveLeadStage,
  getAllowedTransitions,
  recalculateScore,
  winLead,
  loseLead,
  getLeadTimeline,
  addLeadActivity,
  getLeadTasks,
  createLeadTask,
  updateLeadTask,
  deleteLeadTask,
  getLossReasons,
  getFunnelAnalytics,
  claimLead,
  releaseLead,
  assignLead,
  archiveLead,
  setLeadParticipants,
  getFunnelOrder,
  saveFunnelOrder,
} from "../../../../store/creators/funnelThunk";
import { getConsultingServices } from "../../../../store/creators/consultingThunk";
import {
  useFunnel,
  clearLeadDetail,
} from "../../../../store/slices/funnelSlice";
import { useFunnelBoardWebSocket } from "../../../../hooks/useFunnelBoardWebSocket";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import {
  canManageLeadsInFunnel,
  canViewConsultingFunnel,
  filterFunnelsForUser,
  isConsultingFunnelManager,
} from "../../../../utils/consultingFunnelAccess";
import {
  getFunnelDisplayName,
  isProtectedFunnel,
  isSystemStage,
  isCompletedStage,
} from "../../../../utils/consultingFunnelDefaults";
import {
  canDragLead,
  findStageInBoard,
  isLeadLockedForEmployee,
  isLeadOnCompletedStage,
} from "../../../../utils/consultingFunnelLeadUtils";
import { calcConsultingSaleTotal, formatTariffSubscription, resolveTariffPrice } from "../../../../utils/consultingSalePricing";
import { ensurePushPermission, useConsultingRealtime } from "../common/useConsultingRealtime";

// Персональное событие воронки для текущего пользователя (назначение лида/работы).
const isFunnelLeadEvent = (n) => {
  const t = String(n?.type || n?.category || n?.event || "").toLowerCase();
  return t.includes("lead") || t.includes("лид") || t.includes("funnel") || t.includes("assign");
};
import LeadCreateClientModal from "./LeadCreateClientModal";
import LeadPaymentModal from "./LeadPaymentModal";
import { Link } from "react-router-dom";
import FunnelBoardRow from "./FunnelBoardRow";
import LeadTransferModal from "./LeadTransferModal";
import FunnelEmployeesPicker from "./FunnelEmployeesPicker";
import FunnelArchiveModal from "./FunnelArchiveModal";
import {
  moveLeadOnBoard,
  removeLeadFromBoard as removeLeadFromBoardMap,
  upsertLeadOnBoard as upsertLeadOnBoardMap,
} from "../../../../utils/funnelBoardUtils";
import {
  fetchAccessibleFunnelBoards,
  fetchFunnelBoard,
} from "../../../../utils/funnelBoardFetch";
import { useConfirm } from "../../../../hooks/useDialog";
import { usePointerReorder } from "../../../../hooks/usePointerReorder";

/**
 * Расширенные возможности «Воронка 2.0» (скоринг, лента, задачи, win/lose,
 * аналитика, allowed-transitions) включаются флагом, когда соответствующие
 * эндпоинты задеплоены на бэкенде. Базовый канбан (funnels/stages/leads/board/
 * move-stage) работает всегда. По умолчанию выключено — на проде этих URL ещё нет.
 */
const FUNNEL_V2 = import.meta.env.VITE_FUNNEL_V2 === "true";

/* ===================== справочники ===================== */
const STATUS_LABELS = {
  new: "Новый",
  in_work: "В работе",
  won: "Успех",
  lost: "Отказ",
};

const STAGE_TYPES = [
  { value: "new_lead", label: "Новый лид" },
  { value: "first_contact", label: "Первый контакт" },
  { value: "qualification", label: "Квалификация" },
  { value: "nurture", label: "Прогрев / в работе" },
  { value: "proposal_sent", label: "КП отправлено" },
  { value: "negotiation", label: "Переговоры" },
  { value: "decision_pending", label: "Ожидание решения" },
  { value: "won", label: "Выиграно / оплачено" },
  { value: "onboarding", label: "Онбординг" },
  { value: "completed", label: "Завершено" },
  { value: "lost", label: "Потеряно" },
];

const URGENCY = [
  { value: "low", label: "Низкая" },
  { value: "medium", label: "Средняя" },
  { value: "high", label: "Высокая" },
];

const ACTION_TYPES = [
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "meeting", label: "Встреча" },
  { value: "follow_up", label: "Follow-up" },
];

const ACTIVITY_TYPES = [
  { value: "note", label: "Заметка" },
  { value: "call", label: "Звонок" },
  { value: "message", label: "Сообщение" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Встреча" },
  { value: "file", label: "Файл" },
];

/* ===================== утилиты ===================== */
const fmtMoney = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString() + " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

// краткая сумма: 50000 -> «50 тыс», 1250000 -> «1.25 млн»
const fmtMoneyShort = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0) + " млн";
  if (n >= 1_000) return Math.round(n / 1000) + " тыс";
  return String(n);
};

// инициалы для аватара владельца
const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

// детерминированный цвет аватара по строке
const avatarHue = (str) => {
  let h = 0;
  for (let i = 0; i < String(str).length; i++)
    h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
};

// ISO -> значение для <input type="datetime-local">
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
// значение datetime-local -> ISO
const fromLocalInput = (val) => (val ? new Date(val).toISOString() : null);

const errToText = (err, fallback = "Что-то пошло не так.") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.detail && !err.errors) return err.detail;
  const parts = [];
  if (Array.isArray(err.errors)) parts.push(...err.errors);
  for (const [k, v] of Object.entries(err)) {
    if (k === "detail" || k === "errors") continue;
    parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  if (err.detail) parts.unshift(err.detail);
  return parts.join("\n") || fallback;
};

/* ===================== главный экран ===================== */
export default function ConsultingFunnel() {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { profile } = useUser();
  const isManager = isConsultingFunnelManager(profile);
  const canViewFunnel = canViewConsultingFunnel(profile);

  const {
    funnels = [],
    loading,
    error,
    allowedTransitions,
  } = useFunnel();

  const visibleFunnels = useMemo(
    () => filterFunnelsForUser(funnels, profile),
    [funnels, profile]
  );

  const visibleFunnelIdsKey = useMemo(
    () =>
      visibleFunnels
        .map((f) => String(f.id))
        .sort()
        .join(","),
    [visibleFunnels],
  );

  const [boardsMap, setBoardsMap] = useState({});
  const [boardsLoading, setBoardsLoading] = useState(false);
  const lastLoadedBoardsKeyRef = useRef("");
  const boardsLoadGenRef = useRef(0);
  const [dragState, setDragState] = useState(null);

  // фильтры доски (общие для всех воронок)
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("");

  const [funnelFormOpen, setFunnelFormOpen] = useState(false);
  const [funnelEditTarget, setFunnelEditTarget] = useState(null);
  const [stageFormFunnelId, setStageFormFunnelId] = useState(null);
  const [stageEditTarget, setStageEditTarget] = useState(null);
  const [analyticsFunnelId, setAnalyticsFunnelId] = useState(null);
  const [leadModal, setLeadModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [claimBusyId, setClaimBusyId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Порядок воронок per-user. Источник истины — сервер (user-preferences),
  // localStorage используется как кэш и fallback при отсутствии эндпоинта (404).
  const [funnelOrderIds, setFunnelOrderIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("consulting_funnel_order_v1") || "[]"); }
    catch { return []; }
  });

  // При загрузке тянем серверный порядок; пустой ответ/404 — оставляем localStorage.
  useEffect(() => {
    dispatch(getFunnelOrder())
      .unwrap()
      .then((order) => {
        if (Array.isArray(order) && order.length) {
          setFunnelOrderIds(order.map(String));
          try {
            localStorage.setItem(
              "consulting_funnel_order_v1",
              JSON.stringify(order.map(String)),
            );
          } catch {}
        }
      })
      .catch(() => {});
  }, [dispatch]);

  const loadBoards = useCallback(async (ids) => {
    if (!ids.length) return {};
    return fetchAccessibleFunnelBoards({ funnelIds: ids });
  }, []);

  const refreshBoard = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await fetchFunnelBoard(id);
      setBoardsMap((prev) => ({ ...prev, [String(id)]: data }));
    } catch {
      /* ignore single board errors */
    }
  }, []);

  const refreshAllBoards = useCallback(async () => {
    const ids = visibleFunnelIdsKey ? visibleFunnelIdsKey.split(",") : [];
    if (!ids.length) {
      setBoardsMap({});
      return;
    }
    setBoardsLoading(true);
    try {
      const map = await loadBoards(ids);
      setBoardsMap(map);
    } catch {
      setNotice("Не удалось загрузить доски воронок.");
    } finally {
      setBoardsLoading(false);
    }
  }, [visibleFunnelIdsKey, loadBoards]);

  const onDeleteStage = (funnelId, stage) => {
    if (!stage?.id || isSystemStage(stage)) return;
    confirm(
      `Удалить стадию «${stage.name || "без названия"}»? Лиды останутся без этой стадии.`,
      async (result) => {
        if (!result) return;
        try {
          await dispatch(deleteStage(stage.id)).unwrap();
          setNotice("Стадия удалена.");
          refreshBoard(funnelId);
        } catch (e) {
          setNotice(errToText(e, "Не удалось удалить стадию."));
        }
      },
    );
  };

  const onDeleteFunnel = (funnel) => {
    if (!funnel || isProtectedFunnel(funnel)) return;
    confirm(
      `Удалить воронку «${getFunnelDisplayName(funnel)}»? Это действие необратимо.`,
      async (result) => {
        if (!result) return;
        try {
          await dispatch(deleteFunnel(funnel.id)).unwrap();
          setBoardsMap((prev) => {
            const next = { ...prev };
            delete next[funnel.id];
            return next;
          });
          setNotice("Воронка удалена.");
        } catch (e) {
          setNotice(errToText(e, "Не удалось удалить воронку."));
        }
      },
    );
  };

  const { isConnected, userId: wsUserId, isManager: wsIsManager } =
    useFunnelBoardWebSocket({
      funnelIdsKey: visibleFunnelIdsKey,
      enabled: !!visibleFunnelIdsKey,
      onUpsert: (lead) => {
        if (!lead?.funnel) return;
        setBoardsMap((prev) => ({
          ...prev,
          [lead.funnel]: upsertLeadOnBoardMap(prev[lead.funnel], lead),
        }));
      },
      onRemove: (data) => {
        const fid = data?.funnel || data?.funnel_id;
        const lid = data?.id;
        if (!lid) return;
        if (fid) {
          setBoardsMap((prev) => ({
            ...prev,
            [fid]: removeLeadFromBoardMap(prev[fid], lid),
          }));
          return;
        }
        setBoardsMap((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            next[key] = removeLeadFromBoardMap(next[key], lid);
          }
          return next;
        });
      },
      onAssigned: (lead) =>
        setNotice(`Вам назначен лид: ${lead?.title || "без названия"}`),
      onReconnect: refreshAllBoards,
    });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Десктоп-пуш о персональных событиях (лид назначен именно мне). Соединение
  // per-user, поэтому приходит только «моё». См. useConsultingRealtime.
  useEffect(() => {
    ensurePushPermission();
  }, []);
  const onFunnelSignal = useCallback(() => {
    refreshAllBoards();
  }, [refreshAllBoards]);
  useConsultingRealtime({ match: isFunnelLeadEvent, onSignal: onFunnelSignal });

  useEffect(() => {
    dispatch(getFunnels());
    if (FUNNEL_V2) dispatch(getLossReasons());
  }, [dispatch]);

  // Доски — один раз на набор видимых воронок
  useEffect(() => {
    if (loading || !profile) return;

    if (!visibleFunnelIdsKey) {
      lastLoadedBoardsKeyRef.current = "";
      setBoardsMap({});
      setBoardsLoading(false);
      return;
    }

    if (lastLoadedBoardsKeyRef.current === visibleFunnelIdsKey) {
      return;
    }

    lastLoadedBoardsKeyRef.current = visibleFunnelIdsKey;

    const ids = visibleFunnelIdsKey.split(",");
    const gen = ++boardsLoadGenRef.current;
    setBoardsLoading(true);

    fetchAccessibleFunnelBoards({ funnelIds: ids })
      .then((map) => {
        if (gen === boardsLoadGenRef.current) {
          setBoardsMap(map);
        }
      })
      .catch(() => {
        if (gen === boardsLoadGenRef.current) {
          setNotice("Не удалось загрузить доски воронок.");
        }
      })
      .finally(() => {
        if (gen === boardsLoadGenRef.current) {
          setBoardsLoading(false);
        }
      });

    return () => {
      // Strict Mode: сброс, чтобы remount снова загрузил доски
      lastLoadedBoardsKeyRef.current = "";
      boardsLoadGenRef.current += 1;
    };
  }, [loading, profile, visibleFunnelIdsKey]);

  // sync funnel order when visible funnels change (add new, remove deleted)
  useEffect(() => {
    setFunnelOrderIds((prev) => {
      const currentIds = visibleFunnels.map((f) => String(f.id));
      const kept = prev.filter((id) => currentIds.includes(id));
      const added = currentIds.filter((id) => !kept.includes(id));
      const next = [...kept, ...added];
      try { localStorage.setItem("consulting_funnel_order_v1", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [visibleFunnels]);

  const sortedFunnels = useMemo(() => {
    if (!funnelOrderIds.length) return visibleFunnels;
    return funnelOrderIds
      .map((id) => visibleFunnels.find((f) => String(f.id) === id))
      .filter(Boolean);
  }, [funnelOrderIds, visibleFunnels]);

  // Переупорядочивание воронок — на pointer-событиях (см. usePointerReorder).
  // Порядок засеивается из текущего видимого порядка (sortedFunnels), иначе при
  // пустом localStorage indexOf вернул бы -1 и перестановка не применилась бы.
  const handleFunnelReorder = useCallback(
    (dragId, targetId) => {
      if (!dragId || dragId === targetId) return;
      setFunnelOrderIds(() => {
        const ids = sortedFunnels.map((f) => String(f.id));
        const from = ids.indexOf(String(dragId));
        const to = ids.indexOf(String(targetId));
        if (from === -1 || to === -1) return ids;
        ids.splice(from, 1);
        ids.splice(to, 0, String(dragId));
        try {
          localStorage.setItem("consulting_funnel_order_v1", JSON.stringify(ids));
        } catch { /* localStorage недоступен — порядок не сохранится, не критично */ }
        // Сохраняем на сервер (per-user). Ошибку/404 игнорируем — localStorage кэш.
        dispatch(saveFunnelOrder(ids));
        return ids;
      });
    },
    [sortedFunnels, dispatch]
  );

  const {
    dragId: funnelDragId,
    overId: funnelDragOverId,
    onHandlePointerDown: onFunnelHandlePointerDown,
  } = usePointerReorder({
    itemSelector: ".funnel__row",
    idAttr: "data-funnel-id",
    onReorder: handleFunnelReorder,
  });

  // владельцы для фильтра — из всех досок
  const owners = useMemo(() => {
    const map = new Map();
    Object.values(boardsMap).forEach((board) => {
      const all = [
        ...(board?.columns || []).flatMap((c) => c.leads || []),
        ...(board?.unassigned || []),
      ];
      for (const l of all) {
        if (l.owner && !map.has(l.owner)) {
          map.set(l.owner, l.owner_display || "Без имени");
        }
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [boardsMap]);

  // предикат фильтрации одной карточки
  const matchLead = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lead) => {
      if (riskOnly && !lead.is_at_risk) return false;
      if (ownerFilter && lead.owner !== ownerFilter) return false;
      if (gradeFilter && lead.score_grade !== gradeFilter) return false;
      if (q) {
        const hay = [lead.title, lead.full_name, lead.phone, lead.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
  }, [query, riskOnly, ownerFilter, gradeFilter]);

  const hasFilters = !!(query.trim() || ownerFilter || riskOnly || gradeFilter);

  const resetFilters = () => {
    setQuery("");
    setOwnerFilter("");
    setRiskOnly(false);
    setGradeFilter("");
  };

  const onDropToStage = async (funnelId, leadId, stageId) => {
    const board = boardsMap[funnelId];
    const funnel = visibleFunnels.find((f) => f.id === funnelId);
    if (!board || !funnel || !canManageLeadsInFunnel(profile, funnel)) return;

    const lead =
      [...(board.columns || []).flatMap((c) => c.leads || []), ...(board.unassigned || [])].find(
        (l) => l.id === leadId,
      );
    if (lead && !canDragLead(lead, board, profile, true)) {
      setNotice("Завершённые лиды может перемещать только администратор.");
      setDragState(null);
      return;
    }

    // Перенос на завершающую стадию разрешён и сотруднику (не только менеджеру):
    // завершение лида сотрудником — штатный сценарий. Ограничение на повторное
    // перемещение уже завершённого лида проверено выше через canDragLead().
    const targetStage = findStageInBoard(board, stageId);

    setDragState(null);
    setBoardsMap((prev) => ({
      ...prev,
      [funnelId]: moveLeadOnBoard(prev[funnelId], leadId, stageId),
    }));

    try {
      if (stageId) {
        await dispatch(moveLeadStage({ id: leadId, stage: stageId })).unwrap();
        if (isCompletedStage(targetStage)) {
          setNotice(
            "Лид завершён. Запись в аналитику и начисление зарплаты выполняются на сервере.",
          );
        }
      } else {
        await dispatch(
          updateLead({ id: leadId, data: { stage: null } })
        ).unwrap();
      }
    } catch (e) {
      await refreshBoard(funnelId);
      setNotice(
        errToText(
          e,
          "Не удалось переместить лид. Проверьте права на управление лидами.",
        ),
      );
    }
  };

  const activeLeadModalFunnelId = leadModal?.funnelId;
  const activeLeadBoard = activeLeadModalFunnelId
    ? boardsMap[activeLeadModalFunnelId]
    : null;
  const activeLeadStages = (activeLeadBoard?.columns || []).map((c) => c.stage);
  const activeLeadFunnel = visibleFunnels.find(
    (f) => f.id === activeLeadModalFunnelId
  );
  const activeLeadCanManage = canManageLeadsInFunnel(profile, activeLeadFunnel);

  const stageFormBoard = stageFormFunnelId
    ? boardsMap[stageFormFunnelId]
    : null;

  if (!canViewFunnel) {
    return (
      <section className="funnel">
        <div className="funnel__placeholder">
          Нет доступа к воронке продаж. Обратитесь к администратору.
        </div>
      </section>
    );
  }

  return (
    <section className="funnel">
      <header className="funnel__header">
        <div>
          <h2 className="funnel__title">Воронка продаж</h2>
          <p className="funnel__subtitle">
            {visibleFunnels.length
              ? `${visibleFunnels.length} воронок с доступом`
              : "Канбан-доска лидов"}
            {visibleFunnelIdsKey && (
              <span
                className={`funnel__live${isConnected ? " funnel__live--on" : ""}`}
                title={
                  isConnected
                    ? "Обновления в реальном времени"
                    : "Подключение к обновлениям…"
                }
              >
                {isConnected ? "● Live" : "○ …"}
              </span>
            )}
          </p>
        </div>

        <div className="funnel__actions">
          <button
            type="button"
            className="funnel__btn"
            onClick={() => setArchiveOpen(true)}
          >
            Архив
          </button>
          {isManager && (
            <button className="funnel__btn" onClick={() => setFunnelFormOpen(true)}>
              + Воронка
            </button>
          )}
        </div>
      </header>

      {!!error && <div className="funnel__error">{errToText(error)}</div>}
      {!!notice && <div className="funnel__notice">{notice}</div>}

      {visibleFunnels.length > 0 && (
        <div className="funnel__toolbar">
          <div className="funnel__searchWrap">
            <span className="funnel__searchIcon" aria-hidden>
              🔍
            </span>
            <input
              className="funnel__search"
              placeholder="Поиск по названию, имени, телефону…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="funnel__searchClear"
                onClick={() => setQuery("")}
                aria-label="Очистить"
              >
                ×
              </button>
            )}
          </div>

          {owners.length > 1 && (
            <select
              className="funnel__select funnel__select--sm"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Ответственный"
            >
              <option value="">Все ответственные</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}

          {FUNNEL_V2 &&
            ["A", "B", "C"].map((g) => (
              <button
                key={g}
                className={`funnel__gradeBtn funnel__gradeBtn--${g.toLowerCase()}${
                  gradeFilter === g ? " funnel__gradeBtn--active" : ""
                }`}
                onClick={() => setGradeFilter((v) => (v === g ? "" : g))}
                title={`Грейд ${g}`}
              >
                {g}
              </button>
            ))}

          {FUNNEL_V2 && (
            <button
              className={`funnel__chipBtn${
                riskOnly ? " funnel__chipBtn--active" : ""
              }`}
              onClick={() => setRiskOnly((v) => !v)}
            >
              ⚠ Под риском
            </button>
          )}

          {hasFilters && (
            <button className="funnel__chipBtn" onClick={resetFilters}>
              Сбросить
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="funnel__placeholder">Загрузка…</div>
      ) : !visibleFunnels.length ? (
        <div className="funnel__placeholder">
          {isManager
            ? "Создайте воронку, чтобы начать работу."
            : "Нет доступных воронок. Обратитесь к администратору."}
        </div>
      ) : (
        <div className="funnel__rows">
          {sortedFunnels.map((f) => (
            <FunnelBoardRow
              key={f.id}
              funnel={f}
              board={boardsMap[f.id]}
              profile={profile}
              isManager={isManager}
              matchLead={matchLead}
              hasFilters={hasFilters}
              dragState={dragState}
              onDragStart={(funnelId, leadId) =>
                setDragState({ funnelId, leadId })
              }
              onDragEnd={() => setDragState(null)}
              onDropStage={onDropToStage}
              claimBusyId={claimBusyId}
              onClaimLead={(leadId) => refreshBoard(f.id)}
              onOpenLead={(funnelId, leadId) =>
                setLeadModal({ funnelId, leadId })
              }
              onCreateLead={(funnelId, stageId) =>
                setLeadModal({ funnelId, create: true, stageId })
              }
              onTransferLead={(funnelId, lead) =>
                setTransferModal({ sourceFunnelId: funnelId, sourceLead: lead })
              }
              onEditFunnel={(funnel) => setFunnelEditTarget(funnel)}
              onDeleteFunnel={onDeleteFunnel}
              onAddStage={(id) => setStageFormFunnelId(id)}
              onEditStage={(funnelId, stage) =>
                setStageEditTarget({ funnelId, stage })
              }
              onDeleteStage={onDeleteStage}
              allowedTransitions={allowedTransitions}
              onRefreshBoard={() => refreshBoard(f.id)}
              funnelDragId={funnelDragId}
              isDragOver={funnelDragOverId === String(f.id)}
              onFunnelHandlePointerDown={onFunnelHandlePointerDown}
            />
          ))}
        </div>
      )}

      {funnelFormOpen && (
        <FunnelForm
          onClose={() => {
            setFunnelFormOpen(false);
            dispatch(getFunnels());
            refreshAllBoards();
          }}
        />
      )}
      {funnelEditTarget && (
        <FunnelForm
          funnel={funnelEditTarget}
          onClose={() => {
            setFunnelEditTarget(null);
            refreshBoard(funnelEditTarget.id);
          }}
        />
      )}
      {stageFormFunnelId && (
        <StageForm
          funnelId={stageFormFunnelId}
          nextOrder={stageFormBoard?.columns?.length || 0}
          onClose={() => {
            setStageFormFunnelId(null);
            refreshBoard(stageFormFunnelId);
          }}
        />
      )}
      {stageEditTarget && (
        <StageForm
          funnelId={stageEditTarget.funnelId}
          stage={stageEditTarget.stage}
          onClose={() => {
            const fid = stageEditTarget.funnelId;
            setStageEditTarget(null);
            refreshBoard(fid);
          }}
        />
      )}
      {leadModal?.create && activeLeadModalFunnelId && (
        <LeadCreateForm
          funnelId={activeLeadModalFunnelId}
          funnel={activeLeadFunnel}
          stages={activeLeadStages}
          initialStageId={leadModal.stageId}
          onClose={() => {
            setLeadModal(null);
            refreshBoard(activeLeadModalFunnelId);
          }}
        />
      )}
      {leadModal?.leadId && activeLeadModalFunnelId && (
        <LeadDetail
          leadId={leadModal.leadId}
          funnelId={activeLeadModalFunnelId}
          board={activeLeadBoard}
          stages={activeLeadStages}
          wsUserId={wsUserId}
          wsIsManager={wsIsManager || isManager}
          canManageLeads={activeLeadCanManage}
          visibleFunnels={visibleFunnels}
          boardsMap={boardsMap}
          profile={profile}
          onClose={() => setLeadModal(null)}
          onNotice={setNotice}
          onTransfer={(lead) =>
            setTransferModal({
              sourceFunnelId: activeLeadModalFunnelId,
              sourceLead: lead,
            })
          }
          onBoardRefresh={() => refreshBoard(activeLeadModalFunnelId)}
        />
      )}
      {transferModal && (
        <LeadTransferModal
          sourceLead={transferModal.sourceLead}
          sourceFunnelId={transferModal.sourceFunnelId}
          funnels={visibleFunnels}
          boardsMap={boardsMap}
          profile={profile}
          onClose={() => setTransferModal(null)}
          onSuccess={async (_created, { targetFunnelId }) => {
            setNotice("Лид передан в другую воронку.");
            await refreshBoard(targetFunnelId);
          }}
        />
      )}
      {archiveOpen && (
        <FunnelArchiveModal
          funnels={funnels}
          profile={profile}
          onClose={() => setArchiveOpen(false)}
          onOpenLead={(funnelId, leadId) => {
            setArchiveOpen(false);
            setLeadModal({ funnelId, leadId });
          }}
        />
      )}
      {FUNNEL_V2 && analyticsFunnelId && (
        <AnalyticsModal
          funnelId={analyticsFunnelId}
          onClose={() => setAnalyticsFunnelId(null)}
        />
      )}
    </section>
  );
}

/* ===================== Колонка ===================== */
function Column({
  stage,
  leads,
  unassigned = false,
  isOver,
  dragLeadId,
  dropState,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardDragEnd,
  onAddLead,
  onCardClick,
  onClaimLead,
  claimBusyId,
  canManageLeads = true,
}) {
  const cls = [
    "funnel__col",
    isOver ? "funnel__col--over" : "",
    dropState === "allowed" ? "funnel__col--allowed" : "",
    dropState === "blocked" ? "funnel__col--blocked" : "",
    !unassigned && isSystemStage(stage) ? "funnel__col--system" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stageColor = stage?.color || "#cbd5e1";
  const sum = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);
  const systemStage = !unassigned && isSystemStage(stage);

  return (
    <div
      className={cls}
      style={{ "--stage-color": stageColor }}
      onDragOver={canManageLeads ? onDragOver : undefined}
      onDragLeave={canManageLeads ? onDragLeave : undefined}
      onDrop={canManageLeads ? onDrop : undefined}
    >
      <div className="funnel__colBar" />
      <div className="funnel__colHead">
        <div className="funnel__colTitleRow">
          <span className="funnel__colDot" style={{ background: stageColor }} />
          <span className="funnel__colName" title={stage?.name}>
            {stage?.name || "—"}
          </span>
          {systemStage && (
            <span className="funnel__colLock" title="Системная стадия (нельзя изменить)">
              🔒
            </span>
          )}
          <span className="funnel__colCount">{leads.length}</span>
        </div>
        {sum > 0 && (
          <span className="funnel__colSum">{fmtMoneyShort(sum)} с</span>
        )}
      </div>

      <div className="funnel__colBody">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            dragging={dragLeadId === lead.id}
            onDragStart={() => onCardDragStart(lead.id)}
            onDragEnd={onCardDragEnd}
            onClick={() => onCardClick(lead)}
            onClaim={onClaimLead}
            claimBusy={claimBusyId === lead.id}
            canManageLeads={canManageLeads}
          />
        ))}
        {!leads.length && (
          <div className="funnel__colEmpty">
            <span className="funnel__colEmptyIcon">↓</span>
            {canManageLeads ? "Перетащите карточку" : "Нет лидов"}
          </div>
        )}
      </div>

      {!unassigned && canManageLeads && (
        <button className="funnel__colAdd" onClick={onAddLead}>
          <span>+</span> Добавить лид
        </button>
      )}
    </div>
  );
}

/* ===================== Карточка лида ===================== */
function LeadCard({ lead, dragging, onDragStart, onDragEnd, onClick, onClaim, claimBusy, canManageLeads = true }) {
  const inPool = !lead.owner;

  return (
    <article
      className={`funnel__card${dragging ? " funnel__card--dragging" : ""}${
        lead.is_at_risk ? " funnel__card--risk" : ""
      }${inPool ? " funnel__card--pool" : ""}${
        !canManageLeads ? " funnel__card--readonly" : ""
      }`}
      draggable={canManageLeads}
      onDragStart={canManageLeads ? onDragStart : undefined}
      onDragEnd={canManageLeads ? onDragEnd : undefined}
      onClick={onClick}
    >
      <div className="funnel__cardTop">
        <div className="funnel__cardTitle" title={lead.title}>
          {lead.title || "Без названия"}
        </div>
        <div className="funnel__cardTopRight">
          {inPool && <span className="funnel__poolBadge">Пул</span>}
          {lead.score_grade && (
            <span
              className={`funnel__grade funnel__grade--${String(
                lead.score_grade
              ).toLowerCase()}`}
              title={`Скоринг: ${lead.score_value ?? "—"}`}
            >
              {lead.score_grade}
            </span>
          )}
        </div>
      </div>

      {(lead.full_name || lead.phone) && (
        <div className="funnel__cardContact">
          {lead.full_name && (
            <span className="funnel__cardName">{lead.full_name}</span>
          )}
          {lead.phone && (
            <span className="funnel__cardPhone">{lead.phone}</span>
          )}
        </div>
      )}

      <div className="funnel__cardMeta">
        {Number(lead.estimated_value) > 0 && (
          <span className="funnel__cardValue">
            {fmtMoney(lead.estimated_value)}
          </span>
        )}
        <span className={`funnel__badge funnel__badge--${lead.status}`}>
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>

      {lead.probability != null && Number(lead.probability) > 0 && (
        <div className="funnel__cardProbWrap" title={`Вероятность ${lead.probability}%`}>
          <div className="funnel__cardProbTrack">
            <div
              className="funnel__cardProbFill"
              style={{ width: `${Math.min(100, Number(lead.probability))}%` }}
            />
          </div>
          <span className="funnel__cardProbVal">{lead.probability}%</span>
        </div>
      )}

      {lead.is_at_risk && (
        <div className="funnel__cardRisk" title={lead.risk_reason}>
          <span className="funnel__cardRiskDot" />
          Под риском{lead.risk_reason ? `: ${lead.risk_reason}` : ""}
        </div>
      )}

      {(lead.next_action_date || lead.owner_display || inPool) && (
        <div className="funnel__cardFoot">
          {lead.next_action_date && (
            <span className="funnel__cardNext">
              🕑 {fmtDate(lead.next_action_date)}
            </span>
          )}
          {inPool && canManageLeads ? (
            <button
              type="button"
              className="funnel__cardClaim"
              disabled={claimBusy}
              onClick={(e) => {
                e.stopPropagation();
                onClaim?.(lead.id);
              }}
            >
              {claimBusy ? "…" : "Взять"}
            </button>
          ) : (
            lead.owner_display && (
              <span
                className="funnel__avatar"
                title={lead.owner_display}
                style={{
                  background: `hsl(${avatarHue(lead.owner_display)} 65% 55%)`,
                }}
              >
                {initials(lead.owner_display)}
              </span>
            )
          )}
        </div>
      )}
    </article>
  );
}

/* ===================== Модалка-обёртка ===================== */
function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="funnel__overlay" onClick={onClose}>
      <div
        className={`funnel__modal${wide ? " funnel__modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle">{title}</div>
          <button
            className="funnel__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormActions({ saving, onClose }) {
  return (
    <div className="funnel__formActions funnel__formActions--end">
      <button
        type="button"
        className="funnel__btn"
        onClick={onClose}
        disabled={saving}
      >
        Отмена
      </button>
      <button
        type="submit"
        className="funnel__btn funnel__btn--primary"
        disabled={saving}
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}

/* ===================== Форма воронки ===================== */
function FunnelForm({ funnel: existing, onClose }) {
  const dispatch = useDispatch();
  const isEdit = !!existing?.id;
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Введите название воронки.");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        is_active: isActive,
      };
      if (isEdit) {
        await dispatch(
          updateFunnel({ id: existing.id, data: payload })
        ).unwrap();
      } else {
        await dispatch(createFunnel(payload)).unwrap();
      }
      onClose();
    } catch (e2) {
      setErr(
        errToText(
          e2,
          isEdit ? "Не удалось сохранить воронку." : "Не удалось создать воронку.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Изменить воронку" : "Новая воронка"} onClose={onClose}>
      {!!err && <div className="funnel__error">{err}</div>}
      <form className="funnel__form" onSubmit={submit}>
        <div className="funnel__field">
          <label className="funnel__label">Название *</label>
          <input
            className="funnel__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Описание</label>
          <textarea
            className="funnel__input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="funnel__check">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Активна
        </label>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ===================== Форма стадии ===================== */
const PRESET_COLORS = [
  "#3498db",
  "#f39c12",
  "#9b59b6",
  "#2ecc71",
  "#e74c3c",
  "#1abc9c",
];

function StageForm({ funnelId, stage, nextOrder, onClose }) {
  const dispatch = useDispatch();
  const isEdit = !!stage?.id;
  const [name, setName] = useState(stage?.name || "");
  const [order, setOrder] = useState(stage?.order ?? nextOrder ?? 0);
  const [color, setColor] = useState(stage?.color || PRESET_COLORS[0]);
  // v2
  const [stageType, setStageType] = useState(stage?.stage_type || "new_lead");
  const [slaHours, setSlaHours] = useState(
    stage?.sla_hours != null ? String(stage.sla_hours) : "",
  );
  const [allowSkip, setAllowSkip] = useState(!!stage?.allow_skip);
  const [requiredFields, setRequiredFields] = useState(
    Array.isArray(stage?.required_fields)
      ? stage.required_fields.join(", ")
      : "",
  );
  // базовый бэкенд
  const [isFinal, setIsFinal] = useState(!!stage?.is_final);
  const [isSuccess, setIsSuccess] = useState(!!stage?.is_success);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Введите название стадии.");
    setSaving(true);
    try {
      const payload = {
        funnel: funnelId,
        name: name.trim(),
        order: Number(order) || 0,
        color,
      };
      if (FUNNEL_V2) {
        payload.stage_type = stageType;
        payload.allow_skip = allowSkip;
        if (slaHours !== "") payload.sla_hours = Number(slaHours) || 0;
        const rf = requiredFields
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (rf.length) payload.required_fields = rf;
      } else {
        payload.is_final = isFinal;
        payload.is_success = isFinal ? isSuccess : false;
      }

      if (isEdit) {
        await dispatch(updateStage({ id: stage.id, data: payload })).unwrap();
      } else {
        await dispatch(createStage(payload)).unwrap();
      }
      onClose();
    } catch (e2) {
      setErr(
        errToText(
          e2,
          isEdit ? "Не удалось изменить стадию." : "Не удалось создать стадию.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Редактирование стадии" : "Новая стадия"} onClose={onClose}>
      {!!err && <div className="funnel__error">{err}</div>}
      <form className="funnel__form" onSubmit={submit}>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Название *</label>
            <input
              className="funnel__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Порядок</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
        </div>

        {FUNNEL_V2 && (
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Тип стадии</label>
              <select
                className="funnel__input"
                value={stageType}
                onChange={(e) => setStageType(e.target.value)}
              >
                {STAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">SLA, часов</label>
              <input
                className="funnel__input"
                type="number"
                min="0"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="напр. 24"
              />
            </div>
          </div>
        )}

        <div className="funnel__field">
          <label className="funnel__label">Цвет</label>
          <div className="funnel__colors">
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`funnel__colorDot${
                  color === c ? " funnel__colorDot--active" : ""
                }`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="funnel__colorPicker"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>

        {FUNNEL_V2 ? (
          <>
            <div className="funnel__field">
              <label className="funnel__label">
                Обязательные поля (через запятую)
              </label>
              <input
                className="funnel__input"
                value={requiredFields}
                onChange={(e) => setRequiredFields(e.target.value)}
                placeholder="estimated_value, phone"
              />
            </div>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={allowSkip}
                onChange={(e) => setAllowSkip(e.target.checked)}
              />
              Разрешить прыжки через стадии
            </label>
            <p className="funnel__hint">
              Финальность (успех/провал) определяется типом стадии автоматически.
            </p>
          </>
        ) : (
          <>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => setIsFinal(e.target.checked)}
              />
              Финальная стадия (закрытие лида)
            </label>
            {isFinal && (
              <label className="funnel__check">
                <input
                  type="checkbox"
                  checked={isSuccess}
                  onChange={(e) => setIsSuccess(e.target.checked)}
                />
                Успешное закрытие
              </label>
            )}
          </>
        )}

        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ===================== Создание лида ===================== */
function LeadCreateForm({ funnelId, funnel, stages, initialStageId, onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    title: "",
    stage: initialStageId || "",
    full_name: "",
    phone: "",
    email: "",
    source: "",
    estimated_value: "",
    probability: "",
    urgency: "medium",
    description: "",
    service: "",
    tariff: "",
  });
  const [participants, setParticipants] = useState([]);
  const [services, setServices] = useState([]);
  const [postCreateLead, setPostCreateLead] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    dispatch(getConsultingServices())
      .unwrap()
      .then((rows) => {
        if (!cancelled) setServices(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Услуги, доступные в этой воронке. На воронке роли показываем только услуги
  // этой роли + общие (без роли). На основной/без custom_role — все услуги.
  const funnelRoleId = funnel?.custom_role ? String(funnel.custom_role) : null;
  const visibleServices = useMemo(() => {
    if (!funnelRoleId) return services;
    return services.filter((s) => {
      const sr = s.custom_role ? String(s.custom_role) : null;
      return !sr || sr === funnelRoleId;
    });
  }, [services, funnelRoleId]);

  const selectedService = services.find(
    (s) => String(s.id) === String(form.service),
  );
  const serviceTariffs = selectedService?.tariffs || [];

  const selectedTariff = serviceTariffs.find(
    (t) => String(t.id) === String(form.tariff) || t.name === form.tariff,
  );
  const tariffSubHint = formatTariffSubscription(selectedTariff);

  useEffect(() => {
    if (!selectedService) return;
    const total = calcConsultingSaleTotal({
      service: selectedService,
      tariffId: form.tariff || null,
      roleId: funnelRoleId,
      items: [],
      discount: 0,
      markup: 0,
    });
    if (total > 0) {
      setForm((f) => ({ ...f, estimated_value: String(total) }));
    }
  }, [form.service, form.tariff, selectedService, funnelRoleId]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.title.trim()) return setErr("Введите название лида.");
    const payload = {
      funnel: funnelId,
      stage: form.stage || null,
      title: form.title.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: form.source.trim(),
      description: form.description.trim(),
      estimated_value:
        form.estimated_value === "" ? 0 : Number(form.estimated_value) || 0,
      probability: form.probability === "" ? 0 : Number(form.probability) || 0,
    };
    if (FUNNEL_V2) payload.urgency = form.urgency;
    if (form.service) payload.service = form.service;
    if (form.tariff) payload.tariff = form.tariff;
    if (participants.length) payload.participant_ids = participants;

    setSaving(true);
    try {
      const created = await dispatch(createLead(payload)).unwrap();
      if (participants.length && created?.id) {
        await dispatch(
          setLeadParticipants({ id: created.id, participant_ids: participants }),
        ).unwrap();
      }
      setPostCreateLead(created);
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать лид."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal title="Новый лид" onClose={onClose}>
      <form className="funnel__form" onSubmit={submit}>
        {funnel && (
          <p className="funnel__hint">
            Воронка: <strong>{getFunnelDisplayName(funnel)}</strong>
          </p>
        )}
        {!!err && <div className="funnel__error">{err}</div>}
        <div className="funnel__field">
          <label className="funnel__label">Название *</label>
          <input
            className="funnel__input"
            value={form.title}
            onChange={set("title")}
            autoFocus
          />
        </div>

        <div className="funnel__field">
          <label className="funnel__label">Сотрудники воронки</label>
          <FunnelEmployeesPicker
            funnelId={funnelId}
            value={participants}
            onChange={setParticipants}
            disabled={saving}
          />
        </div>

        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Услуга (опционально)</label>
            <select
              className="funnel__input"
              value={form.service}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  service: e.target.value,
                  tariff: "",
                }))
              }
            >
              <option value="">Не выбрана</option>
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Тариф (опционально)</label>
            <select
              className="funnel__input"
              value={form.tariff}
              onChange={set("tariff")}
              disabled={!serviceTariffs.length}
            >
              <option value="">Базовая цена</option>
              {serviceTariffs.map((t) => {
                const sub = formatTariffSubscription(t);
                return (
                  <option key={t.id || t.name} value={t.id || t.name}>
                    {t.name} — {resolveTariffPrice(t, funnelRoleId).toLocaleString()} с
                    {sub ? ` (+ абон. ${sub})` : ""}
                  </option>
                );
              })}
            </select>
            {tariffSubHint && (
              <p className="funnel__hint">Абонентская плата: {tariffSubHint}</p>
            )}
          </div>
        </div>

        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Стадия</label>
            <select
              className="funnel__input"
              value={form.stage}
              onChange={set("stage")}
            >
              <option value="">Без стадии</option>
              {(stages || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Источник</label>
            <input
              className="funnel__input"
              value={form.source}
              onChange={set("source")}
              placeholder="Сайт, Instagram…"
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Контактное лицо</label>
            <input
              className="funnel__input"
              value={form.full_name}
              onChange={set("full_name")}
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Телефон</label>
            <input
              className="funnel__input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+996700000000"
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Email</label>
            <input
              className="funnel__input"
              type="email"
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Оценочная сумма, с</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value}
              onChange={set("estimated_value")}
            />
          </div>
        </div>
        <div className="funnel__grid2">
          <div className="funnel__field">
            <label className="funnel__label">Вероятность, %</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={set("probability")}
            />
          </div>
          {FUNNEL_V2 && (
            <div className="funnel__field">
              <label className="funnel__label">Срочность</label>
              <select
                className="funnel__input"
                value={form.urgency}
                onChange={set("urgency")}
              >
                {URGENCY.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Описание</label>
          <textarea
            className="funnel__input"
            rows={3}
            value={form.description}
            onChange={set("description")}
          />
        </div>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
      {postCreateLead && (
        <LeadCreateClientModal
          lead={postCreateLead}
          onClose={() => {
            setPostCreateLead(null);
            onClose();
          }}
          onSkip={() => {
            setPostCreateLead(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

/* ===================== Карточка лида (детально) ===================== */
function findLead(board, leadId) {
  if (!board) return null;
  for (const col of board.columns || []) {
    const f = (col.leads || []).find((l) => l.id === leadId);
    if (f) return f;
  }
  return (board.unassigned || []).find((l) => l.id === leadId) || null;
}

function LeadDetail({
  leadId,
  funnelId,
  board: boardProp,
  stages,
  wsUserId,
  wsIsManager,
  canManageLeads = true,
  profile,
  onClose,
  onNotice,
  onTransfer,
  onBoardRefresh,
}) {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { board: boardFromStore, lossReasons = [], timeline, tasks } = useFunnel();
  const board = boardProp || boardFromStore;
  const lead = findLead(board, leadId);

  const [tab, setTab] = useState("info");
  const [loseOpen, setLoseOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [assignTo, setAssignTo] = useState("");

  useEffect(() => {
    if (FUNNEL_V2) {
      dispatch(getLeadTimeline(leadId));
      dispatch(getLeadTasks({ lead: leadId }));
    }
    return () => {
      dispatch(clearLeadDetail());
    };
  }, [dispatch, leadId]);

  useEffect(() => {
    if (!wsIsManager) return undefined;
    let cancelled = false;
    api
      .get("/users/employees/")
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : data.results || [];
        setEmployees(
          rows.map((e) => ({
            id: e.id,
            name:
              e.full_name ||
              [e.first_name, e.last_name].filter(Boolean).join(" ") ||
              e.email ||
              "Сотрудник",
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wsIsManager]);

  if (!lead) {
    return (
      <Modal title="Лид" onClose={onClose} wide>
        <div className="funnel__form">Лид не найден.</div>
      </Modal>
    );
  }

  const closed = lead.status === "won" || lead.status === "lost";
  const onCompleted = isLeadOnCompletedStage(lead, board);
  const completedLocked = isLeadLockedForEmployee(lead, board, profile);
  const isMine = wsUserId && lead.owner === wsUserId;
  const inPool = !lead.owner;
  const clientId = lead.client || lead.client_id;
  const clientName = lead.client_display || lead.client_full_name;

  const onArchive = () => {
    confirm(
      "Перенести лид в архив? Карточка исчезнет с доски, данные сохранятся в аналитике.",
      async (result) => {
        if (!result) return;
        setErr("");
        setBusy(true);
        try {
          await dispatch(archiveLead(leadId)).unwrap();
          onNotice?.("Лид перенесён в архив.");
          onBoardRefresh?.();
          onClose();
        } catch (e) {
          setErr(errToText(e, "Не удалось перенести лид в архив."));
        } finally {
          setBusy(false);
        }
      },
    );
  };

  const onClaim = async () => {
    setErr("");
    setBusy(true);
    try {
      await dispatch(claimLead(leadId)).unwrap();
      // Обновляем доску сразу: WebSocket может быть недоступен, иначе карточка
      // останется в общем пуле до ручного обновления страницы.
      onBoardRefresh?.();
    } catch (e) {
      setErr(errToText(e, "Не удалось взять лид."));
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async () => {
    setErr("");
    setBusy(true);
    try {
      await dispatch(releaseLead(leadId)).unwrap();
      onBoardRefresh?.();
    } catch (e) {
      setErr(errToText(e, "Не удалось вернуть лид в пул."));
    } finally {
      setBusy(false);
    }
  };

  const onAssign = async () => {
    if (!assignTo) return setErr("Выберите сотрудника для назначения.");
    setErr("");
    setBusy(true);
    try {
      await dispatch(assignLead({ id: leadId, owner: assignTo })).unwrap();
      onNotice?.("Лид назначен сотруднику.");
      setAssignTo("");
      onBoardRefresh?.();
    } catch (e) {
      setErr(errToText(e, "Не удалось назначить лид."));
    } finally {
      setBusy(false);
    }
  };

  const onWin = async () => {
    setErr("");
    setBusy(true);
    try {
      await dispatch(winLead({ id: leadId })).unwrap();
      onBoardRefresh?.();
    } catch (e) {
      setErr(errToText(e, "Не удалось закрыть как успех."));
    } finally {
      setBusy(false);
    }
  };

  const onRecalc = async () => {
    setBusy(true);
    try {
      await dispatch(recalculateScore(leadId)).unwrap();
    } catch (e) {
      setErr(errToText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={lead.title || "Лид"} onClose={onClose} wide>
      <div className="funnel__detailHead">
        <div className="funnel__detailBadges">
          {lead.score_grade && (
            <span
              className={`funnel__grade funnel__grade--${String(
                lead.score_grade
              ).toLowerCase()}`}
            >
              {lead.score_grade} · {lead.score_value ?? "—"}
            </span>
          )}
          <span className={`funnel__badge funnel__badge--${lead.status}`}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
          {lead.stage_name && (
            <span className="funnel__chip">{lead.stage_name}</span>
          )}
          {clientId && (
            <Link
              to={`/crm/consulting/client/${clientId}`}
              className="funnel__chip funnel__chip--client"
              onClick={(e) => e.stopPropagation()}
            >
              Клиент: {clientName || clientId}
            </Link>
          )}
          {lead.is_at_risk && (
            <span className="funnel__chip funnel__chip--risk">⚠ Под риском</span>
          )}
          {inPool ? (
            <span className="funnel__chip funnel__chip--pool">Общий пул</span>
          ) : (
            lead.owner_display && (
              <span className="funnel__chip">{lead.owner_display}</span>
            )
          )}
        </div>
        <div className="funnel__detailActions">
          {canManageLeads && inPool && (
            <button className="funnel__btn funnel__btn--primary" onClick={onClaim} disabled={busy}>
              Взять в работу
            </button>
          )}
          {canManageLeads && isMine && !closed && (
            <button className="funnel__btn" onClick={onRelease} disabled={busy}>
              Вернуть в пул
            </button>
          )}
          {canManageLeads && wsIsManager && employees.length > 0 && !closed && (
            <>
              <select
                className="funnel__select funnel__select--inline"
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                aria-label="Назначить ответственного"
              >
                <option value="">Назначить…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button
                className="funnel__btn"
                onClick={onAssign}
                disabled={busy || !assignTo}
              >
                Назначить
              </button>
            </>
          )}
          {onCompleted && !lead.is_archived && canManageLeads && (
            <button
              className="funnel__btn funnel__btn--secondary"
              onClick={onArchive}
              disabled={busy}
            >
              В архив
            </button>
          )}
          {canManageLeads && !closed && !completedLocked && onTransfer && (
            <button
              className="funnel__btn"
              onClick={() => onTransfer(lead)}
              disabled={busy}
            >
              ⇄ В другую воронку
            </button>
          )}
          {canManageLeads && !clientId && (
            <button
              className="funnel__btn funnel__btn--secondary"
              onClick={() => setCreateClientOpen(true)}
              disabled={busy}
            >
              + Клиент
            </button>
          )}
          {canManageLeads && clientId && !lead.payment_registered && (
            <button
              className="funnel__btn funnel__btn--primary"
              onClick={() => setPaymentOpen(true)}
              disabled={busy}
            >
              Оформить оплату
            </button>
          )}
          {FUNNEL_V2 && (
            <>
              <button className="funnel__btn" onClick={onRecalc} disabled={busy}>
                ↻ Скоринг
              </button>
              {!closed && (
                <>
                  <button
                    className="funnel__btn funnel__btn--success"
                    onClick={onWin}
                    disabled={busy}
                  >
                    Выиграть
                  </button>
                  <button
                    className="funnel__btn funnel__btn--danger"
                    onClick={() => setLoseOpen((v) => !v)}
                    disabled={busy}
                  >
                    Проиграть
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!!err && <div className="funnel__error">{err}</div>}

      {FUNNEL_V2 && loseOpen && !closed && (
        <LoseForm
          leadId={leadId}
          lossReasons={lossReasons}
          onDone={() => setLoseOpen(false)}
          onError={setErr}
        />
      )}

      {FUNNEL_V2 && (
        <div className="funnel__tabs">
          {[
            ["info", "Информация"],
            ["timeline", "Лента"],
            ["tasks", "Задачи"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`funnel__tab${
                tab === key ? " funnel__tab--active" : ""
              }`}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "tasks" && tasks?.length ? ` (${tasks.length})` : ""}
            </button>
          ))}
        </div>
      )}

      {tab === "info" && (
        <LeadInfoForm
          lead={lead}
          funnelId={funnelId}
          stages={stages}
          onClose={onClose}
          readOnly={!canManageLeads || completedLocked}
        />
      )}
      {completedLocked && (
        <p className="funnel__hint funnel__hint--lock">
          Лид на стадии «Завершено». Редактирование и перемещение доступны только
          администратору или владельцу.
        </p>
      )}
      {FUNNEL_V2 && tab === "timeline" && (
        <TimelineTab leadId={leadId} timeline={timeline} />
      )}
      {FUNNEL_V2 && tab === "tasks" && (
        <TasksTab leadId={leadId} tasks={tasks} />
      )}
      {createClientOpen && (
        <LeadCreateClientModal
          lead={lead}
          onClose={() => setCreateClientOpen(false)}
          onSuccess={() => {
            setCreateClientOpen(false);
            onNotice?.("Клиент создан и привязан к лиду.");
            onBoardRefresh?.();
          }}
          onSkip={() => setCreateClientOpen(false)}
        />
      )}
      {paymentOpen && (
        <LeadPaymentModal
          lead={lead}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => {
            setPaymentOpen(false);
            onNotice?.("Оплата оформлена.");
            onBoardRefresh?.();
          }}
        />
      )}
    </Modal>
  );
}

/* ---------- форма закрытия с потерей ---------- */
function LoseForm({ leadId, lossReasons, onDone, onError }) {
  const dispatch = useDispatch();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return onError("Выберите причину проигрыша.");
    setBusy(true);
    try {
      await dispatch(
        loseLead({ id: leadId, loss_reason: reason, loss_comment: comment })
      ).unwrap();
      onDone();
    } catch (e) {
      onError(errToText(e, "Не удалось закрыть с потерей."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="funnel__loseBox">
      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Причина *</label>
          <select
            className="funnel__input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">— выберите —</option>
            {lossReasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Комментарий</label>
          <input
            className="funnel__input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>
      <div className="funnel__formActions funnel__formActions--end">
        <button className="funnel__btn" onClick={onDone} disabled={busy}>
          Отмена
        </button>
        <button
          className="funnel__btn funnel__btn--danger"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "…" : "Закрыть с потерей"}
        </button>
      </div>
    </div>
  );
}

/* ---------- вкладка «Информация» ---------- */
function LeadInfoForm({ lead, funnelId, stages, onClose, readOnly = false }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    title: lead.title || "",
    stage: lead.stage || "",
    source: lead.source || "",
    full_name: lead.full_name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    estimated_value:
      lead.estimated_value != null ? String(lead.estimated_value) : "",
    probability: lead.probability != null ? String(lead.probability) : "",
    urgency: lead.urgency || "medium",
    budget_confirmed: !!lead.budget_confirmed,
    decision_maker_engaged: !!lead.decision_maker_engaged,
    avg_response_minutes:
      lead.avg_response_minutes != null ? String(lead.avg_response_minutes) : "",
    next_action_type: lead.next_action_type || "",
    next_action_date: toLocalInput(lead.next_action_date),
    next_action_note: lead.next_action_note || "",
    description: lead.description || "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setChk = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.title.trim()) return setErr("Введите название лида.");
    const data = {
      funnel: funnelId,
      stage: form.stage || null,
      title: form.title.trim(),
      source: form.source.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      description: form.description.trim(),
      estimated_value:
        form.estimated_value === "" ? 0 : Number(form.estimated_value) || 0,
      probability: form.probability === "" ? 0 : Number(form.probability) || 0,
    };
    if (FUNNEL_V2) {
      data.urgency = form.urgency;
      data.budget_confirmed = form.budget_confirmed;
      data.decision_maker_engaged = form.decision_maker_engaged;
      data.avg_response_minutes =
        form.avg_response_minutes === ""
          ? null
          : Number(form.avg_response_minutes) || 0;
      data.next_action_type = form.next_action_type || null;
      data.next_action_date = fromLocalInput(form.next_action_date);
      data.next_action_note = form.next_action_note.trim();
    }

    setSaving(true);
    try {
      await dispatch(updateLead({ id: lead.id, data })).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось сохранить лид."));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteLead(lead.id)).unwrap();
      onClose();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось удалить лид."));
      setDeleting(false);
    }
  };

  return (
    <form className="funnel__form" onSubmit={readOnly ? (e) => e.preventDefault() : submit}>
      {readOnly && (
        <p className="funnel__hint">
          Режим просмотра. Для создания и изменения лидов нужен доступ
          «Управление лидами воронки».
        </p>
      )}
      {!!err && <div className="funnel__error">{err}</div>}

      <fieldset disabled={readOnly} className="funnel__fieldset">
      <div className="funnel__field">
        <label className="funnel__label">Название *</label>
        <input
          className="funnel__input"
          value={form.title}
          onChange={set("title")}
        />
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Стадия</label>
          <select
            className="funnel__input"
            value={form.stage}
            onChange={set("stage")}
          >
            <option value="">Без стадии</option>
            {(stages || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Источник</label>
          <input
            className="funnel__input"
            value={form.source}
            onChange={set("source")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Контактное лицо</label>
          <input
            className="funnel__input"
            value={form.full_name}
            onChange={set("full_name")}
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Телефон</label>
          <input
            className="funnel__input"
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Email</label>
          <input
            className="funnel__input"
            type="email"
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div className="funnel__field">
          <label className="funnel__label">Оценочная сумма, с</label>
          <input
            className="funnel__input"
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_value}
            onChange={set("estimated_value")}
          />
        </div>
      </div>

      <div className="funnel__grid2">
        <div className="funnel__field">
          <label className="funnel__label">Вероятность, %</label>
          <input
            className="funnel__input"
            type="number"
            min="0"
            max="100"
            value={form.probability}
            onChange={set("probability")}
          />
        </div>
        {FUNNEL_V2 && (
          <div className="funnel__field">
            <label className="funnel__label">Срочность</label>
            <select
              className="funnel__input"
              value={form.urgency}
              onChange={set("urgency")}
            >
              {URGENCY.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {FUNNEL_V2 && (
        <>
          <div className="funnel__sectionTitle">Квалификация и скоринг</div>
          <div className="funnel__grid2">
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={form.budget_confirmed}
                onChange={setChk("budget_confirmed")}
              />
              Бюджет подтверждён
            </label>
            <label className="funnel__check">
              <input
                type="checkbox"
                checked={form.decision_maker_engaged}
                onChange={setChk("decision_maker_engaged")}
              />
              ЛПР вовлечён
            </label>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Среднее время ответа, мин</label>
            <input
              className="funnel__input"
              type="number"
              min="0"
              value={form.avg_response_minutes}
              onChange={set("avg_response_minutes")}
            />
          </div>

          <div className="funnel__sectionTitle">Следующее действие</div>
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Тип</label>
              <select
                className="funnel__input"
                value={form.next_action_type}
                onChange={set("next_action_type")}
              >
                <option value="">—</option>
                {ACTION_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">Дата</label>
              <input
                className="funnel__input"
                type="datetime-local"
                value={form.next_action_date}
                onChange={set("next_action_date")}
              />
            </div>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Заметка</label>
            <input
              className="funnel__input"
              value={form.next_action_note}
              onChange={set("next_action_note")}
            />
          </div>
        </>
      )}

      <div className="funnel__field">
        <label className="funnel__label">Описание</label>
        <textarea
          className="funnel__input"
          rows={3}
          value={form.description}
          onChange={set("description")}
        />
      </div>

      {(lead.stage_entered_at || lead.last_activity_at) && (
        <p className="funnel__hint">
          В стадии с {fmtDate(lead.stage_entered_at)} · последняя активность{" "}
          {fmtDate(lead.last_activity_at)}
        </p>
      )}
      </fieldset>

      {!readOnly && (
      <div className="funnel__formActions">
        <button
          type="button"
          className="funnel__btn funnel__btn--danger"
          onClick={onDelete}
          disabled={deleting || saving}
        >
          {deleting ? "Удаление…" : "Удалить"}
        </button>
        <div className="funnel__formActionsRight">
          <button
            type="button"
            className="funnel__btn"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="funnel__btn funnel__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
      )}
      {!readOnly ? null : (
        <div className="funnel__formActions funnel__formActions--end">
          <button type="button" className="funnel__btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      )}
    </form>
  );
}

/* ---------- вкладка «Лента» ---------- */
function TimelineTab({ leadId, timeline }) {
  const dispatch = useDispatch();
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("Введите заголовок активности.");
    setBusy(true);
    try {
      await dispatch(
        addLeadActivity({ leadId, type, title: title.trim(), body: body.trim() })
      ).unwrap();
      setTitle("");
      setBody("");
    } catch (e2) {
      setErr(errToText(e2, "Не удалось добавить активность."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="funnel__tabBody">
      <form className="funnel__activityForm" onSubmit={add}>
        {!!err && <div className="funnel__error">{err}</div>}
        <div className="funnel__grid2">
          <select
            className="funnel__input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="funnel__input"
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <textarea
          className="funnel__input"
          rows={2}
          placeholder="Комментарий…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="funnel__formActions funnel__formActions--end">
          <button
            className="funnel__btn funnel__btn--primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "…" : "Добавить"}
          </button>
        </div>
      </form>

      <ul className="funnel__timeline">
        {(timeline || []).map((a) => (
          <li key={a.id} className="funnel__tlItem">
            <div className="funnel__tlDot" />
            <div className="funnel__tlContent">
              <div className="funnel__tlTitle">{a.title}</div>
              {a.body && <div className="funnel__tlBody">{a.body}</div>}
              <div className="funnel__tlMeta">
                {a.actor_display ? `${a.actor_display} · ` : ""}
                {fmtDate(a.created_at)}
              </div>
            </div>
          </li>
        ))}
        {!timeline?.length && (
          <li className="funnel__colEmpty">Активностей пока нет</li>
        )}
      </ul>
    </div>
  );
}

/* ---------- вкладка «Задачи» ---------- */
function TasksTab({ leadId, tasks }) {
  const dispatch = useDispatch();
  const [type, setType] = useState("call");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("Введите название задачи.");
    setBusy(true);
    try {
      await dispatch(
        createLeadTask({
          lead: leadId,
          type,
          title: title.trim(),
          due_date: fromLocalInput(due),
        })
      ).unwrap();
      setTitle("");
      setDue("");
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать задачу."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (t) =>
    dispatch(
      updateLeadTask({
        id: t.id,
        data: { status: t.status === "done" ? "open" : "done" },
      })
    );

  const remove = (id) => dispatch(deleteLeadTask(id));

  return (
    <div className="funnel__tabBody">
      <form className="funnel__activityForm" onSubmit={add}>
        {!!err && <div className="funnel__error">{err}</div>}
        <div className="funnel__grid2">
          <select
            className="funnel__input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            className="funnel__input"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <input
          className="funnel__input"
          placeholder="Название задачи"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="funnel__formActions funnel__formActions--end">
          <button
            className="funnel__btn funnel__btn--primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "…" : "Добавить задачу"}
          </button>
        </div>
      </form>

      <ul className="funnel__tasks">
        {(tasks || []).map((t) => (
          <li
            key={t.id}
            className={`funnel__task${
              t.status === "done" ? " funnel__task--done" : ""
            }${t.status === "overdue" ? " funnel__task--overdue" : ""}`}
          >
            <input
              type="checkbox"
              checked={t.status === "done"}
              onChange={() => toggle(t)}
            />
            <div className="funnel__taskBody">
              <div className="funnel__taskTitle">{t.title}</div>
              <div className="funnel__taskMeta">
                {t.due_date ? `до ${fmtDate(t.due_date)}` : "без срока"}
                {t.created_by_automation ? " · авто" : ""}
              </div>
            </div>
            <button
              className="funnel__iconBtn"
              onClick={() => remove(t.id)}
              aria-label="Удалить"
            >
              ×
            </button>
          </li>
        ))}
        {!tasks?.length && <li className="funnel__colEmpty">Задач пока нет</li>}
      </ul>
    </div>
  );
}

/* ===================== Аналитика ===================== */
function AnalyticsModal({ funnelId, onClose }) {
  const dispatch = useDispatch();
  const { analytics, analyticsLoading } = useFunnel();

  useEffect(() => {
    dispatch(getFunnelAnalytics({ funnelId }));
  }, [dispatch, funnelId]);

  const t = analytics?.totals;

  return (
    <Modal title="Аналитика воронки" onClose={onClose} wide>
      <div className="funnel__form">
        {analyticsLoading || !analytics ? (
          <div className="funnel__placeholder">Загрузка…</div>
        ) : (
          <>
            <div className="funnel__statGrid">
              <Stat label="Сделок" value={t?.deals ?? 0} />
              <Stat label="В работе, сумма" value={fmtMoney(t?.pipeline_value)} />
              <Stat label="Выиграно" value={t?.won ?? 0} />
              <Stat label="Проиграно" value={t?.lost ?? 0} />
              <Stat
                label="Win rate"
                value={
                  t?.win_rate != null ? `${Math.round(t.win_rate * 100)}%` : "—"
                }
              />
              <Stat label="Ср. цикл, дн." value={t?.avg_cycle_days ?? "—"} />
              <Stat label="Под риском" value={t?.at_risk ?? 0} />
            </div>

            <div className="funnel__sectionTitle">По стадиям</div>
            <div className="funnel__tableWrap">
              <table className="funnel__table">
                <thead>
                  <tr>
                    <th>Стадия</th>
                    <th>Кол-во</th>
                    <th>Сумма</th>
                    <th>Ср. часов</th>
                    <th>Конверсия</th>
                    <th>Отток</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.stages || []).map((s) => (
                    <tr key={s.stage_id}>
                      <td>{s.name}</td>
                      <td>{s.count}</td>
                      <td>{fmtMoney(s.value)}</td>
                      <td>{s.avg_hours_in_stage ?? "—"}</td>
                      <td>
                        {s.conversion_to_next != null
                          ? `${Math.round(s.conversion_to_next * 100)}%`
                          : "—"}
                      </td>
                      <td>
                        {s.drop_off_rate != null
                          ? `${Math.round(s.drop_off_rate * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="funnel__grid2">
              <div>
                <div className="funnel__sectionTitle">Причины оттока</div>
                <ul className="funnel__plainList">
                  {(analytics.by_loss_reason || []).map((r) => (
                    <li key={r.code}>
                      <span>{r.label}</span>
                      <strong>{r.count}</strong>
                    </li>
                  ))}
                  {!analytics.by_loss_reason?.length && (
                    <li className="funnel__colEmpty">Нет данных</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="funnel__sectionTitle">По качеству</div>
                <ul className="funnel__plainList">
                  {["A", "B", "C"].map((g) => (
                    <li key={g}>
                      <span>Грейд {g}</span>
                      <strong>{analytics.by_score?.[g] ?? 0}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <div className="funnel__stat">
      <div className="funnel__statValue">{value}</div>
      <div className="funnel__statLabel">{label}</div>
    </div>
  );
}
