import React from "react";
import { X } from "lucide-react";
import classes from "./NotificationModal.module.scss";

const categories = [
  { id: 1, title: "Системные уведомления", count: 0, icon: "🧩" },
  { id: 2, title: "Задачи по проектам", count: 0, icon: "📊" },
  { id: 3, title: "Сообщения", count: 0, icon: "✉️" },
  { id: 4, title: "Задачи по сделкам", count: 0, icon: "🛒" },
  { id: 5, title: "Сделки", count: 0, icon: "📈" },
  { id: 6, title: "Электронная почта", count: 0, icon: "📧" },
  { id: 7, title: "Комментарии в задачах", count: 0, icon: "💬" },
];

const NotificationModal = ({ onClose }) => {
  return (
    <div className={classes.modal}>
      <div className={classes.header}>
        <h3>Центр уведомлений</h3>
        <X className={classes.close} onClick={onClose} size={20} />
      </div>
      <ul className={classes.list}>
        {categories.map((cat) => (
          <li key={cat.id} className={classes.item}>
            <div className={classes.icon}>{cat.icon}</div>
            <div className={classes.texts}>
              <span className={classes.title}>{cat.title}</span>
              <span className={classes.count}>Уведомлений: {cat.count}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationModal;
