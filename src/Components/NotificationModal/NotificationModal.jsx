import { useEffect, useRef, useCallback } from "react";
import { X, CheckCheck, BellOff } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import classes from "./NotificationModal.module.scss";
import {
  fetchNotificationsAsync,
  markAllNotificationsReadAsync,
  markNotificationReadAsync,
} from "../../store/creators/notificationCreators";

const PAGE_SIZE = 20;

const fmtDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const idOf = (n) => n?.id ?? n?.uuid ?? n?.pk;
const isUnread = (n) => !(n?.is_read ?? n?.read ?? false);

// Цвет полоски слева по уровню важности.
const levelColor = (n) => {
  const lvl = String(n?.level ?? n?.importance ?? n?.priority ?? "").toLowerCase();
  if (["critical", "urgent", "high", "danger", "error"].includes(lvl))
    return "#ef4444";
  if (["warning", "medium", "warn"].includes(lvl)) return "#f59e0b";
  if (["success", "ok"].includes(lvl)) return "#10b981";
  return "#3b82f6";
};

const NotificationModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const listRef = useRef(null);

  const {
    list = [],
    unreadCount = 0,
    hasMore = false,
    loading = false,
    loadingMore = false,
    markingAllRead = false,
  } = useSelector((state) => state.notification);

  // Подгружаем первую страницу, только если список пуст (нет лишних запросов,
  // когда данные уже пришли из WebSocket / были загружены в шапке).
  useEffect(() => {
    if (list.length === 0 && !loading) {
      dispatch(fetchNotificationsAsync({ limit: PAGE_SIZE, offset: 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    dispatch(
      fetchNotificationsAsync({
        limit: PAGE_SIZE,
        offset: list.length,
        append: true,
      }),
    );
  }, [dispatch, hasMore, loadingMore, list.length]);

  // Lazy loading при прокрутке к низу списка.
  const onScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
        loadMore();
      }
    },
    [loadMore],
  );

  const handleClick = useCallback(
    (n) => {
      if (isUnread(n)) dispatch(markNotificationReadAsync(idOf(n)));
      const url = n?.url ?? n?.link ?? n?.data?.url;
      if (url) {
        onClose?.();
        if (/^https?:\/\//i.test(url)) window.location.assign(url);
        else navigate(url);
      }
    },
    [dispatch, navigate, onClose],
  );

  const markAll = useCallback(() => {
    if (unreadCount > 0) dispatch(markAllNotificationsReadAsync());
  }, [dispatch, unreadCount]);

  return (
    <div className={classes.modal}>
      <div className={classes.header}>
        <h3>Центр уведомлений</h3>
        <X className={classes.close} onClick={onClose} size={20} />
      </div>

      <ul className={classes.list} ref={listRef} onScroll={onScroll}>
        {loading && list.length === 0 ? (
          <li className={classes.item} style={{ justifyContent: "center" }}>
            <span className={classes.count}>Загрузка…</span>
          </li>
        ) : list.length === 0 ? (
          <li
            className={classes.item}
            style={{
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "28px 12px",
              color: "#9ca3af",
            }}
          >
            <BellOff size={28} />
            <span>Уведомлений нет</span>
          </li>
        ) : (
          list.map((n) => {
            const unread = isUnread(n);
            const title =
              n?.title || n?.verb || n?.subject || "Уведомление";
            const message =
              n?.message || n?.description || n?.text || n?.body || "";
            const actor =
              n?.actor_name || n?.actor || n?.initiator_name || n?.initiator || "";
            return (
              <li
                key={idOf(n)}
                className={classes.item}
                onClick={() => handleClick(n)}
                style={{
                  cursor: "pointer",
                  borderLeft: `3px solid ${levelColor(n)}`,
                  background: unread ? "rgba(59,130,246,0.06)" : "transparent",
                  alignItems: "flex-start",
                }}
              >
                <div className={classes.texts} style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className={classes.title}
                    style={{ fontWeight: unread ? 700 : 500 }}
                  >
                    {title}
                  </span>
                  {message && (
                    <span
                      className={classes.count}
                      style={{
                        whiteSpace: "normal",
                        color: "#4b5563",
                        marginTop: 2,
                      }}
                    >
                      {message}
                    </span>
                  )}
                  <span
                    className={classes.count}
                    style={{ color: "#9ca3af", marginTop: 4, fontSize: 11 }}
                  >
                    {actor ? `${actor} · ` : ""}
                    {fmtDateTime(n?.created_at || n?.created || n?.date)}
                  </span>
                </div>
                {unread && (
                  <span
                    aria-label="Непрочитано"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: levelColor(n),
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                )}
              </li>
            );
          })
        )}

        {loadingMore && (
          <li className={classes.item} style={{ justifyContent: "center" }}>
            <span className={classes.count}>Загрузка…</span>
          </li>
        )}
      </ul>

      {/* «Прочитать все» — внизу, только когда есть непрочитанные уведомления */}
      {unreadCount > 0 && (
        <div className={classes.footer}>
          <button
            type="button"
            className={classes.markAllBtn}
            onClick={markAll}
            disabled={markingAllRead}
          >
            <CheckCheck size={16} />
            Прочитать все
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationModal;
