import React, { useMemo, useState } from "react";
import { FaBoxes } from "react-icons/fa";
import "./Stocks.scss";

/**
 * BEM: .stock — остатки склада
 * Поиск, фильтры, пагинация (>15), СВОДКА СВЕРХУ, хорошая адаптация.
 */
const WarehouseStocks = () => {
  const demo = useMemo(
    () => [
      { name: "Кофе зерновой 1 кг",  category: "Чай/Кофе",   brand: "Acme",   unit: "шт", qty: 42, reserved: 4 },
      { name: "Чай зелёный 100 пак.",category: "Чай/Кофе",   brand: "Sakura", unit: "уп", qty: 18, reserved: 2 },
      { name: "Какао 250 г",          category: "Чай/Кофе",   brand: "Nordik", unit: "шт", qty: 7,  reserved: 0 },
      { name: "Чай ройбуш 100 г",     category: "Чай/Кофе",   brand: "Sakura", unit: "уп", qty: 2,  reserved: 2 },
      { name: "Молоко UHT 1 л",       category: "Напитки",    brand: "Bosco",  unit: "шт", qty: 55, reserved: 6 },
      { name: "Сок яблочный 1 л",     category: "Напитки",    brand: "Acme",   unit: "шт", qty: 12, reserved: 0 },
      { name: "Вода негаз. 0.5 л",    category: "Напитки",    brand: "Khan",   unit: "шт", qty: 96, reserved: 14 },
      { name: "Вода газ. 0.5 л",      category: "Напитки",    brand: "Khan",   unit: "шт", qty: 44, reserved: 1 },
      { name: "Сироп ваниль 0.7 л",   category: "Сиропы",     brand: "Acme",   unit: "шт", qty: 0,  reserved: 0 },
      { name: "Сироп карамель 0.7 л", category: "Сиропы",     brand: "Acme",   unit: "шт", qty: 6,  reserved: 0 },
      { name: "Орехи миндаль 200 г",  category: "Снэки",      brand: "Nordik", unit: "уп", qty: 9,  reserved: 0 },
      { name: "Фисташки 150 г",       category: "Снэки",      brand: "Sakura", unit: "уп", qty: 5,  reserved: 1 },
      { name: "Чипсы классические",   category: "Снэки",      brand: "Bosco",  unit: "уп", qty: 31, reserved: 0 },
      { name: "Чипсы паприка",        category: "Снэки",      brand: "Bosco",  unit: "уп", qty: 27, reserved: 3 },
      { name: "Сахар порц. 5 г",      category: "Расходники", brand: "Khan",   unit: "уп", qty: 120,reserved: 20 },
      { name: "Стакан бумажный 250мл",category: "Расходники", brand: "Khan",   unit: "уп", qty: 60, reserved: 0 },
      { name: "Крышка для стакана",   category: "Расходники", brand: "Khan",   unit: "уп", qty: 58, reserved: 0 },
      { name: "Мешалка деревянная",   category: "Расходники", brand: "Bosco",  unit: "уп", qty: 40, reserved: 0 },
    ],
    []
  );

  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [availability, setAvailability] = useState("all"); // all | available | out | low
  const [lowThreshold, setLowThreshold] = useState(10);

  const categories = useMemo(
    () => Array.from(new Set(demo.map((d) => d.category))).sort(),
    [demo]
  );
  const brands = useMemo(
    () => Array.from(new Set(demo.map((d) => d.brand))).sort(),
    [demo]
  );

  const filtered = demo.filter((r) => {
    const textOk =
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.category.toLowerCase().includes(q.toLowerCase()) ||
      r.brand.toLowerCase().includes(q.toLowerCase()) ||
      r.unit.toLowerCase().includes(q.toLowerCase());

    const catOk = !fCat || r.category === fCat;
    const brandOk = !fBrand || r.brand === fBrand;

    const available = r.qty - r.reserved;
    let availOk = true;
    if (availability === "available") availOk = available > 0;
    if (availability === "out")       availOk = available <= 0;
    if (availability === "low")       availOk = available > 0 && available < Number(lowThreshold || 0);

    return textOk && catOk && brandOk && availOk;
  });

  const pageSize = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totals = pageItems.reduce(
    (acc, r) => {
      acc.qty += r.qty;
      acc.res += r.reserved;
      acc.avl += r.qty - r.reserved;
      return acc;
    },
    { qty: 0, res: 0, avl: 0 }
  );

  const resetToFirst = (setter) => (e) => {
    setter(e.target ? e.target.value : e);
    setPage(1);
  };

  return (
    <div className="stock">
      {/* Header */}
      <div className="stock__header">
        <div className="stock__titleWrap">
          <h2 className="stock__title">
            <FaBoxes aria-hidden /> Остатки
          </h2>
          <div className="stock__subtitle">Текущие остатки по складу (демо UI).</div>
        </div>

        <div className="stock__actions">
          <div className="stock__search">
            <input
              className="stock__searchInput"
              type="text"
              placeholder="Поиск: товар, категория или бренд…"
              value={q}
              onChange={resetToFirst(setQ)}
            />
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="stock__filters" role="group" aria-label="Фильтры">
        <select className="stock__input" value={fCat} onChange={resetToFirst(setFCat)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select className="stock__input" value={fBrand} onChange={resetToFirst(setFBrand)}>
          <option value="">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <div className="stock__seg" role="tablist" aria-label="Доступность">
          <button type="button" role="tab" aria-selected={availability === "all"}
                  className={`stock__segBtn ${availability === "all" ? "is-active" : ""}`}
                  onClick={() => { setAvailability("all"); setPage(1); }}>
            Все
          </button>
          <button type="button" role="tab" aria-selected={availability === "available"}
                  className={`stock__segBtn ${availability === "available" ? "is-active" : ""}`}
                  onClick={() => { setAvailability("available"); setPage(1); }}>
            Доступно
          </button>
          <button type="button" role="tab" aria-selected={availability === "out"}
                  className={`stock__segBtn ${availability === "out" ? "is-active" : ""}`}
                  onClick={() => { setAvailability("out"); setPage(1); }}>
            Нет в наличии
          </button>
          <button type="button" role="tab" aria-selected={availability === "low"}
                  className={`stock__segBtn ${availability === "low" ? "is-active" : ""}`}
                  onClick={() => { setAvailability("low"); setPage(1); }}>
            Мало
          </button>
        </div>

        <label className="stock__threshold">
          Порог:
          <input
            className="stock__input stock__input--num"
            type="number"
            min={1}
            step={1}
            value={lowThreshold}
            onChange={resetToFirst(setLowThreshold)}
            disabled={availability !== "low"}
            aria-label="Порог малого остатка"
          />
        </label>
      </div>

      {/* СВОДКА — СВЕРХУ */}
      <div className="stock__summary" aria-live="polite">
        <div className="stock__summaryItem">Позиции: <b>{pageItems.length}</b></div>
        <div className="stock__summaryItem">Остаток: <b>{totals.qty}</b></div>
        <div className="stock__summaryItem">Резерв: <b>{totals.res}</b></div>
        <div className="stock__summaryItem">Доступно: <b>{totals.avl}</b></div>
      </div>

      {/* Таблица */}
      <div className="stock-table" role="table" aria-label="Остатки (таблица)">
        <div className="stock-table__head" role="row">
          <div className="stock-table__col" role="columnheader">Товар</div>
          <div className="stock-table__col" role="columnheader">Категория</div>
          <div className="stock-table__col" role="columnheader">Бренд</div>
          <div className="stock-table__col" role="columnheader">Ед.</div>
          <div className="stock-table__col" role="columnheader">Остаток</div>
          <div className="stock-table__col" role="columnheader">Резерв</div>
          <div className="stock-table__col" role="columnheader">Доступно</div>
        </div>

        {pageItems.map((r, i) => {
          const available = r.qty - r.reserved;
          const isZero = available <= 0;
          const isLow = available > 0 && available < Number(lowThreshold || 0);
          return (
            <div key={`${r.name}-${i}`} className="stock-table__row" role="row">
              <div className="stock-table__col" role="cell" data-label="Товар">{r.name}</div>
              <div className="stock-table__col" role="cell" data-label="Категория">{r.category}</div>
              <div className="stock-table__col" role="cell" data-label="Бренд">{r.brand}</div>
              <div className="stock-table__col" role="cell" data-label="Ед.">{r.unit}</div>
              <div className="stock-table__col" role="cell" data-label="Остаток">{r.qty}</div>
              <div className="stock-table__col" role="cell" data-label="Резерв">{r.reserved}</div>
              <div
                className={`stock-table__col stock-table__col--avail ${isZero ? "is-zero" : isLow ? "is-low" : "is-ok"}`}
                role="cell"
                data-label="Доступно"
              >
                <span className="stock__pill">{available}</span>
              </div>
            </div>
          );
        })}

        {!pageItems.length && (
          <div className="stock-table__empty">Ничего не найдено.</div>
        )}
      </div>

      {/* Пагинация */}
      {filtered.length > pageSize && (
        <div className="stock__pager" aria-label="Пагинация">
          <ul className="stock__pageList">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`stock__pageBtn ${p === currentPage ? "is-active" : ""}`}
                    onClick={() => setPage(p)}
                    aria-current={p === currentPage ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WarehouseStocks;
