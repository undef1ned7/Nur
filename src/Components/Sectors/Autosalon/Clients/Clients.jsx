// src/components/Autosalon/Clients/Clients.jsx
import React, { useMemo, useState } from "react";
import "./Clients.scss";
import { useAutosalon } from "../context/AutosalonContext";

const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";

export default function AutosalonClients() {
  const { data, clients } = useAutosalon();
  const [q, setQ] = useState("");

  // Фильтрация клиентов
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = data.filter(d => d.client); // Только записи с клиентами
    
    if (t) {
      base = base.filter((r) =>
        [r.client, r.phone, r.car]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }
    
    return base.sort((a, b) => 
      new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [data, q]);

  // Статистика
  const stats = useMemo(() => {
    const total = filtered.length;
    const totalPrice = filtered.reduce((sum, c) => sum + (c.price || 0), 0);
    return { total, totalPrice };
  }, [filtered]);

  return (
    <section className="as-clients">
      <header className="as-clients__header">
        <div>
          <h2 className="as-clients__title">Клиенты Автосалона</h2>
          <p className="as-clients__subtitle">Данные из таблицы продаж · {stats.total} клиентов</p>
        </div>

        <div className="as-clients__actions">
          <div className="as-clients__search">
            <span className="as-clients__searchIcon" aria-hidden>
              🔎
            </span>
            <input
              className="as-clients__searchInput"
              placeholder="Поиск по имени, телефону, авто…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск клиентов"
            />
          </div>
        </div>
      </header>

      {/* Статистика */}
      <div className="as-clients__stats">
        <div className="as-clients__statCard">
          <div className="as-clients__statValue">{stats.total}</div>
          <div className="as-clients__statLabel">Всего клиентов</div>
        </div>
        <div className="as-clients__statCard as-clients__statCard--green">
          <div className="as-clients__statValue">{fmtMoney(stats.totalPrice)}</div>
          <div className="as-clients__statLabel">Общая сумма</div>
        </div>
      </div>

      <div className="as-clients__tableWrap">
        <table className="as-clients__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Клиент</th>
              <th>Номер клиента</th>
              <th>Машина</th>
              <th>Цена</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="as-clients__empty" colSpan={6}>
                  Нет данных. Добавьте клиентов в таблице продаж.
                </td>
              </tr>
            ) : (
              filtered.map((c, index) => (
                <tr key={c.id}>
                  <td>{index + 1}</td>
                  <td className="as-clients__ellipsis" title={c.client}>
                    {c.client || "—"}
                  </td>
                  <td>{c.phone || "—"}</td>
                  <td className="as-clients__ellipsis" title={c.car}>
                    {c.car || "—"}
                  </td>
                  <td className="as-clients__price">{fmtMoney(c.price)}</td>
                  <td>{c.date || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Итог */}
      <div className="as-clients__summary">
        <span className="as-clients__summaryLabel">Итого:</span>
        <span className="as-clients__summaryValue">{fmtMoney(stats.totalPrice)}</span>
      </div>
    </section>
  );
}
