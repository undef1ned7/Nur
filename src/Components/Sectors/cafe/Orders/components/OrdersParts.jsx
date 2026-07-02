// src/.../OrdersParts.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FaChevronDown,
  FaClipboardList,
  FaListUl,
  FaPlus,
  FaSearch,
  FaThLarge,
  FaTimes,
} from "react-icons/fa";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";
import {
  formatLineQtyDisplay,
  formatMenuPriceHint,
} from "../../cafeMenuWeight";
import api from "../../../../../api";

const PAGE_SIZE = 100;
const MENU_VIEW_STORAGE_KEY = "cafe_orders_menu_view";

const readMenuViewMode = () => {
  try {
    const saved = localStorage.getItem(MENU_VIEW_STORAGE_KEY);
    return saved === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
};

/* =========================================================
   SearchSelect — один открытый и закрывается после выбора
   ========================================================= */
export const SearchSelect = ({
  id,
  openId,
  setOpenId,
  label,
  placeholder = "Выберите…",
  value,
  onChange,
  options = [],
  disabled = false,
  hint,
  allowClear = true,
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const open = openId === id;

  const [q, setQ] = useState("");
  const [dir, setDir] = useState("down"); // down | up

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;

    return options.filter((o) => {
      const hay = String(o.search ?? o.label ?? "").toLowerCase();
      return hay.includes(s);
    });
  }, [options, q]);

  const closeDropdown = useCallback(() => {
    setOpenId(null);
    setQ("");
  }, [setOpenId]);

  const computeDir = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || 0;

    const estimated = Math.min(320, 56 + (options?.length || 0) * 44);
    const spaceBelow = viewportH - r.bottom;
    const spaceAbove = r.top;

    if (spaceBelow < estimated && spaceAbove > spaceBelow) setDir("up");
    else setDir("down");
  }, [options]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) closeDropdown();
    };

    const onKey = (e) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", computeDir, { passive: true });
    window.addEventListener("scroll", computeDir, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", computeDir);
      window.removeEventListener("scroll", computeDir);
    };
  }, [open, computeDir, closeDropdown]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    computeDir();
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [open, computeDir]);

  const openDropdown = () => {
    if (disabled) return;
    setOpenId(id);
    setQ("");
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setOpenId((prev) => (prev === id ? null : id));
    setQ("");
  };

  const pick = (opt) => {
    onChange?.(opt.value);
    closeDropdown();
  };

  const clear = () => {
    onChange?.("");
    closeDropdown();
  };

  const shownValue = open ? q : selected?.label || "";

  return (
    <div
      ref={rootRef}
      className={`cafeOrdersSselect ${open ? "cafeOrdersSselect--open" : ""}`}
    >
      {label ? <div className="cafeOrdersSselect__label">{label}</div> : null}

      <div
        className={`cafeOrdersSselect__control ${open ? "cafeOrdersSselect__control--open" : ""} ${
          disabled ? "cafeOrdersSselect__control--disabled" : ""
        }`}
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          if (open && e.target === inputRef.current) return;
          toggleDropdown();
        }}
        role="combobox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          className="cafeOrdersSselect__input"
          value={shownValue}
          onChange={(e) => {
            if (!open) setOpenId(id);
            setQ(e.target.value);
          }}
          onFocus={() => openDropdown()}
          placeholder={placeholder}
          readOnly={!open}
          disabled={disabled}
        />

        {allowClear && !disabled && value ? (
          <button
            type="button"
            className="cafeOrdersSselect__clear"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }}
            aria-label="Очистить"
            title="Очистить"
          >
            <FaTimes />
          </button>
        ) : null}

        <span className="cafeOrdersSselect__icon" aria-hidden>
          <FaChevronDown />
        </span>

        {open && (
          <div
            className={`cafeOrdersSselect__dropdown ${dir === "up" ? "cafeOrdersSselect__dropdown--up" : ""}`}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cafeOrdersSselect__list">
              {filtered.length ? (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className={`cafeOrdersSselect__item ${active ? "cafeOrdersSselect__item--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pick(opt);
                      }}
                      title={opt.label}
                    >
                      <span className="cafeOrdersSselect__itemLabel">
                        {opt.label}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="cafeOrdersSselect__empty">
                  Ничего не найдено
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {hint ? <div className="cafeOrdersSselect__hint">{hint}</div> : null}
    </div>
  );
};
const getListFromResponse = (res) => res?.data?.results || res?.data || [];

/* =========================================================
   Правая панель меню
   ========================================================= */
export const RightMenuPanel = ({
  open,
  onClose,
  menuItems,
  menuImageUrl,
  onPick,
  fmtMoney,
  currentPage,
  loading,
  onPageChange,
  cartItems,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
}) => {
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState(readMenuViewMode);
  const isCart = useCallback(
    (id) =>
      cartItems.find(
        (el) =>
          String(el.line_kind || "menu").toLowerCase() !== "service" &&
          String(el.menu_item) === String(id)
      ),
    [cartItems],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setSearchQuery("");
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(MENU_VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);
  const [categories, setCategories] = useState([]);
  // Раскрытая категория аккордеона (null = все закрыты по умолчанию)
  const [expandedCat, setExpandedCat] = useState(null);
  const fetchCategories = useCallback(async () => {
    const res = await api.get("/cafe/categories/");
    setCategories(getListFromResponse(res));
  }, []);

  // Всё меню грузим один раз при открытии панели и раскладываем по категориям
  // локально — при раскрытии категории новых запросов нет.
  const [allMenu, setAllMenu] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setAllLoading(true);
      try {
        const acc = [];
        let page = 1;
        for (let i = 0; i < 100; i += 1) {
          const res = await api.get("/cafe/menu-items/", {
            params: { page, page_size: 200 },
          });
          const data = res?.data || {};
          const arr = Array.isArray(data) ? data : data.results || [];
          acc.push(...arr);
          if (Array.isArray(data) || !data.next) break;
          page += 1;
        }
        if (!cancelled) setAllMenu(acc);
      } catch {
        if (!cancelled) setAllMenu([]);
      } finally {
        if (!cancelled) setAllLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const normalizeMenuItem = useCallback((raw) => {
    const cat = raw.category ?? raw.category_id ?? raw.category?.id ?? "";
    return {
      id: raw.id,
      title: raw.title ?? raw.name ?? "",
      price: raw.price,
      category: cat === null || cat === undefined ? "" : String(cat),
      image_url: raw.image_url || "",
      kitchen: raw.kitchen ?? null,
      is_sold_by_weight: raw.is_sold_by_weight ?? false,
      sale_unit: raw.sale_unit ?? null,
      is_available: raw.is_available,
    };
  }, []);

  const itemsByCategory = useMemo(() => {
    const map = new Map();
    for (const raw of allMenu) {
      const m = normalizeMenuItem(raw);
      if (m.is_available === false) continue;
      const key = m.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [allMenu, normalizeMenuItem]);
  useEffect(() => {
    (async () => {
      await fetchCategories();
    })();
  }, []);
  const categoryOptions = useMemo(() => {
    const baseOptions = (Array.isArray(categories) ? categories : [])
      .map((cat) => ({
        value: String(cat.id),
        label: cat.title,
      }))
      .filter((opt) => opt.value && opt.label);

    return [{ value: "", label: "Все категории" }, ...baseOptions];
  }, [categories]);

  // Поиск теперь локальный (по загруженному меню) — без запросов на бэкенд.
  // Группы категорий с их блюдами; при поиске оставляем только совпавшие.
  const menuGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const match = (it) =>
      !query || String(it.title || "").toLowerCase().includes(query);

    const base = (Array.isArray(categories) ? categories : [])
      .map((c) => ({ id: String(c.id), title: c.title }))
      .filter((g) => g.id && g.title);

    const groups = base.map((g) => ({
      ...g,
      items: (itemsByCategory.get(g.id) || []).filter(match),
    }));

    const uncategorized = (itemsByCategory.get("") || []).filter(match);
    if (uncategorized.length) {
      groups.push({ id: "__none__", title: "Без категории", items: uncategorized });
    }

    // При поиске прячем пустые категории
    return query ? groups.filter((g) => g.items.length) : groups;
  }, [categories, itemsByCategory, q]);

  // Извлекаем массив блюд из объекта пагинации или используем как массив
  const itemsArray = useMemo(() => {
    if (!menuItems) return [];
    // Если это объект с пагинацией (имеет results)
    if (menuItems.results && Array.isArray(menuItems.results)) {
      return menuItems.results;
    }
    // Если это массив
    if (Array.isArray(menuItems)) {
      return menuItems;
    }
    return [];
  }, [menuItems]);

  // Пагинация - всегда используем данные с сервера
  const totalPages = useMemo(() => {
    // Если есть объект с пагинацией, используем count
    if (menuItems?.count && typeof menuItems.count === "number") {
      return Math.ceil(menuItems.count / PAGE_SIZE);
    }

    // Иначе используем длину массива
    return Math.ceil((itemsArray.length || 0) / PAGE_SIZE);
  }, [itemsArray.length, menuItems?.count]);

  // Показываем все загруженные элементы (сервер уже вернул нужную страницу)
  const paginatedItems = itemsArray;

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage < 1 || newPage > totalPages) return;

      // Вызываем переданную функцию пагинации с текущим поисковым запросом
      if (onPageChange) {
        onPageChange(newPage, searchQuery);
      }

      // Прокрутка вверх списка
      const listEl = document.querySelector(".cafeOrdersRpanel__list");
      if (listEl) {
        listEl.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [totalPages, searchQuery, onPageChange],
  );

  const renderMenuMedia = (img) =>
    img ? (
      <img src={img} alt="" />
    ) : (
      <FaClipboardList aria-hidden />
    );

  const renderMenuPickControl = (cartItem, cartQty) => (
    <span className="cafeOrdersRpanel__add" aria-hidden>
      {!cartItem ? <FaPlus /> : cartQty}
    </span>
  );

  const renderMenuItems = (items) =>
    (items || []).map((m) => {
      const img = m.image_url || menuImageUrl?.(m.id);
      const cartItem = isCart(m.id);
      const isWeight = !!m?.is_sold_by_weight;
      const rawQty = cartItem?.quantity;
      const cartQty =
        rawQty === ""
          ? "—"
          : cartItem
            ? formatLineQtyDisplay(rawQty, m?.sale_unit, isWeight)
            : 0;
      const priceLabel = formatMenuPriceHint(m.price, m);

      if (viewMode === "list") {
        return (
          <button
            key={m.id}
            type="button"
            className="cafeOrdersRpanel__row"
            onClick={() => onPick(m)}
            title={m.title}
          >
            <span className="cafeOrdersRpanel__rowThumb" aria-hidden>
              {renderMenuMedia(img)}
            </span>
            <span className="cafeOrdersRpanel__rowMeta">
              <span className="cafeOrdersRpanel__rowName">{m.title}</span>
              <span className="cafeOrdersRpanel__rowPrice">{priceLabel}</span>
            </span>
            {renderMenuPickControl(cartItem, cartQty)}
          </button>
        );
      }

      return (
        <button
          key={m.id}
          type="button"
          className="cafeOrdersRpanel__card"
          onClick={() => onPick(m)}
          title={m.title}
        >
          <span className="cafeOrdersRpanel__cardMedia" aria-hidden>
            {renderMenuMedia(img)}
          </span>
          <span className="cafeOrdersRpanel__cardBody">
            <span className="cafeOrdersRpanel__cardName">{m.title}</span>
            <span className="cafeOrdersRpanel__cardPrice">{priceLabel}</span>
          </span>
          {renderMenuPickControl(cartItem, cartQty)}
        </button>
      );
    });

  if (!open) return null;

  return (
    <aside className="cafeOrdersRpanel" aria-label="Меню">
      <div className="cafeOrdersRpanel__head">
        <div className="cafeOrdersRpanel__title">Меню</div>
        <div className="cafeOrdersRpanel__headActions">
          <div
            className="cafeOrdersRpanel__viewToggle"
            role="group"
            aria-label="Вид меню"
          >
            <button
              type="button"
              className={`cafeOrdersRpanel__viewBtn${viewMode === "cards" ? " cafeOrdersRpanel__viewBtn--active" : ""}`}
              onClick={() => setViewMode("cards")}
              aria-label="Карточки"
              aria-pressed={viewMode === "cards"}
              title="Карточки"
            >
              <FaThLarge />
            </button>
            <button
              type="button"
              className={`cafeOrdersRpanel__viewBtn${viewMode === "list" ? " cafeOrdersRpanel__viewBtn--active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="Список"
              aria-pressed={viewMode === "list"}
              title="Список"
            >
              <FaListUl />
            </button>
          </div>
          <button
            type="button"
            className="cafeOrdersRpanel__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      <div className="cafeOrdersRpanel__search">
        <FaSearch className="cafeOrdersRpanel__searchIcon" />
        <input
          className="cafeOrdersRpanel__searchInput"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск блюд…"
        />
      </div>
      {/* Категории-аккордеон: всё меню загружено, раскрытие без запросов */}
      <div className="cafeMenuAcc">
        {allLoading && !allMenu.length && (
          <div className="cafeOrdersRpanel__empty">Загрузка меню…</div>
        )}
        {!allLoading && !menuGroups.length && (
          <div className="cafeOrdersRpanel__empty">Ничего не найдено</div>
        )}
        {menuGroups.map((g) => {
          const searching = q.trim().length > 0;
          const open2 =
            searching ||
            (expandedCat !== null && String(expandedCat) === String(g.id));
          return (
            <div
              key={g.id}
              className={`cafeMenuAcc__group${open2 ? " cafeMenuAcc__group--open" : ""}`}
            >
              <button
                type="button"
                className="cafeMenuAcc__head"
                onClick={() =>
                  setExpandedCat((prev) =>
                    String(prev) === String(g.id) ? null : g.id,
                  )
                }
                aria-expanded={open2}
              >
                <span className="cafeMenuAcc__title">
                  {g.title}
                  <span className="cafeMenuAcc__count"> ({g.items.length})</span>
                </span>
                <FaChevronDown className="cafeMenuAcc__chevron" aria-hidden />
              </button>
              {open2 && (
                <div className="cafeMenuAcc__body">
                  <div
                    className={`cafeOrdersRpanel__list cafeOrdersRpanel__list--${viewMode}`}
                  >
                    {g.items.length ? (
                      renderMenuItems(g.items)
                    ) : (
                      <div className="cafeOrdersRpanel__empty">Пусто</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cafeOrdersRpanel__footer">
        <button
          type="button"
          className="cafeOrders__btn cafeOrders__btn--primary cafeOrders__btn--wide"
          onClick={onClose}
        >
          Готов
        </button>
      </div>
    </aside>
  );
};
