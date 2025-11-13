// Raspisanie.jsx
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import "./Raspisanie.scss";
import { Plus, X } from "lucide-react";
import { fetchEmployeesAsync } from "../../../store/creators/employeeCreators";
import {
  fetchEventsAsync,
  createEventAsync,
  updateEventAsync,
} from "../../../store/creators/eventsCreators";
import AddModal from "../AddModal/AddModal";

const EditModal = ({ eventData, onClose, onSave, isLoading, error }) => {
  const [title, setTitle] = useState(eventData?.title || "");
  const [datetime, setDatetime] = useState(
    eventData ? eventData.datetime.slice(0, 16) : ""
  );
  const [employeeId, setEmployeeId] = useState(eventData?.employee || "");

  const dispatch = useDispatch();
  const { list: employees } = useSelector((state) => state.employee);

  useEffect(() => {
    const params = { page: 1, search: "" };
    dispatch(fetchEmployeesAsync(params));
  }, [dispatch]);

  const handleSubmit = () => {
    if (!title || !datetime) {
      alert("Пожалуйста, заполните все обязательные поля.");
      return;
    }

    const updatedEventData = {
      id: eventData.id,
      title,
      datetime: datetime + ":00Z",
      company: 1,
      participants: employeeId ? [employeeId] : [],
      notes: "Изменено через календарь",
    };

    onSave(updatedEventData);
  };

  return (
    <div className="edit-modal">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Редактирование события</h3>
          <X className="edit-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="edit-modal__section">
          <label>Название</label>
          <input
            type="text"
            className="edit-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="edit-modal__section">
          <label>Дата и Время</label>
          <input
            type="datetime-local"
            className="edit-modal__input"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>

        <div className="edit-modal__section">
          <label>Сотрудник</label>
          <select
            className="edit-modal__input"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Выберите сотрудника</option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>
        </div>

        <div className="edit-modal__footer">
          <button
            className="edit-modal__cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            className="edit-modal__save"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Сохраняем..." : "Сохранить изменения"}
          </button>
        </div>

        {error && <p className="edit-modal__error-message">Ошибка: {error}</p>}
      </div>
    </div>
  );
};

export default function Raspisanie() {
  const dispatch = useDispatch();
  const { list: events, creating, createError } = useSelector((s) => s.event);
  const calendarRef = useRef(null);
  const { employees } = useSelector((state) => state.employee);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // 👈 новый стейт
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null); // 👈 данные для редактирования

  useEffect(() => {
    dispatch(fetchEventsAsync());
  }, [dispatch]);

  const mappedEvents = events.map((e) => {
    const hasTime = e.datetime.includes("T"); // проверяем, есть ли время
    return {
      id: e.id,
      title: e.title,
      start: e.datetime, // должно быть ISO: "2025-08-29T09:00:00Z"
      allDay: !hasTime, // если только дата без времени → целый день
      employee: e.participants?.[0] || null,
    };
  });

  const handleDateClick = (info) => {
    setSelectedDate(info.dateStr);
    setShowAddModal(true);
  };

  const handleSave = async (data) => {
    try {
      if (data.id) {
        // тут вместо createEventAsync можно подключить updateEventAsync
        await dispatch(
          updateEventAsync({ eventId: data.id, updatedData: data })
        ).unwrap();
      } else {
        await dispatch(createEventAsync(data)).unwrap();
      }
      await dispatch(fetchEventsAsync()).unwrap();
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingEvent(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="raspisanie">
      <div className="raspisanie__header">
        <button onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Добавить событие
        </button>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ru"
        events={mappedEvents}
        dateClick={handleDateClick}
        eventClick={(info) => {
          setEditingEvent({
            id: info.event.id,
            title: info.event.title,
            datetime: info.event.startStr,
            employee: info.event.extendedProps.employee,
          });
          setShowEditModal(true);
        }}
        eventContent={(arg) => {
          const time = arg.event.allDay
            ? ""
            : format(new Date(arg.event.start), "HH:mm");
          console.log(arg.event.allDay);

          return (
            <div className="event-content">
              <div className="event-title">
                <b>{arg.event.title}</b>
              </div>
              {time && <span>{time}</span>}
            </div>
          );
        }}
        height="auto"
      />

      {showAddModal && (
        <AddModal
          initialDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSave={handleSave}
          isLoading={creating}
          error={createError}
        />
      )}

      {showEditModal && editingEvent && (
        <EditModal
          eventData={editingEvent}
          onClose={() => {
            setShowEditModal(false);
            setEditingEvent(null);
          }}
          onSave={handleSave}
          isLoading={creating}
          error={createError}
        />
      )}
    </div>
  );
}
