import React, { useMemo, useState } from "react";
import { FaTags, FaIndustry, FaPlus, FaTimes, FaSearch } from "react-icons/fa";
import "./Directories.scss";

/**
 * sklad-directories — объединённый справочник «Категории» + «Бренды» (табы).
 * - Только название.
 * - Поиск, пагинация (после 15), создание/редактирование в модалке.
 * - Валидация: обязательность, длина, дубликаты (trim, case-insensitive).
 * - БЭМ: .sklad-directories*
 */

const PAGE_SIZE = 50;
const TABS = { CATEGORIES: "categories", BRANDS: "brands" };

const WarehouseDirectories = () => {
  // Демоданные (>15 для демонстрации пагинации)
  const initialCats = useMemo(
    () =>
      [
        "Напитки", "Кофе", "Чай", "Снэки", "Орехи", "Выпечка", "Молочные продукты",
        "Сыры", "Кондитерские изделия", "Заморозка", "Соусы", "Приправы", "Консервы",
        "Мясо", "Птица", "Рыба", "Овощи", "Фрукты", "Хлеб", "Макароны", "Каши", "Крупы"
      ].sort((a, b) => a.localeCompare(b, "ru")),
    []
  );
  const initialBrands = useMemo(
    () =>
      [
        "Acme", "Nordik", "Khan", "Sakura", "Bosco", "Delta", "Omega", "Vento",
        "Aurora", "Polar", "Gloria", "Orion", "Matrix", "Artex", "Linea", "Mondo",
        "Terra", "Quartz"
      ].sort((a, b) => a.localeCompare(b, "ru")),
    []
  );

  // Текущий таб
  const [tab, setTab] = useState(TABS.CATEGORIES);

  // Данные
  const [cats, setCats] = useState(initialCats);
  const [brands, setBrands] = useState(initialBrands);

  // Поиск
  const [qCat, setQCat] = useState("");
  const [qBrand, setQBrand] = useState("");

  // Пагинация
  const [pageCat, setPageCat] = useState(1);
  const [pageBrand, setPageBrand] = useState(1);

  // Модалка
  const [open, setOpen] = useState(false);
  const [editingValue, setEditingValue] = useState(""); // пусто = создание
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  // Утилиты текущего таба
  const currentList = tab === TABS.CATEGORIES ? cats : brands;
  const setCurrentList = (next) => (tab === TABS.CATEGORIES ? setCats(next) : setBrands(next));
  const query = tab === TABS.CATEGORIES ? qCat : qBrand;
  const setQuery = tab === TABS.CATEGORIES ? setQCat : setQBrand;
  const page = tab === TABS.CATEGORIES ? pageCat : pageBrand;
  const setPage = tab === TABS.CATEGORIES ? setPageCat : setPageBrand;

  // Фильтрация
  const filteredCats = useMemo(() => {
    const q = qCat.trim().toLowerCase();
    return q ? cats.filter((x) => x.toLowerCase().includes(q)) : cats;
  }, [cats, qCat]);

  const filteredBrands = useMemo(() => {
    const q = qBrand.trim().toLowerCase();
    return q ? brands.filter((x) => x.toLowerCase().includes(q)) : brands;
  }, [brands, qBrand]);

  const filtered = tab === TABS.CATEGORIES ? filteredCats : filteredBrands;

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

  // Модалка: открыть/закрыть
  const openCreate = () => {
    setEditingValue("");
    setInputValue("");
    setError("");
    setOpen(true);
  };
  const openEdit = (val) => {
    setEditingValue(val);
    setInputValue(val);
    setError("");
    setOpen(true);
  };
  const closeModal = () => {
    setOpen(false);
    setError("");
  };

  // Проверка дубликатов в текущем списке
  const isDuplicate = (val) => {
    const v = val.trim().toLowerCase();
    if (!v) return false;
    return currentList.some((x) => {
      const same = x.trim().toLowerCase() === v;
      if (editingValue && x === editingValue) return false; // редактируем себя
      return same;
    });
  };

  // Сохранение (создание/редактирование)
  const handleSave = () => {
    const v = inputValue.trim();

    if (!v) { setError("Укажите название."); return; }
    if (v.length < 2) { setError("Название слишком короткое."); return; }
    if (v.length > 80) { setError("Название слишком длинное."); return; }
    if (isDuplicate(v)) { setError("Такое название уже существует."); return; }

    if (!editingValue) {
      const next = [...currentList, v].sort((a, b) => a.localeCompare(b, "ru"));
      setCurrentList(next);
      const q = query.trim().toLowerCase();
      const filteredNext = q ? next.filter((x) => x.toLowerCase().includes(q)) : next;
      setPage(Math.max(1, Math.ceil(filteredNext.length / PAGE_SIZE)));
    } else {
      const next = currentList
        .map((x) => (x === editingValue ? v : x))
        .sort((a, b) => a.localeCompare(b, "ru"));
      setCurrentList(next);
    }

    setOpen(false);
  };

  // Пагинация — кнопки
  const goToPage = (p) => {
    const safe = Math.min(Math.max(1, p), totalPages);
    setPage(safe);
  };

  const renderPager = () => {
    if (filtered.length <= PAGE_SIZE) return null;

    const btn = (p, label, active = false, disabled = false) => (
      <li key={`${label}-${tab}`}>
        <button
          type="button"
          className={`sklad-directories__pageBtn${active ? " is-active" : ""}`}
          onClick={() => goToPage(p)}
          disabled={disabled || active}
          aria-current={active ? "page" : undefined}
        >
          {label}
        </button>
      </li>
    );

    const first = 1;
    const last = totalPages;
    const prev = currentPage - 1;
    const next = currentPage + 1;

    const items = [];
    items.push(btn(prev, "‹", false, currentPage === 1));
    items.push(btn(first, "1", currentPage === 1));
    if (currentPage > 3) items.push(<li key="dots-l" className="sklad-directories__dots">…</li>);
    if (currentPage > 2 && currentPage < last) items.push(btn(currentPage - 1, String(currentPage - 1)));
    if (currentPage !== 1 && currentPage !== last) items.push(btn(currentPage, String(currentPage), true));
    if (currentPage < last - 1 && currentPage > 1) items.push(btn(currentPage + 1, String(currentPage + 1)));
    if (currentPage < last - 2) items.push(<li key="dots-r" className="sklad-directories__dots">…</li>);
    if (last > 1) items.push(btn(last, String(last), currentPage === last));
    items.push(btn(next, "›", false, currentPage === last));

    return (
      <nav className="sklad-directories__pager" aria-label="Постраничная навигация">
        <ul className="sklad-directories__pageList">{items}</ul>
      </nav>
    );
  };

  // Смена таба
  const switchTab = (nextTab) => {
    setTab(nextTab);
    if (nextTab === TABS.CATEGORIES) setPageCat(1);
    else setPageBrand(1);
  };

  const modalTitle =
    editingValue
      ? tab === TABS.CATEGORIES ? "Редактировать категорию" : "Редактировать бренд"
      : tab === TABS.CATEGORIES ? "Новая категория" : "Новый бренд";

  const subtitle = tab === TABS.CATEGORIES
    ? "Список категорий для группировки товаров"
    : "Справочник брендов производителей/линеек";

  return (
    <section className="sklad-directories" aria-label="Категории и бренды">
      {/* Header */}
      <div className="sklad-directories__header">
        <div className="sklad-directories__titleWrap">
          <h2 className="sklad-directories__title">
            {tab === TABS.CATEGORIES ? <FaTags aria-hidden /> : <FaIndustry aria-hidden />}
            &nbsp;{tab === TABS.CATEGORIES ? "Категории" : "Бренды"}
          </h2>
          <div className="sklad-directories__subtitle">{subtitle}</div>
        </div>

        <div className="sklad-directories__actions">
          <div className="sklad-directories__tabs" role="tablist" aria-label="Переключение справочников">
            <button
              role="tab"
              aria-selected={tab === TABS.CATEGORIES}
              className={`sklad-directories__tab${tab === TABS.CATEGORIES ? " is-active" : ""}`}
              type="button"
              onClick={() => switchTab(TABS.CATEGORIES)}
            >
              Категории
            </button>
            <button
              role="tab"
              aria-selected={tab === TABS.BRANDS}
              className={`sklad-directories__tab${tab === TABS.BRANDS ? " is-active" : ""}`}
              type="button"
              onClick={() => switchTab(TABS.BRANDS)}
            >
              Бренды
            </button>
          </div>

          <div className="sklad-directories__search">
            <FaSearch className="sklad-directories__searchIcon" aria-hidden />
            <input
              className="sklad-directories__searchInput"
              type="text"
              placeholder={tab === TABS.CATEGORIES ? "Поиск категории…" : "Поиск бренда…"}
              value={tab === TABS.CATEGORIES ? qCat : qBrand}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Строка поиска"
            />
          </div>

          <button
            type="button"
            className="sklad-directories__btn sklad-directories__btn--primary"
            onClick={openCreate}
          >
            <FaPlus aria-hidden /> <span className="sklad-directories__btnText">
              {tab === TABS.CATEGORIES ? "Новая категория" : "Новый бренд"}
            </span>
          </button>
        </div>
      </div>

      {/* Список */}
      <div
        className="sklad-directories__list"
        role="list"
        aria-label={tab === TABS.CATEGORIES ? "Категории (список)" : "Бренды (список)"}
      >
        {pageSlice.map((title) => (
          <article key={`${tab}-${title}`} className="sklad-directories__card" role="listitem">
            <div className="sklad-directories__info">
              <h3 className="sklad-directories__name">{title}</h3>
            </div>
            <div className="sklad-directories__cardActions">
              <button
                type="button"
                className="sklad-directories__btn sklad-directories__btn--secondary"
                onClick={() => openEdit(title)}
                aria-label={`Изменить «${title}»`}
              >
                Изменить
              </button>
            </div>
          </article>
        ))}

        {!pageSlice.length && (
          <div className="sklad-directories__alert" role="status">По вашему запросу ничего не найдено.</div>
        )}
      </div>

      {renderPager()}

      {/* Модалка */}
      {open && (
        <div className="sklad-directories__overlay" onClick={closeModal} aria-label="Закрыть модальное окно">
          <div
            className="sklad-directories__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dir-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sklad-directories__modalHeader">
              <h3 id="dir-modal-title" className="sklad-directories__modalTitle">{modalTitle}</h3>
              <button
                type="button"
                className="sklad-directories__iconBtn"
                onClick={closeModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </header>

            <form
              className="sklad-directories__form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              noValidate
            >
              <div className="sklad-directories__grid">
                <div
                  className={`sklad-directories__field${error ? " sklad-directories__field--invalid" : ""}`}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="sklad-directories__label" htmlFor="dir-name">
                    Название <span className="sklad-directories__req">*</span>
                  </label>
                  <input
                    id="dir-name"
                    className={`sklad-directories__input${error ? " sklad-directories__input--invalid" : ""}`}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder={tab === TABS.CATEGORIES ? "Например: Кофе" : "Например: Acme"}
                    maxLength={80}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="sklad-directories__alert sklad-directories__alert--inModal" role="alert">
                    {error}
                  </div>
                )}
              </div>

              <footer className="sklad-directories__footer">
                <div className="sklad-directories__spacer" />
                <div className="sklad-directories__footerRight">
                  <button type="button" className="sklad-directories__btn" onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="sklad-directories__btn sklad-directories__btn--primary"
                    disabled={!inputValue.trim()}
                  >
                    Сохранить
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default WarehouseDirectories;
