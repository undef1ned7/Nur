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
  isMarketCompany,
  onShowReceiveModal,
  onShowHistoryModal,
  selectCashBox,
  onSelectCashBox,
  cashBoxes,
  onAdd,
  onSendToScales,
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
            <button className="sklad__add" onClick={onAdd}>
              <Plus size={16} style={{ marginRight: "4px" }} /> Добавить товар
            </button>
            {isMarketCompany && (
              <button className="sklad__add" onClick={onSendToScales}>
                Отправить на весы
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SkladHeader;
