// src/components/Salary/Salary.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./salary.scss";
import {
  FaPlus,
  FaTimes,
  FaUserAlt,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import api from "../../../../api";

/* ===================== API ===================== */
const EMPLOYEES_LIST_URL = "/users/employees/";
const SALARIES_URL = "/consalting/salaries/";

/* ===================== Consts & helpers ===================== */
const LIST_PER_PAGE = 12;
const COMBO_PER_PAGE = 12;

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  name: fullName(e) || e.email || "—",
});

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

const normStr = (s) => String(s || "").trim();
const toDecimalString = (s) => {
  // "12,50" -> "12.50"
  const raw = String(s || "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const [i, f = ""] = raw.split(".");
  const intPart = (i || "0").replace(/^0+(?=\d)/, "") || "0";
  const frac = f.replace(/\./g, "");
  return frac ? `${intPart}.${frac}` : intPart;
};
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") : String(v || "—");
};

/* ===================== Employees combobox (reusable) ===================== */
const EmployeesCombo = ({
  value,
  onChange,
  error,
  placeholder = "Сотрудник",
  clearable = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(EMPLOYEES_LIST_URL);
      setEmployees(asArray(res.data).map(normalizeEmployee));
    } finally {
      setLoading(false);
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
    const t = normStr(q).toLowerCase();
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
    <div className="salary__combo" ref={ref}>
      <div className={`salary__comboControl${error ? " is-invalid" : ""}`}>
        <FaUserAlt className="salary__comboIcon" />
        <input
          ref={inputRef}
          className="salary__comboInput"
          placeholder={placeholder}
          value={open ? q : selectedLabel || (value ? String(value) : "")}
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
            className="salary__comboClear"
            onClick={() => onChange?.("")}
            aria-label="Сбросить"
            title="Сбросить"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className="salary__comboToggle"
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
        <div className="salary__comboDrop" role="listbox">
          <div className="salary__comboSearch">
            <FaSearch className="salary__comboSearchIcon" />
            <input
              className="salary__comboSearchInput"
              placeholder="Поиск сотрудника…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              autoFocus
            />
          </div>

          {loading ? (
            <div className="salary__comboEmpty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="salary__comboEmpty">Ничего не найдено</div>
          ) : (
            <>
              <ul className="salary__comboList">
                {rows.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`salary__comboItem ${
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
                <div className="salary__comboPager">
                  <button
                    type="button"
                    className="salary__pageBtn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safe === 1}
                  >
                    <FaChevronLeft /> Назад
                  </button>
                  <span className="salary__page">
                    Стр. {safe} из {total}
                  </span>
                  <button
                    type="button"
                    className="salary__pageBtn"
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

/* ===================== Main component ===================== */
const Salary = () => {
  /* --- фильтр по сотруднику --- */
  const [filterUser, setFilterUser] = useState("");

  /* --- список --- */
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");

  /* --- сотрудники для отображения имени --- */
  const [employees, setEmployees] = useState([]);
  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), e.name));
    return m;
  }, [employees]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get(EMPLOYEES_LIST_URL);
      setEmployees(asArray(res.data).map(normalizeEmployee));
    } finally {
      /* ничего не логируем */
    }
  }, []);

  const fetchSalaries = useCallback(async (pageNum = 1, userId = "") => {
    setLoadingList(true);
    setListError("");
    try {
      const { data } = await api.get(SALARIES_URL, {
        params: {
          page: pageNum,
          page_size: LIST_PER_PAGE,
          user: userId || undefined, // фильтр по сотруднику, если выбран
        },
      });
      const rows = asArray(data);
      setItems(rows);
      setCount(typeof data?.count === "number" ? data.count : rows.length);
      setPage(pageNum);
    } catch (err) {
      setListError(pickApiError(err, "Не удалось загрузить начисления."));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    // при смене фильтра — на первую страницу
    fetchSalaries(1, filterUser);
  }, [fetchSalaries, filterUser]);

  const totalPages = Math.max(1, Math.ceil(count / LIST_PER_PAGE));

  /* --- создание --- */
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    user: "",
    amount: "",
    percent: "",
    description: "",
  });
  const [errs, setErrs] = useState({});

  const validate = (f) => {
    const e = {};
    if (!normStr(f.user)) e.user = "Выберите сотрудника.";
    const amt = toDecimalString(f.amount);
    if (!amt || Number.isNaN(Number(amt)))
      e.amount = "Сумма должна быть числом.";
    const pct = normStr(f.percent);
    if (!pct) e.percent = "Процент обязателен.";
    if (pct.length < 1 || pct.length > 255)
      e.percent = "Длина процента 1–255 символов.";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setNotice("");
    const v = validate(form);
    setErrs(v);
    if (Object.keys(v).length) return;

    const payload = {
      user: String(form.user),
      amount: toDecimalString(form.amount),
      percent: normStr(form.percent),
      description: normStr(form.description) || "",
    };

    setSaving(true);
    try {
      await api.post(SALARIES_URL, payload);
      setOpen(false);
      setForm({ user: "", amount: "", percent: "", description: "" });
      setNotice("Начисление создано.");
      fetchSalaries(1, filterUser); // перечитать список с текущим фильтром
    } catch (err) {
      setErrs((p) => ({
        ...p,
        __top: pickApiError(err, "Не удалось создать начисление."),
      }));
    } finally {
      setSaving(false);
    }
  };

  /* ===================== Render ===================== */
  return (
    <div className="salary">
      <div className="salary__header">
        <div className="salary__titleWrap">
          <h2 className="salary__title">Зарплата</h2>
          <div className="salary__subtitle">
            {loadingList
              ? "Загрузка…"
              : `${count} начислений${
                  count > LIST_PER_PAGE ? ` · стр. ${page}/${totalPages}` : ""
                }`}
          </div>
        </div>

        <div className="salary__actions">
          {/* Фильтр по сотруднику */}
          <EmployeesCombo
            value={filterUser}
            onChange={setFilterUser}
            placeholder="Все сотрудники"
            clearable
          />
          <button
            className="salary__btn salary__btn--primary"
            type="button"
            onClick={() => {
              setErrs({});
              setOpen(true);
            }}
          >
            <FaPlus />{" "}
            <span className="salary__btnText">Добавить начисление</span>
          </button>
        </div>
      </div>

      {!!notice && (
        <div className="salary__alert salary__alert--success">{notice}</div>
      )}
      {!!listError && <div className="salary__alert">{listError}</div>}

      {/* ===== List ===== */}
      <div className="salary__list" aria-live="polite">
        {loadingList ? (
          <div className="salary__alert">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="salary__alert">Нет записей.</div>
        ) : (
          items.map((it) => {
            const empName = empById.get(String(it.user)) || String(it.user);
            return (
              <article
                key={it.id || `${it.user}-${it.amount}-${it.percent}`}
                className="salary__card"
              >
                <div className="salary__info">
                  <h3 className="salary__name" title={empName}>
                    <FaUserAlt /> {empName}
                  </h3>
                  <div className="salary__meta">
                    <span className="salary__badge">
                      Процент: <b>{String(it.percent || "")}</b>
                    </span>
                    <span className="salary__price">
                      Сумма: <b>{money(it.amount)}</b>
                    </span>
                  </div>
                  {it.description && (
                    <p className="salary__desc">{it.description}</p>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* ===== Pager ===== */}
      {count > LIST_PER_PAGE && (
        <div className="salary__pager">
          <button
            className="salary__pageBtn"
            onClick={() => fetchSalaries(Math.max(1, page - 1), filterUser)}
            disabled={page <= 1}
            type="button"
          >
            <FaChevronLeft /> Пред
          </button>
          <span className="salary__page">
            Стр. {page} из {totalPages}
          </span>
          <button
            className="salary__pageBtn"
            onClick={() =>
              fetchSalaries(Math.min(totalPages, page + 1), filterUser)
            }
            disabled={page >= totalPages}
            type="button"
          >
            След <FaChevronRight />
          </button>
        </div>
      )}

      {/* ===== Modal (create) ===== */}
      {open && (
        <div
          className="salary__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setOpen(false)}
        >
          <div className="salary__modal" onClick={(e) => e.stopPropagation()}>
            <div className="salary__modalHeader">
              <h3 className="salary__modalTitle">Новое начисление</h3>
              <button
                className="salary__iconBtn"
                onClick={() => !saving && setOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!errs.__top && (
              <div className="salary__alert salary__alert--inModal">
                {errs.__top}
              </div>
            )}

            <form className="salary__form" onSubmit={submit} noValidate>
              <div className="salary__grid">
                <div
                  className={`salary__field ${
                    errs.user ? "salary__field--invalid" : ""
                  }`}
                >
                  <label className="salary__label">
                    Сотрудник <span className="salary__req">*</span>
                  </label>
                  <EmployeesCombo
                    value={form.user}
                    onChange={(id) => {
                      setForm((s) => ({ ...s, user: id }));
                      if (errs.user)
                        setErrs((p) => ({ ...p, user: undefined }));
                    }}
                    placeholder="Сотрудник"
                    error={!!errs.user}
                  />
                  {errs.user && (
                    <div className="salary__error">{errs.user}</div>
                  )}
                </div>

                <div
                  className={`salary__field ${
                    errs.amount ? "salary__field--invalid" : ""
                  }`}
                >
                  <label className="salary__label">
                    Сумма <span className="salary__req">*</span>
                  </label>
                  <input
                    className={`salary__input ${
                      errs.amount ? "salary__input--invalid" : ""
                    }`}
                    inputMode="decimal"
                    placeholder="Например: 40000 или 40000.50"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, amount: e.target.value }))
                    }
                  />
                  {errs.amount && (
                    <div className="salary__error">{errs.amount}</div>
                  )}
                </div>

                <div
                  className={`salary__field ${
                    errs.percent ? "salary__field--invalid" : ""
                  }`}
                >
                  <label className="salary__label">
                    Процент <span className="salary__req">*</span>
                  </label>
                  <input
                    className={`salary__input ${
                      errs.percent ? "salary__input--invalid" : ""
                    }`}
                    placeholder="Например: 10"
                    value={form.percent}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, percent: e.target.value }))
                    }
                  />
                  {errs.percent && (
                    <div className="salary__error">{errs.percent}</div>
                  )}
                </div>

                <div className="salary__field salary__field--wide">
                  <label className="salary__label">Описание</label>
                  <textarea
                    rows={4}
                    className="salary__textarea"
                    placeholder="Короткое пояснение… (необязательно)"
                    value={form.description}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, description: e.target.value }))
                    }
                    maxLength={1000}
                  />
                </div>
              </div>

              <div className="salary__footer">
                <div className="salary__spacer" />
                <button
                  type="button"
                  className="salary__btn salary__btn--secondary"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="salary__btn salary__btn--primary"
                  disabled={saving}
                >
                  {saving ? "Сохранение…" : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salary;
