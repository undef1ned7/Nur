// kassa.jsx (App с роутером и сайдбаром)

import { useEffect, useMemo, useState } from "react";

// страницы

// аналитика
import api from "../../../../api";
import Analytics from "./Analytics";

// ---------- Аналитика ----------
export const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [halls, setHalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  const asArray = (data) =>
    Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [hRes, rRes, bRes] = await Promise.all([
        api.get("/booking/hotels/"),
        api.get("/booking/rooms/"),
        api.get("/booking/bookings/"),
      ]);
      setHotels(asArray(hRes.data));
      setHalls(asArray(rRes.data));
      setBookings(asArray(bRes.data));
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    );
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const inRange = (iso, a, b) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= a && d <= b;
    };
    const today = bookings.filter((b) =>
      inRange(b.start_time, startOfToday, endOfToday)
    ).length;
    const week = bookings.filter((b) =>
      inRange(b.start_time, now, weekAhead)
    ).length;

    return [
      { key: "hotels", label: "Гостиницы", value: hotels.length },
      { key: "halls", label: "Залы", value: halls.length },
      { key: "bookings", label: "Все брони", value: bookings.length },
      { key: "today", label: "Сегодня", value: today },
      { key: "week", label: "7 дней", value: week },
    ];
  }, [hotels, halls, bookings]);

  return (
    <div>
      {error && (
        <div
          style={{
            color: "#b91c1c",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <Analytics loading={loading} items={metrics} />
    </div>
  );
};
