import React from "react";
import { X, DollarSign, Receipt, Calendar } from "lucide-react";
import "./MenuModal.scss";

const MenuModal = ({ onClose, onAction }) => {
  const menuItems = [
    {
      id: "debt",
      icon: DollarSign,
      label: "Погасить долг",
    },
    {
      id: "receipts",
      icon: Receipt,
      label: "Журнал чеков",
    },
  ];

  return (
    <div className="menu-modal-overlay" onClick={onClose}>
      <div className="menu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="menu-modal__header">
          <h2 className="menu-modal__title">Меню</h2>
          <button className="menu-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="menu-modal__items">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="menu-modal__item"
                onClick={() => {
                  onAction(item.id);
                  onClose();
                }}
              >
                <Icon size={24} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MenuModal;
