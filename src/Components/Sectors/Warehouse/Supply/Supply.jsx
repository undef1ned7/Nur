import React, { useMemo, useState } from "react";
import {
  FaTruck,
  FaPlus,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import "./Supply.scss";

/**
 * Единый экран: Поставщики / Заказы поставщику / Возвраты поставщику
 * BEM: .sklad-supply
 * UI-only, пагинация после 15, валидация, без console.log/window.confirm
 */
const PER_PAGE = 15;

const WarehouseSupply = () => {
  /* ---------- лок-справочники ---------- */
  const [types, setTypes] = useState(["Компания", "ИП", "ФЛ"]);
  const [cities, setCities] = useState(["Бишкек", "Ош"]);
  const products = useMemo(
    () => ["Кофе зерновой 1 кг", "Чай зелёный 100 пак."],
    []
  );
  const poStatuses = ["В пути", "Отказ", "Получен"];

  /* ---------- данные списков ---------- */
  const [suppliers, setSuppliers] = useState([
    { name: "ООО «Альфа»", type: "Компания", phone: "+996 555 123-456", city: "Бишкек", note: "" },
    { name: "ИП «Бета»",   type: "ИП",       phone: "+996 700 222-333", city: "Ош",     note: "" },
  ]);
  const [orders, setOrders] = useState([
    { date: "2025-09-10", supplier: "ООО «Альфа»", status: "В пути" },
    { date: "2025-09-12", supplier: "ИП «Бета»",   status: "Получен" },
  ]);
  const [returnsList, setReturnsList] = useState([
    { date: "2025-09-11", supplier: "ООО «Альфа»", desc: "Возврат брака" },
    { date: "2025-09-13", supplier: "ИП «Бета»",   desc: "Ошибочная поставка" },
  ]);

  /* ---------- вкладки ---------- */
  const [tab, setTab] = useState("sup");          // sup | po | rt
  const [supView, setSupView] = useState("list"); // list | types | cities
  const [q, setQ] = useState("");

  // пагинация
  const [pageSup, setPageSup]       = useState(1);
  const [pagePO, setPagePO]         = useState(1);
  const [pageRT, setPageRT]         = useState(1);
  const [pageTypes, setPageTypes]   = useState(1);
  const [pageCities, setPageCities] = useState(1);

  /* ---------- модалки ---------- */
  const [openSup, setOpenSup] = useState(false);
  const [openPO,  setOpenPO]  = useState(false);
  const [openRT,  setOpenRT]  = useState(false);

  /* ---------- формы ---------- */
  // Поставщик
  const [supName, setSupName]   = useState("");
  const [supType, setSupType]   = useState("");
  const [supCity, setSupCity]   = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supNote, setSupNote]   = useState("");
  const [supError, setSupError] = useState("");

  // Заказ
  const [poSupplier, setPoSupplier] = useState("");
  const [poDate, setPoDate]         = useState("");
  const [poStatus, setPoStatus]     = useState(poStatuses[0]);
  const [poRows, setPoRows]         = useState([{ product: "", qty: "", price: "" }]);
  const [poError, setPoError]       = useState("");

  // Возврат
  const [rtSupplier, setRtSupplier] = useState("");
  const [rtDate, setRtDate]         = useState("");
  const [rtDesc, setRtDesc]         = useState("");
  const [rtRows, setRtRows]         = useState([{ product: "", qty: "", price: "" }]);
  const [rtError, setRtError]       = useState("");

  // Инлайн формы
  const [typeName, setTypeName] = useState("");
  const [typeErr, setTypeErr]   = useState("");
  const [cityName, setCityName] = useState("");
  const [cityErr, setCityErr]   = useState("");

  /* ---------- утилиты ---------- */
  const resetSupplierForm = () => {
    setSupName(""); setSupType(""); setSupCity(""); setSupPhone(""); setSupNote(""); setSupError("");
  };
  const resetPOForm = () => {
    setPoSupplier(""); setPoDate(""); setPoStatus(poStatuses[0]);
    setPoRows([{ product: "", qty: "", price: "" }]); setPoError("");
  };
  const resetRTForm = () => {
    setRtSupplier(""); setRtDate(""); setRtDesc("");
    setRtRows([{ product: "", qty: "", price: "" }]); setRtError("");
  };

  const calcSum = (qty, price) => {
    const qn = Number(qty), pn = Number(price);
    if (!Number.isFinite(qn) || !Number.isFinite(pn) || qn <= 0 || pn <= 0) return "";
    return (qn * pn).toFixed(2);
  };

  const paginate = (arr, page) => arr.slice((page - 1) * PER_PAGE, (page - 1) * PER_PAGE + PER_PAGE);
  const safeIncludes = (str = "", needle = "") => (str + "").toLowerCase().includes((needle + "").toLowerCase());

  /* ---------- фильтры ---------- */
  const filteredSuppliers = suppliers.filter(
    (s) => safeIncludes(s.name, q) || safeIncludes(s.phone, q) || safeIncludes(s.type, q) || safeIncludes(s.city, q)
  );
  const filteredOrders   = orders.filter( (o) => safeIncludes(o.supplier, q) || safeIncludes(o.status, q) || safeIncludes(o.date, q) );
  const filteredReturns  = returnsList.filter( (r) => safeIncludes(r.supplier, q) || safeIncludes(r.desc, q) || safeIncludes(r.date, q) );
  const filteredTypes    = types.filter((t) => safeIncludes(t, q));
  const filteredCities   = cities.filter((c) => safeIncludes(c, q));

  const totalPagesSup    = Math.max(1, Math.ceil(filteredSuppliers.length / PER_PAGE));
  const totalPagesPO     = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));
  const totalPagesRT     = Math.max(1, Math.ceil(filteredReturns.length / PER_PAGE));
  const totalPagesTypes  = Math.max(1, Math.ceil(filteredTypes.length / PER_PAGE));
  const totalPagesCities = Math.max(1, Math.ceil(filteredCities.length / PER_PAGE));

  const pageDataSup    = paginate(filteredSuppliers, pageSup);
  const pageDataPO     = paginate(filteredOrders, pagePO);
  const pageDataRT     = paginate(filteredReturns, pageRT);
  const pageDataTypes  = paginate(filteredTypes, pageTypes);
  const pageDataCities = paginate(filteredCities, pageCities);

  /* ---------- модалки открытия ---------- */
  const openSupModal = () => { resetSupplierForm(); setOpenSup(true); };
  const openPoModal  = () => { resetPOForm(); setOpenPO(true); };
  const openRtModal  = () => { resetRTForm(); setOpenRT(true); };

  /* ---------- позиции в таблицах ---------- */
  const setRowValue = (setRows) => (idx, key, val) => {
    setRows((prev) => {
      const next = [...prev]; next[idx] = { ...next[idx], [key]: val }; return next;
    });
  };
  const addRow = (setRows) => () => setRows((prev) => [...prev, { product: "", qty: "", price: "" }]);

  /* ---------- сохранения (демо) ---------- */
  const saveSupplierLocal = () => {
    const name = supName.trim();
    if (!name) { setSupError("Укажите название."); return; }
    const dup = suppliers.some((s) => s.name.toLowerCase() === name.toLowerCase());
    if (dup) { setSupError("Такой поставщик уже существует."); return; }
    setSuppliers((prev) => [...prev, {
      name, type: supType || "", phone: supPhone || "", city: supCity || "", note: supNote || "",
    }]);
    setOpenSup(false);
  };

  const validateItems = (rows) => {
    if (!rows.length) return "Добавьте хотя бы одну позицию.";
    const ok = rows.some((r) => r.product && Number(r.qty) > 0 && Number(r.price) > 0);
    return ok ? "" : "Заполните товар, количество и цену хотя бы для одной позиции.";
  };

  const saveOrderLocal = () => {
    if (!poSupplier) { setPoError("Выберите поставщика."); return; }
    if (!poDate)     { setPoError("Укажите дату."); return; }
    const itemsErr = validateItems(poRows); if (itemsErr) { setPoError(itemsErr); return; }
    setOrders((prev) => [...prev, { date: poDate, supplier: poSupplier, status: poStatus }]);
    setOpenPO(false);
  };

  const saveReturnLocal = () => {
    if (!rtSupplier) { setRtError("Выберите поставщика."); return; }
    if (!rtDate)     { setRtError("Укажите дату."); return; }
    const itemsErr = validateItems(rtRows); if (itemsErr) { setRtError(itemsErr); return; }
    setReturnsList((prev) => [...prev, { date: rtDate, supplier: rtSupplier, desc: rtDesc.trim() }]);
    setOpenRT(false);
  };

  /* ---------- render ---------- */
  return (
    <div className="sklad-supply" role="region" aria-label="Поставки">
      {/* Header */}
      <div className="sklad-supply__header">
        <div className="sklad-supply__titleWrap">
          <h2 className="sklad-supply__title"><FaTruck aria-hidden /> Поставки</h2>
          <div className="sklad-supply__subtitle">Поставщики, заказы поставщику и возвраты — в одном месте</div>
        </div>

        <div className="sklad-supply__actions">
          <div className="sklad-supply__search">
            <input
              className="sklad-supply__searchInput"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (tab === "sup") { setPageSup(1); setPageTypes(1); setPageCities(1); }
                if (tab === "po") setPagePO(1);
                if (tab === "rt") setPageRT(1);
              }}
              aria-label="Поиск"
            />
          </div>

          {tab === "sup" && supView === "list" && (
            <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={openSupModal}>
              <FaPlus aria-hidden /><span className="sklad-supply__btnText">Новый поставщик</span>
            </button>
          )}
          {tab === "po" && (
            <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={openPoModal}>
              <FaPlus aria-hidden /><span className="sklad-supply__btnText">Новый заказ</span>
            </button>
          )}
          {tab === "rt" && (
            <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={openRtModal}>
              <FaPlus aria-hidden /><span className="sklad-supply__btnText">Новый возврат</span>
            </button>
          )}
        </div>
      </div>

      {/* Основные вкладки */}
      <div className="sklad-supply__tabs" role="tablist" aria-label="Меню разделов">
        <button
          role="tab"
          aria-selected={tab === "sup"}
          aria-current={tab === "sup" ? "page" : undefined}
          className={`sklad-supply__tab ${tab === "sup" ? "is-active" : ""}`}
          onClick={() => { setTab("sup"); setSupView("list"); setPageSup(1); setPageTypes(1); setPageCities(1); }}
          type="button"
        >Поставщики</button>

        <button
          role="tab"
          aria-selected={tab === "po"}
          aria-current={tab === "po" ? "page" : undefined}
          className={`sklad-supply__tab ${tab === "po" ? "is-active" : ""}`}
          onClick={() => { setTab("po"); setPagePO(1); }}
          type="button"
        >Заказы поставщику</button>

        <button
          role="tab"
          aria-selected={tab === "rt"}
          aria-current={tab === "rt" ? "page" : undefined}
          className={`sklad-supply__tab ${tab === "rt" ? "is-active" : ""}`}
          onClick={() => { setTab("rt"); setPageRT(1); }}
          type="button"
        >Возвраты поставщику</button>
      </div>

      {/* Вложенные вкладки для Поставщиков */}
      {tab === "sup" && (
        <div className="sklad-supply__subtabs" role="tablist" aria-label="Секции справочника поставщиков">
          <button role="tab" aria-selected={supView === "list"}  aria-current={supView === "list" ? "page" : undefined}
                  className={`sklad-supply__tab sklad-supply__tab--sub ${supView === "list" ? "is-active" : ""}`}
                  onClick={() => setSupView("list")} type="button">Список</button>
          <button role="tab" aria-selected={supView === "types"} aria-current={supView === "types" ? "page" : undefined}
                  className={`sklad-supply__tab sklad-supply__tab--sub ${supView === "types" ? "is-active" : ""}`}
                  onClick={() => setSupView("types")} type="button">Типы</button>
          <button role="tab" aria-selected={supView === "cities"} aria-current={supView === "cities" ? "page" : undefined}
                  className={`sklad-supply__tab sklad-supply__tab--sub ${supView === "cities" ? "is-active" : ""}`}
                  onClick={() => setSupView("cities")} type="button">Города</button>
        </div>
      )}

      {/* ---------- Список поставщиков ---------- */}
      {tab === "sup" && supView === "list" && (
        <>
          <div className="sklad-supply__table sklad-supply__table--sup" role="table" aria-label="Поставщики (таблица)">
            <div className="sklad-supply__thead" role="row">
              <div className="sklad-supply__th" role="columnheader">Название</div>
              <div className="sklad-supply__th" role="columnheader">Тип</div>
              <div className="sklad-supply__th" role="columnheader">Телефон</div>
              <div className="sklad-supply__th" role="columnheader">Город</div>
              <div className="sklad-supply__th" role="columnheader">Действия</div>
            </div>

            {pageDataSup.map((s) => (
              <div key={`${s.name}-${s.city}`} className="sklad-supply__trow" role="row">
                <div className="sklad-supply__td" data-label="Название" role="cell">{s.name}</div>
                <div className="sklad-supply__td" data-label="Тип" role="cell">{s.type || "—"}</div>
                <div className="sklad-supply__td sklad-supply__nowrap" data-label="Телефон" role="cell">{s.phone || "—"}</div>
                <div className="sklad-supply__td" data-label="Город" role="cell">{s.city || "—"}</div>
                <div className="sklad-supply__td sklad-supply__td--actions" data-label="Действия" role="cell">
                  <button className="sklad-supply__btn sklad-supply__btn--secondary" type="button" onClick={openSupModal}>Открыть</button>
                </div>
              </div>
            ))}

            {!pageDataSup.length && <div className="sklad-supply__empty">Ничего не найдено.</div>}
          </div>

          {filteredSuppliers.length > PER_PAGE && (
            <div className="sklad-supply__pager">
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageSup((p) => Math.max(1, p - 1))} disabled={pageSup === 1}><FaChevronLeft /></button>
              <ul className="sklad-supply__pageList">
                {Array.from({ length: totalPagesSup }, (_, i) => i + 1).map((n) => (
                  <li key={n}><button className={`sklad-supply__pageBtn ${n === pageSup ? "is-active" : ""}`} type="button" onClick={() => setPageSup(n)}>{n}</button></li>
                ))}
              </ul>
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageSup((p) => Math.min(totalPagesSup, p + 1))} disabled={pageSup === totalPagesSup}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}

      {/* ---------- Типы ---------- */}
      {tab === "sup" && supView === "types" && (
        <>
          <div className="sklad-supply__inlineAdd">
            <input
              className="sklad-supply__input"
              type="text"
              placeholder="Новый тип, например: Компания"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              aria-label="Название типа"
            />
            <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={() => {
              const v = typeName.trim();
              if (!v) return setTypeErr("Введите название типа.");
              if (types.some(t => t.toLowerCase() === v.toLowerCase())) return setTypeErr("Такой тип уже есть.");
              setTypes(p => [...p, v]); setTypeName(""); setTypeErr("");
              setPageTypes(Math.max(1, Math.ceil((types.length + 1) / PER_PAGE)));
            }}>
              <FaPlus aria-hidden /><span className="sklad-supply__btnText">Добавить</span>
            </button>
          </div>
          {typeErr && <div className="sklad-supply__alert">{typeErr}</div>}

          <div className="sklad-supply__table sklad-supply__table--ref" role="table" aria-label="Типы поставщиков">
            <div className="sklad-supply__thead" role="row">
              <div className="sklad-supply__th" role="columnheader">Тип</div>
            </div>
            {pageDataTypes.map((t, i) => (
              <div key={`${t}-${i}`} className="sklad-supply__trow" role="row">
                <div className="sklad-supply__td" data-label="Тип" role="cell">{t}</div>
              </div>
            ))}
            {!pageDataTypes.length && <div className="sklad-supply__empty">Пусто.</div>}
          </div>

          {filteredTypes.length > PER_PAGE && (
            <div className="sklad-supply__pager">
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageTypes((p) => Math.max(1, p - 1))} disabled={pageTypes === 1}><FaChevronLeft /></button>
              <ul className="sklad-supply__pageList">
                {Array.from({ length: totalPagesTypes }, (_, i) => i + 1).map((n) => (
                  <li key={n}><button className={`sklad-supply__pageBtn ${n === pageTypes ? "is-active" : ""}`} type="button" onClick={() => setPageTypes(n)}>{n}</button></li>
                ))}
              </ul>
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageTypes((p) => Math.min(totalPagesTypes, p + 1))} disabled={pageTypes === totalPagesTypes}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}

      {/* ---------- Города ---------- */}
      {tab === "sup" && supView === "cities" && (
        <>
          <div className="sklad-supply__inlineAdd">
            <input
              className="sklad-supply__input"
              type="text"
              placeholder="Новый город, например: Бишкек"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              aria-label="Название города"
            />
            <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={() => {
              const v = cityName.trim();
              if (!v) return setCityErr("Введите название города.");
              if (cities.some(c => c.toLowerCase() === v.toLowerCase())) return setCityErr("Такой город уже есть.");
              setCities(p => [...p, v]); setCityName(""); setCityErr("");
              setPageCities(Math.max(1, Math.ceil((cities.length + 1) / PER_PAGE)));
            }}>
              <FaPlus aria-hidden /><span className="sklad-supply__btnText">Добавить</span>
            </button>
          </div>
          {cityErr && <div className="sklad-supply__alert">{cityErr}</div>}

          <div className="sklad-supply__table sklad-supply__table--ref" role="table" aria-label="Города поставщиков">
            <div className="sklad-supply__thead" role="row">
              <div className="sklad-supply__th" role="columnheader">Город</div>
            </div>
            {pageDataCities.map((c, i) => (
              <div key={`${c}-${i}`} className="sklad-supply__trow" role="row">
                <div className="sklad-supply__td" data-label="Город" role="cell">{c}</div>
              </div>
            ))}
            {!pageDataCities.length && <div className="sklad-supply__empty">Пусто.</div>}
          </div>

          {filteredCities.length > PER_PAGE && (
            <div className="sklad-supply__pager">
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageCities((p) => Math.max(1, p - 1))} disabled={pageCities === 1}><FaChevronLeft /></button>
              <ul className="sklad-supply__pageList">
                {Array.from({ length: totalPagesCities }, (_, i) => i + 1).map((n) => (
                  <li key={n}><button className={`sklad-supply__pageBtn ${n === pageCities ? "is-active" : ""}`} type="button" onClick={() => setPageCities(n)}>{n}</button></li>
                ))}
              </ul>
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageCities((p) => Math.min(totalPagesCities, p + 1))} disabled={pageCities === totalPagesCities}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}

      {/* ---------- Заказы ---------- */}
      {tab === "po" && (
        <>
          <div className="sklad-supply__table sklad-supply__table--po" role="table" aria-label="Заказы поставщику (таблица)">
            <div className="sklad-supply__thead" role="row">
              <div className="sklad-supply__th" role="columnheader">Дата</div>
              <div className="sklad-supply__th" role="columnheader">Поставщик</div>
              <div className="sklad-supply__th" role="columnheader">Статус</div>
              <div className="sklad-supply__th" role="columnheader">Действия</div>
            </div>

            {pageDataPO.map((o, idx) => (
              <div key={`${o.supplier}-${o.date}-${idx}`} className="sklad-supply__trow" role="row">
                <div className="sklad-supply__td sklad-supply__nowrap" data-label="Дата" role="cell">{o.date}</div>
                <div className="sklad-supply__td" data-label="Поставщик" role="cell">{o.supplier}</div>
                <div className="sklad-supply__td sklad-supply__nowrap" data-label="Статус" role="cell">{o.status}</div>
                <div className="sklad-supply__td sklad-supply__td--actions" data-label="Действия" role="cell">
                  <button className="sklad-supply__btn sklad-supply__btn--secondary" type="button" onClick={openPoModal}>Открыть</button>
                </div>
              </div>
            ))}

            {!pageDataPO.length && <div className="sklad-supply__empty">Ничего не найдено.</div>}
          </div>

          {filteredOrders.length > PER_PAGE && (
            <div className="sklad-supply__pager">
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPagePO((p) => Math.max(1, p - 1))} disabled={pagePO === 1}><FaChevronLeft /></button>
              <ul className="sklad-supply__pageList">
                {Array.from({ length: totalPagesPO }, (_, i) => i + 1).map((n) => (
                  <li key={n}><button className={`sklad-supply__pageBtn ${n === pagePO ? "is-active" : ""}`} type="button" onClick={() => setPagePO(n)}>{n}</button></li>
                ))}
              </ul>
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPagePO((p) => Math.min(totalPagesPO, p + 1))} disabled={pagePO === totalPagesPO}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}

      {/* ---------- Возвраты ---------- */}
      {tab === "rt" && (
        <>
          <div className="sklad-supply__table sklad-supply__table--rt" role="table" aria-label="Возвраты поставщику (таблица)">
            <div className="sklad-supply__thead" role="row">
              <div className="sklad-supply__th" role="columnheader">Дата</div>
              <div className="sklad-supply__th" role="columnheader">Поставщик</div>
              <div className="sklad-supply__th" role="columnheader">Описание</div>
              <div className="sklad-supply__th" role="columnheader">Действия</div>
            </div>

            {pageDataRT.map((r, idx) => (
              <div key={`${r.supplier}-${r.date}-${idx}`} className="sklad-supply__trow" role="row">
                <div className="sklad-supply__td sklad-supply__nowrap" data-label="Дата" role="cell">{r.date}</div>
                <div className="sklad-supply__td" data-label="Поставщик" role="cell">{r.supplier}</div>
                <div className="sklad-supply__td" data-label="Описание" role="cell">{r.desc || "—"}</div>
                <div className="sklad-supply__td sklad-supply__td--actions" data-label="Действия" role="cell">
                  <button className="sklad-supply__btn sklad-supply__btn--secondary" type="button" onClick={openRtModal}>Открыть</button>
                </div>
              </div>
            ))}

            {!pageDataRT.length && <div className="sklad-supply__empty">Ничего не найдено.</div>}
          </div>

          {filteredReturns.length > PER_PAGE && (
            <div className="sklad-supply__pager">
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageRT((p) => Math.max(1, p - 1))} disabled={pageRT === 1}><FaChevronLeft /></button>
              <ul className="sklad-supply__pageList">
                {Array.from({ length: totalPagesRT }, (_, i) => i + 1).map((n) => (
                  <li key={n}><button className={`sklad-supply__pageBtn ${n === pageRT ? "is-active" : ""}`} type="button" onClick={() => setPageRT(n)}>{n}</button></li>
                ))}
              </ul>
              <button className="sklad-supply__pageBtn" type="button" onClick={() => setPageRT((p) => Math.min(totalPagesRT, p + 1))} disabled={pageRT === totalPagesRT}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}

      {/* ---------- МОДАЛКИ ---------- */}
      {openSup && (
        <>
          <button className="sklad-supply__overlay" onClick={() => setOpenSup(false)} aria-label="Закрыть" />
          <div className="sklad-supply__modal" role="dialog" aria-modal="true" aria-labelledby="sup-title">
            <div className="sklad-supply__modalHeader">
              <h3 id="sup-title" className="sklad-supply__modalTitle">Поставщик</h3>
              <button className="sklad-supply__iconBtn" type="button" onClick={() => setOpenSup(false)} aria-label="Закрыть"><FaTimes /></button>
            </div>

            {supError && <div className="sklad-supply__alert sklad-supply__alert--inModal">{supError}</div>}

            <div className="sklad-supply__form">
              <div className="sklad-supply__grid">
                <div className="sklad-supply__field sklad-supply__field--full">
                  <label className="sklad-supply__label" htmlFor="sup-name">Название <span className="sklad-supply__req">*</span></label>
                  <input id="sup-name" className="sklad-supply__input" type="text" value={supName} onChange={(e) => setSupName(e.target.value)} placeholder='Например: ООО «Альфа»' />
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="sup-type">Тип</label>
                  <select id="sup-type" className="sklad-supply__input" value={supType} onChange={(e) => setSupType(e.target.value)}>
                    <option value="">— выбрать —</option>
                    {types.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="sup-city">Город</label>
                  <select id="sup-city" className="sklad-supply__input" value={supCity} onChange={(e) => setSupCity(e.target.value)}>
                    <option value="">— выбрать —</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="sup-phone">Телефон</label>
                  <input id="sup-phone" className="sklad-supply__input" type="text" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} placeholder="+996 ___ ___-___" />
                </div>

                <div className="sklad-supply__field sklad-supply__field--full">
                  <label className="sklad-supply__label" htmlFor="sup-note">Комментарий</label>
                  <textarea id="sup-note" className="sklad-supply__input" rows={3} value={supNote} onChange={(e) => setSupNote(e.target.value)} placeholder="Опционально" />
                </div>
              </div>

              <div className="sklad-supply__footer">
                <div className="sklad-supply__spacer" />
                <button className="sklad-supply__btn" type="button" onClick={() => setOpenSup(false)}>Отмена</button>
                <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={saveSupplierLocal}>Сохранить</button>
              </div>
            </div>
          </div>
        </>
      )}

      {openPO && (
        <>
          <button className="sklad-supply__overlay" onClick={() => setOpenPO(false)} aria-label="Закрыть" />
          <div className="sklad-supply__modal" role="dialog" aria-modal="true" aria-labelledby="po-title">
            <div className="sklad-supply__modalHeader">
              <h3 id="po-title" className="sklad-supply__modalTitle">Заказ поставщику</h3>
              <button className="sklad-supply__iconBtn" type="button" onClick={() => setOpenPO(false)} aria-label="Закрыть"><FaTimes /></button>
            </div>

            {poError && <div className="sklad-supply__alert sklad-supply__alert--inModal">{poError}</div>}

            <div className="sklad-supply__form">
              <div className="sklad-supply__grid">
                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="po-sup">Поставщик <span className="sklad-supply__req">*</span></label>
                  <select id="po-sup" className="sklad-supply__input" value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}>
                    <option value="">— выбрать —</option>
                    {suppliers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="po-date">Дата <span className="sklad-supply__req">*</span></label>
                  <input id="po-date" className="sklad-supply__input" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="po-status">Статус</label>
                  <select id="po-status" className="sklad-supply__input" value={poStatus} onChange={(e) => setPoStatus(e.target.value)}>
                    {poStatuses.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>

                <div className="sklad-supply__field sklad-supply__field--full">
                  <div className="sklad-supply-items">
                    <div className="sklad-supply-items__head">
                      <div className="sklad-supply-items__col">Товар</div>
                      <div className="sklad-supply-items__col">Кол-во</div>
                      <div className="sklad-supply-items__col">Цена</div>
                      <div className="sklad-supply-items__col">Сумма</div>
                    </div>

                    {poRows.map((row, idx) => {
                      const handle = setRowValue(setPoRows);
                      return (
                        <div key={idx} className="sklad-supply-items__row">
                          <select className="sklad-supply__input" value={row.product} onChange={(e) => handle(idx, "product", e.target.value)}>
                            <option value="">— выбрать товар —</option>
                            {products.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input className="sklad-supply__input" type="number" placeholder="0" value={row.qty} onChange={(e) => handle(idx, "qty", e.target.value)} />
                          <input className="sklad-supply__input" type="number" placeholder="0.00" value={row.price} onChange={(e) => handle(idx, "price", e.target.value)} />
                          <input className="sklad-supply__input sklad-supply__input--readonly" type="text" value={calcSum(row.qty, row.price)} placeholder="0.00" readOnly />
                        </div>
                      );
                    })}

                    <div className="sklad-supply-items__footer">
                      <button type="button" className="sklad-supply__btn" onClick={addRow(setPoRows)}>
                        <FaPlus aria-hidden /><span className="sklad-supply__btnText">Добавить позицию</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sklad-supply__footer">
                <div className="sklad-supply__spacer" />
                <button className="sklad-supply__btn" type="button" onClick={() => setOpenPO(false)}>Отмена</button>
                <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={saveOrderLocal}>Сохранить</button>
              </div>
            </div>
          </div>
        </>
      )}

      {openRT && (
        <>
          <button className="sklad-supply__overlay" onClick={() => setOpenRT(false)} aria-label="Закрыть" />
          <div className="sklad-supply__modal" role="dialog" aria-modal="true" aria-labelledby="rt-title">
            <div className="sklad-supply__modalHeader">
              <h3 id="rt-title" className="sklad-supply__modalTitle">Возврат поставщику</h3>
              <button className="sklad-supply__iconBtn" type="button" onClick={() => setOpenRT(false)} aria-label="Закрыть"><FaTimes /></button>
            </div>

            {rtError && <div className="sklad-supply__alert sklad-supply__alert--inModal">{rtError}</div>}

            <div className="sklad-supply__form">
              <div className="sklad-supply__grid">
                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="rt-sup">Поставщик <span className="sklad-supply__req">*</span></label>
                  <select id="rt-sup" className="sklad-supply__input" value={rtSupplier} onChange={(e) => setRtSupplier(e.target.value)}>
                    <option value="">— выбрать —</option>
                    {suppliers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div className="sklad-supply__field">
                  <label className="sklad-supply__label" htmlFor="rt-date">Дата <span className="sklad-supply__req">*</span></label>
                  <input id="rt-date" className="sklad-supply__input" type="date" value={rtDate} onChange={(e) => setRtDate(e.target.value)} />
                </div>

                <div className="sklad-supply__field sklad-supply__field--full">
                  <label className="sklad-supply__label" htmlFor="rt-desc">Описание</label>
                  <textarea id="rt-desc" className="sklad-supply__input" rows={3} value={rtDesc} onChange={(e) => setRtDesc(e.target.value)} placeholder="Причина возврата (опционально)" />
                </div>

                <div className="sklad-supply__field sklad-supply__field--full">
                  <div className="sklad-supply-items">
                    <div className="sklad-supply-items__head">
                      <div className="sklad-supply-items__col">Товар</div>
                      <div className="sklad-supply-items__col">Кол-во</div>
                      <div className="sklad-supply-items__col">Цена</div>
                      <div className="sklad-supply-items__col">Сумма</div>
                    </div>

                    {rtRows.map((row, idx) => {
                      const handle = setRowValue(setRtRows);
                      return (
                        <div key={idx} className="sklad-supply-items__row">
                          <select className="sklad-supply__input" value={row.product} onChange={(e) => handle(idx, "product", e.target.value)}>
                            <option value="">— выбрать товар —</option>
                            {products.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input className="sklad-supply__input" type="number" placeholder="0" value={row.qty} onChange={(e) => handle(idx, "qty", e.target.value)} />
                          <input className="sklad-supply__input" type="number" placeholder="0.00" value={row.price} onChange={(e) => handle(idx, "price", e.target.value)} />
                          <input className="sklad-supply__input sklad-supply__input--readonly" type="text" value={calcSum(row.qty, row.price)} placeholder="0.00" readOnly />
                        </div>
                      );
                    })}

                    <div className="sklad-supply-items__footer">
                      <button type="button" className="sklad-supply__btn" onClick={addRow(setRtRows)}>
                        <FaPlus aria-hidden /><span className="sklad-supply__btnText">Добавить позицию</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sklad-supply__footer">
                <div className="sklad-supply__spacer" />
                <button className="sklad-supply__btn" type="button" onClick={() => setOpenRT(false)}>Отмена</button>
                <button className="sklad-supply__btn sklad-supply__btn--primary" type="button" onClick={saveReturnLocal}>Сохранить</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WarehouseSupply;
