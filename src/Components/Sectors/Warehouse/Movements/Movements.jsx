import React, { useMemo, useState } from "react";
import { FaFileInvoiceDollar, FaShoppingCart, FaPlus, FaTimes } from "react-icons/fa";
import "./Movements.scss";

/**
 * BEM root: .sklad-   — единый компонент "Приход / Отгрузки"
 * Только UI (демо), без сохранения.
 */
const WarehouseMovements = () => {
  // справочники (демо)
  const suppliers = ["ООО «Альфа»", "ИП Бета"];
  const customers = ["Розничный покупатель", "Компания «Дельта»"];
  const products  = ["Кофе зерновой 1 кг", "Чай зелёный 100 пак."];

  const receiptStatuses = ["Принят", "Отказ", "В пути"];
  const issueStatuses   = ["В очереди", "Отменено", "Выгружено"];

  // демо-списки документов
  const receiptList = useMemo(
    () => [
      { date: "2025-09-10", counterparty: "ООО «Альфа»", status: "Принят" },
      { date: "2025-09-12", counterparty: "ИП Бета",     status: "В пути" },
    ],
    []
  );
  const issueList = useMemo(
    () => [
      { date: "2025-09-14", counterparty: "Розничный покупатель", status: "В очереди" },
      { date: "2025-09-15", counterparty: "Компания «Дельта»",   status: "Выгружено" },
    ],
    []
  );

  // UI
  const [tab, setTab] = useState("receipt"); // "receipt" | "issue"
  const [q, setQ]   = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // модалка
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState(receiptStatuses[0]);
  const [counterparty, setCounterparty] = useState("");

  // позиции
  const emptyReceiptRow = { product: "", qty: "", price: "" }; // приход
  const emptyIssueRow   = { product: "", qty: "", amount: "" }; // отгрузка (только сумма)
  const [rows, setRows] = useState([ { ...emptyReceiptRow } ]);

  const source = tab === "receipt" ? receiptList : issueList;
  const filtered = source.filter(
    (r) =>
      r.counterparty.toLowerCase().includes(q.toLowerCase()) ||
      r.status.toLowerCase().includes(q.toLowerCase())
  );

  // пагинация (после 15)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const validPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((validPage - 1) * pageSize, validPage * pageSize);

  const openModal = (mode) => {
    setTab(mode);
    setDate("");
    setCounterparty("");
    setStatus(mode === "receipt" ? receiptStatuses[0] : issueStatuses[0]);
    setRows([ mode === "receipt" ? { ...emptyReceiptRow } : { ...emptyIssueRow } ]);
    setOpen(true);
  };
  const closeModal = () => setOpen(false);

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      tab === "receipt" ? { ...emptyReceiptRow } : { ...emptyIssueRow },
    ]);

  const updateRow = (idx, key, val) =>
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });

  const sumRow = (qty, price) => {
    const qn = Number(qty);
    const pn = Number(price);
    if (!qn || !pn) return "";
    return (qn * pn).toFixed(2);
  };

  return (
    <div className="sklad-movements">
      {/* header */}
      <div className="sklad-movements__header">
        <div className="sklad-movements__titleWrap">
          <h2 className="sklad-movements__title">
            {tab === "receipt" ? (
              <>
                <FaFileInvoiceDollar aria-hidden /> Приход
              </>
            ) : (
              <>
                <FaShoppingCart aria-hidden /> Отгрузки
              </>
            )}
          </h2>
          <div className="sklad-movements__subtitle">Учёт движений. Демоверсия UI.</div>
        </div>

        <div className="sklad-movements__actions">
          <div className="sklad-movements__tabs" role="tablist" aria-label="Тип операции">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "receipt"}
              className={`sklad-movements__tab ${tab === "receipt" ? "is-active" : ""}`}
              onClick={() => { setTab("receipt"); setPage(1); }}
            >
              Приход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "issue"}
              className={`sklad-movements__tab ${tab === "issue" ? "is-active" : ""}`}
              onClick={() => { setTab("issue"); setPage(1); }}
            >
              Отгрузки
            </button>
          </div>

          <div className="sklad-movements__search">
            <input
              className="sklad-movements__searchInput"
              type="text"
              placeholder="Поиск: контрагент или статус…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              aria-label="Поиск"
            />
          </div>

          <button
            className="sklad-movements__btn sklad-movements__btn--primary"
            type="button"
            onClick={() => openModal(tab)}
          >
            <FaPlus aria-hidden />
            <span className="sklad-movements__btnText">
              {tab === "receipt" ? "Новый приход" : "Новая отгрузка"}
            </span>
          </button>
        </div>
      </div>

      {/* таблица */}
      <div className="sklad-movements-table" role="table" aria-label="Документы (таблица)">
        <div className="sklad-movements-table__head" role="row">
          <div className="sklad-movements-table__col" role="columnheader">Дата</div>
          <div className="sklad-movements-table__col" role="columnheader">
            {tab === "receipt" ? "Поставщик" : "Покупатель"}
          </div>
          <div className="sklad-movements-table__col" role="columnheader">Статус</div>
          <div className="sklad-movements-table__col" role="columnheader">Действия</div>
        </div>

        {pageItems.map((r, i) => (
          <div key={`${r.counterparty}-${i}`} className="sklad-movements-table__row" role="row">
            <div className="sklad-movements-table__col sklad-movements__nowrap" data-label="Дата" role="cell">
              {r.date}
            </div>
            <div
              className="sklad-movements-table__col"
              data-label={tab === "receipt" ? "Поставщик" : "Покупатель"}
              role="cell"
            >
              {r.counterparty}
            </div>
            <div className="sklad-movements-table__col" data-label="Статус" role="cell">
              <span className="sklad-movements__badge">{r.status}</span>
            </div>
            <div className="sklad-movements-table__col sklad-movements-table__col--actions" data-label="Действия" role="cell">
              <button
                type="button"
                className="sklad-movements__btn sklad-movements__btn--secondary"
                onClick={() => openModal(tab)}
              >
                Открыть
              </button>
            </div>
          </div>
        ))}

        {!pageItems.length && (
          <div className="sklad-movements-table__empty">Ничего не найдено.</div>
        )}
      </div>

      {/* пагинация после 15 */}
      {filtered.length > pageSize && (
        <div className="sklad-movements__pager" aria-label="Пагинация">
          <ul className="sklad-movements__pageList">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`sklad-movements__pageBtn ${p === validPage ? "is-active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* модалка */}
      {open && (
        <>
          <button className="sklad-movements__overlay" onClick={closeModal} aria-label="Закрыть" />
          <div className="sklad-movements__modal" role="dialog" aria-modal="true">
            <div className="sklad-movements__modalHeader">
              <h3 className="sklad-movements__modalTitle">
                {tab === "receipt" ? "Приход товара" : "Отгрузка товара"}
              </h3>
              <button className="sklad-movements__iconBtn" type="button" aria-label="Закрыть" onClick={closeModal}>
                <FaTimes />
              </button>
            </div>

            <div className="sklad-movements__form">
              {/* верхняя часть формы */}
              <div className="sklad-movements__grid">
                <div className="sklad-movements__field">
                  <label className="sklad-movements__label">
                    {tab === "receipt" ? "Поставщик" : "Покупатель"} <b className="sklad-movements__req">*</b>
                  </label>
                  <select
                    className="sklad-movements__input"
                    value={counterparty}
                    onChange={(e) => setCounterparty(e.target.value)}
                  >
                    <option value="">— выбрать —</option>
                    {(tab === "receipt" ? suppliers : customers).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="sklad-movements__field">
                  <label className="sklad-movements__label">Дата <b className="sklad-movements__req">*</b></label>
                  <input
                    type="date"
                    className="sklad-movements__input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="sklad-movements__field">
                  <label className="sklad-movements__label">Статус <b className="sklad-movements__req">*</b></label>
                  <select
                    className="sklad-movements__input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {(tab === "receipt" ? receiptStatuses : issueStatuses).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* позиции */}
              <div className="sklad-movements-items">
                <div className="sklad-movements-items__head">
                  <div className="sklad-movements-items__col">Товар</div>
                  <div className="sklad-movements-items__col">Кол-во</div>
                  {tab === "receipt" && <div className="sklad-movements-items__col">Цена</div>}
                  <div className="sklad-movements-items__col">Сумма</div>
                </div>

                {rows.map((row, idx) => (
                  <div key={idx} className="sklad-movements-items__row">
                    <select
                      className="sklad-movements__input"
                      value={row.product}
                      onChange={(e) => updateRow(idx, "product", e.target.value)}
                    >
                      <option value="">— выбрать товар —</option>
                      {products.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <input
                      className="sklad-movements__input"
                      type="number"
                      placeholder="0"
                      value={row.qty}
                      onChange={(e) => updateRow(idx, "qty", e.target.value)}
                    />

                    {tab === "receipt" ? (
                      <>
                        <input
                          className="sklad-movements__input"
                          type="number"
                          placeholder="0.00"
                          value={row.price}
                          onChange={(e) => updateRow(idx, "price", e.target.value)}
                        />
                        <input
                          className="sklad-movements__input sklad-movements__input--readonly"
                          type="text"
                          placeholder="0.00"
                          value={sumRow(row.qty, row.price)}
                          readOnly
                        />
                      </>
                    ) : (
                      <input
                        className="sklad-movements__input"
                        type="number"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(e) => updateRow(idx, "amount", e.target.value)}
                      />
                    )}
                  </div>
                ))}

                <div className="sklad-movements-items__footer">
                  <button type="button" className="sklad-movements__btn" onClick={addRow}>
                    <FaPlus aria-hidden />
                    <span className="sklad-movements__btnText">Добавить позицию</span>
                  </button>
                </div>
              </div>

              {/* футер */}
              <div className="sklad-movements__footer">
                <div className="sklad-movements__spacer" />
                <button className="sklad-movements__btn" type="button" onClick={closeModal}>Отмена</button>
                <button className="sklad-movements__btn sklad-movements__btn--primary" type="button" disabled title="Только UI">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WarehouseMovements;
