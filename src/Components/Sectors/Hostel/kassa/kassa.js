import React, { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from "react-router-dom";
import api from "../../../../api";
import Reports from "../Reports/Reports";
import { getAll as getAllClients } from "../Clients/clientStore";
import "./kassa.scss";

/* ──────────────────────────────── Базовый путь */
const BASE = "/crm/hostel/kassa";

/* helpers */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const listFrom = (res) => res?.data?.results || res?.data || [];
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const whenDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const toNum = (x) => Number(String(x).replace(",", ".")) || 0;
const numStr = (n) => String(Number(n) || 0).replace(",", ".");
const toLocal = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

// НЕОПЛАЧЕН = любой, КРОМЕ paid / отменён / закрыт
const isUnpaidStatus = (s) => {
  const v = (s || "").toString().trim().toLowerCase();
  return ![
    "paid",
    "оплачен",
    "оплачено",
    "canceled",
    "cancelled",
    "отменён",
    "отменен",
    "closed",
    "done",
    "completed",
    "завершено",
  ].includes(v);
};

/* ───────────────────────────────────────────────── */
const Kassa = () => (
  <Routes>
    <Route index element={<CashboxList />} />
    <Route path="pay" element={<CashboxPayment />} />
    <Route path="reports" element={<CashboxReports />} />
    <Route path=":id" element={<CashboxDetail />} />
  </Routes>
);

/* Верхние вкладки */
const HeaderTabs = () => {
  const { pathname } = useLocation();

  // точные проверки активной вкладки под BASE
  const isPath = (p) => pathname === p || pathname === `${p}/`;

  const isList = isPath(BASE);
  const isReports = isPath(`${BASE}/reports`);
  const isPay = isPath(`${BASE}/pay`);

  return (
    <div className="kassa__header">
      <div className="kassa__tabs">
        <Link
          className={`kassa__tab ${isList ? "kassa__tab--active" : ""}`}
          to={BASE}
        >
          Кассы
        </Link>
        <Link
          className={`kassa__tab ${isPay ? "kassa__tab--active" : ""}`}
          to={`${BASE}/pay`}
        >
          Оплата
        </Link>
        <Link
          className={`kassa__tab ${isReports ? "kassa__tab--active" : ""}`}
          to={`${BASE}/reports`}
        >
          Отчёты
        </Link>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Список касс */
const CashboxList = () => {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const { data } = await api.get("/construction/cashboxes/");
      setRows(asArray(data));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.department_name, r.name].some((x) =>
        String(x || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [rows, q]);

  const onCreate = async () => {
    const title = (name || "").trim();
    if (!title) return alert("Введите название кассы");
    try {
      await api.post("/construction/cashboxes/", { name: title });
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      console.error(e);
      alert("Не удалось создать кассу");
    }
  };

  return (
    <div className="kassa">
      <HeaderTabs />

      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">Всего: {filtered.length}</span>
        </div>

        <div className="kassa__controls">
          <div className="kassa__searchWrap">
            <input
              className="kassa__input"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="kassa__btn kassa__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            Создать кассу
          </button>
        </div>
      </div>

      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              {/* без ID — только название */}
              <th>Касса</th>
              <th>Приход</th>
              <th>Расход</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка…</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((r) => (
                <tr
                  key={r.id || r.uuid}
                  className="kassa__rowClickable"
                  onClick={() => navigate(`${BASE}/${r.id || r.uuid}`)}
                >
                  <td>
                    <b>{r.department_name || r.name || "—"}</b>
                  </td>
                  <td>{money(r.analytics?.income?.total || 0)}</td>
                  <td>{money(r.analytics?.expense?.total || 0)}</td>
                  <td>
                    <button
                      className="kassa__btn kassa__btn--secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${BASE}/${r.id || r.uuid}`);
                      }}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="kassa__center">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="kassa-modal">
          <div
            className="kassa-modal__overlay"
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3 className="kassa-modal__title">Создать кассу</h3>
              <button
                className="kassa-modal__close"
                onClick={() => setCreateOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Название кассы *</label>
              <input
                className="kassa-modal__input"
                type="text"
                placeholder="Например: касса №1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="kassa-modal__footer">
              <button
                className="kassa__btn kassa__btn--primary"
                onClick={onCreate}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────── Вкладка ОПЛАТА (ТОЛЬКО БРОНИ) */
const CashboxPayment = () => {
  const [boxes, setBoxes] = useState([]);
  const [boxId, setBoxId] = useState("");

  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);

  const [clients, setClients] = useState([]); // для назначения

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [payingId, setPayingId] = useState("");

  const nightsBetween = (a, b) => {
    if (!a || !b) return 1;
    const ms = new Date(b) - new Date(a);
    const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
    return Math.max(1, d);
  };

  const priceByBooking = (b) => {
    if (Number(b.total)) return Number(b.total);
    const nights = nightsBetween(b.start_time, b.end_time);
    let price = 0;
    if (b.hotel) {
      const h = hotels.find((x) => String(x.id) === String(b.hotel));
      price = Number(h?.price) || 0;
    } else if (b.room) {
      const r = rooms.find((x) => String(x.id) === String(b.room));
      price = Number(r?.price) || 0;
    } else if (b.bed) {
      const bed = beds.find((x) => String(x.id) === String(b.bed));
      price = (Number(bed?.price) || 0) * Math.max(1, Number(b.qty) || 1);
    }
    return nights * price;
  };

  const bookingLabel = (b) => {
    if (b.hotel) {
      const h = hotels.find((x) => String(x.id) === String(b.hotel));
      return `Комната: ${h?.name || b.hotel}`;
    }
    if (b.room) {
      const r = rooms.find((x) => String(x.id) === String(b.room));
      return `Зал: ${r?.name || b.room}`;
    }
    const bed = beds.find((x) => String(x.id) === String(b.bed));
    const qty = Math.max(1, Number(b.qty) || 1);
    return `Койко-место: ${bed?.name || b.bed}${qty ? ` × ${qty}` : ""}`;
  };

  const clientName = (id) => {
    const c = clients.find((x) => String(x.id) === String(id));
    return c?.full_name || c?.name || "";
  };
  const purposeText = (b) => {
    const p = (b.purpose || "").trim();
    if (p) return p;
    const n = clientName(b.client);
    if (n) return `Клиент: ${n}`;
    if (b.client) return `Клиент #${b.client}`;
    return "Без назначения";
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [boxesRes, bookRes, hRes, rRes, bedsRes] = await Promise.all([
        api.get("/construction/cashboxes/").catch(() => ({ data: [] })),
        api.get("/booking/bookings/"),
        api.get("/booking/hotels/"),
        api.get("/booking/rooms/"),
        api.get("/booking/beds/"),
      ]);

      const boxesArr = asArray(boxesRes.data);
      setBoxes(boxesArr);
      setBoxId(boxesArr[0]?.id || boxesArr[0]?.uuid || "");

      setHotels(listFrom(hRes) || []);
      setRooms(listFrom(rRes) || []);
      setBeds(listFrom(bedsRes) || []);

      const allBookings = listFrom(bookRes) || [];
      setBookings(
        allBookings
          .filter((b) => isUnpaidStatus(b.status))
          .map((b) => ({
            id: b.id,
            hotel: b.hotel ?? null,
            room: b.room ?? null,
            bed: b.bed ?? null,
            qty: Number(b.qty ?? 1) || 1,
            start_time: b.start_time || "",
            end_time: b.end_time || "",
            client: b.client ?? null,
            purpose: b.purpose || "",
            total: Number(b.total) || 0,
            status: b.status || "created",
          }))
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshClients = async () => {
    try {
      const list = await getAllClients();
      setClients(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("clients load error", e);
      setClients([]);
    }
  };

  useEffect(() => {
    loadAll();
    refreshClients();
  }, []);
  useEffect(() => {
    const onRefresh = () => {
      loadAll();
      refreshClients();
    };
    window.addEventListener("bookings:refresh", onRefresh);
    return () => window.removeEventListener("bookings:refresh", onRefresh);
  }, []);

  const markBookingPaid = async (id) => {
    try {
      await api.post(`/booking/bookings/${id}/pay/`);
      return true;
    } catch {}
    try {
      await api.patch(`/booking/bookings/${id}/`, { status: "paid" });
      return true;
    } catch {}
    return false;
  };

  const payBooking = async (b) => {
    if (!boxId) {
      alert(
        "Создайте кассу в разделе «Кассы» и выберите её для приёма оплаты."
      );
      return;
    }
    const total = priceByBooking(b) || 0;
    const label = `Оплата брони — ${bookingLabel(b)}`;

    if (!window.confirm(`Провести оплату на сумму ${money(total)} ?`)) return;

    setPayingId(String(b.id));
    try {
      await api.post("/construction/cashflows/", {
        cashbox: boxId,
        type: "income",
        name: label,
        amount: numStr(total),
      });

      const ok = await markBookingPaid(b.id);
      if (!ok) {
        alert("Не удалось пометить бронь как оплаченную.");
        return;
      }

      try {
        await api.delete(`/booking/bookings/${b.id}/`);
      } catch {}

      setBookings((prev) => prev.filter((x) => String(x.id) !== String(b.id)));

      try {
        window.dispatchEvent(new CustomEvent("bookings:refresh"));
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent("clients:booking-saved", {
            detail: { booking: { ...b, status: "paid", total } },
          })
        );
      } catch {}
    } catch (e) {
      console.error(e);
      alert("Не удалось провести оплату.");
    } finally {
      setPayingId("");
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return bookings;
    return bookings.filter((b) =>
      [
        b.purpose,
        purposeText(b),
        clientName(b.client),
        b.start_time,
        b.end_time,
        bookingLabel(b),
      ].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [q, bookings, hotels, rooms, beds, clients]);

  return (
    <div className="kassa">
      <HeaderTabs />

      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">
            К оплате броней: {filtered.length}
          </span>
        </div>

        <div className="kassa__controls">
          <input
            className="kassa__input"
            placeholder="Поиск по объектам/датам/назначению…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 260, marginRight: 8 }}
          />
          <select
            className="kassa__input"
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            title="Касса для приёма оплаты"
          >
            {boxes.map((b) => (
              <option key={b.id || b.uuid} value={b.id || b.uuid}>
                {b.department_name || b.name || "Касса"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              <th>Объект</th>
              <th>Период</th>
              <th>Назначение</th>
              <th>Сумма</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Загрузка…</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((b) => (
                <tr key={b.id} className="kassa__rowPay">
                  <td>
                    <b>{bookingLabel(b)}</b>
                  </td>
                  <td>
                    {toLocal(b.start_time)} — {toLocal(b.end_time)}
                  </td>
                  <td>{purposeText(b)}</td>
                  <td>{money(priceByBooking(b))}</td>
                  <td>
                    <button
                      className="kassa__btn kassa__btn--primary"
                      onClick={() => payBooking(b)}
                      disabled={String(payingId) === String(b.id)}
                    >
                      {String(payingId) === String(b.id)
                        ? "Оплата…"
                        : "Оплатить"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="kassa__center">
                  Нет броней, ожидающих оплаты
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Обёртка с отчётом */
const CashboxReports = () => (
  <div className="kassa">
    <HeaderTabs />
    <Reports />
  </div>
);

/* ──────────────────────────────── Детали кассы (фильтр дат + «красивая» модалка) */
const CashboxDetail = () => {
  const { id } = useParams();

  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // фильтр по датам
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // модалка операции
  const [openOp, setOpenOp] = useState(null); // хранит объект операции
  const [opLoading, setOpLoading] = useState(false);
  const [opDetail, setOpDetail] = useState(null);

  // справочник клиентов
  const [clientsMap, setClientsMap] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const list = await getAllClients();
        const map = Object.fromEntries(
          (Array.isArray(list) ? list : []).map((c) => [String(c.id), c])
        );
        setClientsMap(map);
      } catch {
        setClientsMap({});
      }
    })();
  }, []);

  const fromAny = (res) => {
    const d = res?.data ?? res ?? [];
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d)) return d;
    return [];
  };

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      let detail = null;
      try {
        detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`))
          .data;
      } catch {}
      if (!detail) {
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
            .data;
        } catch {}
      }
      if (!detail) {
        detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
      }

      setBox(detail);

      let flows =
        fromAny({ data: detail?.operations }) ||
        fromAny({ data: detail?.flows }) ||
        fromAny({ data: detail?.transactions });

      if (!flows.length) {
        try {
          const r1 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: id },
          });
          flows = fromAny(r1);
        } catch {}
      }
      if (!flows.length && detail?.uuid) {
        try {
          const r2 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: detail.uuid },
          });
          flows = fromAny(r2);
        } catch {}
      }

      const mapped = (flows || []).map((x, i) => {
        const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense")
          type = amt >= 0 ? "income" : "expense";
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          amount: Math.abs(amt),
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
          client: x.client ?? x.client_id ?? null,
          client_name: x.client_name ?? null,
          client_phone: x.client_phone ?? null,
          purpose: x.purpose ?? x.description ?? x.note ?? "",
          cashbox_name: x.cashbox_name ?? null,
          _raw: x,
        };
      });

      setOps(mapped);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const inRange = (iso) => {
    if (!iso) return true;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return true;
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    if (start != null && t < start) return false;
    if (end != null && t > end) return false;
    return true;
  };

  const shown = useMemo(() => {
    let base =
      tab === "income"
        ? ops.filter((o) => o.type === "income")
        : tab === "expense"
        ? ops.filter((o) => o.type === "expense")
        : ops;
    base = base.filter((o) => inRange(o.created_at));
    return [...base].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }, [ops, tab, dateFrom, dateTo]);

  const resetDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  const openOperation = async (o) => {
    setOpenOp(o);
    setOpDetail({ ...o });
    setOpLoading(true);

    // пробуем подтянуть полную запись операции по нескольким вариантам эндпоинта
    const tryEndpoints = [
      `/construction/cashflows/${o.id}/`,
      `/construction/cashflow/${o.id}/`,
      `/construction/cashboxes/${id}/flows/${o.id}/`,
    ];
    let full = null;
    for (const ep of tryEndpoints) {
      try {
        const { data } = await api.get(ep);
        if (data) {
          full = data;
          break;
        }
      } catch {}
    }
    if (full) {
      setOpDetail((prev) => ({
        ...(prev || {}),
        title: full.title || full.name || prev?.title,
        amount: Number(
          full.amount ??
            full.sum ??
            full.value ??
            full.total ??
            prev?.amount ??
            0
        ),
        created_at:
          full.created_at ||
          full.created ||
          full.date ||
          full.timestamp ||
          prev?.created_at,
        purpose: full.purpose ?? full.description ?? full.note ?? prev?.purpose,
        client: full.client ?? full.client_id ?? prev?.client ?? null,
        client_name: full.client_name ?? prev?.client_name ?? null,
        client_phone: full.client_phone ?? prev?.client_phone ?? null,
        cashbox_name: full.cashbox_name ?? prev?.cashbox_name ?? null,
      }));
    }
    setOpLoading(false);
  };

  const closeOperation = () => {
    setOpenOp(null);
    setOpDetail(null);
    setOpLoading(false);
  };

  // подготовка секций модалки (клиент только если есть)
  const modalSections = (d) => {
    if (!d) return { general: [], source: [], client: [], note: null };
    const boxName = box?.department_name || box?.name || "Касса";

    // клиент: из детали или из справочника
    const cid = d.client != null ? String(d.client) : null;
    const cc = cid ? clientsMap[cid] : null;
    const clientName = d.client_name || cc?.full_name || cc?.name || null;
    const clientPhone = d.client_phone || cc?.phone || null;

    const general = [
      ["Наименование", d.title || (d.type === "income" ? "Приход" : "Расход")],
      ["Тип", d.type === "income" ? "Приход" : "Расход"],
      ["Сумма", money(d.amount || 0)],
      ["Дата/время", whenDT(d.created_at)],
      ["Касса", d.cashbox_name || boxName],
    ];

    const source = [];
    const purpose = (d.purpose || "").trim();
    if (purpose) source.push(["Назначение", purpose]);

    const client = [];
    if (clientName) client.push(["Имя", clientName]);
    if (clientPhone) client.push(["Телефон", clientPhone]);

    return { general, source, client, note: null };
  };

  // Esc закрывает модалку
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeOperation();
    };
    if (openOp) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openOp]);

  return (
    <div className="kassa">
      <div className="kassa__header">
        <div className="kassa__tabs">
          <Link className="kassa__tab" to={BASE}>
            ← Назад
          </Link>
          <span className="kassa__tab kassa__tab--active">
            {box?.department_name || box?.name || "Касса"}
          </span>
          <Link className="kassa__tab" to={`${BASE}/pay`}>
            Оплата
          </Link>
          <Link className="kassa__tab" to={`${BASE}/reports`}>
            Отчёты
          </Link>
        </div>
      </div>

      <div className="kassa__switch" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          className={`kassa__chip ${
            tab === "expense" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("expense")}
        >
          Расход
        </button>
        <button
          className={`kassa__chip ${
            tab === "income" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("income")}
        >
          Приход
        </button>
        <button
          className={`kassa__chip ${
            tab === "all" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("all")}
        >
          Все
        </button>

        <div className="kassa__grow" />

        {/* фильтр по датам */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="kassa__muted">Период:</label>
          <input
            type="date"
            className="kassa__input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="С даты"
          />
          <span className="kassa__muted">—</span>
          <input
            type="date"
            className="kassa__input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="По дату"
          />
          {(dateFrom || dateTo) && (
            <button
              className="kassa__btn kassa__btn--secondary"
              onClick={resetDates}
            >
              Сбросить
            </button>
          )}
        </div>

        <button
          className="kassa__btn kassa__btn--primary"
          onClick={() =>
            alert(
              "Добавление операции делается через API. Здесь доступен только просмотр."
            )
          }
          style={{ marginLeft: 8 }}
        >
          Добавить операцию
        </button>
      </div>

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Наименование</th>
              <th>Сумма</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Загрузка…</td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={4} className="kassa__alert kassa__alert--error">
                  {err}
                </td>
              </tr>
            ) : shown.length ? (
              shown.map((o) => (
                <tr
                  key={o.id}
                  className="kassa__rowClickable"
                  onClick={() => openOperation(o)}
                  title="Открыть подробности операции"
                >
                  <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                  <td>{o.title}</td>
                  <td>{money(o.amount)}</td>
                  <td>{when(o.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Нет операций</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Модалка — карточка операции (приятный вид) */}
      {openOp && opDetail && (
        <div className="kassa-modal" role="dialog" aria-modal="true">
          <div className="kassa-modal__overlay" onClick={closeOperation} />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3
                className="kassa-modal__title"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      opDetail.type === "income" ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${
                      opDetail.type === "income" ? "#a7f3d0" : "#fecaca"
                    }`,
                    color: opDetail.type === "income" ? "#065f46" : "#7f1d1d",
                  }}
                >
                  {opDetail.type === "income" ? "ПРИХОД" : "РАСХОД"}
                </span>
                <span style={{ fontWeight: 800 }}>
                  {money(opDetail.amount)}
                </span>
              </h3>
              <button
                className="kassa-modal__close"
                onClick={closeOperation}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div
              className="kassa-modal__section"
              style={{ display: "grid", gap: 12 }}
            >
              {(() => {
                const { general, source, client } = modalSections(opDetail);
                return (
                  <>
                    {/* Общее */}
                    <CardBlock title="Общее">
                      {general.map(([k, v]) => (
                        <KV key={k} k={k} v={v} />
                      ))}
                    </CardBlock>

                    {/* Источник */}
                    {!!source.length && (
                      <CardBlock title="Источник">
                        {source.map(([k, v]) => (
                          <KV key={k} k={k} v={v} />
                        ))}
                      </CardBlock>
                    )}

                    {/* Клиент — только если есть данные */}
                    {!!client.length && (
                      <CardBlock title="Клиент">
                        {client.map(([k, v]) => (
                          <KV key={k} k={k} v={v} />
                        ))}
                      </CardBlock>
                    )}
                  </>
                );
              })()}

              {opLoading && (
                <div className="kassa__muted">Доп. данные загружаются…</div>
              )}
            </div>

            <div className="kassa-modal__footer">
              <button className="kassa__btn" onClick={closeOperation}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// маленькие помощники для карточки
const CardBlock = ({ title, children }) => (
  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 12,
      background: "#fff",
      display: "grid",
      gap: 8,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
    <div style={{ display: "grid", gap: 6 }}>{children}</div>
  </div>
);

const KV = ({ k, v }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "160px 1fr",
      gap: 10,
      alignItems: "start",
    }}
  >
    <div style={{ color: "#6b7280" }}>{k}</div>
    <div style={{ fontWeight: 600 }}>{v || "—"}</div>
  </div>
);

export default Kassa;
