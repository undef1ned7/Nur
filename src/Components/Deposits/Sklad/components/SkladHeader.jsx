import { Plus, Minus } from "lucide-react";

/**
 * Компонент заголовка склада с поиском и кнопками
 */
const SkladHeader = ({
  searchTerm,
  onSearchChange,
  count,
  productsLength,
  isFiltered,
  onResetFilters,
  isBuildingCompany,
  onShowReceiveModal,
  onShowHistoryModal,
  selectCashBox,
  onSelectCashBox,
  cashBoxes,
  onAdd,
}) => {
  return (
    <div className="sklad__header">
      <div className="sklad__left">
        <input
          type="text"
          placeholder="Поиск по названию товара"
          className="sklad__search"
          value={searchTerm}
          onChange={onSearchChange}
        />
        <div className="sklad__center">
          <span>Всего: {count !== null ? count : "-"}</span>
          <span>Найдено: {productsLength}</span>
          {isFiltered && (
            <span
              className="sklad__reset"
              onClick={onResetFilters}
              style={{ cursor: "pointer" }}
            >
              Сбросить
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {isBuildingCompany ? (
          <>
            <button className="sklad__add" onClick={onShowReceiveModal}>
              <Plus size={16} style={{ marginRight: "4px" }} /> Принять товар
            </button>
            <button onClick={onShowHistoryModal} className="sklad__add">
              <Minus size={16} style={{ marginRight: "4px" }} /> Отправить товар
            </button>
          </>
        ) : (
          <>
            <select
              value={selectCashBox}
              onChange={(e) => onSelectCashBox(e.target.value)}
              className="employee__search-wrapper"
            >
              <option value="" disabled>
                Выберите кассу
              </option>
              {cashBoxes?.map((cash) => (
                <option key={cash.id} value={cash.id}>
                  {cash.name ?? cash.department_name}
                </option>
              ))}
            </select>

            <button
              className="sklad__add"
              onClick={onAdd}
              disabled={!selectCashBox}
              title={!selectCashBox ? "Сначала выберите кассу" : undefined}
            >
              <Plus size={16} style={{ marginRight: "4px" }} /> Добавить товар
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SkladHeader;
