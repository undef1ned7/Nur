import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCheck,
  FaCopy,
  FaEdit,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";
import { useDispatch } from "react-redux";
import { historySellProduct } from "../../../../store/creators/orderCreators";
import { fetchProductHistoryAsync } from "../../../../store/creators/productCreators";
import "./Masters.scss";

/* ===================== API endpoints ===================== */
const EMPLOYEES_LIST_URL = "/users/employees/";
const EMPLOYEES_CREATE_URL = "/users/employees/create/";
const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;

const ROLES_LIST_URL = "/users/roles/";
const ROLE_CREATE_URL = "/users/roles/custom/";
const ROLE_ITEM_URL = (id) => `/users/roles/custom/${id}/`;

/* === Доп. эндпоинты для истории (не-барбершоп) === */
const SALES_LIST_URL = "/sales/"; // замените на ваш реальный путь, если другой
const PRODUCT_HISTORY_URL = "/warehouse/history/"; // замените на ваш путь, если другой

/* ===================== Helpers ===================== */
const SYSTEM_ROLES = ["owner", "admin"];
const PAGE_SIZE = 12;
const MENU_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 12;

const pad = (n) => String(n).padStart(2, "0");
const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtMoney = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU")} сом`;

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const normalizeEmail = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  role: e.role ?? null,
  custom_role: e.custom_role ?? null,
  role_display: e.role_display ?? "",
});
const fullName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

const ruLabelSys = (c) =>
  c === "owner" ? "Владелец" : c === "admin" ? "Администратор" : c || "";
const sysCodeFromName = (n) => {
  const l = String(n || "")
    .trim()
    .toLowerCase();
  if (["admin", "administrator", "админ", "администратор"].includes(l))
    return "admin";
  if (["owner", "владелец"].includes(l)) return "owner";
  return null;
};
const normalizeRoleName = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

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

