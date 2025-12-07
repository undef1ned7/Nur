import { CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Компонент таблицы товаров
 */
const SkladTable = ({
  products,
  onEdit,
  onOpenMarriage,
  onOpenAddProduct,
  isSelected,
  toggleRow,
  toggleSelectAllOnPage,
}) => {
  // Определяем статус товара
  const getProductStatus = (item) => {
    if (item.quantity === 0) {
      return { text: "Нет в наличии", color: "#ff5a5a", icon: "error" };
    } else if (item.quantity < 20) {
      return { text: "Заканчивается", color: "#ff9500", icon: "warning" };
    } else {
      return { text: "В наличии", color: "#00aa88", icon: "success" };
    }
  };

  return (
    <div className="sklad-new__table-wrapper">
      <table className="sklad-new__table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={
                  products.length > 0 && products.every((i) => isSelected(i.id))
                }
                onChange={() => toggleSelectAllOnPage(products)}
              />
            </th>
            <th>№</th>
            <th>Название</th>
            <th>Поставщик</th>
            <th>Цена</th>
            <th>Количество</th>
            <th>Категория</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item, index) => {
            const status = getProductStatus(item);
            return (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected(item.id)}
                    onChange={() => toggleRow(item.id)}
                  />
                </td>
                <td>{index + 1}</td>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.client_name ? item.client_name : "-"}</td>
                <td>
                  {item.price ? parseFloat(item.price).toFixed(2) : "0.00"}
                </td>
                <td
                  className={
                    item.quantity < 20 && item.quantity > 0
                      ? "sklad-new__quantity--low"
                      : ""
                  }
                >
                  {item.quantity}
                </td>
                <td>
                  {item.category !== undefined && item.category
                    ? item.category.length > 30
                      ? `${item.category.slice(0, 30)}...`
                      : item.category
                    : "-"}
                </td>
                <td>
                  <div
                    className="sklad-new__status"
                    style={{ color: status.color }}
                  >
                    {status.icon === "success" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{status.text}</span>
                  </div>
                </td>
                <td>
                  <div className="sklad-new__actions-cell">
                    <button
                      className="sklad-new__action-btn sklad-new__action-btn--primary"
                      onClick={() => onOpenAddProduct(item)}
                    >
                      Добавить
                    </button>
                    <button
                      className="sklad-new__action-btn sklad-new__action-btn--secondary"
                      onClick={() => onOpenMarriage(item)}
                    >
                      Брак
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SkladTable;
