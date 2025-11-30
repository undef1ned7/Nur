export const DebtsHeader = ({
  q,
  setQ,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onAddClick,
}) => {
  return (
    <div className="catalog__controls">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          className="catalog__search"
          placeholder="Поиск по имени/телефону…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Поиск"
        />
        <input
          type="date"
          className="catalog__search"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Дата от (по дате создания)"
        />
        <input
          type="date"
          className="catalog__search"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Дата до (по дате создания)"
        />
      </div>

      <button
        className="catalog__btn catalog__btn--primary"
        onClick={onAddClick}
      >
        + Добавить долг
      </button>
    </div>
  );
};
