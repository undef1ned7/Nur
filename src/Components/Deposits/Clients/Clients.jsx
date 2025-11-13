import React, { useState, useEffect } from "react";
import { Search, MoreVertical, X, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchClientsAsync,
  createClientAsync,
  updateClientAsync,
  deleteClientAsync,
} from "../../../store/creators/clientCreators";
import { clearClients, useClient } from "../../../store/slices/ClientSlice"; // 👈 регистр тот же, что в store
import "./Clients.scss"; // 🔄 подключаем тот же SCSS, что и у Employee
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import Suppliers from "../../Contact/Suppliers/Suppliers";
import ContactClient from "../../Contact/ContactClient/ContactClient";
import Implementers from "../../Contact/Implementers/Implementers";
import { useUser } from "../../../store/slices/userSlice";

/* ---------- EditModal ---------- */
const EditModal = ({ client, onClose }) => {
  const dispatch = useDispatch();
  const { updating, updateError, deleting, deleteError } = useSelector(
    (s) => s.client
  );

  const [edited, setEdited] = useState({
    full_name: client.full_name,
    phone: client.phone,
    status: client.status,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEdited((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    const { full_name, phone, status } = edited;
    if (!full_name || !phone || !status) return alert("Заполните все поля.");
    try {
      await dispatch(
        updateClientAsync({ clientId: client.id, updatedData: edited })
      ).unwrap();
      onClose();
    } catch {
      alert("Ошибка обновления клиента");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Удалить клиента?")) return;
    try {
      await dispatch(deleteClientAsync(client.id)).unwrap();
      onClose();
    } catch {
      alert("Ошибка удаления клиента");
    }
  };

  const statusOptions = [
    { value: "new", label: "Новый" },
    { value: "contacted", label: "Контакт установлен" },
    { value: "interested", label: "Заинтересован" },
    { value: "converted", label: "Конвертирован" },
    { value: "inactive", label: "Неактивный" },
    { value: "lost", label: "Потерян" },
  ];

  return (
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Клиент №{client.id}</h3>
          <X size={18} onClick={onClose} className="edit-modal__close-icon" />
        </div>

        <div className="edit-modal__section">
          <label>ФИО *</label>
          <input
            name="full_name"
            value={edited.full_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="edit-modal__section">
          <label>Телефон *</label>
          <input
            name="phone"
            value={edited.phone}
            onChange={handleChange}
            required
          />
        </div>
        <div className="edit-modal__section">
          <label>Статус *</label>
          <select
            name="status"
            value={edited.status}
            onChange={handleChange}
            required
          >
            <option value="">Выберите статус</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {updateError && (
          <p className="edit-modal__error-message">{String(updateError)}</p>
        )}
        {deleteError && (
          <p className="edit-modal__error-message">{String(deleteError)}</p>
        )}

        <div className="edit-modal__footer">
          <button onClick={handleDelete} disabled={deleting || updating}>
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button onClick={handleSave} disabled={updating || deleting}>
            {updating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- Main table ---------- */
export default function ClientsTable() {
  const { company } = useUser();
  const [activeTab, setActiveTab] = useState(1);
  const tabs = [
    {
      label: "Клиенты",
      content: <ContactClient />,
    },
    {
      label: "Поставщики",
      content: <Suppliers />,
    },
    ...(company?.sector?.name === "Гостиница"
      ? []
      : [
          {
            label: "Реализаторы",
            content: <Implementers />,
          },
        ]),
  ];

  const navigate = useNavigate();
  return (
    <div className="employee">
      <div className="vitrina__header" style={{ margin: "15px 0" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => {
            return (
              <span
                className={`vitrina__tab ${
                  index === activeTab && "vitrina__tab--active"
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
              // <button onClick={() => setActiveTab(index)}>{tab.label}</button>
            );
          })}
        </div>
      </div>
      <div>{tabs[activeTab].content}</div>
      {/* top bar */}
    </div>
  );
}