/* ===================== Reusable searchable select ===================== */
const RoleSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  hideCurrentLabelInMenu = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const refWrap = useRef(null);

  const labelByKey = useMemo(() => {
    const m = new Map();
    options.forEach((o) => m.set(o.key, o.label));
    return m;
  }, [options]);

  const filtered = useMemo(() => {
    const txt = q.trim().toLowerCase();
    let list = !txt
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(txt));
    if (hideCurrentLabelInMenu)
      list = list.filter((o) => o.label !== placeholder);
    return list;
  }, [options, q, hideCurrentLabelInMenu, placeholder]);

  const total = Math.max(1, Math.ceil(filtered.length / MENU_PAGE_SIZE));
  const safe = Math.min(page, total);
  const rows = filtered.slice(
    (safe - 1) * MENU_PAGE_SIZE,
    safe * MENU_PAGE_SIZE
  );

  useEffect(() => setPage(1), [q, open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!refWrap.current) return;
      if (!refWrap.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div
      className={`barbermasters__select ${open ? "is-open" : ""} ${className}`}
      ref={refWrap}
    >
      <button
        type="button"
        className="barbermasters__selectControl"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`barbermasters__selectValue ${
            value ? "" : "is-placeholder"
          }`}
        >
          {value ? labelByKey.get(value) || placeholder : placeholder}
        </span>
        <span className="barbermasters__selectCaret" aria-hidden />
      </button>

      {open && (
        <div className="barbermasters__selectMenu" role="listbox">
          <div className="barbermasters__selectSearch">
            <FaSearch className="barbermasters__selectSearchIcon" />
            <input
              className="barbermasters__selectSearchInput"
              placeholder="Поиск роли…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>

          <div className="barbermasters__selectList" tabIndex={-1}>
            {rows.length === 0 ? (
              <div className="barbermasters__selectEmpty">
                Ничего не найдено
              </div>
            ) : (
              rows.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`barbermasters__selectItem ${
                    o.key === value ? "is-active" : ""
                  }`}
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>

          {filtered.length > MENU_PAGE_SIZE && (
            <div className="barbermasters__selectPager">
              <button
                className="barbermasters__selectPageBtn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safe === 1}
              >
                Назад
              </button>
              <span className="barbermasters__selectPageInfo">
                Стр. {safe}/{total}
              </span>
              <button
                className="barbermasters__selectPageBtn"
                onClick={() => setPage((p) => Math.min(total, p + 1))}
                disabled={safe === total}
              >
                Далее
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ===================== Main component ===================== */
const Masters = () => {
  const { company } = useUser();
  const dispatch = useDispatch();
  const isMaster = company?.sector?.name === "Барбершоп";

  const [tab, setTab] = useState("masters");

  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNotice, setPageNotice] = useState("");

  // поиск + фильтры
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  // списки / пагинация
  const [pageEmp, setPageEmp] = useState(1);
  const [pageRole, setPageRole] = useState(1);

  // роли CRUD
  const [roleCreateOpen, setRoleCreateOpen] = useState(false);
  const [roleCreateName, setRoleCreateName] = useState("");
  const [roleCreateSaving, setRoleCreateSaving] = useState(false);
  const [roleCreateErr, setRoleCreateErr] = useState("");

  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleEditId, setRoleEditId] = useState(null);
  const [roleEditName, setRoleEditName] = useState("");
  const [roleEditSaving, setRoleEditSaving] = useState(false);
  const [roleEditErr, setRoleEditErr] = useState("");

  const [roleDeletingIds, setRoleDeletingIds] = useState(new Set());
  const [roleToDelete, setRoleToDelete] = useState(null);

  // сотрудники CRUD
  const [empCreateOpen, setEmpCreateOpen] = useState(false);
  const [empEditOpen, setEmpEditOpen] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [empAlerts, setEmpAlerts] = useState([]);
  const [empFieldErrors, setEmpFieldErrors] = useState({});
  const [empDeletingIds, setEmpDeletingIds] = useState(new Set());
  const [empToDelete, setEmpToDelete] = useState(null);
  const emptyEmp = { email: "", first_name: "", last_name: "", roleChoice: "" };
  const [empForm, setEmpForm] = useState(emptyEmp);
  const [editingEmpId, setEditingEmpId] = useState(null);

  // логин нового
  const [openLogin, setOpenLogin] = useState(false);
  const [employData, setEmployData] = useState(null);
  const [copied, setCopied] = useState(null);

  // история
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEmp, setHistoryEmp] = useState(null);
  const [pageHistory, setPageHistory] = useState(1);
  const [historyFrom, setHistoryFrom] = useState(""); // YYYY-MM-DD
  const [historyTo, setHistoryTo] = useState(""); // YYYY-MM-DD

  // ====== НЕ-барбершоп: вкладки и данные ======
  const [nonBarberTab, setNonBarberTab] = useState("sales"); // 'sales' | 'product'
  const [salesByUser, setSalesByUser] = useState(new Map()); // userId -> array
  const [prodHistByUser, setProdHistByUser] = useState(new Map()); // userId -> array
  const [loadingNonBarber, setLoadingNonBarber] = useState(false);
  const [nonBarberErr, setNonBarberErr] = useState("");
  const [pageSales, setPageSales] = useState(1);
  const [pageProduct, setPageProduct] = useState(1);

  const copyToClipboard = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  /* ========= Fetch ========= */
  const fetchEmployees = useCallback(async () => {
    const res = await api.get(EMPLOYEES_LIST_URL);
    setEmployees(asArray(res.data).map(normalizeEmployee));
  }, []);
  const fetchRoles = useCallback(async () => {
    const res = await api.get(ROLES_LIST_URL);
    setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "" })));
  }, []);
  const fetchAppointments = useCallback(async () => {
    const res = await api.get("/barbershop/appointments/");
    setAppointments(asArray(res.data));
  }, []);
  const fetchServices = useCallback(async () => {
    const res = await api.get("/barbershop/services/");
    setServices(asArray(res.data));
  }, []);

  // не-барбершоп: подгрузка продаж по пользователю
  const fetchSalesForUser = useCallback(
    async (user) => {
      if (!user?.id) return [];
      try {
        // Загружаем все данные без параметров
        const result = await dispatch(historySellProduct()).unwrap();
        let list = asArray(result);

        // Клиентская фильтрация по user
        const email = normalizeEmail(user.email);
        list = list.filter((s) => {
          // Проверяем по user ID
          if (s.user === user.id) return true;

          // Проверяем по user_display
          if (s.user_display === user.email) return true;

          // Проверяем по email
          if (email && normalizeEmail(s.email) === email) return true;

          // Проверяем по user_display (нормализованный email)
          if (email && normalizeEmail(s.user_display) === email) return true;

          return false;
        });

        return list;
      } catch (e) {
        throw e;
      }
    },
    [dispatch]
  );

  // не-барбершоп: подгрузка товарной истории по created_by_name
  const fetchProductHistoryForUser = useCallback(
    async (user) => {
      if (!user?.id) return [];
      try {
        // Загружаем все данные без параметров
        const result = await dispatch(fetchProductHistoryAsync()).unwrap();
        let list = asArray(result);

        // Клиентская фильтрация по created_by_name
        const authorName = fullName(user);
        const userEmail = user.email;

        const fn = (v) =>
          String(v || "")
            .trim()
            .toLowerCase();
        const wantA = fn(authorName);
        const wantB = fn(userEmail);

        list = list.filter((x) => {
          const by = fn(x.created_by_name);
          return by && (by === wantA || by === wantB);
        });

        return list;
      } catch (e) {
        throw e;
      }
    },
    [dispatch]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([
          fetchEmployees(),
          fetchRoles(),
          fetchAppointments(),
          fetchServices(),
        ]);
      } catch {
        setError("Не удалось загрузить данные.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchEmployees, fetchRoles, fetchAppointments, fetchServices]);

  /* ========= Derived ========= */
  const roleById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  const roleOptions = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({
      key: `sys:${code}`,
      label: ruLabelSys(code),
    }));
    const cus = roles
      .filter((r) => !sysCodeFromName(r.name))
      .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));
    const seen = new Set();
    const out = [];
    for (const o of [...sys, ...cus]) {
      const k = o.label.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(o);
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [roles]);

  const roleFilterOptions = useMemo(
    () => [
      { key: "ALL", label: "Все роли" },
      ...roleOptions,
      { key: "NONE", label: "Без роли" },
    ],
    [roleOptions]
  );

  const filteredEmployees = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = employees;

    if (filterRole === "NONE") {
      base = base.filter((u) => !u.role && !u.custom_role);
    } else if (filterRole !== "ALL") {
      base = base.filter((u) => {
        if (filterRole.startsWith("sys:"))
          return u.role === filterRole.slice(4);
        if (filterRole.startsWith("cus:"))
          return String(u.custom_role) === filterRole.slice(4);
        return true;
      });
    }

    if (!t) return base;
    return base.filter((e) =>
      [fullName(e), e.email, e.role_display, ruLabelSys(e.role)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    );
  }, [employees, q, filterRole]);

  const rolesForList = useMemo(() => {
    const sys = SYSTEM_ROLES.map((code) => ({
      id: `sys:${code}`,
      name: ruLabelSys(code),
      _sys: true,
    }));
    const seen = new Set();
    const dedup = [];
    for (const r of roles) {
      if (sysCodeFromName(r.name)) continue;
      const k = String(r.name || "")
        .trim()
        .toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        dedup.push({ id: r.id, name: r.name || "", _sys: false });
      }
    }
    const base = [...sys, ...dedup].sort((a, b) =>
      a.name.localeCompare(b.name, "ru")
    );
    const t = q.trim().toLowerCase();
    if (!t) return base;
    return base.filter((r) => (r.name || "").toLowerCase().includes(t));
  }, [roles, q]);

  useEffect(() => {
    setPageEmp(1);
    setPageRole(1);
  }, [q, tab, filteredEmployees.length, rolesForList.length, filterRole]);

  const totalPagesEmp = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE)
  );
  const totalPagesRole = Math.max(
    1,
    Math.ceil(rolesForList.length / PAGE_SIZE)
  );
  const pageSafeEmp = Math.min(pageEmp, totalPagesEmp);
  const pageSafeRole = Math.min(pageRole, totalPagesRole);
  const empRows = filteredEmployees.slice(
    (pageSafeEmp - 1) * PAGE_SIZE,
    pageSafeEmp * PAGE_SIZE
  );
  const roleRows = rolesForList.slice(
    (pageSafeRole - 1) * PAGE_SIZE,
    pageSafeRole * PAGE_SIZE
  );

  // история мастера (барбершоп)
  const servicesById = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s));
    return m;
  }, [services]);

  const apptsByBarber = useMemo(() => {
    const map = new Map();
    appointments.forEach((a) => {
      if (!a.barber) return;
      const arr = map.get(a.barber) || [];
      arr.push(a);
      map.set(a.barber, arr);
    });
    return map;
  }, [appointments]);

  const openHistory = (u) => {
    setHistoryEmp(u);
    setPageHistory(1);
    setHistoryFrom("");
    setHistoryTo("");
    setNonBarberTab("sales"); // по умолчанию на вкладку продаж
    setPageSales(1);
    setPageProduct(1);
    setHistoryOpen(true);
  };
  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryEmp(null);
    setPageHistory(1);
    setHistoryFrom("");
    setHistoryTo("");
    setPageSales(1);
    setPageProduct(1);
    setNonBarberTab("sales");
    setNonBarberErr("");
  };

  // полная история по сотруднику (барбершоп, отсортирована DESC)
  const historyBaseList = useMemo(() => {
    if (!historyEmp?.id) return [];
    const list = (apptsByBarber.get(historyEmp.id) || []).slice();
    return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [historyEmp, apptsByBarber]);

  // фильтр по диапазону дат (используется и для не-барбершоп вкладок)
  const invalidRange = useMemo(
    () => historyFrom && historyTo && historyFrom > historyTo,
    [historyFrom, historyTo]
  );

  // ===== подгрузка данных при открытии истории (не-барбершоп) =====
  useEffect(() => {
    const needNonBarber = company?.sector?.name !== "Барбершоп";
    if (!historyOpen || !historyEmp || !needNonBarber) return;

    let alive = true;
    (async () => {
      try {
        setLoadingNonBarber(true);
        setNonBarberErr("");

        const [sales, product] = await Promise.all([
          fetchSalesForUser(historyEmp).catch((e) => {
            throw new Error(pickApiError(e, "Не удалось загрузить продажи."));
          }),
          fetchProductHistoryForUser(historyEmp).catch((e) => {
            throw new Error(
              pickApiError(e, "Не удалось загрузить историю товара.")
            );
          }),
        ]);

        if (!alive) return;

        setSalesByUser((prev) => {
          const m = new Map(prev);
          m.set(historyEmp.id, Array.isArray(sales) ? sales : []);
          return m;
        });
        setProdHistByUser((prev) => {
          const m = new Map(prev);
          m.set(historyEmp.id, Array.isArray(product) ? product : []);
          return m;
        });
      } catch (err) {
        if (!alive) return;
        setNonBarberErr(err?.message || "Ошибка загрузки данных.");
      } finally {
        if (alive) setLoadingNonBarber(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    historyOpen,
    historyEmp,
    company?.sector?.name,
    fetchSalesForUser,
    fetchProductHistoryForUser,
  ]);

  /* ===== Derived lists for non-barbershop tabs with date filters ===== */

  // SALES
  const salesBaseList = useMemo(() => {
    if (!historyEmp?.id) return [];
    const raw = salesByUser.get(historyEmp.id) || [];
    // сортировка по created_at DESC
    return raw
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [historyEmp, salesByUser]);

  const salesFiltered = useMemo(() => {
    let arr = salesBaseList;
    if (invalidRange) return [];
    if (historyFrom) {
      const tFrom = new Date(`${historyFrom}T00:00:00`).getTime();
      arr = arr.filter((a) => new Date(a.created_at).getTime() >= tFrom);
    }
    if (historyTo) {
      const tTo = new Date(`${historyTo}T23:59:59`).getTime();
      arr = arr.filter((a) => new Date(a.created_at).getTime() <= tTo);
    }
    return arr;
  }, [salesBaseList, historyFrom, historyTo, invalidRange]);

  const totalPagesSales = Math.max(
    1,
    Math.ceil(salesFiltered.length / HISTORY_PAGE_SIZE)
  );
  const pageSafeSales = Math.min(pageSales, totalPagesSales);
  const salesRows = salesFiltered.slice(
    (pageSafeSales - 1) * HISTORY_PAGE_SIZE,
    pageSafeSales * HISTORY_PAGE_SIZE
  );

  // PRODUCT HISTORY (фильтр по created_by_name уже был на этапе fetch; здесь только даты)
  const productBaseList = useMemo(() => {
    if (!historyEmp?.id) return [];
    const raw = prodHistByUser.get(historyEmp.id) || [];
    // нормализация даты: берем created_at (если нет — поле date)
    return raw.slice().sort((a, b) => {
      const aDt = a.created_at || a.date;
      const bDt = b.created_at || b.date;
      return new Date(bDt) - new Date(aDt);
    });
  }, [historyEmp, prodHistByUser]);

  const productFiltered = useMemo(() => {
    let arr = productBaseList;
    if (invalidRange) return [];
    if (historyFrom) {
      const tFrom = new Date(`${historyFrom}T00:00:00`).getTime();
      arr = arr.filter((a) => {
        const dt = a.created_at || `${a.date}T00:00:00`;
        return new Date(dt).getTime() >= tFrom;
      });
    }
    if (historyTo) {
      const tTo = new Date(`${historyTo}T23:59:59`).getTime();
      arr = arr.filter((a) => {
        const dt = a.created_at || `${a.date}T23:59:59`;
        return new Date(dt).getTime() <= tTo;
      });
    }
    return arr;
  }, [productBaseList, historyFrom, historyTo, invalidRange]);

  const totalPagesProduct = Math.max(
    1,
    Math.ceil(productFiltered.length / HISTORY_PAGE_SIZE)
  );
  const pageSafeProduct = Math.min(pageProduct, totalPagesProduct);
  const productRows = productFiltered.slice(
    (pageSafeProduct - 1) * HISTORY_PAGE_SIZE,
    pageSafeProduct * HISTORY_PAGE_SIZE
  );

  // инвалидация пагинаций при смене фильтра дат / вкладки
  useEffect(() => {
    setPageHistory(1);
    setPageSales(1);
    setPageProduct(1);
  }, [
    historyFrom,
    historyTo,
    nonBarberTab,
    historyFilteredLength(
      historyEmp,
      company?.sector?.name,
      salesFiltered,
      productFiltered
    ),
  ]);

  // утилита для зависимости (чтоб триггерить эффект при изменении длины списков)
  function historyFilteredLength(emp, sectorName, salesF, prodF) {
    if (!emp) return "0-0";
    if (sectorName === "Барбершоп") return `${historyBaseList.length}-0`;
    return `${salesF.length}-${prodF.length}`;
  }

  // полная история по сотруднику (барбершоп) после фильтров
  const historyFiltered = useMemo(() => {
    let arr = historyBaseList;
    if (invalidRange) return [];
    if (historyFrom) {
      const tFrom = new Date(`${historyFrom}T00:00:00`).getTime();
      arr = arr.filter((a) => new Date(a.start_at).getTime() >= tFrom);
    }
    if (historyTo) {
      const tTo = new Date(`${historyTo}T23:59:59`).getTime();
      arr = arr.filter((a) => new Date(a.start_at).getTime() <= tTo);
    }
    return arr;
  }, [historyBaseList, historyFrom, historyTo, invalidRange]);

  const totalPagesHistory = Math.max(
    1,
    Math.ceil(historyFiltered.length / HISTORY_PAGE_SIZE)
  );
  const pageSafeHistory = Math.min(pageHistory, totalPagesHistory);
  const historyRows = historyFiltered.slice(
    (pageSafeHistory - 1) * HISTORY_PAGE_SIZE,
    pageSafeHistory * HISTORY_PAGE_SIZE
  );

  /* ========= Validation ========= */
  const focusFirstInvalid = (errs) => {
    const order = ["email", "first_name", "last_name", "roleChoice"];
    const key = order.find((k) => errs[k]);
    if (key) {
      const el = document.querySelector(`.barbermasters__form [name="${key}"]`);
      if (el?.focus) el.focus();
    }
  };

  const validateEmployee = (form, isEdit = false, editId = null) => {
    const alerts = [];
    const errs = {};
    const email = normalizeEmail(form.email);
    if (!email) {
      errs.email = true;
      alerts.push("Укажите Email.");
    } else if (!emailRx.test(email)) {
      errs.email = true;
      alerts.push("Email указан неверно.");
    } else {
      const exists = employees.some(
        (u) => normalizeEmail(u.email) === email && (!isEdit || u.id !== editId)
      );
      if (exists) {
        errs.email = true;
        alerts.push("Сотрудник с таким Email уже существует.");
      }
    }
    const first = String(form.first_name || "").trim();
    const last = String(form.last_name || "").trim();
    if (!first) {
      errs.first_name = true;
      alerts.push("Укажите имя.");
    } else if (first.length < 2) {
      errs.first_name = true;
      alerts.push("Имя: минимум 2 символа.");
    }
    if (!last) {
      errs.last_name = true;
      alerts.push("Укажите фамилию.");
    } else if (last.length < 2) {
      errs.last_name = true;
      alerts.push("Фамилия: минимум 2 символа.");
    }
    if (!form.roleChoice) {
      errs.roleChoice = true;
      alerts.push("Выберите роль.");
    }
    return { errs, alerts };
  };

  /* ========= Roles CRUD ========= */
  const submitRoleCreate = async (e) => {
    e.preventDefault();
    const name = roleCreateName.trim();
    if (!name) return setRoleCreateErr("Укажите название роли.");
    if (sysCodeFromName(name))
      return setRoleCreateErr("Это имя занято системной ролью.");
    const dup = roles.some(
      (r) => normalizeRoleName(r.name) === normalizeRoleName(name)
    );
    if (dup) return setRoleCreateErr("Роль с таким названием уже существует.");

    setRoleCreateSaving(true);
    setRoleCreateErr("");
    try {
      await api.post(ROLE_CREATE_URL, { name });
      await fetchRoles();
      setRoleCreateOpen(false);
      setRoleCreateName("");
    } catch (err) {
      setRoleCreateErr(pickApiError(err, "Не удалось создать роль."));
    } finally {
      setRoleCreateSaving(false);
    }
  };

  const openRoleEdit = (r) => {
    if (r._sys) return;
    setRoleEditId(r.id);
    setRoleEditName(r.name || "");
    setRoleEditErr("");
    setRoleEditOpen(true);
  };

  const submitRoleEdit = async (e) => {
    e.preventDefault();
    if (!roleEditId) return;
    const name = roleEditName.trim();
    if (!name) return setRoleEditErr("Укажите название роли.");
    if (sysCodeFromName(name))
      return setRoleEditErr("Это имя зарезервировано системной ролью.");
    const dup = roles.some(
      (r) =>
        r.id !== roleEditId &&
        normalizeRoleName(r.name) === normalizeRoleName(name)
    );
    if (dup) return setRoleEditErr("Роль с таким названием уже существует.");

    setRoleEditSaving(true);
    setRoleEditErr("");
    try {
      await api.put(ROLE_ITEM_URL(roleEditId), { name });
      await fetchRoles();
      setRoleEditOpen(false);
      setRoleEditId(null);
      setRoleEditName("");
    } catch (err) {
      setRoleEditErr(pickApiError(err, "Не удалось обновить роль."));
    } finally {
      setRoleEditSaving(false);
    }
  };

  const doRemoveRole = async () => {
    const r = roleToDelete;
    if (!r || r._sys) return;
    setRoleDeletingIds((p) => new Set(p).add(r.id));
    setPageNotice("");
    try {
      await api.delete(ROLE_ITEM_URL(r.id));
      await fetchRoles();
    } catch (err) {
      setPageNotice(pickApiError(err, "Не удалось удалить роль."));
    } finally {
      setRoleDeletingIds((p) => {
        const n = new Set(p);
        n.delete(r.id);
        return n;
      });
      setRoleToDelete(null);
    }
  };

  /* ========= Employees CRUD ========= */
  const openEmpCreate = () => {
    setEmpAlerts([]);
    setEmpFieldErrors({});
    setEmpForm(emptyEmp);
    setEmpCreateOpen(true);
  };

  const submitEmployeeCreate = async (e) => {
    e.preventDefault();
    const { errs, alerts } = validateEmployee(empForm, false, null);
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstInvalid(errs);
      return;
    }
    const email = normalizeEmail(empForm.email);
    const payload = {
      email,
      first_name: empForm.first_name.trim(),
      last_name: empForm.last_name.trim(),
    };
    if (empForm.roleChoice.startsWith("sys:"))
      payload.role = empForm.roleChoice.slice(4);
    else if (empForm.roleChoice.startsWith("cus:"))
      payload.custom_role = empForm.roleChoice.slice(4);

    setEmpSaving(true);
    setEmpAlerts([]);
    try {
      const { data } = await api.post(EMPLOYEES_CREATE_URL, payload);
      await fetchEmployees();
      setEmployData(data);
      setOpenLogin(true);
      setEmpCreateOpen(false);
      setEmpForm(emptyEmp);
    } catch (err) {
      const msg = pickApiError(err, "Не удалось создать сотрудника.");
      setEmpAlerts([msg]);
    } finally {
      setEmpSaving(false);
    }
  };

  const openEmpEdit = (u) => {
    const roleChoice = u.role
      ? `sys:${u.role}`
      : u.custom_role
      ? `cus:${u.custom_role}`
      : "";
    setEditingEmpId(u.id);
    setEmpForm({
      email: u.email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      roleChoice,
    });
    setEmpAlerts([]);
    setEmpFieldErrors({});
    setEmpEditOpen(true);
  };

  const submitEmployeeEdit = async (e) => {
    e.preventDefault();
    if (!editingEmpId) return;
    const { errs, alerts } = validateEmployee(empForm, true, editingEmpId);
    if (alerts.length) {
      setEmpFieldErrors(errs);
      setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstInvalid(errs);
      return;
    }
    const payload = {
      email: normalizeEmail(empForm.email),
      first_name: empForm.first_name.trim(),
      last_name: empForm.last_name.trim(),
      role: null,
      custom_role: null,
    };
    if (empForm.roleChoice.startsWith("sys:"))
      payload.role = empForm.roleChoice.slice(4);
    else if (empForm.roleChoice.startsWith("cus:"))
      payload.custom_role = empForm.roleChoice.slice(4);

    setEmpSaving(true);
    setEmpAlerts([]);
    try {
      await api.put(EMPLOYEE_ITEM_URL(editingEmpId), payload);
      await fetchEmployees();
      setEmpEditOpen(false);
      setEditingEmpId(null);
      setEmpForm(emptyEmp);
    } catch (err) {
      const msg = pickApiError(err, "Не удалось обновить сотрудника.");
      setEmpAlerts([msg]);
    } finally {
      setEmpSaving(false);
    }
  };

  const doRemoveEmployee = async () => {
    const u = empToDelete;
    if (!u) return;
    setEmpDeletingIds((p) => new Set(p).add(u.id));
    setPageNotice("");
    try {
      await api.delete(EMPLOYEE_ITEM_URL(u.id));
      await fetchEmployees();
    } catch (err) {
      setPageNotice(pickApiError(err, "Не удалось удалить сотрудника."));
    } finally {
      setEmpDeletingIds((p) => {
        const n = new Set(p);
        n.delete(u.id);
        return n;
      });
      setEmpToDelete(null);
    }
  };

  /* ========= Small pager ========= */
  const Pager = ({ page, total, onChange }) => {
    if (total <= 1) return null;
    const onPrev = () => onChange(Math.max(1, page - 1));
    const onNext = () => onChange(Math.min(total, page + 1));
    const pages = new Set([1, page - 1, page, page + 1, total]);
    const list = [...pages]
      .filter((n) => n >= 1 && n <= total)
      .sort((a, b) => a - b);
    return (
      <nav className="barbermasters__pager" aria-label="Пагинация">
        <button
          className="barbermasters__pageBtn"
          onClick={onPrev}
          disabled={page === 1}
        >
          Назад
        </button>
        <ul className="barbermasters__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const gap = prev && n - prev > 1;
            return (
              <div key={n} className="barbermasters__pageItemWrap">
                {gap && <li className="barbermasters__dots">…</li>}
                <li>
                  <button
                    className={`barbermasters__pageBtn ${
                      n === page ? "is-active" : ""
                    }`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => onChange(n)}
                  >
                    {n}
                  </button>
                </li>
              </div>
            );
          })}
        </ul>
        <button
          className="barbermasters__pageBtn"
          onClick={onNext}
          disabled={page === total}
        >
          Далее
        </button>
      </nav>
    );
  };

  /* ===================== Render ===================== */
  return (
    <div className="barbermasters">
      <div className="barbermasters__header">
        <div className="barbermasters__titleWrap">
          <h2 className="barbermasters__title">{"Сотрудники"}</h2>
          <span className="barbermasters__subtitle">
            {loading
              ? "Загрузка…"
              : tab === "roles"
              ? `${rolesForList.length} ролей${
                  rolesForList.length > PAGE_SIZE
                    ? ` · стр. ${pageSafeRole}/${totalPagesRole}`
                    : ""
                }`
              : `${filteredEmployees.length} записей${
                  filteredEmployees.length > PAGE_SIZE
                    ? ` · стр. ${pageSafeEmp}/${totalPagesEmp}`
                    : ""
                }`}
          </span>
        </div>

        <div className="barbermasters__actions">
          <div className="barbermasters__tabs">
            <button
              type="button"
              className={`barbermasters__btn barbermasters__btn--secondary ${
                tab === "roles" ? "is-active" : ""
              }`}
              onClick={() => setTab("roles")}
            >
              Роли
            </button>
            <button
              type="button"
              className={`barbermasters__btn barbermasters__btn--secondary ${
                tab === "masters" ? "is-active" : ""
              }`}
              onClick={() => setTab("masters")}
            >
              Сотрудники
            </button>
          </div>

          {tab === "masters" && (
            <RoleSelect
              options={roleFilterOptions}
              value={filterRole}
              onChange={setFilterRole}
              placeholder="Все роли"
              hideCurrentLabelInMenu
              className="barbermasters__roleFilter"
            />
          )}

          <div className="barbermasters__search">
            <FaSearch className="barbermasters__searchIcon" />
            <input
              className="barbermasters__searchInput"
              placeholder={
                tab === "roles" ? "Поиск ролей…" : "Поиск по сотрудникам"
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {tab === "roles" ? (
            <button
              type="button"
              className="barbermasters__btn barbermasters__btn--primary"
              onClick={() => setRoleCreateOpen(true)}
            >
              <FaPlus />
            </button>
          ) : (
            <button
              type="button"
              className="barbermasters__btn barbermasters__btn--primary"
              onClick={openEmpCreate}
            >
              <FaPlus />
            </button>
          )}
        </div>
      </div>

      {!!error && <div className="barbermasters__alert">{error}</div>}
      {!!pageNotice && <div className="barbermasters__alert">{pageNotice}</div>}
      {loading && <div className="barbermasters__alert">Загрузка…</div>}

      {!loading && tab === "roles" && (
        <>
          <div className="barbermasters__list">
            {roleRows.map((r) => (
              <article key={r.id} className="barbermasters__card">
                <div className="barbermasters__cardLeft">
                  <div className="barbermasters__avatar">
                    {(r.name || "•").trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="barbermasters__nameRow">
                      <h4 className="barbermasters__name">
                        {r.name || "Без названия"}
                      </h4>
                    </div>
                    {r._sys && (
                      <div className="barbermasters__meta">
                        <span className="bm-item">Системная роль</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="barbermasters__cardActions">
                  <button
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => openRoleEdit(r)}
                    disabled={r._sys}
                    title={
                      r._sys
                        ? "Системные роли нельзя изменять"
                        : "Редактировать"
                    }
                  >
                    <FaEdit />{" "}
                    <span className="barbermasters__btnText">
                      Редактировать
                    </span>
                  </button>
                  <button
                    className="barbermasters__btn barbermasters__btn--danger"
                    onClick={() => setRoleToDelete(r)}
                    disabled={r._sys || roleDeletingIds.has(r.id)}
                    title={r._sys ? "Системные роли нельзя удалять" : "Удалить"}
                  >
                    <FaTrash />{" "}
                    <span className="barbermasters__btnText">
                      {roleDeletingIds.has(r.id) ? "Удаление…" : "Удалить"}
                    </span>
                  </button>
                </div>
              </article>
            ))}
            {rolesForList.length === 0 && (
              <div className="barbermasters__alert">Пока нет ролей.</div>
            )}
          </div>

          {rolesForList.length > PAGE_SIZE && (
            <Pager
              page={pageSafeRole}
              total={totalPagesRole}
              onChange={setPageRole}
            />
          )}
        </>
      )}

      {!loading && tab === "masters" && (
        <>
          <div className="barbermasters__list">
            {empRows.map((u) => {
              const initial =
                (fullName(u) || u.email || "•")
                  .trim()
                  .charAt(0)
                  .toUpperCase() || "•";
              const roleLabel = u.role
                ? ruLabelSys(u.role)
                : roles.length
                ? roleById.get(u.custom_role)?.name || u.role_display || "—"
                : u.role_display || "—";
              return (
                <article key={u.id} className="barbermasters__card">
                  <div className="barbermasters__cardLeft">
                    <div className="barbermasters__avatar">{initial}</div>
                    <div>
                      <div className="barbermasters__nameRow">
                        <h4 className="barbermasters__name">
                          {fullName(u) || "Без имени"}
                        </h4>
                      </div>
                      <div className="barbermasters__meta">
                        <span className="bm-item">{u.email || "—"}</span>
                        <span className="bm-item">{roleLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="barbermasters__cardActions">
                    <button
                      className="barbermasters__btn barbermasters__btn--secondary"
                      onClick={() => openHistory(u)}
                      title="История"
                    >
                      <FaSearch />{" "}
                      <span className="barbermasters__btnText">История</span>
                    </button>
                    <button
                      className="barbermasters__btn barbermasters__btn--secondary"
                      onClick={() => openEmpEdit(u)}
                      title={`Редактировать сотрудника
                      `}
                    >
                      <FaEdit />{" "}
                      <span className="barbermasters__btnText">
                        Редактировать
                      </span>
                    </button>
                    <button
                      className="barbermasters__btn barbermasters__btn--danger"
                      onClick={() => setEmpToDelete(u)}
                      disabled={empDeletingIds.has(u.id)}
                      title={`Удалить ${"сотрудника"}`}
                    >
                      <FaTrash />{" "}
                      <span className="barbermasters__btnText">
                        {empDeletingIds.has(u.id) ? "Удаление…" : "Удалить"}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredEmployees.length === 0 && employees.length > 0 && (
              <div className="barbermasters__alert">Ничего не найдено.</div>
            )}
            {!loading && employees.length === 0 && (
              <div className="barbermasters__alert">Пока нет сотрудников.</div>
            )}
          </div>

          {filteredEmployees.length > PAGE_SIZE && (
            <Pager
              page={pageSafeEmp}
              total={totalPagesEmp}
              onChange={setPageEmp}
            />
          )}
        </>
      )}

      {/* ===== Roles: create ===== */}
      {roleCreateOpen && (
        <div
          className="barbermasters__overlay"
          onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
        >
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Новая роль</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form
              className="barbermasters__form"
              onSubmit={submitRoleCreate}
              noValidate
            >
              <div className="barbermasters__grid">
                <label className="barbermasters__field barbermasters__field--full">
                  <span className="barbermasters__label">
                    Название роли <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className="barbermasters__input"
                    placeholder="Например: Контент-менеджер"
                    value={roleCreateName}
                    onChange={(e) => setRoleCreateName(e.target.value)}
                    required
                  />
                </label>
              </div>

              {!!roleCreateErr && (
                <div className="barbermasters__alert barbermasters__alert--inModal">
                  {roleCreateErr}
                </div>
              )}

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setRoleCreateOpen(false)}
                    disabled={roleCreateSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={roleCreateSaving}
                  >
                    {roleCreateSaving ? "Сохранение…" : "Создать роль"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Roles: edit ===== */}
      {roleEditOpen && (
        <div
          className="barbermasters__overlay"
          onClick={() => !roleEditSaving && setRoleEditOpen(false)}
        >
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Изменить роль</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !roleEditSaving && setRoleEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {!!roleEditErr && (
              <div className="barbermasters__alert barbermasters__alert--inModal">
                {roleEditErr}
              </div>
            )}

            <form
              className="barbermasters__form"
              onSubmit={submitRoleEdit}
              noValidate
            >
              <div className="barbermasters__grid">
                <label className="barbermasters__field barbermasters__field--full">
                  <span className="barbermasters__label">
                    Название роли <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    className="barbermasters__input"
                    placeholder="Название роли"
                    value={roleEditName}
                    onChange={(e) => setRoleEditName(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setRoleEditOpen(false)}
                    disabled={roleEditSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={roleEditSaving}
                  >
                    {roleEditSaving ? "Сохранение…" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Employees: create ===== */}
      {empCreateOpen && (
        <div
          className="barbermasters__overlay"
          onClick={() => !empSaving && setEmpCreateOpen(false)}
        >
          <div
            className="barbermasters__modal barbermasters__modal--taller"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Новый сотрудник</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !empSaving && setEmpCreateOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {empAlerts.length > 0 && (
              <div className="barbermasters__alert barbermasters__alert--inModal">
                {empAlerts.length === 1 ? (
                  empAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {empAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form
              className="barbermasters__form"
              onSubmit={submitEmployeeCreate}
              noValidate
            >
              <div className="barbermasters__grid">
                <label
                  className={`barbermasters__field ${
                    empFieldErrors.email ? "barbermasters__field--invalid" : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Email <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    className={`barbermasters__input ${
                      empFieldErrors.email
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="user@mail.com"
                    value={empForm.email}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, email: e.target.value }))
                    }
                    required
                  />
                </label>

                <label
                  className={`barbermasters__field ${
                    empFieldErrors.first_name
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Имя <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="first_name"
                    className={`barbermasters__input ${
                      empFieldErrors.first_name
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Имя"
                    value={empForm.first_name}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, first_name: e.target.value }))
                    }
                    required
                  />
                </label>

                <label
                  className={`barbermasters__field ${
                    empFieldErrors.last_name
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Фамилия <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="last_name"
                    className={`barbermasters__input ${
                      empFieldErrors.last_name
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Фамилия"
                    value={empForm.last_name}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, last_name: e.target.value }))
                    }
                    required
                  />
                </label>

                <div
                  className={`barbermasters__field barbermasters__field--full ${
                    empFieldErrors.roleChoice
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Роль <b className="barbermasters__req">*</b>
                  </span>
                  <RoleSelect
                    options={roleOptions}
                    value={empForm.roleChoice}
                    onChange={(key) =>
                      setEmpForm((p) => ({ ...p, roleChoice: key }))
                    }
                    placeholder="Выберите роль"
                    className="barbermasters__roleSelect"
                  />
                  <input
                    name="roleChoice"
                    value={empForm.roleChoice}
                    hidden
                    readOnly
                  />
                </div>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setEmpCreateOpen(false)}
                    disabled={empSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={empSaving}
                  >
                    {empSaving ? "Сохранение…" : "Создать сотрудника"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Employees: edit ===== */}
      {empEditOpen && (
        <div
          className="barbermasters__overlay"
          onClick={() => !empSaving && setEmpEditOpen(false)}
        >
          <div
            className="barbermasters__modal barbermasters__modal--taller"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">
                Редактировать сотрудника
              </h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => !empSaving && setEmpEditOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {empAlerts.length > 0 && (
              <div className="barbermasters__alert barbermasters__alert--inModal">
                {empAlerts.length === 1 ? (
                  empAlerts[0]
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {empAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form
              className="barbermasters__form"
              onSubmit={submitEmployeeEdit}
              noValidate
            >
              <div className="barbermasters__grid">
                <label
                  className={`barbermasters__field ${
                    empFieldErrors.email ? "barbermasters__field--invalid" : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Email <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    className={`barbermasters__input ${
                      empFieldErrors.email
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="user@mail.com"
                    value={empForm.email}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, email: e.target.value }))
                    }
                    required
                  />
                </label>

                <label
                  className={`barbermasters__field ${
                    empFieldErrors.first_name
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Имя <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="first_name"
                    className={`barbermasters__input ${
                      empFieldErrors.first_name
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Имя"
                    value={empForm.first_name}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, first_name: e.target.value }))
                    }
                    required
                  />
                </label>

                <label
                  className={`barbermasters__field ${
                    empFieldErrors.last_name
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Фамилия <b className="barbermasters__req">*</b>
                  </span>
                  <input
                    name="last_name"
                    className={`barbermasters__input ${
                      empFieldErrors.last_name
                        ? "barbermasters__input--invalid"
                        : ""
                    }`}
                    placeholder="Фамилия"
                    value={empForm.last_name}
                    onChange={(e) =>
                      setEmpForm((p) => ({ ...p, last_name: e.target.value }))
                    }
                    required
                  />
                </label>

                <div
                  className={`barbermasters__field barbermasters__field--full ${
                    empFieldErrors.roleChoice
                      ? "barbermasters__field--invalid"
                      : ""
                  }`}
                >
                  <span className="barbermasters__label">
                    Роль <b className="barbermasters__req">*</b>
                  </span>
                  <RoleSelect
                    options={roleOptions}
                    value={empForm.roleChoice}
                    onChange={(key) =>
                      setEmpForm((p) => ({ ...p, roleChoice: key }))
                    }
                    placeholder="Выберите роль"
                    className="barbermasters__roleSelect"
                  />
                  <input
                    name="roleChoice"
                    value={empForm.roleChoice}
                    hidden
                    readOnly
                  />
                </div>
              </div>

              <div className="barbermasters__footer">
                <span className="barbermasters__spacer" />
                <div className="barbermasters__footerRight">
                  <button
                    type="button"
                    className="barbermasters__btn barbermasters__btn--secondary"
                    onClick={() => setEmpEditOpen(false)}
                    disabled={empSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barbermasters__btn barbermasters__btn--primary"
                    disabled={empSaving}
                  >
                    {empSaving ? "Сохранение…" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== New employee credentials ===== */}
      {openLogin && (
        <div
          className="barbermasters__overlay"
          onClick={() => setOpenLogin(false)}
        >
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Логин сотрудника</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => setOpenLogin(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              <p className="barbermasters__label">
                Логин: <b>{employData?.email}</b>
                <button
                  className="barbermasters__iconBtn barbermasters__copyBtn"
                  onClick={() =>
                    copyToClipboard(employData?.email || "", "email")
                  }
                  aria-label="Скопировать логин"
                  title={copied === "email" ? "Скопировано!" : "Скопировать"}
                >
                  {copied === "email" ? <FaCheck /> : <FaCopy />}
                </button>
              </p>

              <p className="barbermasters__label">
                Пароль: <b>{employData?.generated_password}</b>
                <button
                  className="barbermasters__iconBtn barbermasters__copyBtn"
                  onClick={() =>
                    copyToClipboard(
                      employData?.generated_password || "",
                      "password"
                    )
                  }
                  aria-label="Скопировать пароль"
                  title={copied === "password" ? "Скопировано!" : "Скопировать"}
                >
                  {copied === "password" ? <FaCheck /> : <FaCopy />}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete role ===== */}
      {roleToDelete && (
        <div
          className="barbermasters__overlay"
          onClick={() => setRoleToDelete(null)}
        >
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Удалить роль</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => setRoleToDelete(null)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              Вы действительно хотите удалить роль «{roleToDelete.name || "—"}»?
              Действие необратимо.
            </div>
            <div className="barbermasters__footer">
              <span className="barbermasters__spacer" />
              <div className="barbermasters__footerRight">
                <button
                  className="barbermasters__btn barbermasters__btn--secondary"
                  onClick={() => setRoleToDelete(null)}
                >
                  Отмена
                </button>
                <button
                  className="barbermasters__btn barbermasters__btn--danger"
                  onClick={doRemoveRole}
                  disabled={roleDeletingIds.has(roleToDelete.id)}
                >
                  {roleDeletingIds.has(roleToDelete.id)
                    ? "Удаление…"
                    : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete employee ===== */}
      {empToDelete && (
        <div
          className="barbermasters__overlay"
          onClick={() => setEmpToDelete(null)}
        >
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">Удалить сотрудника</h3>
              <button
                className="barbermasters__iconBtn"
                onClick={() => setEmpToDelete(null)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>
            <div className="barbermasters__content">
              Удалить «{fullName(empToDelete) || empToDelete.email || "—"}»?
              Действие необратимо.
            </div>
            <div className="barbermasters__footer">
              <span className="barbermasters__spacer" />
              <div className="barbermasters__footerRight">
                <button
                  className="barbermasters__btn barbermasters__btn--secondary"
                  onClick={() => setEmpToDelete(null)}
                >
                  Отмена
                </button>
                <button
                  className="barbermasters__btn barbermasters__btn--danger"
                  onClick={doRemoveEmployee}
                  disabled={empDeletingIds.has(empToDelete.id)}
                >
                  {empDeletingIds.has(empToDelete.id) ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== History (with date range filter) ===== */}
      {historyOpen && (
        <div className="barbermasters__overlay" onClick={closeHistory}>
          <div
            className="barbermasters__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barbermasters__modalHeader">
              <h3 className="barbermasters__modalTitle">
                История — {fullName(historyEmp) || historyEmp?.email}
              </h3>
              <button
                className="barbermasters__iconBtn"
                onClick={closeHistory}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="barbermasters__content">
              {/* Фильтр дат */}
              <div className="barbermasters__inlineFilter">
                <label
                  className={`barbermasters__field ${
                    invalidRange ? "barbermasters__field--invalid" : ""
                  }`}
                >
                  <span className="barbermasters__label">От</span>
                  <input
                    type="date"
                    className="barbermasters__input"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                  />
                </label>
                <label
                  className={`barbermasters__field ${
                    invalidRange ? "barbermasters__field--invalid" : ""
                  }`}
                >
                  <span className="barbermasters__label">До</span>
                  <input
                    type="date"
                    className="barbermasters__input"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="barbermasters__btn barbermasters__btn--secondary"
                  onClick={() => {
                    setHistoryFrom("");
                    setHistoryTo("");
                  }}
                  title="Сбросить фильтр"
                >
                  Сброс
                </button>
              </div>

              {invalidRange && (
                <div className="barbermasters__alert">
                  Диапазон дат неверен: «От» позже «До».
                </div>
              )}

              {company.sector.name === "Барбершоп" && (
                <>
                  {historyFiltered.length === 0 ? (
                    <div className="barbermasters__alert">Записей нет</div>
                  ) : (
                    <>
                      <div className="barbermasters__list">
                        {historyRows.map((a) => {
                          const date = dateISO(a.start_at);
                          const time = timeISO(a.start_at);
                          const client =
                            a.client_name ||
                            (a.client ? `ID ${a.client}` : "—");
                          const svcObj = servicesById.get(a.service);
                          const service =
                            a.service_name ||
                            svcObj?.service_name ||
                            svcObj?.name ||
                            "—";
                          const priceVal =
                            a.service_price ?? a.price ?? svcObj?.price;
                          return (
                            <article key={a.id} className="barbermasters__card">
                              <div className="barbermasters__cardLeft">
                                <div>
                                  <div className="barbermasters__nameRow">
                                    <h4 className="barbermasters__name">
                                      {date} • {time}
                                    </h4>
                                  </div>
                                  <div className="barbermasters__meta">
                                    <span className="bm-item">
                                      Клиент: {client}
                                    </span>
                                    <span className="bm-item">
                                      Услуга: {service}
                                    </span>
                                    <span className="bm-item">
                                      Цена: {fmtMoney(priceVal)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {historyFiltered.length > HISTORY_PAGE_SIZE && (
                        <Pager
                          page={pageSafeHistory}
                          total={totalPagesHistory}
                          onChange={setPageHistory}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              {company.sector.name !== "Барбершоп" && (
                <>
                  {/* Вкладки */}
                  <div
                    className="barbermasters__tabs"
                    style={{ marginBottom: 12 }}
                  >
                    <button
                      type="button"
                      className={`barbermasters__btn barbermasters__btn--secondary ${
                        nonBarberTab === "sales" ? "is-active" : ""
                      }`}
                      onClick={() => setNonBarberTab("sales")}
                    >
                      История продаж
                    </button>
                    <button
                      type="button"
                      className={`barbermasters__btn barbermasters__btn--secondary ${
                        nonBarberTab === "product" ? "is-active" : ""
                      }`}
                      onClick={() => setNonBarberTab("product")}
                      style={{ marginLeft: 8 }}
                    >
                      История товара
                    </button>
                  </div>

                  {nonBarberErr && (
                    <div className="barbermasters__alert">{nonBarberErr}</div>
                  )}
                  {loadingNonBarber && (
                    <div className="barbermasters__alert">Загрузка…</div>
                  )}

                  {/* === SALES TAB === */}
                  {nonBarberTab === "sales" && !loadingNonBarber && (
                    <>
                      {salesFiltered.length === 0 ? (
                        <div className="barbermasters__alert">Записей нет</div>
                      ) : (
                        <>
                          <div className="barbermasters__list">
                            {salesRows.map((s) => {
                              const dt = s.created_at;
                              const date = dateISO(dt);
                              const time = timeISO(dt);
                              const client =
                                s.client_name ||
                                (s.client ? `ID ${s.client}` : "—");
                              return (
                                <article
                                  key={s.id}
                                  className="barbermasters__card"
                                >
                                  <div className="barbermasters__cardLeft">
                                    <div>
                                      <div className="barbermasters__nameRow">
                                        <h4 className="barbermasters__name">
                                          {date} • {time} — {s.status || "—"}
                                        </h4>
                                      </div>
                                      <div className="barbermasters__meta">
                                        <span className="bm-item">
                                          Клиент: {client}
                                        </span>
                                        <span className="bm-item">
                                          Сумма: {fmtMoney(s.total)}
                                        </span>
                                        <span className="bm-item">
                                          Скидка: {fmtMoney(s.discount_total)}
                                        </span>
                                        <span className="bm-item">
                                          Налог: {fmtMoney(s.tax_total)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                          {salesFiltered.length > HISTORY_PAGE_SIZE && (
                            <Pager
                              page={pageSafeSales}
                              total={totalPagesSales}
                              onChange={setPageSales}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* === PRODUCT TAB === */}
                  {nonBarberTab === "product" && !loadingNonBarber && (
                    <>
                      {productFiltered.length === 0 ? (
                        <div className="barbermasters__alert">Записей нет</div>
                      ) : (
                        <>
                          <div className="barbermasters__list">
                            {productRows.map((p) => {
                              const dt = p.created_at || `${p.date}T00:00:00`;
                              const date = dateISO(dt);
                              const time = timeISO(dt);
                              return (
                                <article
                                  key={p.id}
                                  className="barbermasters__card"
                                >
                                  <div className="barbermasters__cardLeft">
                                    <div>
                                      <div className="barbermasters__nameRow">
                                        <h4 className="barbermasters__name">
                                          {date} • {time} — {p.name || "—"}
                                        </h4>
                                      </div>
                                      <div className="barbermasters__meta">
                                        <span className="bm-item">
                                          Бренд: {p.brand || "—"}
                                        </span>
                                        <span className="bm-item">
                                          Категория: {p.category || "—"}
                                        </span>
                                        <span className="bm-item">
                                          Баркод: {p.barcode || "—"}
                                        </span>
                                        <span className="bm-item">
                                          Кол-во: {p.quantity ?? "—"}
                                        </span>
                                        <span className="bm-item">
                                          Цена продажи: {fmtMoney(p.price)}
                                        </span>
                                        <span className="bm-item">
                                          Закуп: {fmtMoney(p.purchase_price)}
                                        </span>
                                        <span className="bm-item">
                                          Автор: {p.created_by_name || "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                          {productFiltered.length > HISTORY_PAGE_SIZE && (
                            <Pager
                              page={pageSafeProduct}
                              total={totalPagesProduct}
                              onChange={setPageProduct}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="barbermasters__footer">
              <button
                className="barbermasters__btn barbermasters__btn--secondary"
                onClick={closeHistory}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {openLogin && null}
    </div>
  );
};

export default Masters;

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   FaCheck,
//   FaCopy,
//   FaEdit,
//   FaPlus,
//   FaSearch,
//   FaTimes,
//   FaTrash,
// } from "react-icons/fa";
// import api from "../../../../api";
// import { useUser } from "../../../../store/slices/userSlice";
// import "./Masters.scss";

// /* ===================== API endpoints ===================== */
// const EMPLOYEES_LIST_URL = "/users/employees/";
// const EMPLOYEES_CREATE_URL = "/users/employees/create/";
// const EMPLOYEE_ITEM_URL = (id) => `/users/employees/${id}/`;

// const ROLES_LIST_URL = "/users/roles/";
// const ROLE_CREATE_URL = "/users/roles/custom/";
// const ROLE_ITEM_URL = (id) => `/users/roles/custom/${id}/`;

// /* ===================== Helpers ===================== */
// const SYSTEM_ROLES = ["owner", "admin"];
// const PAGE_SIZE = 12;
// const MENU_PAGE_SIZE = 10;
// const HISTORY_PAGE_SIZE = 12;

// const pad = (n) => String(n).padStart(2, "0");
// const dateISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return "";
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// };
// const timeISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return "";
//   return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// };
// const fmtMoney = (v) =>
//   v === null || v === undefined || v === ""
//     ? "—"
//     : `${Number(v).toLocaleString("ru-RU")} сом`;

// const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
// const normalizeEmail = (s) =>
//   String(s || "")
//     .trim()
//     .toLowerCase();
// const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// const normalizeEmployee = (e = {}) => ({
//   id: e.id,
//   email: e.email ?? "",
//   first_name: e.first_name ?? "",
//   last_name: e.last_name ?? "",
//   role: e.role ?? null,
//   custom_role: e.custom_role ?? null,
//   role_display: e.role_display ?? "",
// });
// const fullName = (e) =>
//   [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim();

// const ruLabelSys = (c) =>
//   c === "owner" ? "Владелец" : c === "admin" ? "Администратор" : c || "";
// const sysCodeFromName = (n) => {
//   const l = String(n || "")
//     .trim()
//     .toLowerCase();
//   if (["admin", "administrator", "админ", "администратор"].includes(l))
//     return "admin";
//   if (["owner", "владелец"].includes(l)) return "owner";
//   return null;
// };
// const normalizeRoleName = (s) =>
//   String(s || "")
//     .trim()
//     .replace(/\s+/g, " ")
//     .toLowerCase();

// const pickApiError = (e, fb) => {
//   const d = e?.response?.data;
//   if (!d) return fb;
//   if (typeof d === "string") return d;
//   if (typeof d === "object") {
//     try {
//       const k = Object.keys(d)[0];
//       const v = Array.isArray(d[k]) ? d[k][0] : d[k];
//       return String(v || fb);
//     } catch {
//       return fb;
//     }
//   }
//   return fb;
// };

// /* ===================== Reusable searchable select ===================== */
// const RoleSelect = ({
//   options,
//   value,
//   onChange,
//   placeholder,
//   className = "",
//   hideCurrentLabelInMenu = false,
// }) => {
//   const [open, setOpen] = useState(false);
//   const [q, setQ] = useState("");
//   const [page, setPage] = useState(1);
//   const refWrap = useRef(null);

//   const labelByKey = useMemo(() => {
//     const m = new Map();
//     options.forEach((o) => m.set(o.key, o.label));
//     return m;
//   }, [options]);

//   const filtered = useMemo(() => {
//     const txt = q.trim().toLowerCase();
//     let list = !txt
//       ? options
//       : options.filter((o) => o.label.toLowerCase().includes(txt));
//     if (hideCurrentLabelInMenu)
//       list = list.filter((o) => o.label !== placeholder);
//     return list;
//   }, [options, q, hideCurrentLabelInMenu, placeholder]);

//   const total = Math.max(1, Math.ceil(filtered.length / MENU_PAGE_SIZE));
//   const safe = Math.min(page, total);
//   const rows = filtered.slice(
//     (safe - 1) * MENU_PAGE_SIZE,
//     safe * MENU_PAGE_SIZE
//   );

//   useEffect(() => setPage(1), [q, open, options.length]);

//   useEffect(() => {
//     if (!open) return;
//     const onDoc = (e) => {
//       if (!refWrap.current) return;
//       if (!refWrap.current.contains(e.target)) setOpen(false);
//     };
//     const onEsc = (e) => e.key === "Escape" && setOpen(false);
//     document.addEventListener("mousedown", onDoc);
//     document.addEventListener("keydown", onEsc);
//     return () => {
//       document.removeEventListener("mousedown", onDoc);
//       document.removeEventListener("keydown", onEsc);
//     };
//   }, [open]);

//   return (
//     <div
//       className={`barbermasters__select ${open ? "is-open" : ""} ${className}`}
//       ref={refWrap}
//     >
//       <button
//         type="button"
//         className="barbermasters__selectControl"
//         onClick={() => setOpen((s) => !s)}
//         aria-haspopup="listbox"
//         aria-expanded={open}
//       >
//         <span
//           className={`barbermasters__selectValue ${
//             value ? "" : "is-placeholder"
//           }`}
//         >
//           {value ? labelByKey.get(value) || placeholder : placeholder}
//         </span>
//         <span className="barbermasters__selectCaret" aria-hidden />
//       </button>

//       {open && (
//         <div className="barbermasters__selectMenu" role="listbox">
//           <div className="barbermasters__selectSearch">
//             <FaSearch className="barbermasters__selectSearchIcon" />
//             <input
//               className="barbermasters__selectSearchInput"
//               placeholder="Поиск роли…"
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//               autoFocus
//             />
//           </div>

//           <div className="barbermasters__selectList" tabIndex={-1}>
//             {rows.length === 0 ? (
//               <div className="barbermasters__selectEmpty">
//                 Ничего не найдено
//               </div>
//             ) : (
//               rows.map((o) => (
//                 <button
//                   key={o.key}
//                   type="button"
//                   className={`barbermasters__selectItem ${
//                     o.key === value ? "is-active" : ""
//                   }`}
//                   onClick={() => {
//                     onChange(o.key);
//                     setOpen(false);
//                   }}
//                 >
//                   {o.label}
//                 </button>
//               ))
//             )}
//           </div>

//           {filtered.length > MENU_PAGE_SIZE && (
//             <div className="barbermasters__selectPager">
//               <button
//                 className="barbermasters__selectPageBtn"
//                 onClick={() => setPage((p) => Math.max(1, p - 1))}
//                 disabled={safe === 1}
//               >
//                 Назад
//               </button>
//               <span className="barbermasters__selectPageInfo">
//                 Стр. {safe}/{total}
//               </span>
//               <button
//                 className="barbermasters__selectPageBtn"
//                 onClick={() => setPage((p) => Math.min(total, p + 1))}
//                 disabled={safe === total}
//               >
//                 Далее
//               </button>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// /* ===================== Main component ===================== */
// const Masters = () => {
//   const { company } = useUser();
//   const isMaster = company?.sector?.name === "Барбершоп";

//   const [tab, setTab] = useState("masters");

//   const [employees, setEmployees] = useState([]);
//   const [roles, setRoles] = useState([]);
//   const [appointments, setAppointments] = useState([]);
//   const [services, setServices] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [pageNotice, setPageNotice] = useState("");

//   // поиск + фильтры
//   const [q, setQ] = useState("");
//   const [filterRole, setFilterRole] = useState("ALL");

//   // списки / пагинация
//   const [pageEmp, setPageEmp] = useState(1);
//   const [pageRole, setPageRole] = useState(1);

//   // роли CRUD
//   const [roleCreateOpen, setRoleCreateOpen] = useState(false);
//   const [roleCreateName, setRoleCreateName] = useState("");
//   const [roleCreateSaving, setRoleCreateSaving] = useState(false);
//   const [roleCreateErr, setRoleCreateErr] = useState("");

//   const [roleEditOpen, setRoleEditOpen] = useState(false);
//   const [roleEditId, setRoleEditId] = useState(null);
//   const [roleEditName, setRoleEditName] = useState("");
//   const [roleEditSaving, setRoleEditSaving] = useState(false);
//   const [roleEditErr, setRoleEditErr] = useState("");

//   const [roleDeletingIds, setRoleDeletingIds] = useState(new Set());
//   const [roleToDelete, setRoleToDelete] = useState(null);

//   // сотрудники CRUD
//   const [empCreateOpen, setEmpCreateOpen] = useState(false);
//   const [empEditOpen, setEmpEditOpen] = useState(false);
//   const [empSaving, setEmpSaving] = useState(false);
//   const [empAlerts, setEmpAlerts] = useState([]);
//   const [empFieldErrors, setEmpFieldErrors] = useState({});
//   const [empDeletingIds, setEmpDeletingIds] = useState(new Set());
//   const [empToDelete, setEmpToDelete] = useState(null);
//   const emptyEmp = { email: "", first_name: "", last_name: "", roleChoice: "" };
//   const [empForm, setEmpForm] = useState(emptyEmp);
//   const [editingEmpId, setEditingEmpId] = useState(null);

//   // логин нового
//   const [openLogin, setOpenLogin] = useState(false);
//   const [employData, setEmployData] = useState(null);
//   const [copied, setCopied] = useState(null);

//   // история
//   const [historyOpen, setHistoryOpen] = useState(false);
//   const [historyEmp, setHistoryEmp] = useState(null);
//   const [pageHistory, setPageHistory] = useState(1);
//   const [historyFrom, setHistoryFrom] = useState(""); // YYYY-MM-DD
//   const [historyTo, setHistoryTo] = useState(""); // YYYY-MM-DD

//   const copyToClipboard = async (text, key) => {
//     if (!text) return;
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopied(key);
//       setTimeout(() => setCopied(null), 1500);
//     } catch {}
//   };

//   /* ========= Fetch ========= */
//   const fetchEmployees = useCallback(async () => {
//     const res = await api.get(EMPLOYEES_LIST_URL);
//     setEmployees(asArray(res.data).map(normalizeEmployee));
//   }, []);
//   const fetchRoles = useCallback(async () => {
//     const res = await api.get(ROLES_LIST_URL);
//     setRoles(asArray(res.data).map((r) => ({ id: r.id, name: r.name || "" })));
//   }, []);
//   const fetchAppointments = useCallback(async () => {
//     const res = await api.get("/barbershop/appointments/");
//     setAppointments(asArray(res.data));
//   }, []);
//   const fetchServices = useCallback(async () => {
//     const res = await api.get("/barbershop/services/");
//     setServices(asArray(res.data));
//   }, []);

//   useEffect(() => {
//     (async () => {
//       try {
//         setLoading(true);
//         setError("");
//         await Promise.all([
//           fetchEmployees(),
//           fetchRoles(),
//           fetchAppointments(),
//           fetchServices(),
//         ]);
//       } catch {
//         setError("Не удалось загрузить данные.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [fetchEmployees, fetchRoles, fetchAppointments, fetchServices]);

//   /* ========= Derived ========= */
//   const roleById = useMemo(() => {
//     const m = new Map();
//     roles.forEach((r) => m.set(r.id, r));
//     return m;
//   }, [roles]);

//   const roleOptions = useMemo(() => {
//     const sys = SYSTEM_ROLES.map((code) => ({
//       key: `sys:${code}`,
//       label: ruLabelSys(code),
//     }));
//     const cus = roles
//       .filter((r) => !sysCodeFromName(r.name))
//       .map((r) => ({ key: `cus:${r.id}`, label: String(r.name || "").trim() }));
//     const seen = new Set();
//     const out = [];
//     for (const o of [...sys, ...cus]) {
//       const k = o.label.trim().toLowerCase();
//       if (!seen.has(k)) {
//         seen.add(k);
//         out.push(o);
//       }
//     }
//     return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
//   }, [roles]);

//   const roleFilterOptions = useMemo(
//     () => [
//       { key: "ALL", label: "Все роли" },
//       ...roleOptions,
//       { key: "NONE", label: "Без роли" },
//     ],
//     [roleOptions]
//   );

//   const filteredEmployees = useMemo(() => {
//     const t = q.trim().toLowerCase();
//     let base = employees;

//     if (filterRole === "NONE") {
//       base = base.filter((u) => !u.role && !u.custom_role);
//     } else if (filterRole !== "ALL") {
//       base = base.filter((u) => {
//         if (filterRole.startsWith("sys:"))
//           return u.role === filterRole.slice(4);
//         if (filterRole.startsWith("cus:"))
//           return String(u.custom_role) === filterRole.slice(4);
//         return true;
//       });
//     }

//     if (!t) return base;
//     return base.filter((e) =>
//       [fullName(e), e.email, e.role_display, ruLabelSys(e.role)]
//         .filter(Boolean)
//         .some((v) => String(v).toLowerCase().includes(t))
//     );
//   }, [employees, q, filterRole]);

//   const rolesForList = useMemo(() => {
//     const sys = SYSTEM_ROLES.map((code) => ({
//       id: `sys:${code}`,
//       name: ruLabelSys(code),
//       _sys: true,
//     }));
//     const seen = new Set();
//     const dedup = [];
//     for (const r of roles) {
//       if (sysCodeFromName(r.name)) continue;
//       const k = String(r.name || "")
//         .trim()
//         .toLowerCase();
//       if (!seen.has(k)) {
//         seen.add(k);
//         dedup.push({ id: r.id, name: r.name || "", _sys: false });
//       }
//     }
//     const base = [...sys, ...dedup].sort((a, b) =>
//       a.name.localeCompare(b.name, "ru")
//     );
//     const t = q.trim().toLowerCase();
//     if (!t) return base;
//     return base.filter((r) => (r.name || "").toLowerCase().includes(t));
//   }, [roles, q]);

//   useEffect(() => {
//     setPageEmp(1);
//     setPageRole(1);
//   }, [q, tab, filteredEmployees.length, rolesForList.length, filterRole]);

//   const totalPagesEmp = Math.max(
//     1,
//     Math.ceil(filteredEmployees.length / PAGE_SIZE)
//   );
//   const totalPagesRole = Math.max(
//     1,
//     Math.ceil(rolesForList.length / PAGE_SIZE)
//   );
//   const pageSafeEmp = Math.min(pageEmp, totalPagesEmp);
//   const pageSafeRole = Math.min(pageRole, totalPagesRole);
//   const empRows = filteredEmployees.slice(
//     (pageSafeEmp - 1) * PAGE_SIZE,
//     pageSafeEmp * PAGE_SIZE
//   );
//   const roleRows = rolesForList.slice(
//     (pageSafeRole - 1) * PAGE_SIZE,
//     pageSafeRole * PAGE_SIZE
//   );

//   // история мастера
//   const servicesById = useMemo(() => {
//     const m = new Map();
//     services.forEach((s) => m.set(s.id, s));
//     return m;
//   }, [services]);

//   const apptsByBarber = useMemo(() => {
//     const map = new Map();
//     appointments.forEach((a) => {
//       if (!a.barber) return;
//       const arr = map.get(a.barber) || [];
//       arr.push(a);
//       map.set(a.barber, arr);
//     });
//     return map;
//   }, [appointments]);

//   const openHistory = (u) => {
//     setHistoryEmp(u);
//     setPageHistory(1);
//     setHistoryFrom("");
//     setHistoryTo("");
//     setHistoryOpen(true);
//   };
//   const closeHistory = () => {
//     setHistoryOpen(false);
//     setHistoryEmp(null);
//     setPageHistory(1);
//     setHistoryFrom("");
//     setHistoryTo("");
//   };

//   // полная история по сотруднику (отсортирована DESC)
//   const historyBaseList = useMemo(() => {
//     if (!historyEmp?.id) return [];
//     const list = (apptsByBarber.get(historyEmp.id) || []).slice();
//     return list.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
//   }, [historyEmp, apptsByBarber]);

//   // фильтр по диапазону дат
//   const historyFiltered = useMemo(() => {
//     let arr = historyBaseList;
//     if (historyFrom) {
//       const tFrom = new Date(`${historyFrom}T00:00:00`).getTime();
//       arr = arr.filter((a) => new Date(a.start_at).getTime() >= tFrom);
//     }
//     if (historyTo) {
//       const tTo = new Date(`${historyTo}T23:59:59`).getTime();
//       arr = arr.filter((a) => new Date(a.start_at).getTime() <= tTo);
//     }
//     return arr;
//   }, [historyBaseList, historyFrom, historyTo]);

//   // инвалидация пагинации при смене фильтра
//   useEffect(
//     () => setPageHistory(1),
//     [historyFrom, historyTo, historyFiltered.length]
//   );

//   const totalPagesHistory = Math.max(
//     1,
//     Math.ceil(historyFiltered.length / HISTORY_PAGE_SIZE)
//   );
//   const pageSafeHistory = Math.min(pageHistory, totalPagesHistory);
//   const historyRows = historyFiltered.slice(
//     (pageSafeHistory - 1) * HISTORY_PAGE_SIZE,
//     pageSafeHistory * HISTORY_PAGE_SIZE
//   );

//   const invalidRange = useMemo(
//     () => historyFrom && historyTo && historyFrom > historyTo,
//     [historyFrom, historyTo]
//   );

//   /* ========= Validation ========= */
//   const focusFirstInvalid = (errs) => {
//     const order = ["email", "first_name", "last_name", "roleChoice"];
//     const key = order.find((k) => errs[k]);
//     if (key) {
//       const el = document.querySelector(`.barbermasters__form [name="${key}"]`);
//       if (el?.focus) el.focus();
//     }
//   };

//   const validateEmployee = (form, isEdit = false, editId = null) => {
//     const alerts = [];
//     const errs = {};
//     const email = normalizeEmail(form.email);
//     if (!email) {
//       errs.email = true;
//       alerts.push("Укажите Email.");
//     } else if (!emailRx.test(email)) {
//       errs.email = true;
//       alerts.push("Email указан неверно.");
//     } else {
//       const exists = employees.some(
//         (u) => normalizeEmail(u.email) === email && (!isEdit || u.id !== editId)
//       );
//       if (exists) {
//         errs.email = true;
//         alerts.push("Сотрудник с таким Email уже существует.");
//       }
//     }
//     const first = String(form.first_name || "").trim();
//     const last = String(form.last_name || "").trim();
//     if (!first) {
//       errs.first_name = true;
//       alerts.push("Укажите имя.");
//     } else if (first.length < 2) {
//       errs.first_name = true;
//       alerts.push("Имя: минимум 2 символа.");
//     }
//     if (!last) {
//       errs.last_name = true;
//       alerts.push("Укажите фамилию.");
//     } else if (last.length < 2) {
//       errs.last_name = true;
//       alerts.push("Фамилия: минимум 2 символа.");
//     }
//     if (!form.roleChoice) {
//       errs.roleChoice = true;
//       alerts.push("Выберите роль.");
//     }
//     return { errs, alerts };
//   };

//   /* ========= Roles CRUD ========= */
//   const submitRoleCreate = async (e) => {
//     e.preventDefault();
//     const name = roleCreateName.trim();
//     if (!name) return setRoleCreateErr("Укажите название роли.");
//     if (sysCodeFromName(name))
//       return setRoleCreateErr("Это имя занято системной ролью.");
//     const dup = roles.some(
//       (r) => normalizeRoleName(r.name) === normalizeRoleName(name)
//     );
//     if (dup) return setRoleCreateErr("Роль с таким названием уже существует.");

//     setRoleCreateSaving(true);
//     setRoleCreateErr("");
//     try {
//       await api.post(ROLE_CREATE_URL, { name });
//       await fetchRoles();
//       setRoleCreateOpen(false);
//       setRoleCreateName("");
//     } catch (err) {
//       setRoleCreateErr(pickApiError(err, "Не удалось создать роль."));
//     } finally {
//       setRoleCreateSaving(false);
//     }
//   };

//   const openRoleEdit = (r) => {
//     if (r._sys) return;
//     setRoleEditId(r.id);
//     setRoleEditName(r.name || "");
//     setRoleEditErr("");
//     setRoleEditOpen(true);
//   };

//   const submitRoleEdit = async (e) => {
//     e.preventDefault();
//     if (!roleEditId) return;
//     const name = roleEditName.trim();
//     if (!name) return setRoleEditErr("Укажите название роли.");
//     if (sysCodeFromName(name))
//       return setRoleEditErr("Это имя зарезервировано системной ролью.");
//     const dup = roles.some(
//       (r) =>
//         r.id !== roleEditId &&
//         normalizeRoleName(r.name) === normalizeRoleName(name)
//     );
//     if (dup) return setRoleEditErr("Роль с таким названием уже существует.");

//     setRoleEditSaving(true);
//     setRoleEditErr("");
//     try {
//       await api.put(ROLE_ITEM_URL(roleEditId), { name });
//       await fetchRoles();
//       setRoleEditOpen(false);
//       setRoleEditId(null);
//       setRoleEditName("");
//     } catch (err) {
//       setRoleEditErr(pickApiError(err, "Не удалось обновить роль."));
//     } finally {
//       setRoleEditSaving(false);
//     }
//   };

//   const doRemoveRole = async () => {
//     const r = roleToDelete;
//     if (!r || r._sys) return;
//     setRoleDeletingIds((p) => new Set(p).add(r.id));
//     setPageNotice("");
//     try {
//       await api.delete(ROLE_ITEM_URL(r.id));
//       await fetchRoles();
//     } catch (err) {
//       setPageNotice(pickApiError(err, "Не удалось удалить роль."));
//     } finally {
//       setRoleDeletingIds((p) => {
//         const n = new Set(p);
//         n.delete(r.id);
//         return n;
//       });
//       setRoleToDelete(null);
//     }
//   };

//   /* ========= Employees CRUD ========= */
//   const openEmpCreate = () => {
//     setEmpAlerts([]);
//     setEmpFieldErrors({});
//     setEmpForm(emptyEmp);
//     setEmpCreateOpen(true);
//   };

//   const submitEmployeeCreate = async (e) => {
//     e.preventDefault();
//     const { errs, alerts } = validateEmployee(empForm, false, null);
//     if (alerts.length) {
//       setEmpFieldErrors(errs);
//       setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
//       focusFirstInvalid(errs);
//       return;
//     }
//     const email = normalizeEmail(empForm.email);
//     const payload = {
//       email,
//       first_name: empForm.first_name.trim(),
//       last_name: empForm.last_name.trim(),
//     };
//     if (empForm.roleChoice.startsWith("sys:"))
//       payload.role = empForm.roleChoice.slice(4);
//     else if (empForm.roleChoice.startsWith("cus:"))
//       payload.custom_role = empForm.roleChoice.slice(4);

//     setEmpSaving(true);
//     setEmpAlerts([]);
//     try {
//       const { data } = await api.post(EMPLOYEES_CREATE_URL, payload);
//       await fetchEmployees();
//       setEmployData(data);
//       setOpenLogin(true);
//       setEmpCreateOpen(false);
//       setEmpForm(emptyEmp);
//     } catch (err) {
//       const msg = pickApiError(err, "Не удалось создать сотрудника.");
//       setEmpAlerts([msg]);
//     } finally {
//       setEmpSaving(false);
//     }
//   };

//   const openEmpEdit = (u) => {
//     const roleChoice = u.role
//       ? `sys:${u.role}`
//       : u.custom_role
//       ? `cus:${u.custom_role}`
//       : "";
//     setEditingEmpId(u.id);
//     setEmpForm({
//       email: u.email || "",
//       first_name: u.first_name || "",
//       last_name: u.last_name || "",
//       roleChoice,
//     });
//     setEmpAlerts([]);
//     setEmpFieldErrors({});
//     setEmpEditOpen(true);
//   };

//   const submitEmployeeEdit = async (e) => {
//     e.preventDefault();
//     if (!editingEmpId) return;
//     const { errs, alerts } = validateEmployee(empForm, true, editingEmpId);
//     if (alerts.length) {
//       setEmpFieldErrors(errs);
//       setEmpAlerts(["Исправьте ошибки в форме.", ...alerts]);
//       focusFirstInvalid(errs);
//       return;
//     }
//     const payload = {
//       email: normalizeEmail(empForm.email),
//       first_name: empForm.first_name.trim(),
//       last_name: empForm.last_name.trim(),
//       role: null,
//       custom_role: null,
//     };
//     if (empForm.roleChoice.startsWith("sys:"))
//       payload.role = empForm.roleChoice.slice(4);
//     else if (empForm.roleChoice.startsWith("cus:"))
//       payload.custom_role = empForm.roleChoice.slice(4);

//     setEmpSaving(true);
//     setEmpAlerts([]);
//     try {
//       await api.put(EMPLOYEE_ITEM_URL(editingEmpId), payload);
//       await fetchEmployees();
//       setEmpEditOpen(false);
//       setEditingEmpId(null);
//       setEmpForm(emptyEmp);
//     } catch (err) {
//       const msg = pickApiError(err, "Не удалось обновить сотрудника.");
//       setEmpAlerts([msg]);
//     } finally {
//       setEmpSaving(false);
//     }
//   };

//   const doRemoveEmployee = async () => {
//     const u = empToDelete;
//     if (!u) return;
//     setEmpDeletingIds((p) => new Set(p).add(u.id));
//     setPageNotice("");
//     try {
//       await api.delete(EMPLOYEE_ITEM_URL(u.id));
//       await fetchEmployees();
//     } catch (err) {
//       setPageNotice(pickApiError(err, "Не удалось удалить сотрудника."));
//     } finally {
//       setEmpDeletingIds((p) => {
//         const n = new Set(p);
//         n.delete(u.id);
//         return n;
//       });
//       setEmpToDelete(null);
//     }
//   };

//   /* ========= Small pager ========= */
//   const Pager = ({ page, total, onChange }) => {
//     if (total <= 1) return null;
//     const onPrev = () => onChange(Math.max(1, page - 1));
//     const onNext = () => onChange(Math.min(total, page + 1));
//     const pages = new Set([1, page - 1, page, page + 1, total]);
//     const list = [...pages]
//       .filter((n) => n >= 1 && n <= total)
//       .sort((a, b) => a - b);
//     return (
//       <nav className="barbermasters__pager" aria-label="Пагинация">
//         <button
//           className="barbermasters__pageBtn"
//           onClick={onPrev}
//           disabled={page === 1}
//         >
//           Назад
//         </button>
//         <ul className="barbermasters__pageList">
//           {list.map((n, i) => {
//             const prev = list[i - 1];
//             const gap = prev && n - prev > 1;
//             return (
//               <div key={n} className="barbermasters__pageItemWrap">
//                 {gap && <li className="barbermasters__dots">…</li>}
//                 <li>
//                   <button
//                     className={`barbermasters__pageBtn ${
//                       n === page ? "is-active" : ""
//                     }`}
//                     aria-current={n === page ? "page" : undefined}
//                     onClick={() => onChange(n)}
//                   >
//                     {n}
//                   </button>
//                 </li>
//               </div>
//             );
//           })}
//         </ul>
//         <button
//           className="barbermasters__pageBtn"
//           onClick={onNext}
//           disabled={page === total}
//         >
//           Далее
//         </button>
//       </nav>
//     );
//   };

//   /* ===================== Render ===================== */
//   return (
//     <div className="barbermasters">
//       <div className="barbermasters__header">
//         <div className="barbermasters__titleWrap">
//           <h2 className="barbermasters__title">
//             {isMaster ? "Мастера" : "Сотрудники"}
//           </h2>
//           <span className="barbermasters__subtitle">
//             {loading
//               ? "Загрузка…"
//               : tab === "roles"
//               ? `${rolesForList.length} ролей${
//                   rolesForList.length > PAGE_SIZE
//                     ? ` · стр. ${pageSafeRole}/${totalPagesRole}`
//                     : ""
//                 }`
//               : `${filteredEmployees.length} записей${
//                   filteredEmployees.length > PAGE_SIZE
//                     ? ` · стр. ${pageSafeEmp}/${totalPagesEmp}`
//                     : ""
//                 }`}
//           </span>
//         </div>

//         <div className="barbermasters__actions">
//           <div className="barbermasters__tabs">
//             <button
//               type="button"
//               className={`barbermasters__btn barbermasters__btn--secondary ${
//                 tab === "roles" ? "is-active" : ""
//               }`}
//               onClick={() => setTab("roles")}
//             >
//               Роли
//             </button>
//             <button
//               type="button"
//               className={`barbermasters__btn barbermasters__btn--secondary ${
//                 tab === "masters" ? "is-active" : ""
//               }`}
//               onClick={() => setTab("masters")}
//             >
//               Сотрудники
//             </button>
//           </div>

//           {tab === "masters" && (
//             <RoleSelect
//               options={roleFilterOptions}
//               value={filterRole}
//               onChange={setFilterRole}
//               placeholder="Все роли"
//               hideCurrentLabelInMenu
//               className="barbermasters__roleFilter"
//             />
//           )}

//           <div className="barbermasters__search">
//             <FaSearch className="barbermasters__searchIcon" />
//             <input
//               className="barbermasters__searchInput"
//               placeholder={
//                 tab === "roles" ? "Поиск ролей…" : "Поиск по сотрудникам"
//               }
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//               aria-label="Поиск"
//             />
//           </div>

//           {tab === "roles" ? (
//             <button
//               type="button"
//               className="barbermasters__btn barbermasters__btn--primary"
//               onClick={() => setRoleCreateOpen(true)}
//             >
//               <FaPlus />
//             </button>
//           ) : (
//             <button
//               type="button"
//               className="barbermasters__btn barbermasters__btn--primary"
//               onClick={openEmpCreate}
//             >
//               <FaPlus />
//             </button>
//           )}
//         </div>
//       </div>

//       {!!error && <div className="barbermasters__alert">{error}</div>}
//       {!!pageNotice && <div className="barbermasters__alert">{pageNotice}</div>}
//       {loading && <div className="barbermasters__alert">Загрузка…</div>}

//       {!loading && tab === "roles" && (
//         <>
//           <div className="barbermasters__list">
//             {roleRows.map((r) => (
//               <article key={r.id} className="barbermasters__card">
//                 <div className="barbermasters__cardLeft">
//                   <div className="barbermasters__avatar">
//                     {(r.name || "•").trim().charAt(0).toUpperCase()}
//                   </div>
//                   <div>
//                     <div className="barbermasters__nameRow">
//                       <h4 className="barbermasters__name">
//                         {r.name || "Без названия"}
//                       </h4>
//                     </div>
//                     {r._sys && (
//                       <div className="barbermasters__meta">
//                         <span className="bm-item">Системная роль</span>
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 <div className="barbermasters__cardActions">
//                   <button
//                     className="barbermasters__btn barbermasters__btn--secondary"
//                     onClick={() => openRoleEdit(r)}
//                     disabled={r._sys}
//                     title={
//                       r._sys
//                         ? "Системные роли нельзя изменять"
//                         : "Редактировать"
//                     }
//                   >
//                     <FaEdit />{" "}
//                     <span className="barbermasters__btnText">
//                       Редактировать
//                     </span>
//                   </button>
//                   <button
//                     className="barbermasters__btn barbermasters__btn--danger"
//                     onClick={() => setRoleToDelete(r)}
//                     disabled={r._sys || roleDeletingIds.has(r.id)}
//                     title={r._sys ? "Системные роли нельзя удалять" : "Удалить"}
//                   >
//                     <FaTrash />{" "}
//                     <span className="barbermasters__btnText">
//                       {roleDeletingIds.has(r.id) ? "Удаление…" : "Удалить"}
//                     </span>
//                   </button>
//                 </div>
//               </article>
//             ))}
//             {rolesForList.length === 0 && (
//               <div className="barbermasters__alert">Пока нет ролей.</div>
//             )}
//           </div>

//           {rolesForList.length > PAGE_SIZE && (
//             <Pager
//               page={pageSafeRole}
//               total={totalPagesRole}
//               onChange={setPageRole}
//             />
//           )}
//         </>
//       )}

//       {!loading && tab === "masters" && (
//         <>
//           <div className="barbermasters__list">
//             {empRows.map((u) => {
//               const initial =
//                 (fullName(u) || u.email || "•")
//                   .trim()
//                   .charAt(0)
//                   .toUpperCase() || "•";
//               const roleLabel = u.role
//                 ? ruLabelSys(u.role)
//                 : roles.length
//                 ? roleById.get(u.custom_role)?.name || u.role_display || "—"
//                 : u.role_display || "—";
//               return (
//                 <article key={u.id} className="barbermasters__card">
//                   <div className="barbermasters__cardLeft">
//                     <div className="barbermasters__avatar">{initial}</div>
//                     <div>
//                       <div className="barbermasters__nameRow">
//                         <h4 className="barbermasters__name">
//                           {fullName(u) || "Без имени"}
//                         </h4>
//                       </div>
//                       <div className="barbermasters__meta">
//                         <span className="bm-item">{u.email || "—"}</span>
//                         <span className="bm-item">{roleLabel}</span>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="barbermasters__cardActions">
//                     <button
//                       className="barbermasters__btn barbermasters__btn--secondary"
//                       onClick={() => openHistory(u)}
//                       title="История"
//                     >
//                       <FaSearch />{" "}
//                       <span className="barbermasters__btnText">История</span>
//                     </button>
//                     <button
//                       className="barbermasters__btn barbermasters__btn--secondary"
//                       onClick={() => openEmpEdit(u)}
//                       title={`Редактировать ${
//                         isMaster ? "мастера" : "сотрудника"
//                       }`}
//                     >
//                       <FaEdit />{" "}
//                       <span className="barbermasters__btnText">
//                         Редактировать
//                       </span>
//                     </button>
//                     <button
//                       className="barbermasters__btn barbermasters__btn--danger"
//                       onClick={() => setEmpToDelete(u)}
//                       disabled={empDeletingIds.has(u.id)}
//                       title={`Удалить ${isMaster ? "мастера" : "сотрудника"}`}
//                     >
//                       <FaTrash />{" "}
//                       <span className="barbermasters__btnText">
//                         {empDeletingIds.has(u.id) ? "Удаление…" : "Удалить"}
//                       </span>
//                     </button>
//                   </div>
//                 </article>
//               );
//             })}
//             {filteredEmployees.length === 0 && employees.length > 0 && (
//               <div className="barbermasters__alert">Ничего не найдено.</div>
//             )}
//             {!loading && employees.length === 0 && (
//               <div className="barbermasters__alert">Пока нет сотрудников.</div>
//             )}
//           </div>

//           {filteredEmployees.length > PAGE_SIZE && (
//             <Pager
//               page={pageSafeEmp}
//               total={totalPagesEmp}
//               onChange={setPageEmp}
//             />
//           )}
//         </>
//       )}

//       {/* ===== Roles: create ===== */}
//       {roleCreateOpen && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
//         >
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Новая роль</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => !roleCreateSaving && setRoleCreateOpen(false)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             <form
//               className="barbermasters__form"
//               onSubmit={submitRoleCreate}
//               noValidate
//             >
//               <div className="barbermasters__grid">
//                 <label className="barbermasters__field barbermasters__field--full">
//                   <span className="barbermasters__label">
//                     Название роли <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     className="barbermasters__input"
//                     placeholder="Например: Контент-менеджер"
//                     value={roleCreateName}
//                     onChange={(e) => setRoleCreateName(e.target.value)}
//                     required
//                   />
//                 </label>
//               </div>

//               {!!roleCreateErr && (
//                 <div className="barbermasters__alert barbermasters__alert--inModal">
//                   {roleCreateErr}
//                 </div>
//               )}

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button
//                     type="button"
//                     className="barbermasters__btn barbermasters__btn--secondary"
//                     onClick={() => setRoleCreateOpen(false)}
//                     disabled={roleCreateSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="barbermasters__btn barbermasters__btn--primary"
//                     disabled={roleCreateSaving}
//                   >
//                     {roleCreateSaving ? "Сохранение…" : "Создать роль"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ===== Roles: edit ===== */}
//       {roleEditOpen && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => !roleEditSaving && setRoleEditOpen(false)}
//         >
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Изменить роль</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => !roleEditSaving && setRoleEditOpen(false)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {!!roleEditErr && (
//               <div className="barbermasters__alert barbermasters__alert--inModal">
//                 {roleEditErr}
//               </div>
//             )}

//             <form
//               className="barbermasters__form"
//               onSubmit={submitRoleEdit}
//               noValidate
//             >
//               <div className="barbermasters__grid">
//                 <label className="barbermasters__field barbermasters__field--full">
//                   <span className="barbermasters__label">
//                     Название роли <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     className="barbermasters__input"
//                     placeholder="Название роли"
//                     value={roleEditName}
//                     onChange={(e) => setRoleEditName(e.target.value)}
//                     required
//                   />
//                 </label>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button
//                     type="button"
//                     className="barbermasters__btn barbermasters__btn--secondary"
//                     onClick={() => setRoleEditOpen(false)}
//                     disabled={roleEditSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="barbermasters__btn barbermasters__btn--primary"
//                     disabled={roleEditSaving}
//                   >
//                     {roleEditSaving ? "Сохранение…" : "Сохранить изменения"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ===== Employees: create ===== */}
//       {empCreateOpen && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => !empSaving && setEmpCreateOpen(false)}
//         >
//           <div
//             className="barbermasters__modal barbermasters__modal--taller"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Новый сотрудник</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => !empSaving && setEmpCreateOpen(false)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {empAlerts.length > 0 && (
//               <div className="barbermasters__alert barbermasters__alert--inModal">
//                 {empAlerts.length === 1 ? (
//                   empAlerts[0]
//                 ) : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {empAlerts.map((m, i) => (
//                       <li key={i}>{m}</li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form
//               className="barbermasters__form"
//               onSubmit={submitEmployeeCreate}
//               noValidate
//             >
//               <div className="barbermasters__grid">
//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.email ? "barbermasters__field--invalid" : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Email <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="email"
//                     type="email"
//                     className={`barbermasters__input ${
//                       empFieldErrors.email
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="user@mail.com"
//                     value={empForm.email}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, email: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.first_name
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Имя <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="first_name"
//                     className={`barbermasters__input ${
//                       empFieldErrors.first_name
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="Имя"
//                     value={empForm.first_name}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, first_name: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.last_name
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Фамилия <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="last_name"
//                     className={`barbermasters__input ${
//                       empFieldErrors.last_name
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="Фамилия"
//                     value={empForm.last_name}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, last_name: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <div
//                   className={`barbermasters__field barbermasters__field--full ${
//                     empFieldErrors.roleChoice
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Роль <b className="barbermasters__req">*</b>
//                   </span>
//                   <RoleSelect
//                     options={roleOptions}
//                     value={empForm.roleChoice}
//                     onChange={(key) =>
//                       setEmpForm((p) => ({ ...p, roleChoice: key }))
//                     }
//                     placeholder="Выберите роль"
//                     className="barbermasters__roleSelect"
//                   />
//                   <input
//                     name="roleChoice"
//                     value={empForm.roleChoice}
//                     hidden
//                     readOnly
//                   />
//                 </div>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button
//                     type="button"
//                     className="barbermasters__btn barbermasters__btn--secondary"
//                     onClick={() => setEmpCreateOpen(false)}
//                     disabled={empSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="barbermasters__btn barbermasters__btn--primary"
//                     disabled={empSaving}
//                   >
//                     {empSaving ? "Сохранение…" : "Создать сотрудника"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ===== Employees: edit ===== */}
//       {empEditOpen && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => !empSaving && setEmpEditOpen(false)}
//         >
//           <div
//             className="barbermasters__modal barbermasters__modal--taller"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">
//                 Редактировать сотрудника
//               </h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => !empSaving && setEmpEditOpen(false)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {empAlerts.length > 0 && (
//               <div className="barbermasters__alert barbermasters__alert--inModal">
//                 {empAlerts.length === 1 ? (
//                   empAlerts[0]
//                 ) : (
//                   <ul style={{ margin: 0, paddingLeft: 18 }}>
//                     {empAlerts.map((m, i) => (
//                       <li key={i}>{m}</li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             )}

//             <form
//               className="barbermasters__form"
//               onSubmit={submitEmployeeEdit}
//               noValidate
//             >
//               <div className="barbermasters__grid">
//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.email ? "barbermasters__field--invalid" : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Email <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="email"
//                     type="email"
//                     className={`barbermasters__input ${
//                       empFieldErrors.email
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="user@mail.com"
//                     value={empForm.email}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, email: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.first_name
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Имя <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="first_name"
//                     className={`barbermasters__input ${
//                       empFieldErrors.first_name
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="Имя"
//                     value={empForm.first_name}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, first_name: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <label
//                   className={`barbermasters__field ${
//                     empFieldErrors.last_name
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Фамилия <b className="barbermasters__req">*</b>
//                   </span>
//                   <input
//                     name="last_name"
//                     className={`barbermasters__input ${
//                       empFieldErrors.last_name
//                         ? "barbermasters__input--invalid"
//                         : ""
//                     }`}
//                     placeholder="Фамилия"
//                     value={empForm.last_name}
//                     onChange={(e) =>
//                       setEmpForm((p) => ({ ...p, last_name: e.target.value }))
//                     }
//                     required
//                   />
//                 </label>

//                 <div
//                   className={`barbermasters__field barbermasters__field--full ${
//                     empFieldErrors.roleChoice
//                       ? "barbermasters__field--invalid"
//                       : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">
//                     Роль <b className="barbermasters__req">*</b>
//                   </span>
//                   <RoleSelect
//                     options={roleOptions}
//                     value={empForm.roleChoice}
//                     onChange={(key) =>
//                       setEmpForm((p) => ({ ...p, roleChoice: key }))
//                     }
//                     placeholder="Выберите роль"
//                     className="barbermasters__roleSelect"
//                   />
//                   <input
//                     name="roleChoice"
//                     value={empForm.roleChoice}
//                     hidden
//                     readOnly
//                   />
//                 </div>
//               </div>

//               <div className="barbermasters__footer">
//                 <span className="barbermasters__spacer" />
//                 <div className="barbermasters__footerRight">
//                   <button
//                     type="button"
//                     className="barbermasters__btn barbermasters__btn--secondary"
//                     onClick={() => setEmpEditOpen(false)}
//                     disabled={empSaving}
//                   >
//                     Отмена
//                   </button>
//                   <button
//                     type="submit"
//                     className="barbermasters__btn barbermasters__btn--primary"
//                     disabled={empSaving}
//                   >
//                     {empSaving ? "Сохранение…" : "Сохранить изменения"}
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* ===== New employee credentials ===== */}
//       {openLogin && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => setOpenLogin(false)}
//         >
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Логин сотрудника</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => setOpenLogin(false)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>
//             <div className="barbermasters__content">
//               <p className="barbermasters__label">
//                 Логин: <b>{employData?.email}</b>
//                 <button
//                   className="barbermasters__iconBtn barbermasters__copyBtn"
//                   onClick={() =>
//                     copyToClipboard(employData?.email || "", "email")
//                   }
//                   aria-label="Скопировать логин"
//                   title={copied === "email" ? "Скопировано!" : "Скопировать"}
//                 >
//                   {copied === "email" ? <FaCheck /> : <FaCopy />}
//                 </button>
//               </p>

//               <p className="barbermasters__label">
//                 Пароль: <b>{employData?.generated_password}</b>
//                 <button
//                   className="barbermasters__iconBtn barbermasters__copyBtn"
//                   onClick={() =>
//                     copyToClipboard(
//                       employData?.generated_password || "",
//                       "password"
//                     )
//                   }
//                   aria-label="Скопировать пароль"
//                   title={copied === "password" ? "Скопировано!" : "Скопировать"}
//                 >
//                   {copied === "password" ? <FaCheck /> : <FaCopy />}
//                 </button>
//               </p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ===== Delete role ===== */}
//       {roleToDelete && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => setRoleToDelete(null)}
//         >
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Удалить роль</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => setRoleToDelete(null)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>
//             <div className="barbermasters__content">
//               Вы действительно хотите удалить роль «{roleToDelete.name || "—"}»?
//               Действие необратимо.
//             </div>
//             <div className="barbermasters__footer">
//               <span className="barbermasters__spacer" />
//               <div className="barbermasters__footerRight">
//                 <button
//                   className="barbermasters__btn barbermasters__btn--secondary"
//                   onClick={() => setRoleToDelete(null)}
//                 >
//                   Отмена
//                 </button>
//                 <button
//                   className="barbermasters__btn barbermasters__btn--danger"
//                   onClick={doRemoveRole}
//                   disabled={roleDeletingIds.has(roleToDelete.id)}
//                 >
//                   {roleDeletingIds.has(roleToDelete.id)
//                     ? "Удаление…"
//                     : "Удалить"}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ===== Delete employee ===== */}
//       {empToDelete && (
//         <div
//           className="barbermasters__overlay"
//           onClick={() => setEmpToDelete(null)}
//         >
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">Удалить сотрудника</h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={() => setEmpToDelete(null)}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>
//             <div className="barbermasters__content">
//               Удалить «{fullName(empToDelete) || empToDelete.email || "—"}»?
//               Действие необратимо.
//             </div>
//             <div className="barbermasters__footer">
//               <span className="barbermasters__spacer" />
//               <div className="barbermasters__footerRight">
//                 <button
//                   className="barbermasters__btn barbermasters__btn--secondary"
//                   onClick={() => setEmpToDelete(null)}
//                 >
//                   Отмена
//                 </button>
//                 <button
//                   className="barbermasters__btn barbermasters__btn--danger"
//                   onClick={doRemoveEmployee}
//                   disabled={empDeletingIds.has(empToDelete.id)}
//                 >
//                   {empDeletingIds.has(empToDelete.id) ? "Удаление…" : "Удалить"}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ===== History (with date range filter) ===== */}
//       {historyOpen && (
//         <div className="barbermasters__overlay" onClick={closeHistory}>
//           <div
//             className="barbermasters__modal"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="barbermasters__modalHeader">
//               <h3 className="barbermasters__modalTitle">
//                 История — {fullName(historyEmp) || historyEmp?.email}
//               </h3>
//               <button
//                 className="barbermasters__iconBtn"
//                 onClick={closeHistory}
//                 aria-label="Закрыть"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             <div className="barbermasters__content">
//               {/* Фильтр дат */}
//               <div className="barbermasters__inlineFilter">
//                 <label
//                   className={`barbermasters__field ${
//                     invalidRange ? "barbermasters__field--invalid" : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">От</span>
//                   <input
//                     type="date"
//                     className="barbermasters__input"
//                     value={historyFrom}
//                     onChange={(e) => setHistoryFrom(e.target.value)}
//                   />
//                 </label>
//                 <label
//                   className={`barbermasters__field ${
//                     invalidRange ? "barbermasters__field--invalid" : ""
//                   }`}
//                 >
//                   <span className="barbermasters__label">До</span>
//                   <input
//                     type="date"
//                     className="barbermasters__input"
//                     value={historyTo}
//                     onChange={(e) => setHistoryTo(e.target.value)}
//                   />
//                 </label>
//                 <button
//                   type="button"
//                   className="barbermasters__btn barbermasters__btn--secondary"
//                   onClick={() => {
//                     setHistoryFrom("");
//                     setHistoryTo("");
//                   }}
//                   title="Сбросить фильтр"
//                 >
//                   Сброс
//                 </button>
//               </div>

//               {invalidRange && (
//                 <div className="barbermasters__alert">
//                   Диапазон дат неверен: «От» позже «До».
//                 </div>
//               )}

//               {company.sector.name === "Барбершоп" && (
//                 <>
//                   {historyFiltered.length === 0 ? (
//                     <div className="barbermasters__alert">Записей нет</div>
//                   ) : (
//                     <>
//                       <div className="barbermasters__list">
//                         {historyRows.map((a) => {
//                           const date = dateISO(a.start_at);
//                           const time = timeISO(a.start_at);
//                           const client =
//                             a.client_name ||
//                             (a.client ? `ID ${a.client}` : "—");
//                           const svcObj = servicesById.get(a.service);
//                           const service =
//                             a.service_name ||
//                             svcObj?.service_name ||
//                             svcObj?.name ||
//                             "—";
//                           const priceVal =
//                             a.service_price ?? a.price ?? svcObj?.price;
//                           return (
//                             <article key={a.id} className="barbermasters__card">
//                               <div className="barbermasters__cardLeft">
//                                 <div>
//                                   <div className="barbermasters__nameRow">
//                                     <h4 className="barbermasters__name">
//                                       {date} • {time}
//                                     </h4>
//                                   </div>
//                                   <div className="barbermasters__meta">
//                                     <span className="bm-item">
//                                       Клиент: {client}
//                                     </span>
//                                     <span className="bm-item">
//                                       Услуга: {service}
//                                     </span>
//                                     <span className="bm-item">
//                                       Цена: {fmtMoney(priceVal)}
//                                     </span>
//                                   </div>
//                                 </div>
//                               </div>
//                             </article>
//                           );
//                         })}
//                       </div>
//                       {historyFiltered.length > HISTORY_PAGE_SIZE && (
//                         <Pager
//                           page={pageSafeHistory}
//                           total={totalPagesHistory}
//                           onChange={setPageHistory}
//                         />
//                       )}
//                     </>
//                   )}
//                 </>
//               )}
//               {company.sector.name !== "Барбершоп" && <>{/* // тут */}</>}
//             </div>

//             <div className="barbermasters__footer">
//               <button
//                 className="barbermasters__btn barbermasters__btn--secondary"
//                 onClick={closeHistory}
//               >
//                 Закрыть
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {openLogin && null}
//     </div>
//   );
// };

// export default Masters;
