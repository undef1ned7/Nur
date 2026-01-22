// src/Components/Sectors/Autosalon/context/AutosalonContext.jsx
import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

// Начальные данные
const INITIAL_DATA = [
  { id: 1, client: "Иванов Иван", phone: "+7 777 123 4567", car: "Toyota Camry", price: 3500000, service: 150000, date: "2026-01-15", status: "sold" },
  { id: 2, client: "Петров Петр", phone: "+7 777 234 5678", car: "BMW X5", price: 8500000, service: 250000, date: "2026-01-16", status: "reserved" },
  { id: 3, client: "Сидоров Сидор", phone: "+7 777 345 6789", car: "Mercedes E-Class", price: 7200000, service: 200000, date: "2026-01-17", status: "sold" },
  { id: 4, client: "Козлов Андрей", phone: "+7 777 456 7890", car: "Hyundai Tucson", price: 3200000, service: 100000, date: "2026-01-18", status: "available" },
  { id: 5, client: "Николаев Николай", phone: "+7 777 567 8901", car: "Kia Sportage", price: 2900000, service: 80000, date: "2026-01-18", status: "reserved" },
  { id: 6, client: "Александров Алекс", phone: "+7 777 678 9012", car: "Lexus RX 350", price: 9100000, service: 300000, date: "2026-01-19", status: "sold" },
  { id: 7, client: "Михайлов Михаил", phone: "+7 777 789 0123", car: "Toyota RAV4", price: 4100000, service: 120000, date: "2026-01-19", status: "sold" },
  { id: 8, client: "Дмитриев Дмитрий", phone: "+7 777 890 1234", car: "Audi Q7", price: 8800000, service: 280000, date: "2026-01-20", status: "available" },
  { id: 9, client: "Сергеев Сергей", phone: "+7 777 901 2345", car: "Honda CR-V", price: 3800000, service: 110000, date: "2026-01-20", status: "sold" },
  { id: 10, client: "Алексеев Алексей", phone: "+7 777 012 3456", car: "Volkswagen Tiguan", price: 3600000, service: 95000, date: "2026-01-20", status: "sold" },
];

const AutosalonContext = createContext(null);

export const AutosalonProvider = ({ children }) => {
  const [data, setData] = useState(INITIAL_DATA);

  // Получить следующий ID
  const getNextId = useCallback(() => {
    return Math.max(...data.map(d => d.id), 0) + 1;
  }, [data]);

  // Добавить запись
  const addRecord = useCallback((record) => {
    setData(prev => [...prev, { ...record, id: record.id || getNextId() }]);
  }, [getNextId]);

  // Обновить запись
  const updateRecord = useCallback((id, updates) => {
    setData(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  // Удалить запись
  const deleteRecord = useCallback((id) => {
    setData(prev => prev.filter(item => item.id !== id));
  }, []);

  // Удалить несколько записей
  const deleteRecords = useCallback((ids) => {
    setData(prev => prev.filter(item => !ids.includes(item.id)));
  }, []);

  // Статистика
  const stats = useMemo(() => {
    const sold = data.filter(d => d.status === "sold");
    const reserved = data.filter(d => d.status === "reserved");
    const available = data.filter(d => d.status === "available");
    
    const totalRevenue = sold.reduce((sum, d) => sum + (d.price || 0), 0);
    const totalService = data.reduce((sum, d) => sum + (d.service || 0), 0);
    
    return {
      total: data.length,
      soldCount: sold.length,
      reservedCount: reserved.length,
      availableCount: available.length,
      totalRevenue,
      totalService,
      avgCheck: sold.length ? totalRevenue / sold.length : 0,
    };
  }, [data]);

  // Аналитика по маркам
  const brandStats = useMemo(() => {
    const sold = data.filter(d => d.status === "sold");
    const byBrand = new Map();
    
    sold.forEach(d => {
      const brand = d.car?.split(" ")[0] || "Другое";
      const prev = byBrand.get(brand) || { count: 0, sum: 0 };
      byBrand.set(brand, { 
        count: prev.count + 1, 
        sum: prev.sum + (d.price || 0) 
      });
    });
    
    return Array.from(byBrand, ([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.sum - a.sum);
  }, [data]);

  // Аналитика по датам (для графика)
  const dailyStats = useMemo(() => {
    const sold = data.filter(d => d.status === "sold");
    const byDate = new Map();
    
    sold.forEach(d => {
      const date = d.date || "unknown";
      const prev = byDate.get(date) || { count: 0, sum: 0 };
      byDate.set(date, { 
        count: prev.count + 1, 
        sum: prev.sum + (d.price || 0) 
      });
    });
    
    return Array.from(byDate, ([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Клиенты (уникальные)
  const clients = useMemo(() => {
    const clientMap = new Map();
    data.forEach(d => {
      if (d.client && !clientMap.has(d.client)) {
        clientMap.set(d.client, {
          id: d.id,
          client: d.client,
          phone: d.phone,
          car: d.car,
          price: d.price,
          date: d.date,
        });
      }
    });
    return Array.from(clientMap.values());
  }, [data]);

  const value = {
    data,
    setData,
    addRecord,
    updateRecord,
    deleteRecord,
    deleteRecords,
    getNextId,
    stats,
    brandStats,
    dailyStats,
    clients,
  };

  return (
    <AutosalonContext.Provider value={value}>
      {children}
    </AutosalonContext.Provider>
  );
};

export const useAutosalon = () => {
  const context = useContext(AutosalonContext);
  if (!context) {
    throw new Error("useAutosalon must be used within AutosalonProvider");
  }
  return context;
};

export default AutosalonContext;
