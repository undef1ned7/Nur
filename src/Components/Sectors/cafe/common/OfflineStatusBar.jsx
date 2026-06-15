import { useState, useEffect } from "react";
import { useCafeSync } from "../../../../hooks/useCafeSync";
import { removeQueueAction } from "../../../../services/cafeOfflineService";

function formatSyncError(error) {
  if (!error) return "Неизвестная ошибка";
  if (typeof error === "string") {
    const m = error.match(/string='([^']+)'/);
    if (m) return m[1];
    return error;
  }
  if (error?.detail) return String(error.detail);
  return JSON.stringify(error);
}

export default function OfflineStatusBar() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    syncError,
    justSynced,
    syncQueue,
    lastFailed: lastFailedFromHook,
  } = useCafeSync();

  const [lastFailed, setLastFailed] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLastFailed(lastFailedFromHook);
  }, [lastFailedFromHook]);

  if (
    isOnline &&
    !isSyncing &&
    !justSynced &&
    !syncError &&
    !(lastFailed?.length > 0)
  ) {
    return null;
  }

  const baseStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: "8px 16px",
    textAlign: "center",
    fontSize: "14px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  };

  if (isSyncing) {
    return (
      <div style={{ ...baseStyle, background: "#3b82f6", color: "white" }}>
        <span>⏳</span>
        <span>Синхронизация...</span>
      </div>
    );
  }

  if (justSynced) {
    return (
      <div style={{ ...baseStyle, background: "#22c55e", color: "white" }}>
        <span>✓</span>
        <span>Синхронизировано</span>
      </div>
    );
  }

  if (lastFailed && lastFailed.length > 0) {
    return (
      <div
        style={{
          ...baseStyle,
          background: "#f97316",
          color: "white",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>
            Синхронизировано частично — {lastFailed.length} действий не
            применились
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "1px solid white",
              color: "white",
              padding: "2px 8px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {expanded ? "Скрыть" : "Подробнее"}
          </button>
        </div>

        {expanded && (
          <div
            style={{
              background: "rgba(0,0,0,0.15)",
              borderRadius: 6,
              padding: 8,
              fontSize: 13,
            }}
          >
            {lastFailed.map((f, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                  borderBottom:
                    idx < lastFailed.length - 1
                      ? "1px solid rgba(255,255,255,0.2)"
                      : "none",
                }}
              >
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600 }}>{f.type}</div>
                  <div>{formatSyncError(f.error)}</div>
                </div>
                {f.queueItem?.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      await removeQueueAction(f.queueItem.id);
                      setLastFailed((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    style={{
                      background: "none",
                      border: "1px solid white",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                    title="Убрать это действие из очереди — оно не будет повторяться"
                  >
                    Убрать
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (syncError) {
    return (
      <div style={{ ...baseStyle, background: "#ef4444", color: "white" }}>
        <span>⚠️</span>
        <span>Ошибка синхронизации — </span>
        <button
          type="button"
          onClick={syncQueue}
          style={{
            background: "none",
            border: "1px solid white",
            color: "white",
            padding: "2px 8px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...baseStyle, background: "#f59e0b", color: "white" }}>
      <span>⚡</span>
      <span>
        Офлайн — работаем локально
        {pendingCount > 0 && ` · ${pendingCount} заказов ожидают синхронизации`}
      </span>
    </div>
  );
}
