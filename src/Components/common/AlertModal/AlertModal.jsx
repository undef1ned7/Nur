import React, { useEffect } from "react";
import ReactPortal from "../Portal/ReactPortal";

// Simple, reusable alert modal with types: success | error | warning | info
// Props:
// - open: boolean (render when true)
// - type: 'success' | 'error' | 'warning' | 'info'
// - title?: string
// - message: string
// - okText?: string
// - onClose: () => void
// - onConfirm?: () => void (defaults to onClose)
const TYPE_STYLES = {
  success: { bg: "#e8f7ef", color: "#1e8e3e", iconBg: "#22c55e" },
  error: { bg: "#fdecea", color: "#b42318", iconBg: "#ef4444" },
  warning: { bg: "#fff7e6", color: "#b25e09", iconBg: "#f59e0b" },
  info: { bg: "#eef6ff", color: "#1d4ed8", iconBg: "#3b82f6" },
};

const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 6L9 17L4 12"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 6L6 18M6 6l12 12"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ExclamationIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 6v8M12 18h.01"
      stroke="#fff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InfoIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 11v7M12 6h.01"
      stroke="#fff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Иконка зависит от типа: раньше для ошибок тоже показывалась галочка (QA B26)
const TYPE_ICONS = {
  success: CheckIcon,
  error: CrossIcon,
  warning: ExclamationIcon,
  info: InfoIcon,
};

const AlertModal = ({
  open,
  type = "success",
  title,
  message,
  okText = "Ok",
  onClose,
  onConfirm,
}) => {
  const styles = TYPE_STYLES[type] || TYPE_STYLES.info;
  const Icon = TYPE_ICONS[type] || InfoIcon;
  const handle = onConfirm || onClose;
  const ALERT_Z_INDEX = 100000;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      // Escape — всегда закрытие (не подтверждение): иначе в окнах
      // «Подтверждение удаления» Escape запускал удаление.
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handle?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handle, onClose]);

  if (!open) return null;

  return (
    <ReactPortal wrapperId="alert_modal">
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: ALERT_Z_INDEX,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "relative",
            width: "min(420px, 92vw)",
            margin: "10vh auto 0",
            maxHeight: "500px",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            padding: 24,
            overflowY: "auto",
            zIndex: ALERT_Z_INDEX + 1,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: styles.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Icon />
          </div>
          {title ? (
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {title}
            </h3>
          ) : null}
          <p
            style={{
              whiteSpace: "pre-wrap",
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "#111827",
            }}
          >
            {message}
          </p>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={handle}
              style={{
                background: "#f7d617",
                color: "#000",
                border: "1px solid #00000033",
                fontWeight: 600,
                fontSize: 16,
                borderRadius: 8,
                padding: "10px 24px",
                cursor: "pointer",
                minWidth: 96,
              }}
            >
              {okText}
            </button>
          </div>
        </div>
      </div>
    </ReactPortal>
  );
};

export default AlertModal;
