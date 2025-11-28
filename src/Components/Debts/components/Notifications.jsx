export const Notifications = ({ notifications }) => {
  if (!notifications?.length) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      {notifications.map((notification, index) => (
        <div
          key={index}
          style={{
            background:
              notification.type === "error" ? "#fff1f2" : "#fef3c7",
            border:
              notification.type === "error"
                ? "1px solid #fecdd3"
                : "1px solid #fde68a",
            color: notification.type === "error" ? "#b91c1c" : "#92400e",
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 5,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ⚠️ {notification.message}
        </div>
      ))}
    </div>
  );
};
