import { useCafeSync } from "../../../../hooks/useCafeSync";

export default function OfflineStatusBar() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    syncError,
    justSynced,
    syncQueue,
    lastFailed,
  } = useCafeSync();

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
      <div style={{ ...baseStyle, background: "#f97316", color: "white" }}>
        <span>⚠️</span>
        <span>
          Синхронизировано частично — {lastFailed.length} действий не
          применились. Проверьте заказы.
        </span>
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
