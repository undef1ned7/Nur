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
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={allOnPageChecked}
          onChange={() => toggleSelectAllOnPage(pageItems)}
        />
        <span>Все на странице</span>
      </label>

      {selectedIds.size > 0 && (
        <>
          <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span>
          <button
            className="sklad__add"
            style={{ background: "#e53935" }}
            onClick={onBulkDelete}
            disabled={bulkDeleting}
            title="Массовое удаление выбранных товаров"
          >
            {bulkDeleting ? "Удаляем..." : "Удалить выбранные"}
          </button>
          <button
            className="sklad__reset"
            onClick={onClearSelection}
            style={{ cursor: "pointer" }}
            title="Снять весь выбор"
          >
            Сбросить выбор
          </button>
        </>
      )}
    </div>
  );
};

export default SelectionActions;
