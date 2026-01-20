import React from "react";
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

const AlertModal = ({
  open,
  type = "success",
  title,
  message,
  okText = "Ok",
  onClose,
  onConfirm,
}) => {
  if (!open) return null;
  const styles = TYPE_STYLES[type] || TYPE_STYLES.info;
  const handle = onConfirm || onClose;

  return (
    <ReactPortal wrapperId="alert_modal">
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
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
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            padding: 24,
            zIndex: 1001,
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
            <CheckIcon />
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
            style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}
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
