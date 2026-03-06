import React, { useMemo, useState } from "react";
import { FaBox, FaPlus, FaTimes, FaSearch, FaEdit } from "react-icons/fa";
import "./Products.scss";

/**
 * sklad-products — справочник товаров + вкладка "Ед. изм."
 * - Поля товара: Наименование, Категория, Бренд, Ед. изм. (все обязательные)
 * - Поиск и пагинация (после 15) на вкладке "Товары"
 * - Вкладка "Ед. изм.": добавление/редактирование единиц (одно поле)
 * - Валидация: обязательность, длины, дубликаты (товар: name+brand+unit; ед.: name)
 * - При редактировании названия ед. изм. — обновляются товары с этой единицей
 * - БЭМ: .sklad-products*
 */

const PAGE_SIZE = 50;

const WarehouseProducts = () => {
  /* ---------- Справочники (демо) ---------- */
  const initialCategories = useMemo(
    () =>
      [
        "Чай/Кофе",
        "Напитки",
        "Снэки",
        "Выпечка",
        "Кондитерские изделия",
        "Молочные продукты",
      ].sort((a, b) => a.localeCompare(b, "ru")),
    []
  );

  const initialBrands = useMemo(
    () =>
      ["Acme", "Sakura", "Nordik", "Khan", "Bosco"].sort((a, b) =>
        a.localeCompare(b, "ru")
      ),
    []
  );

  const initialUnits = useMemo(
    () =>
      [
        "шт",
        "уп",
        "кг",
        "г",
        "л",
        "мл",
        "м",
        "м²",
        "м³",
        "пара",
        "набор",
        "рулон",
        "короб",
      ],
    []
  );

  const initialProducts = useMemo(
    () =>
      [
        { name: "Кофе зерновой 1 кг", category: "Чай/Кофе", brand: "Acme", unit: "шт" },
        { name: "Чай зелёный 100 пак.", category: "Чай/Кофе", brand: "Sakura", unit: "уп" },
        { name: "Круассан сливочный", category: "Выпечка", brand: "Nordik", unit: "шт" },
        { name: "Печенье овсяное", category: "Кондитерские изделия", brand: "Bosco", unit: "уп" },
        { name: "Молоко ультрапастеризованное 1 л", category: "Молочные продукты", brand: "Acme", unit: "л" },
        { name: "Йогурт классический 120 г", category: "Молочные продукты", brand: "Sakura", unit: "г" },
        { name: "Сок яблочный 1 л", category: "Напитки", brand: "Khan", unit: "л" },
        { name: "Вода негазированная 0.5 л", category: "Напитки", brand: "Nordik", unit: "мл" },
        { name: "Чипсы картофельные 150 г", category: "Снэки", brand: "Acme", unit: "г" },
        { name: "Сухарики пшеничные 90 г", category: "Снэки", brand: "Bosco", unit: "г" },
        { name: "Печенье сахарное", category: "Кондитерские изделия", brand: "Sakura", unit: "уп" },
        { name: "Булочка с корицей", category: "Выпечка", brand: "Khan", unit: "шт" },
        { name: "Кофе растворимый 100 г", category: "Чай/Кофе", brand: "Acme", unit: "г" },
        { name: "Чай чёрный листовой 200 г", category: "Чай/Кофе", brand: "Sakura", unit: "г" },
        { name: "Нектар апельсиновый 0.95 л", category: "Напитки", brand: "Bosco", unit: "л" },
        { name: "Вафли хрустящие", category: "Кондитерские изделия", brand: "Nordik", unit: "уп" },
        { name: "Маффин шоколадный", category: "Выпечка", brand: "Acme", unit: "шт" },
        { name: "Айран 0.5 л", category: "Молочные продукты", brand: "Khan", unit: "мл" },
      ].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    []
  );

  /* ---------- Состояния ---------- */
  const [activeTab, setActiveTab] = useState("products"); // products | units
  const [categories] = useState(initialCategories);
  const [brands] = useState(initialBrands);
  const [units, setUnits] = useState(initialUnits);
  const [items, setItems] = useState(initialProducts);

  // Поиск/страницы (только для вкладки "Товары")
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.category.toLowerCase().includes(s) ||
        p.brand.toLowerCase().includes(s) ||
        p.unit.toLowerCase().includes(s)
    );
  }, [items, q]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  const pageSlice = filtered.slice(from, from + PAGE_SIZE);

  // Модалка товара
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");

  // Модалка ед. изм.
  const [uOpen, setUOpen] = useState(false);
  const [uEditingIndex, setUEditingIndex] = useState(-1);
  const [uName, setUName] = useState("");
  const [uError, setUError] = useState("");

  /* ---------- Вкладка: Товары ---------- */
  const openCreate = () => {
    setEditingIndex(-1);
    setName("");
    setCategory("");
    setBrand("");
    setUnit("");
    setError("");
    setOpen(true);
  };

  const openEdit = (idxInSlice) => {
    const absIndex = from + idxInSlice;
    const p = filtered[absIndex];
    const realIndex = items.findIndex(
      (x) =>
        x.name === p.name && x.category === p.category && x.brand === p.brand && x.unit === p.unit
    );
    if (realIndex >= 0) {
      setEditingIndex(realIndex);
      setName(items[realIndex].name);
      setCategory(items[realIndex].category);
      setBrand(items[realIndex].brand);
      setUnit(items[realIndex].unit);
      setError("");
      setOpen(true);
    }
  };

  const closeModal = () => { setOpen(false); setError(""); };

  const normalizedKey = ({ name, brand, unit }) =>
    `${name.trim().toLowerCase()}|${brand.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;

  const isDuplicateProduct = (draft) => {
    const key = normalizedKey(draft);
    return items.some((it, i) => (i === editingIndex ? false : normalizedKey(it) === key));
  };

  const handleSaveProduct = () => {
    const nm = name.trim();
    const ct = category.trim();
    const br = brand.trim();
    const un = unit.trim();

    if (!nm) return setError("Укажите наименование.");
    if (nm.length < 2) return setError("Наименование слишком короткое.");
    if (nm.length > 120) return setError("Наименование слишком длинное.");
    if (!ct) return setError("Выберите категорию.");
    if (!br) return setError("Выберите бренд.");
    if (!un) return setError("Выберите единицу измерения.");

    const draft = { name: nm.replace(/\s+/g, " "), category: ct, brand: br, unit: un };
    if (isDuplicateProduct(draft)) return setError("Такой товар уже существует.");

    if (editingIndex === -1) {
      const next = [...items, draft].sort((a, b) => a.name.localeCompare(b.name, "ru"));
      setItems(next);
      const s = q.trim().toLowerCase();
      const filteredNext = s
        ? next.filter(
            (p) =>
              p.name.toLowerCase().includes(s) ||
              p.category.toLowerCase().includes(s) ||
              p.brand.toLowerCase().includes(s) ||
              p.unit.toLowerCase().includes(s)
          )
        : next;
      setPage(Math.max(1, Math.ceil(filteredNext.length / PAGE_SIZE)));
    } else {
      const next = items
        .map((it, i) => (i === editingIndex ? draft : it))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
      setItems(next);
    }

    setOpen(false);
  };

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  /* ---------- Вкладка: Ед. изм. ---------- */
  const openUnitCreate = () => {
    setUEditingIndex(-1);
    setUName("");
    setUError("");
    setUOpen(true);
  };

  const openUnitEdit = (idx) => {
    setUEditingIndex(idx);
    setUName(units[idx]);
    setUError("");
    setUOpen(true);
  };

  const closeUnitModal = () => { setUOpen(false); setUError(""); };

  const handleSaveUnit = () => {
    const v = uName.trim();
    if (!v) return setUError("Укажите название единицы.");
    if (v.length > 20) return setUError("Слишком длинное название.");

    const exists = units.some(
      (u, i) => i !== uEditingIndex && u.toLowerCase() === v.toLowerCase()
    );
    if (exists) return setUError("Такая единица уже есть.");

    if (uEditingIndex === -1) {
      setUnits((prev) => [...prev, v]);
    } else {
      const old = units[uEditingIndex];
      const nextUnits = units.map((u, i) => (i === uEditingIndex ? v : u));
      const nextItems = items.map((p) => (p.unit === old ? { ...p, unit: v } : p));
      setUnits(nextUnits);
      setItems(nextItems);
    }

    setUOpen(false);
  };

  /* ---------- UI ---------- */
  const subtitle =
    activeTab === "products"
      ? "Справочник товаров для закупок, отгрузок и остатков"
      : "Справочник единиц измерения (используются в товарах)";

  const renderPager = () => {
    if (filtered.length <= PAGE_SIZE || activeTab !== "products") return null;

    const btn = (p, label, active = false, disabled = false) => (
      <li key={`p-${label}`}>
        <button
          type="button"
          className={`sklad-products__pageBtn${active ? " is-active" : ""}`}
          onClick={() => goToPage(p)}
          disabled={disabled || active}
          aria-current={active ? "page" : undefined}
        >
          {label}
        </button>
      </li>
    );

    const first = 1, last = totalPages;
    const prev = currentPage - 1, next = currentPage + 1;

    const itemsUi = [];
    itemsUi.push(btn(prev, "‹", false, currentPage === 1));
    itemsUi.push(btn(first, "1", currentPage === 1));
    if (currentPage > 3) itemsUi.push(<li key="dots-l" className="sklad-products__dots">…</li>);
    if (currentPage > 2 && currentPage < last) itemsUi.push(btn(currentPage - 1, String(currentPage - 1)));
    if (currentPage !== 1 && currentPage !== last) itemsUi.push(btn(currentPage, String(currentPage), true));
    if (currentPage < last - 1 && currentPage > 1) itemsUi.push(btn(currentPage + 1, String(currentPage + 1)));
    if (currentPage < last - 2) itemsUi.push(<li key="dots-r" className="sklad-products__dots">…</li>);
    if (last > 1) itemsUi.push(btn(last, String(last), currentPage === last));
    itemsUi.push(btn(next, "›", false, currentPage === last));

    return (
      <nav className="sklad-products__pager" aria-label="Постраничная навигация">
        <ul className="sklad-products__pageList">{itemsUi}</ul>
      </nav>
    );
  };

  return (
    <section className="sklad-products" aria-label="Товары и единицы измерения">
      {/* Header */}
      <div className="sklad-products__header">
        <div className="sklad-products__titleWrap">
          <h2 className="sklad-products__title">
            <FaBox aria-hidden /> Товары
          </h2>
          <div className="sklad-products__subtitle">{subtitle}</div>
        </div>

        <div
          className={
            `sklad-products__actions` +
            (activeTab === "units" ? " sklad-products__actions--units" : "")
          }
        >
          {/* Табы */}
          <div className="sklad-products__tabs" role="tablist" aria-label="Разделы">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "products"}
              className={`sklad-products__tab${activeTab === "products" ? " is-active" : ""}`}
              onClick={() => setActiveTab("products")}
            >
              Товары
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "units"}
              className={`sklad-products__tab${activeTab === "units" ? " is-active" : ""}`}
              onClick={() => setActiveTab("units")}
            >
              Ед. изм.
            </button>
          </div>

          {activeTab === "products" && (
            <>
              <div className="sklad-products__search">
                <FaSearch className="sklad-products__searchIcon" aria-hidden />
                <input
                  className="sklad-products__searchInput"
                  type="text"
                  placeholder="Поиск: наименование, категория, бренд или ед.…"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  aria-label="Строка поиска"
                />
              </div>

              <button
                type="button"
                className="sklad-products__btn sklad-products__btn--primary"
                onClick={openCreate}
              >
                <FaPlus aria-hidden /> <span className="sklad-products__btnText">Новый товар</span>
              </button>
            </>
          )}

          {activeTab === "units" && (
            <button
              type="button"
              className="sklad-products__btn sklad-products__btn--primary"
              onClick={openUnitCreate}
            >
              <FaPlus aria-hidden /> <span className="sklad-products__btnText">Новая единица</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === "products" ? (
        <>
          <div className="sklad-products__list" role="list" aria-label="Список товаров">
            {pageSlice.map((p, idx) => (
              <article key={`${p.name}-${idx}`} className="sklad-products__card" role="listitem">
                <div className="sklad-products__info">
                  <h3 className="sklad-products__name">{p.name}</h3>
                  <div className="sklad-products__meta">
                    <span className="sklad-products__badge">{p.category}</span>
                    <span className="sklad-products__badge">{p.brand}</span>
                    <span className="sklad-products__badge">{p.unit}</span>
                  </div>
                </div>

                <div className="sklad-products__cardActions">
                  <button
                    type="button"
                    className="sklad-products__btn sklad-products__btn--secondary"
                    onClick={() => openEdit(idx)}
                    aria-label={`Изменить «${p.name}»`}
                  >
                    Изменить
                  </button>
                </div>
              </article>
            ))}

            {!pageSlice.length && (
              <div className="sklad-products__alert" role="status">
                По вашему запросу ничего не найдено.
              </div>
            )}
          </div>

          {renderPager()}

          {/* Модалка товара */}
          {open && (
            <div className="sklad-products__overlay" onClick={closeModal} aria-label="Закрыть модальное окно">
              <div
                className="sklad-products__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="prd-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="sklad-products__modalHeader">
                  <h3 id="prd-modal-title" className="sklad-products__modalTitle">
                    {editingIndex === -1 ? "Новый товар" : "Редактировать товар"}
                  </h3>
                  <button type="button" className="sklad-products__iconBtn" onClick={closeModal} aria-label="Закрыть">
                    <FaTimes />
                  </button>
                </header>

                <form
                  className="sklad-products__form"
                  onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }}
                  noValidate
                >
                  <div className="sklad-products__grid">
                    <div className={`sklad-products__field${error && !name.trim() ? " sklad-products__field--invalid" : ""}`} style={{ gridColumn: "1 / -1" }}>
                      <label className="sklad-products__label" htmlFor="prd-name">
                        Наименование <span className="sklad-products__req">*</span>
                      </label>
                      <input
                        id="prd-name"
                        className={`sklad-products__input${error && !name.trim() ? " sklad-products__input--invalid" : ""}`}
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                        placeholder="Например: Кофе зерновой 1 кг"
                        maxLength={120}
                        required
                        autoFocus
                      />
                    </div>

                    <div className={`sklad-products__field${error && !category.trim() ? " sklad-products__field--invalid" : ""}`}>
                      <label className="sklad-products__label" htmlFor="prd-category">
                        Категория <span className="sklad-products__req">*</span>
                      </label>
                      <select
                        id="prd-category"
                        className={`sklad-products__input${error && !category.trim() ? " sklad-products__input--invalid" : ""}`}
                        value={category}
                        onChange={(e) => { setCategory(e.target.value); if (error) setError(""); }}
                        required
                      >
                        <option value="">— выбрать —</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className={`sklad-products__field${error && !brand.trim() ? " sklad-products__field--invalid" : ""}`}>
                      <label className="sklad-products__label" htmlFor="prd-brand">
                        Бренд <span className="sklad-products__req">*</span>
                      </label>
                      <select
                        id="prd-brand"
                        className={`sklad-products__input${error && !brand.trim() ? " sklad-products__input--invalid" : ""}`}
                        value={brand}
                        onChange={(e) => { setBrand(e.target.value); if (error) setError(""); }}
                        required
                      >
                        <option value="">— выбрать —</option>
                        {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className={`sklad-products__field${error && !unit.trim() ? " sklad-products__field--invalid" : ""}`}>
                      <label className="sklad-products__label" htmlFor="prd-unit">
                        Ед. изм. <span className="sklad-products__req">*</span>
                      </label>
                      <select
                        id="prd-unit"
                        className={`sklad-products__input${error && !unit.trim() ? " sklad-products__input--invalid" : ""}`}
                        value={unit}
                        onChange={(e) => { setUnit(e.target.value); if (error) setError(""); }}
                        required
                      >
                        <option value="">— выбрать —</option>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    {error && (
                      <div className="sklad-products__alert sklad-products__alert--inModal" role="alert">
                        {error}
                      </div>
                    )}
                  </div>

                  <footer className="sklad-products__footer">
                    <div className="sklad-products__spacer" />
                    <div className="sklad-products__footerRight">
                      <button type="button" className="sklad-products__btn" onClick={closeModal}>Отмена</button>
                      <button
                        type="submit"
                        className="sklad-products__btn sklad-products__btn--primary"
                        disabled={!name.trim() || !category.trim() || !brand.trim() || !unit.trim()}
                      >
                        Сохранить
                      </button>
                    </div>
                  </footer>
                </form>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Вкладка Ед. изм. */}
          <div className="sklad-products__units">
            <div className="sklad-products__unitsList" role="list" aria-label="Единицы измерения">
              {units.map((u, i) => (
                <div key={`${u}-${i}`} className="sklad-products__unitsRow" role="listitem">
                  <span className="sklad-products__unitsName">{u}</span>
                  <div className="sklad-products__unitsActions">
                    <button
                      type="button"
                      className="sklad-products__btn sklad-products__btn--secondary"
                      onClick={() => openUnitEdit(i)}
                      aria-label={`Изменить единицу «${u}»`}
                    >
                      <FaEdit aria-hidden /> Изменить
                    </button>
                  </div>
                </div>
              ))}
              {!units.length && (
                <div className="sklad-products__alert" role="status">Список пуст.</div>
              )}
            </div>
          </div>

          {/* Модалка ед. изм. */}
          {uOpen && (
            <div className="sklad-products__overlay" onClick={closeUnitModal} aria-label="Закрыть модальное окно">
              <div
                className="sklad-products__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="unit-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="sklad-products__modalHeader">
                  <h3 id="unit-modal-title" className="sklad-products__modalTitle">
                    {uEditingIndex === -1 ? "Новая единица" : "Редактировать единицу"}
                  </h3>
                  <button type="button" className="sklad-products__iconBtn" onClick={closeUnitModal} aria-label="Закрыть">
                    <FaTimes />
                  </button>
                </header>

                <form
                  className="sklad-products__form"
                  onSubmit={(e) => { e.preventDefault(); handleSaveUnit(); }}
                  noValidate
                >
                  <div className="sklad-products__grid" style={{ gridTemplateColumns: "1fr" }}>
                    <div className={`sklad-products__field${uError && !uName.trim() ? " sklad-products__field--invalid" : ""}`}>
                      <label className="sklad-products__label" htmlFor="unit-name">
                        Название единицы <span className="sklad-products__req">*</span>
                      </label>
                      <input
                        id="unit-name"
                        className={`sklad-products__input${uError && !uName.trim() ? " sklad-products__input--invalid" : ""}`}
                        type="text"
                        value={uName}
                        onChange={(e) => { setUName(e.target.value); if (uError) setUError(""); }}
                        placeholder="Например: кг"
                        maxLength={20}
                        required
                        autoFocus
                      />
                    </div>

                    {uError && (
                      <div className="sklad-products__alert sklad-products__alert--inModal" role="alert">
                        {uError}
                      </div>
                    )}
                  </div>

                  <footer className="sklad-products__footer">
                    <div className="sklad-products__spacer" />
                    <div className="sklad-products__footerRight">
                      <button type="button" className="sklad-products__btn" onClick={closeUnitModal}>Отмена</button>
                      <button
                        type="submit"
                        className="sklad-products__btn sklad-products__btn--primary"
                        disabled={!uName.trim()}
                      >
                        Сохранить
                      </button>
                    </div>
                  </footer>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default WarehouseProducts;
