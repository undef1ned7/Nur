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
  const fetchCategories = useCallback(async () => {
    const res = await api.get("/cafe/categories/");
    setCategories(getListFromResponse(res));
  }, []);
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
  // Debounce для поиска - отправляем запрос на бэкенд через 500ms после остановки ввода
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const timeoutId = setTimeout(() => {
      const trimmedQuery = q.trim();
      if (trimmedQuery !== searchQuery) {
        setSearchQuery(trimmedQuery);
        // Сбрасываем на первую страницу при новом поиске
        if (onPageChange) {
          onPageChange(1, trimmedQuery);
        }
      }
    }, 500);

    searchTimeoutRef.current = timeoutId;

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [q, searchQuery, onPageChange]);

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

  const renderMenuItems = () =>
    paginatedItems.map((m) => {
      const img = menuImageUrl?.(m.id);
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
      <div className="cafeOrdersRpanel__search mt-0! pt-0!">
        <SearchableCombobox
          value={selectedCategoryFilter}
          onChange={(val) => setSelectedCategoryFilter(val || "")}
          options={categoryOptions}
          placeholder="Фильтр по категории…"
          disabled={!categoryOptions.length}
          classNamePrefix="cafeMenuCombo"
        />
      </div>

      <div
        className={`cafeOrdersRpanel__list cafeOrdersRpanel__list--${viewMode}`}
      >
        {loading && <div className="cafeOrdersRpanel__empty">Загрузка…</div>}
        {!loading && renderMenuItems()}
        {!loading && !paginatedItems.length && (
          <div className="cafeOrdersRpanel__empty">Ничего не найдено</div>
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="cafeOrdersRpanel__pagination">
          <button
            type="button"
            className="cafeOrdersRpanel__pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPrevPage || loading}
          >
            Назад
          </button>
          {/* <span className="cafeOrdersRpanel__pagination-info">
            Страница {currentPage} из {totalPages}
            {menuItems?.count ? ` (${menuItems.count} блюд)` : filtered.length ? ` (${filtered.length} блюд)` : ""}
          </span> */}
          <button
            type="button"
            className="cafeOrdersRpanel__pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage || loading}
          >
            Вперед
          </button>
        </div>
      )}

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
