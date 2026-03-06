import { Minus, Plus, X } from "lucide-react";
import "../sell.scss";
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
  const formatMoney = (v) => {
    const n = Number(String(v ?? "").trim().replace(/,/g, "."));
    if (!Number.isFinite(n)) return String(v ?? "0");
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const toNum = (v) => {
    const n = Number(String(v ?? "").trim().replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  };

  const getThumb = (item) => {
    return (
      item?.primary_image_url ||
      item?.image_url ||
      item?.product_image_url ||
      item?.product?.primary_image_url ||
      item?.product?.image_url ||
      "/images/placeholder.avif"
    );
  };

  if (!Array.isArray(items) || items.length === 0) {
    return <div className="cartEmpty">Корзина пуста</div>;
  }

  return (
    <div className="cartList">
      {items.map((item, idx) => {
        const title = item?.product_name ?? item?.display_name ?? item?.name ?? "—";
        const unit = item?.unit ?? item?.unit_name ?? "шт";
        const priceNum = toNum(item?.unit_price ?? item?.price ?? 0);
        const qtyRaw = itemQuantities?.[item.id] ?? item?.quantity ?? "";
        const qtyNum = toNum(qtyRaw);
        const sum = priceNum * qtyNum;
        const thumb = getThumb(item);

        return (
          <div
            key={item.id}
            className={cx("cartItem", selectedId === item.id && "active")}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRowClick(item);
            }}
            title="Выбрать позицию"
          >
            <div className="cartItem__media">
              <img
                src={thumb}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = "/images/placeholder.avif";
                }}
              />
            </div>

            <div className="cartItem__main">
              <div className="cartItem__head">
                <div className="cartItem__title">
                  <span className="cartItem__index">#{idx + 1}</span>
                  {title}
                </div>
                <button
                  type="button"
                  className="cartItem__remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item);
                  }}
                  aria-label="Удалить"
                  title="Удалить"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="cartItem__meta">
                <span className="cartItem__price">
                  {formatMoney(priceNum)} сом / {unit}
                </span>
                <span className="cartItem__sum">
                  {formatMoney(sum)} сом
                </span>
              </div>

              <div
                className="cartItem__controls"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="cartQty">
                  <button
                    type="button"
                    className="cartQty__btn cartQty__btn--minus"
                    onClick={() => onDecreaseQty(item)}
                    title="Уменьшить"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    className="cartQty__input"
                    type="number"
                    min="0"
                    value={qtyRaw}
                    onChange={(e) => onQtyChange(item, e.target.value)}
                    onBlur={() => onQtyBlur(item)}
                    title="Количество"
                  />
                  <button
                    type="button"
                    className="cartQty__btn cartQty__btn--plus"
                    onClick={() => onIncreaseQty(item)}
                    title="Увеличить"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CartTable;
