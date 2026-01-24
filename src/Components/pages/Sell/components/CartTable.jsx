import { Minus, Plus, X } from "lucide-react";

const cx = (...args) => args.filter(Boolean).join(" ");

const CartTable = ({
  items,
  selectedId,
  onRowClick,
  itemQuantities,
  onQtyChange,
  onQtyBlur,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveItem,
}) => {
  return (
    <div className="start__body-wrapper">
      <div className="start__body-wrapper">
        <table className="start__body-table">
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={cx(selectedId === item.id && "active")}
                onClick={() => onRowClick(item)}
                style={{ cursor: "pointer" }}
                title="Выбрать позицию"
              >
                <td>{idx + 1}.</td>
                <td>{item.product_name ?? item.display_name}</td>
                <td>{item.unit_price}</td>
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      className="start__table-btn start__table-btn--minus"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDecreaseQty(item);
                      }}
                      title="Уменьшить количество"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={itemQuantities[item.id] ?? item.quantity ?? ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        onQtyChange(item, e.target.value);
                      }}
                      onBlur={(e) => {
                        e.stopPropagation();
                        onQtyBlur(item);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "60px",
                        textAlign: "center",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "14px",
                      }}
                      title="Редактировать количество"
                    />
                    <span style={{ fontSize: "14px", color: "#666" }}>шт</span>
                    <button
                      className="start__table-btn start__table-btn--plus"
                      onClick={(e) => {
                        e.stopPropagation();
                        onIncreaseQty(item);
                      }}
                      title="Увеличить количество"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </td>
                <td className="min-w-18">{(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</td>
                <td>
                  <button
                    className="start__table-btn start__table-btn--delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item);
                    }}
                    title="Удалить товар"
                  >
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CartTable;
