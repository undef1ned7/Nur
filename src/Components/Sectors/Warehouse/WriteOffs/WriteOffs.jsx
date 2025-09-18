import React, { useMemo, useState } from "react";
import { FaBalanceScale, FaPlus, FaTimes } from "react-icons/fa";
import "./WriteOffs.scss";

/**
 * BEM: .sklad-writeoff — «Списание»
 * UI-демо: поиск, пагинация (>15), модалка по центру.
 */
const WarehouseWriteOffs = () => {
  // Справочники (демо)
  const reasons = ["Инвентаризация", "Порча/Списание"];
  const products = ["Кофе зерновой 1 кг", "Чай зелёный 100 пак."];

  // Документы (демо)
  const demo = useMemo(
    () => [
      { date: "2025-09-12", reason: "Инвентаризация", note: "" },
      { date: "2025-09-13", reason: "Порча/Списание", note: "Повреждение упаковки" },
    ],
    []
  );

  /* ---------- Поиск/пагинация ---------- */
  const [q, setQ] = useState("");
  const PAGE = 15;
  const [page, setPage] = useState(1);

  const filtered = demo.filter(
    (r) =>
      r.reason.toLowerCase().includes(q.toLowerCase()) ||
      r.date.includes(q) ||
      (r.note || "").toLowerCase().includes(q.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  /* ---------- Модалка ---------- */
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");

  /* Позиции */
  const emptyRow = { product: "", qty: "" }; // qty со знаком
  const [rows, setRows] = useState([{ ...emptyRow }]);

  const openModal = () => {
    setDate("");
    setReason(reasons[0]);
    setNote("");
    setRows([{ ...emptyRow }]);
    setOpen(true);
  };
  const closeModal = () => setOpen(false);

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);
  const updateRow = (idx, key, val) =>
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });

  // Простая валидация
  const hasValidItem = rows.some((r) => r.product.trim() && String(r.qty).trim() !== "");
  const isValid = Boolean(date && reason && hasValidItem);

  return (
    <section className="sklad-writeoff" aria-label="Списание со склада">
      {/* Header */}
      <div className="sklad-writeoff__header">
        <div className="sklad-writeoff__titleWrap">
          <h2 className="sklad-writeoff__title">
            <FaBalanceScale aria-hidden /> Списание
          </h2>
          <div className="sklad-writeoff__subtitle">
            Учет списаний со склада. Демоверсия UI.
          </div>
        </div>

        <div className="sklad-writeoff__actions">
          <div className="sklad-writeoff__search">
            <input
              className="sklad-writeoff__searchInput"
              type="text"
              placeholder="Поиск: дата, причина или комментарий…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              aria-label="Поиск по списаниям"
            />
          </div>

          <button
            className="sklad-writeoff__btn sklad-writeoff__btn--primary"
            type="button"
            onClick={openModal}
          >
            <FaPlus aria-hidden />
            <span className="sklad-writeoff__btnText">Новое списание</span>
          </button>
        </div>
      </div>

      {/* Таблица / карточки */}
      <div className="sklad-writeoff-table" role="table" aria-label="Списания (таблица)">
        <div className="sklad-writeoff-table__head" role="row">
          <div className="sklad-writeoff-table__col" role="columnheader">Дата</div>
          <div className="sklad-writeoff-table__col" role="columnheader">Причина</div>
          <div className="sklad-writeoff-table__col" role="columnheader">Комментарий</div>
        </div>

        {pageItems.map((r, i) => (
          <div key={`${r.date}-${r.reason}-${i}`} className="sklad-writeoff-table__row" role="row">
            <div className="sklad-writeoff-table__col" role="cell">{r.date}</div>
            <div className="sklad-writeoff-table__col" role="cell">{r.reason}</div>
            <div className="sklad-writeoff-table__col" role="cell">{r.note || "—"}</div>
          </div>
        ))}

        {!pageItems.length && (
          <div className="sklad-writeoff-table__empty" role="status">
            Ничего не найдено.
          </div>
        )}
      </div>

      {/* Пагинация */}
      {filtered.length > PAGE && (
        <nav className="sklad-writeoff__pager" aria-label="Постраничная навигация">
          <ul className="sklad-writeoff__pageList">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`sklad-writeoff__pageBtn ${p === safePage ? "is-active" : ""}`}
                    onClick={() => setPage(p)}
                    aria-current={p === safePage ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Модалка */}
      {open && (
        <>
          <button
            className="sklad-writeoff__overlay"
            onClick={closeModal}
            aria-label="Закрыть модальное окно"
          />
          <div
            className="sklad-writeoff__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="writeoff-modal-title"
          >
            <div className="sklad-writeoff__modalHeader">
              <h3 id="writeoff-modal-title" className="sklad-writeoff__modalTitle">
                Списание со склада
              </h3>
              <button
                className="sklad-writeoff__iconBtn"
                type="button"
                aria-label="Закрыть"
                onClick={closeModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className="sklad-writeoff__form">
              {/* Верх формы */}
              <div className="sklad-writeoff__grid">
                <div className="sklad-writeoff__field">
                  <label className="sklad-writeoff__label">Дата <b className="sklad-writeoff__req">*</b></label>
                  <input
                    type="date"
                    className="sklad-writeoff__input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="sklad-writeoff__field">
                  <label className="sklad-writeoff__label">Причина <b className="sklad-writeoff__req">*</b></label>
                  <select
                    className="sklad-writeoff__input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  >
                    {reasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="sklad-writeoff__field sklad-writeoff__field--full">
                  <label className="sklad-writeoff__label">Комментарий</label>
                  <textarea
                    rows={3}
                    className="sklad-writeoff__input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Опционально"
                  />
                </div>
              </div>

              {/* Позиции */}
              <div className="sklad-writeoff-items">
                <div className="sklad-writeoff-items__head">
                  <div className="sklad-writeoff-items__col">Товар</div>
                  <div className="sklad-writeoff-items__col">Кол-во (±)</div>
                </div>

                {rows.map((row, idx) => (
                  <div key={idx} className="sklad-writeoff-items__row">
                    <select
                      className="sklad-writeoff__input"
                      value={row.product}
                      onChange={(e) => updateRow(idx, "product", e.target.value)}
                    >
                      <option value="">— выбрать товар —</option>
                      {products.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <input
                      className="sklad-writeoff__input"
                      type="number"
                      placeholder="например: -2 или 5"
                      value={row.qty}
                      onChange={(e) => updateRow(idx, "qty", e.target.value)}
                    />
                  </div>
                ))}

                <div className="sklad-writeoff-items__footer">
                  <button
                    type="button"
                    className="sklad-writeoff__btn sklad-writeoff__btn--secondary"
                    onClick={addRow}
                  >
                    <FaPlus aria-hidden />
                    <span className="sklad-writeoff__btnText">Добавить позицию</span>
                  </button>
                </div>
              </div>

              {/* Футер */}
              <div className="sklad-writeoff__footer">
                <div className="sklad-writeoff__spacer" />
                <button className="sklad-writeoff__btn" type="button" onClick={closeModal}>
                  Отмена
                </button>
                <button
                  className="sklad-writeoff__btn sklad-writeoff__btn--primary"
                  type="button"
                  disabled={!isValid}
                  title={!isValid ? "Заполните обязательные поля" : "Только UI"}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default WarehouseWriteOffs;
