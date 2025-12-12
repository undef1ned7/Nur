import "./SelectionActions.scss";

/**
 * Компонент для управления массовым выбором товаров
 */
const SelectionActions = ({
  pageItems,
  selectedIds,
  toggleSelectAllOnPage,
  onBulkDelete,
  onClearSelection,
  bulkDeleting,
}) => {
  const allOnPageChecked =
    pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));

  return (
    <div className="selection-actions">
      <label className="selection-actions__checkbox-label">
        <input
          type="checkbox"
          checked={allOnPageChecked}
          onChange={() => toggleSelectAllOnPage(pageItems)}
        />
        <span>Все на странице</span>
      </label>

      {selectedIds.size > 0 && (
        <>
          <span className="selection-actions__count">
            Выбрано: {selectedIds.size}
          </span>
          <div className="selection-actions__actions">
            <button
              className="selection-actions__delete-btn"
              onClick={onBulkDelete}
              disabled={bulkDeleting}
              title="Массовое удаление выбранных товаров"
            >
              {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
            </button>
            <button
              className="selection-actions__clear-btn"
              onClick={onClearSelection}
              title="Снять весь выбор"
            >
              Сбросить выбор
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SelectionActions;
