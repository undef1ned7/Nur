import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
} from "../../../../api/notification";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/**
 * Задача №2 — Web-версия для агентов: ПОЛУЧЕНИЕ УВЕДОМЛЕНИЙ.
 *
 * Единственная функция агента, которой не было в вебе. Использует уже
 * существующее API уведомлений:
 *   GET  /main/notifications/            → { results: [...], count }
 *   POST /main/notifications/mark-all-read/
 *
 * Изолированный, адаптивный (dropdown ≤ 92vw → нет горизонтального скролла),
 * dark-aware (через токены --prod-* страницы Производства), read-only к остальному.
 */

const fmtDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("ru-RU");
};

const isUnread = (n) => !(n?.is_read ?? n?.read ?? false);

const AgentNotificationsBell = () => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  const unread = list.filter(isUnread).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNotifications();
      const items = Array.isArray(data) ? data : data?.results || [];
      setList(items);
    } catch (e) {
      setError(validateResErrors(e, "Не удалось загрузить уведомления"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Первичная загрузка + лёгкий поллинг каждые 60с
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      setList((l) => l.map((n) => ({ ...n, is_read: true, read: true })));
    } catch (e) {
      setError(validateResErrors(e, "Не удалось отметить прочитанными"));
    }
  };

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) load();
      return next;
    });
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Уведомления"
        title="Уведомления"
        style={{
          position: "relative",
          width: 42,
          height: 42,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          border: "1px solid var(--prod-border-strong, #dfe3ea)",
          background: "var(--prod-card, #fff)",
          color: "var(--prod-text, #0f172a)",
          cursor: "pointer",
        }}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "min(360px, 92vw)",
            maxHeight: "min(70vh, 480px)",
            display: "flex",
            flexDirection: "column",
            background: "var(--prod-card, #fff)",
            color: "var(--prod-text, #0f172a)",
            border: "1px solid var(--prod-border, #e9ecf1)",
            borderRadius: 16,
            boxShadow: "var(--prod-shadow-lg, 0 18px 50px rgba(15,23,42,0.14))",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "12px 14px",
              borderBottom: "1px solid var(--prod-border, #e9ecf1)",
            }}
          >
            <strong style={{ fontSize: 15 }}>
              Уведомления{unread > 0 ? ` · ${unread}` : ""}
            </strong>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={markAll}
                disabled={unread === 0}
                title="Прочитать все"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 30,
                  padding: "0 10px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid var(--prod-border-strong, #dfe3ea)",
                  background: "var(--prod-card, #fff)",
                  color: "var(--prod-text-2, #475569)",
                  cursor: unread === 0 ? "not-allowed" : "pointer",
                  opacity: unread === 0 ? 0.5 : 1,
                }}
              >
                <CheckCheck size={14} />
                Прочитать все
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                style={{
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "var(--prod-muted, #8a93a3)",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {error && (
              <div
                style={{
                  margin: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--prod-danger-soft, #fef2f2)",
                  color: "var(--prod-danger-ink, #b91c1c)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            {loading && list.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--prod-muted, #8a93a3)",
                  fontSize: 14,
                }}
              >
                Загрузка…
              </div>
            ) : list.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: "var(--prod-muted, #8a93a3)",
                  fontSize: 14,
                }}
              >
                Уведомлений нет
              </div>
            ) : (
              list.map((n, idx) => {
                const unreadItem = isUnread(n);
                const title =
                  n?.title || n?.verb || n?.subject || "Уведомление";
                const message =
                  n?.message || n?.description || n?.text || n?.body || "";
                return (
                  <div
                    key={n?.id ?? n?.uuid ?? idx}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--prod-border, #e9ecf1)",
                      background: unreadItem
                        ? "var(--prod-card-2, #fbfcfd)"
                        : "transparent",
                    }}
                  >
                    <span
                      style={{
                        marginTop: 6,
                        width: 8,
                        height: 8,
                        flex: "0 0 auto",
                        borderRadius: "50%",
                        background: unreadItem
                          ? "#ef4444"
                          : "var(--prod-border-strong, #dfe3ea)",
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: unreadItem ? 700 : 600,
                          color: "var(--prod-text, #0f172a)",
                        }}
                      >
                        {title}
                      </div>
                      {message && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--prod-text-2, #475569)",
                            marginTop: 2,
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}
                        >
                          {message}
                        </div>
                      )}
                      {(n?.created_at || n?.created || n?.date) && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--prod-muted, #8a93a3)",
                            marginTop: 4,
                          }}
                        >
                          {fmtDateTime(n.created_at || n.created || n.date)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentNotificationsBell;
