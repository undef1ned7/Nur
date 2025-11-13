// src/components/Bookings/Bookings.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./Bookings.scss";
import {
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaUserAlt,
  FaPlus,
  FaTrash,
} from "react-icons/fa";
import api from "../../../../api";

/* ===================== API ===================== */
const EMPLOYEES_LIST_URL = "/users/employees/";
const BOOKINGS_URL = "/consalting/bookings/";
const BOOKING_ITEM_URL = (id) => `/consalting/bookings/${id}/`;

/* ===================== Utils ===================== */
const COMBO_PER_PAGE = 3;
const ITEMS_PER_DAY_VISIBLE = 3; // размер страницы внутри карточки дня

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  name: fullName(e) || e.email || "—",
});

const norm = (s) => String(s || "").trim();
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ""));
const pickApiError = (e, fb) => {
  const d = e?.response?.data;
  if (!d) return fb;
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    try {
      const k = Object.keys(d)[0];
      const v = Array.isArray(d[k]) ? d[k][0] : d[k];
      return String(v || fb);
    } catch {
      return fb;
    }
  }
  return fb;
};
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHM = (t) => {
  const m = /^(\d{2}):(\d{2})/.exec(String(t || ""));
  return m ? `${m[1]}:${m[2]}` : "";
};

/* ===================== Employees combobox ===================== */
const EmployeesCombo = ({
  value,
  onChange,
  placeholder = "Все сотрудники",
  error = false,
  clearable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [employees, setEmployees] = useState([]);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(EMPLOYEES_LIST_URL);
      setEmployees(asArray(res.data).map(normalizeEmployee));
    } catch (err) {
      console.error(err); // только ошибки
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const t = norm(q).toLowerCase();
    if (!t) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(t));
  }, [employees, q]);

  const total = Math.max(1, Math.ceil(filtered.length / COMBO_PER_PAGE));
  const safe = Math.min(page, total);
  const rows = filtered.slice(
    (safe - 1) * COMBO_PER_PAGE,
    safe * COMBO_PER_PAGE
  );

  const selectedLabel =
    employees.find((e) => String(e.id) === String(value))?.name || "";

  return (
    <div className="bookings__combo" ref={ref}>
      <div className={`bookings__comboControl${error ? " is-invalid" : ""}`}>
        <FaUserAlt className="bookings__comboIcon" />
        <input
          ref={inputRef}
          className="bookings__comboInput"
          placeholder={placeholder}
          value={open ? q : selectedLabel}
          onFocus={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
        {clearable && value && (
          <button
            type="button"
            className="bookings__comboClear"
            onClick={() => onChange?.("")}
            aria-label="Сбросить"
            title="Сбросить"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className="bookings__comboToggle"
          onClick={() => {
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-label="Открыть список"
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="bookings__comboDrop" role="listbox">
          <div className="bookings__comboSearch">
            {/* <FaSearch className="bookings__comboSearchIcon" /> */}
            <input
              className="bookings__comboSearchInput"
              placeholder="Поиск сотрудника…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              autoFocus
            />
          </div>

          {rows.length === 0 ? (
            <div className="bookings__comboEmpty">Ничего не найдено</div>
          ) : (
            <>
              <ul className="bookings__comboList">
                {rows.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`bookings__comboItem ${
                        String(e.id) === String(value) ? "is-active" : ""
                      }`}
                      onClick={() => {
                        onChange?.(e.id);
                        setOpen(false);
                      }}
                    >
                      {e.name}
                    </button>
                  </li>
                ))}
              </ul>

              {filtered.length > COMBO_PER_PAGE && (
                <div className="bookings__comboPager">
                  <button
                    type="button"
                    className="bookings__pageBtn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safe === 1}
                  >
                    <FaChevronLeft /> Назад
                  </button>
                  <span className="bookings__page">
                    Стр. {safe} из {total}
                  </span>
                  <button
                    type="button"
                    className="bookings__pageBtn"
                    onClick={() => setPage((p) => Math.min(total, p + 1))}
                    disabled={safe === total}
                  >
                    Далее <FaChevronRight />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ===================== Calendar helpers ===================== */
const monthLabelRu = (y, m) =>
  new Date(y, m, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/* ===================== Main ===================== */
const ConsultingBookings = () => {
  // месяц
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });

  // фильтр по сотруднику
  const [filterEmp, setFilterEmp] = useState("");

  // список сотрудников (для подписи в карточках)
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(EMPLOYEES_LIST_URL);
        setEmployees(asArray(res.data).map(normalizeEmployee));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);
  const empNameById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(e.id, e.name));
    return m;
  }, [employees]);

  // записи
  const [all, setAll] = useState([]);
  const [localNew, setLocalNew] = useState([]);
  const merged = useMemo(() => [...all, ...localNew], [all, localNew]);

  // уведомления
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // чтение
  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await api.get(BOOKINGS_URL, {
        params: { page_size: 1000 },
      });
      const rows = asArray(data).map((x) => ({
        id: x.id,
        title: x.title,
        date: x.date,
        time: toHM(x.time),
        employee: x.employee || null,
        note: x.note || "",
      }));
      setAll(rows);
    } catch (err) {
      console.error(err);
    }
  }, []);
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // группировка по дню (учитываем фильтр сотрудника)
  const byDate = useMemo(() => {
    const map = new Map();
    const start = new Date(ym.y, ym.m, 1);
    const end = new Date(ym.y, ym.m, daysInMonth(ym.y, ym.m));
    merged.forEach((b) => {
      if (!isDate(b.date)) return;
      const d = new Date(b.date);
      if (d < start || d > end) return;
      if (filterEmp && String(b.employee || "") !== String(filterEmp)) return;
      const arr = map.get(b.date) || [];
      arr.push(b);
      map.set(b.date, arr);
    });
    for (const [k, arr] of map) {
      arr.sort((a, b) =>
        String(a.time || "").localeCompare(String(b.time || ""))
      );
      map.set(k, arr);
    }
    return map;
  }, [merged, ym, filterEmp]);

  // drag state
  const dragRef = useRef(null);
  const [movingIds, setMovingIds] = useState(new Set());

  // модалка: режимы
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [errs, setErrs] = useState({});
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    employee: null,
    note: "",
  });

  // состояние интерфейса внутри каждого дня: поиск + страница
  const [dayUi, setDayUi] = useState({});
  const getDayUi = (iso) => dayUi[iso] || { q: "", page: 1 };
  const setDayUiFor = (iso, patch) =>
    setDayUi((s) => ({ ...s, [iso]: { ...getDayUi(iso), ...patch } }));
  // при смене месяца/фильтра — сбрасываем пагинацию/поиск
  useEffect(() => {
    setDayUi({});
  }, [ym, filterEmp]);

  const openCreateForDay = (dateISO) => {
    setErrs({});
    setMode("create");
    setEditingId(null);
    setAskDelete(false);
    setForm({
      title: "",
      date: dateISO,
      time: "",
      employee: filterEmp || null,
      note: "",
    });
    setOpen(true);
  };

  const openEdit = (b) => {
    setErrs({});
    setMode("edit");
    setEditingId(b.id);
    setAskDelete(false);
    setForm({
      title: b.title || "",
      date: b.date || "",
      time: toHM(b.time) || "",
      employee: b.employee || null,
      note: b.note || "",
    });
    setOpen(true);
  };

  const validate = (f) => {
    const e = {};
    const title = norm(f.title);
    if (!title) e.title = "Укажите название.";
    else if (title.length > 255) e.title = "Максимум 255 символов.";
    if (!isDate(f.date)) e.date = "Дата в формате ГГГГ-ММ-ДД.";
    if (!isTime(f.time)) e.time = "Время в формате ЧЧ:ММ.";
    if (norm(f.note).length > 1000) e.note = "Заметка: максимум 1000 символов.";
    return e;
  };

  const applyLocalEdit = (id, patch) => {
    setAll((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setLocalNew((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const applyLocalDate = (id, date) => applyLocalEdit(id, { date });

  // create / edit
  const submit = async (ev) => {
    ev.preventDefault();
    setNotice("");
    setErrorMsg("");
    const v = validate(form);
    setErrs(v);
    if (Object.keys(v).length) return;

    const payload = {
      title: norm(form.title),
      date: form.date,
      time: form.time,
      employee: form.employee || null,
      note: norm(form.note) || "",
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const { data } = await api.post(BOOKINGS_URL, payload);
        const created = {
          id: data?.id || `tmp_${Math.random().toString(36).slice(2)}`,
          ...payload,
        };
        setLocalNew((p) => [created, ...p]);
        setOpen(false);
        setNotice("Бронирование создано.");
      } else {
        if (!editingId) return;
        await api.patch(BOOKING_ITEM_URL(editingId), payload);
        applyLocalEdit(editingId, payload);
        setOpen(false);
        setNotice("Изменения сохранены.");
      }
    } catch (err) {
      const msg = pickApiError(
        err,
        mode === "create"
          ? "Не удалось создать бронирование."
          : "Не удалось сохранить изменения."
      );
      setErrs((p) => ({ ...p, __top: msg }));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // delete
  const doDelete = async () => {
    if (!editingId) return;
    setDeleting(true);
    try {
      if (String(editingId).startsWith("tmp_")) {
        setLocalNew((p) => p.filter((b) => b.id !== editingId));
      } else {
        await api.delete(BOOKING_ITEM_URL(editingId));
        setAll((p) => p.filter((b) => b.id !== editingId));
      }
      setOpen(false);
      setNotice("Бронирование удалено.");
    } catch (err) {
      setErrs((p) => ({
        ...p,
        __top: pickApiError(err, "Не удалось удалить бронирование."),
      }));
      console.error(err);
    } finally {
      setDeleting(false);
      setAskDelete(false);
    }
  };

  // переход месяца
  const prevMonth = () =>
    setYm((s) => (s.m === 0 ? { y: s.y - 1, m: 11 } : { y: s.y, m: s.m - 1 }));
  const nextMonth = () =>
    setYm((s) => (s.m === 11 ? { y: s.y + 1, m: 0 } : { y: s.y, m: s.m + 1 }));

  // дни месяца
  const days = useMemo(() => {
    const total = daysInMonth(ym.y, ym.m);
    const today = new Date();
    const todayISO = ymd(today);

    return Array.from({ length: total }, (_, i) => {
      const d = new Date(ym.y, ym.m, i + 1);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // воскресенье или суббота
      const isToday = ymd(d) === todayISO;

      return {
        num: i + 1,
        iso: ymd(d),
        isWeekend,
        isToday,
      };
    });
  }, [ym]);

  // ——— ПЕРСИСТ ПЕРЕНОСА ———
  const persistMove = async (id, newDate, prevDate) => {
    if (String(id).startsWith("tmp_")) {
      applyLocalDate(id, newDate);
      return true;
    }
    // оптимистично
    applyLocalDate(id, newDate);
    setMovingIds((s) => new Set(s).add(id));
    try {
      await api.patch(BOOKING_ITEM_URL(id), { date: newDate });
      return true;
    } catch (err) {
      applyLocalDate(id, prevDate);
      const msg = pickApiError(err, "Не удалось перенести запись.");
      setErrorMsg(msg);
      console.error(err);
      return false;
    } finally {
      setMovingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <div className="bookings">
      <div className="bookings__header">
        <div className="bookings__month">
          <button
            className="bookings__navBtn"
            onClick={prevMonth}
            aria-label="Предыдущий месяц"
          >
            <FaChevronLeft />
          </button>
          <h2 className="bookings__title">{monthLabelRu(ym.y, ym.m)}</h2>
          <button
            className="bookings__navBtn"
            onClick={nextMonth}
            aria-label="Следующий месяц"
          >
            <FaChevronRight />
          </button>
        </div>

        <div className="bookings__actions">
          <EmployeesCombo
            value={filterEmp}
            onChange={setFilterEmp}
            placeholder="Все сотрудники"
            clearable
          />
        </div>
      </div>

      {!!notice && (
        <div className="bookings__alert bookings__alert--success">{notice}</div>
      )}
      {!!errorMsg && <div className="bookings__alert">{errorMsg}</div>}

      {/* ===== Calendar weekdays header ===== */}
      <div className="bookings__weekdays">
        <div className="bookings__weekday">Пн</div>
        <div className="bookings__weekday">Вт</div>
        <div className="bookings__weekday">Ср</div>
        <div className="bookings__weekday">Чт</div>
        <div className="bookings__weekday">Пт</div>
        <div className="bookings__weekday">Сб</div>
        <div className="bookings__weekday">Вс</div>
      </div>

      {/* ===== Calendar grid ===== */}
      <div className="bookings__calendar calendar">
        {days.map((d) => {
          const base = byDate.get(d.iso) || [];

          // поиск по НАЗВАНИЮ брони (внутри дня)
          const ui = getDayUi(d.iso);
          const qDay = norm(ui.q).toLowerCase();
          const filtered = !qDay
            ? base
            : base.filter((b) =>
                String(b.title || "")
                  .toLowerCase()
                  .includes(qDay)
              );

          // пагинация внутри дня
          const total = Math.max(
            1,
            Math.ceil(filtered.length / ITEMS_PER_DAY_VISIBLE)
          );
          const pageSafe = Math.min(Math.max(1, ui.page || 1), total);
          const start = (pageSafe - 1) * ITEMS_PER_DAY_VISIBLE;
          const rows = filtered.slice(start, start + ITEMS_PER_DAY_VISIBLE);

          return (
            <section
              key={d.iso}
              className={`bookings__day ${
                d.isWeekend ? "bookings__day--weekend" : ""
              } ${d.isToday ? "bookings__day--today" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const drag = dragRef.current;
                if (!drag || drag.fromDate === d.iso) return;
                await persistMove(drag.id, d.iso, drag.fromDate);
                dragRef.current = null;
              }}
            >
              <header className="bookings__dayHead">
                <span className="bookings__dayNum">{d.num}</span>
                <button
                  type="button"
                  className="bookings__addBtn"
                  onClick={() => openCreateForDay(d.iso)}
                  aria-label="Добавить в этот день"
                  title="Добавить запись"
                >
                  <FaPlus />
                </button>
              </header>

              <div className="bookings__dayBody">
                {/* Поиск по названию брони (внутри дня) */}
                <div
                  className="bookings__comboSearch"
                  style={{ paddingTop: 0 }}
                >
                  {/* <FaSearch className="bookings__comboSearchIcon" /> */}
                  <input
                    className="bookings__comboSearchInput"
                    placeholder="Поиск брони…"
                    value={ui.q}
                    onChange={(e) =>
                      setDayUiFor(d.iso, { q: e.target.value, page: 1 })
                    }
                  />
                </div>

                {rows.length === 0 ? (
                  <div className="bookings__empty">Нет записей</div>
                ) : (
                  rows.map((b) => (
                    <article
                      key={b.id}
                      className={`bookings__item${
                        movingIds.has(b.id) ? " is-moving" : ""
                      }`}
                      draggable
                      onDragStart={() =>
                        (dragRef.current = { id: b.id, fromDate: b.date })
                      }
                      onDragEnd={() => (dragRef.current = null)}
                      onClick={() => openEdit(b)}
                      title={b.note ? b.note : b.title}
                    >
                      <div className="bookings__itemTitle">
                        <b>{toHM(b.time) || "--:--"}</b> • {b.title}
                      </div>
                      <div className="bookings__itemMeta">
                        Сотр.:{" "}
                        {b.employee ? empNameById.get(b.employee) || "—" : "—"}
                      </div>
                    </article>
                  ))
                )}

                {/* Пагинация внутри дня (после 3) */}
                {filtered.length > ITEMS_PER_DAY_VISIBLE && (
                  <div className="bookings__comboPager">
                    <button
                      type="button"
                      className="bookings__pageBtn"
                      onClick={() =>
                        setDayUiFor(d.iso, { page: Math.max(1, pageSafe - 1) })
                      }
                      disabled={pageSafe === 1}
                    >
                      <FaChevronLeft />
                    </button>
                    <span className="bookings__page">
                      {pageSafe} из {total}
                    </span>
                    <button
                      type="button"
                      className="bookings__pageBtn"
                      onClick={() =>
                        setDayUiFor(d.iso, {
                          page: Math.min(total, pageSafe + 1),
                        })
                      }
                      disabled={pageSafe === total}
                    >
                      <FaChevronRight />
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ===== Modal (create/edit) ===== */}
      {open && (
        <div
          className="bookings__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setOpen(false)}
        >
          <div className="bookings__modal" onClick={(e) => e.stopPropagation()}>
            <div className="bookings__modalHeader">
              <h3 className="bookings__modalTitle">
                {mode === "create"
                  ? "Новое бронирование"
                  : "Редактировать бронирование"}
              </h3>
              <button
                className="bookings__iconBtn"
                onClick={() => !saving && setOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!errs.__top && (
              <div className="bookings__alert bookings__alert--inModal">
                {errs.__top}
              </div>
            )}

            <form className="bookings__form" onSubmit={submit} noValidate>
              <div className="bookings__grid">
                <div
                  className={`bookings__field ${
                    errs.title ? "bookings__field--invalid" : ""
                  }`}
                >
                  <label className="bookings__label" htmlFor="bk-title">
                    Название <span className="bookings__req">*</span>
                  </label>
                  <input
                    id="bk-title"
                    className={`bookings__input ${
                      errs.title ? "bookings__input--invalid" : ""
                    }`}
                    placeholder="Напр.: Встреча"
                    maxLength={255}
                    value={form.title}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, title: e.target.value }))
                    }
                    required
                  />
                  {errs.title && (
                    <div className="bookings__error">{errs.title}</div>
                  )}
                </div>

                <div
                  className={`bookings__field ${
                    errs.date ? "bookings__field--invalid" : ""
                  }`}
                >
                  <label className="bookings__label" htmlFor="bk-date">
                    Дата <span className="bookings__req">*</span>
                  </label>
                  <input
                    id="bk-date"
                    type="date"
                    className={`bookings__input ${
                      errs.date ? "bookings__input--invalid" : ""
                    }`}
                    value={form.date}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, date: e.target.value }))
                    }
                    required
                  />
                  {errs.date && (
                    <div className="bookings__error">{errs.date}</div>
                  )}
                </div>

                <div
                  className={`bookings__field ${
                    errs.time ? "bookings__field--invalid" : ""
                  }`}
                >
                  <label className="bookings__label" htmlFor="bk-time">
                    Время <span className="bookings__req">*</span>
                  </label>
                  <input
                    id="bk-time"
                    type="time"
                    className={`bookings__input ${
                      errs.time ? "bookings__input--invalid" : ""
                    }`}
                    value={form.time}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, time: e.target.value }))
                    }
                    required
                  />
                  {errs.time && (
                    <div className="bookings__error">{errs.time}</div>
                  )}
                </div>

                <div className="bookings__field">
                  <label className="bookings__label">Сотрудник</label>
                  <EmployeesCombo
                    value={form.employee}
                    onChange={(id) =>
                      setForm((s) => ({ ...s, employee: id || null }))
                    }
                    placeholder="Сотрудник (необязательно)"
                    clearable
                  />
                </div>

                <div
                  className={`bookings__field bookings__field--wide ${
                    errs.note ? "bookings__field--invalid" : ""
                  }`}
                >
                  <label className="bookings__label" htmlFor="bk-note">
                    Заметка
                  </label>
                  <textarea
                    id="bk-note"
                    rows={4}
                    className="bookings__textarea"
                    placeholder="Короткое описание…"
                    value={form.note}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, note: e.target.value }))
                    }
                    maxLength={1000}
                  />
                  {errs.note && (
                    <div className="bookings__error">{errs.note}</div>
                  )}
                </div>

                {mode === "edit" && (
                  <div className="bookings__confirm bookings__field--wide">
                    {!askDelete ? (
                      <button
                        type="button"
                        className="bookings__btn bookings__btn--danger"
                        onClick={() => setAskDelete(true)}
                        disabled={deleting}
                      >
                        <FaTrash /> Удалить
                      </button>
                    ) : (
                      <>
                        <span className="bookings__confirmText">
                          Удалить бронирование? Действие необратимо.
                        </span>
                        <div className="bookings__confirmActions">
                          <button
                            type="button"
                            className="bookings__btn bookings__btn--secondary"
                            onClick={() => setAskDelete(false)}
                            disabled={deleting}
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            className="bookings__btn bookings__btn--danger"
                            onClick={doDelete}
                            disabled={deleting}
                          >
                            {deleting ? "Удаление…" : "Удалить"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bookings__footer">
                <div className="bookings__spacer" />
                <button
                  type="button"
                  className="bookings__btn bookings__btn--secondary"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bookings__btn bookings__btn--primary"
                  disabled={saving}
                >
                  {saving
                    ? "Сохранение…"
                    : mode === "create"
                    ? "Добавить"
                    : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultingBookings;
