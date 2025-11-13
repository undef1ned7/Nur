import { MoreVertical } from "lucide-react";

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
  return (
    <div className="table-wrapper">
      <table className="sklad__table">
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
            <th></th>
            <th>№</th>
            <th>Название</th>
            <th>Поставщик</th>
            <th>Цена</th>
            <th>Количество</th>
            <th>Категория</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((item, index) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={isSelected(item.id)}
                  onChange={() => toggleRow(item.id)}
                />
              </td>
              <td>
                <MoreVertical
                  size={16}
                  onClick={() => onEdit(item)}
                  style={{ cursor: "pointer" }}
                />
              </td>
              <td>{index + 1}</td>
              <td>
                <strong>
                  {item.name.length > 30
                    ? `${item.name.slice(0, 30)}...`
                    : item.name}
                </strong>
              </td>
              <td>{item.client_name ? item.client_name : "-"}</td>
              <td>{item.price}</td>
              <td>
                {item.quantity === 0 ? (
                  <span className="sell__badge--danger">Нет в наличии</span>
                ) : (
                  item.quantity
                )}
              </td>
              <td>
                {item.category !== undefined ? (
                  <>
                    {item.category?.length < 30
                      ? item.category
                      : `${item.category?.slice(0, 30)}...`}
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td>
                <button
                  className="btn edit-btn"
                  style={{ marginRight: 10 }}
                  onClick={() => onOpenAddProduct(item)}
                >
                  Добавить
                </button>
                <button
                  className="btn edit-btn"
                  onClick={() => onOpenMarriage(item)}
                >
                  В брак
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SkladTable;
