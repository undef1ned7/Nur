// src/components/Autosalon/Table/Table.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import "./Table.scss";
import { useAutosalon } from "../context/AutosalonContext";

const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("ru-RU");
};

const STATUS_LABELS = {
  available: "В наличии",
  reserved: "Забронирован",
  sold: "Продан",
};

const STATUS_OPTIONS = [
  { value: "available", label: "В наличии" },
  { value: "reserved", label: "Забронирован" },
  { value: "sold", label: "Продан" },
];

// Редактируемая ячейка
const EditableCell = ({ value, onChange, placeholder = "", type = "text", onStartEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    if (onStartEdit) onStartEdit();
  };

  const handleBlur = () => {
    setIsEditing(false);
    const finalValue = type === "number" ? (Number(tempValue) || 0) : tempValue;
    if (finalValue !== value) {
      onChange(finalValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleBlur();
    }
    if (e.key === "Escape") {
      setTempValue(value);
      setIsEditing(false);
    }
  };

  let displayValue = value || "";
  if (type === "number") {
    displayValue = value ? fmtMoney(value) : "";
  } else if (type === "date") {
    displayValue = formatDate(value);
  }

  return (
    <div className="as-excel__cellWrapper" onDoubleClick={handleDoubleClick}>
      {isEditing ? (
        <input
          ref={inputRef}
          className="as-excel__cellInput"
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      ) : (
        <span className="as-excel__cellText">
          {displayValue || <span className="as-excel__placeholder">{placeholder || "—"}</span>}
        </span>
      )}
    </div>
  );
};

// Ячейка статуса
const StatusCell = ({ value, onChange, onStartEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    if (onStartEdit) onStartEdit();
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    setIsEditing(false);
  };

  const statusClass = {
    available: "as-excel__status--available",
    reserved: "as-excel__status--reserved",
    sold: "as-excel__status--sold",
  };

  return (
    <div className="as-excel__cellWrapper" onDoubleClick={handleDoubleClick}>
      {isEditing ? (
        <select
          ref={selectRef}
          className="as-excel__cellInput as-excel__cellSelect"
          value={value}
          onChange={handleChange}
          onBlur={() => setIsEditing(false)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <span className={`as-excel__status ${statusClass[value] || ""}`}>
          {STATUS_LABELS[value] || value}
        </span>
      )}
    </div>
  );
};

// Создать пустую строку
const createEmptyRow = (id) => ({
  id,
  client: "",
  phone: "",
  car: "",
  price: 0,
  service: 0,
  date: new Date().toISOString().split('T')[0],
  status: "available",
});

export default function AutosalonTable() {
  const { data, setData, stats } = useAutosalon();
  
  const [localData, setLocalData] = useState(() => {
    const maxId = Math.max(...data.map(c => c.id), 0);
    return [...data, createEmptyRow(maxId + 1)];
  });
  
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Синхронизация с контекстом (без пустой строки)
  useEffect(() => {
    const realData = localData.filter(d => d.client || d.car || d.phone);
    setData(realData);
  }, [localData, setData]);

  // Фильтрация
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = localData.slice();

    const lastRow = base[base.length - 1];
    const isLastEmpty = !lastRow.client && !lastRow.phone && !lastRow.car && !lastRow.service;
    
    if (isLastEmpty) {
      base = base.slice(0, -1);
    }

    if (t) {
      base = base.filter((r) =>
        [r.client, r.phone, r.car]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }

    if (statusFilter) {
      base = base.filter((r) => r.status === statusFilter);
    }

    if (!t && !statusFilter && isLastEmpty) {
      base.push(lastRow);
    }

    return base;
  }, [localData, q, statusFilter]);

  // Локальная статистика
  const localStats = useMemo(() => {
    const realData = localData.filter(c => c.client || c.car);
    const available = realData.filter((c) => c.status === "available").length;
    const reserved = realData.filter((c) => c.status === "reserved").length;
    const sold = realData.filter((c) => c.status === "sold").length;
    const total = realData.length;
    return { available, reserved, sold, total };
  }, [localData]);

  // Итог по услугам
  const serviceTotal = useMemo(() => {
    const realData = localData.filter(c => c.client || c.car);
    return realData.reduce((sum, car) => sum + (car.service || 0), 0);
  }, [localData]);

  // Обновление ячейки
  const updateCell = (id, field, value) => {
    setLocalData((prev) =>
      prev.map((car) => (car.id === id ? { ...car, [field]: value } : car))
    );
  };

  // При редактировании последней строки
  const handleStartEditLastRow = (carId) => {
    const lastCar = localData[localData.length - 1];
    if (lastCar && lastCar.id === carId) {
      const newId = Math.max(...localData.map((c) => c.id), 0) + 1;
      setLocalData((prev) => [...prev, createEmptyRow(newId)]);
    }
  };

  // Удаление выбранных
  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setLocalData((prev) => {
      const filtered = prev.filter((car) => !selectedRows.has(car.id));
      const last = filtered[filtered.length - 1];
      if (last && (last.client || last.phone || last.car || last.service)) {
        const newId = Math.max(...filtered.map((c) => c.id), 0) + 1;
        return [...filtered, createEmptyRow(newId)];
      }
      return filtered;
    });
    setSelectedRows(new Set());
  };

  // Выбор строки
  const toggleRowSelection = (id) => {
    const lastCar = localData[localData.length - 1];
    if (lastCar && lastCar.id === id && !lastCar.client && !lastCar.car) return;

    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Выбрать все
  const toggleSelectAll = () => {
    const selectableCars = filtered.filter(c => c.client || c.car);
    if (selectedRows.size === selectableCars.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectableCars.map((c) => c.id)));
    }
  };

  // Проверка - последняя пустая строка?
  const isLastEmptyRow = (car) => {
    const lastCar = localData[localData.length - 1];
    return lastCar && lastCar.id === car.id && !car.client && !car.phone && !car.car && !car.service;
  };

  return (
    <section className="as-excel">
      <header className="as-excel__header">
        <div>
          <h2 className="as-excel__title">Таблица продаж</h2>
          <p className="as-excel__subtitle">Двойной клик для редактирования · Данные синхронизированы с аналитикой</p>
        </div>

        <div className="as-excel__actions">
          <div className="as-excel__search">
            <span className="as-excel__searchIcon">🔎</span>
            <input
              className="as-excel__searchInput"
              placeholder="Поиск..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {selectedRows.size > 0 && (
            <button
              className="as-excel__btn as-excel__btn--danger"
              onClick={deleteSelectedRows}
            >
              Удалить ({selectedRows.size})
            </button>
          )}
        </div>
      </header>

      {/* Статистика */}
      <div className="as-excel__stats">
        <button
          className={`as-excel__statCard ${statusFilter === "available" ? "as-excel__statCard--active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "available" ? "" : "available")}
          type="button"
        >
          <div className="as-excel__statValue">{localStats.available}</div>
          <div className="as-excel__statLabel">В наличии</div>
        </button>
        <button
          className={`as-excel__statCard as-excel__statCard--reserved ${statusFilter === "reserved" ? "as-excel__statCard--active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "reserved" ? "" : "reserved")}
          type="button"
        >
          <div className="as-excel__statValue">{localStats.reserved}</div>
          <div className="as-excel__statLabel">Забронировано</div>
        </button>
        <button
          className={`as-excel__statCard as-excel__statCard--sold ${statusFilter === "sold" ? "as-excel__statCard--active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "sold" ? "" : "sold")}
          type="button"
        >
          <div className="as-excel__statValue">{localStats.sold}</div>
          <div className="as-excel__statLabel">Продано</div>
        </button>
        <button
          className={`as-excel__statCard as-excel__statCard--total ${statusFilter === "" ? "as-excel__statCard--active" : ""}`}
          onClick={() => setStatusFilter("")}
          type="button"
        >
          <div className="as-excel__statValue">{localStats.total}</div>
          <div className="as-excel__statLabel">Всего</div>
        </button>
      </div>

      {/* Таблица */}
      <div className="as-excel__tableWrap">
        <table className="as-excel__table">
          <thead>
            <tr>
              <th className="as-excel__thCheck">
                <input
                  type="checkbox"
                  checked={filtered.filter(c => c.client || c.car).length > 0 && selectedRows.size === filtered.filter(c => c.client || c.car).length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="as-excel__thNum">#</th>
              <th>Клиент</th>
              <th>Номер клиента</th>
              <th>Машина</th>
              <th>Цена</th>
              <th>Услуга</th>
              <th>Дата</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="as-excel__empty">
                  Нет данных
                </td>
              </tr>
            ) : (
              filtered.map((car, index) => {
                const isLast = isLastEmptyRow(car);
                return (
                  <tr
                    key={car.id}
                    className={`as-excel__row ${selectedRows.has(car.id) ? "as-excel__row--selected" : ""} ${isLast ? "as-excel__row--new" : ""}`}
                  >
                    <td className="as-excel__cellCheck">
                      {!isLast && (
                        <input
                          type="checkbox"
                          checked={selectedRows.has(car.id)}
                          onChange={() => toggleRowSelection(car.id)}
                        />
                      )}
                    </td>
                    <td className="as-excel__cellNum">{isLast ? "+" : index + 1}</td>
                    <td className="as-excel__cell">
                      <EditableCell
                        value={car.client}
                        onChange={(val) => updateCell(car.id, "client", val)}
                        placeholder={isLast ? "Введите клиента..." : "Клиент"}
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell">
                      <EditableCell
                        value={car.phone}
                        onChange={(val) => updateCell(car.id, "phone", val)}
                        placeholder="+7 777 000 0000"
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell">
                      <EditableCell
                        value={car.car}
                        onChange={(val) => updateCell(car.id, "car", val)}
                        placeholder="Марка Модель"
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell as-excel__cell--price">
                      <EditableCell
                        value={car.price}
                        onChange={(val) => updateCell(car.id, "price", val)}
                        placeholder="0"
                        type="number"
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell as-excel__cell--service">
                      <EditableCell
                        value={car.service}
                        onChange={(val) => updateCell(car.id, "service", val)}
                        placeholder="0"
                        type="number"
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell as-excel__cell--date">
                      <EditableCell
                        value={car.date}
                        onChange={(val) => updateCell(car.id, "date", val)}
                        placeholder="Дата"
                        type="date"
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                    <td className="as-excel__cell">
                      <StatusCell
                        value={car.status}
                        onChange={(val) => updateCell(car.id, "status", val)}
                        onStartEdit={() => handleStartEditLastRow(car.id)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Итог */}
      <div className="as-excel__summary">
        <span className="as-excel__summaryLabel">Итого услуг:</span>
        <span className="as-excel__summaryValue">{fmtMoney(serviceTotal)}</span>
      </div>

      <div className="as-excel__footer">
        <span className="as-excel__footerInfo">
          Всего: {localStats.total} записей
          {selectedRows.size > 0 && ` · Выбрано: ${selectedRows.size}`}
        </span>
        <span className="as-excel__footerHint">
          Enter — сохранить · Esc — отмена
        </span>
      </div>
    </section>
  );
}
