import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { productSearchHaystackLower } from "../../../../../../tools/productBarcode";
import "./HotkeyProductsModal.scss";

const HOTKEY_GROUPS = Array.from({ length: 12 }, (_, index) => `F${index + 1}`);

const formatPrice = (price) => {
  const num = parseFloat(price);
  if (Number.isNaN(num)) return "0";
  if (num % 1 === 0) return String(num);
  return String(num).replace(/\.?0+$/, "");
};

const formatQuantity = (qty) => {
  const num = parseFloat(qty);
  if (Number.isNaN(num)) return "0";
  if (num % 1 === 0) return String(num);
  return String(num).replace(/\.?0+$/, "");
};

const getDefaultPiecePackage = (product) => {
  const packages = Array.isArray(product?.packages) ? product.packages : [];
  return packages.find((pkg) => Number(pkg?.quantity_in_package) > 0) || null;
};

const HotkeyProductsModal = ({
  hotkeyGroup,
  products = [],
  loading = false,
  error = "",
  onClose,
  onSelectGroup,
  onAddProduct,
  onAddProductPiece,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    setSearchTerm("");
  }, [hotkeyGroup]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [hotkeyGroup]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const filteredProducts = useMemo(() => {
    const query = String(searchTerm || "").trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const haystack = productSearchHaystackLower(product);
      return haystack.includes(query);
    });
  }, [products, searchTerm]);

  return (
    <div className="hotkey-products-modal-overlay" onClick={onClose}>
      <div
        className="hotkey-products-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="hotkey-products-modal__header">
          <div className="hotkey-products-modal__title-wrap">
            <h2 className="hotkey-products-modal__title">
              Горячая группа {hotkeyGroup}
            </h2>
            <p className="hotkey-products-modal__subtitle">
              Отдельный список товаров по клавише {hotkeyGroup}
            </p>
          </div>
          <button
            type="button"
            className="hotkey-products-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        <div className="hotkey-products-modal__groups" role="tablist">
          {HOTKEY_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              className={`hotkey-products-modal__group-btn ${
                hotkeyGroup === group
                  ? "hotkey-products-modal__group-btn--active"
                  : ""
              }`}
              onClick={() => onSelectGroup?.(group)}
              aria-pressed={hotkeyGroup === group}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="hotkey-products-modal__search">
          <Search size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Поиск внутри ${hotkeyGroup}`}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="hotkey-products-modal__search-input"
          />
        </div>

        <div className="hotkey-products-modal__summary">
          Найдено {filteredProducts.length}
        </div>

        <div className="hotkey-products-modal__body">
          {loading ? (
            <div className="hotkey-products-modal__empty">Загрузка товаров...</div>
          ) : error ? (
            <div className="hotkey-products-modal__empty">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="hotkey-products-modal__empty">
              {searchTerm
                ? "Товары по запросу не найдены"
                : `Для ${hotkeyGroup} товаров нет`}
            </div>
          ) : (
            <div className="hotkey-products-modal__grid">
              {filteredProducts.map((product) => {
                const piecePackage = getDefaultPiecePackage(product);

                return (
                  <div
                    key={product.id}
                    className={`hotkey-products-modal__card ${
                      product.isCart
                        ? "hotkey-products-modal__card--selected"
                        : ""
                    }`}
                    onClick={() => onAddProduct?.(product)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onAddProduct?.(product);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {product.isCart ? (
                      <div className="hotkey-products-modal__badge">
                        {formatQuantity(product.cartQty || 0)}
                      </div>
                    ) : null}

                    <div className="hotkey-products-modal__card-name">
                      {product.name || "—"}
                    </div>

                    <div className="hotkey-products-modal__card-price">
                      {formatPrice(product.price || 0)} сом
                    </div>

                    <div className="hotkey-products-modal__card-stock">
                      {formatQuantity(product.quantity || 0)} {product.unit || "шт"}
                    </div>

                    {piecePackage ? (
                      <div className="hotkey-products-modal__card-actions">
                        <button
                          type="button"
                          className="hotkey-products-modal__piece-btn"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onAddProductPiece?.(product, piecePackage.id);
                          }}
                        >
                          +1 шт из упаковки
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hotkey-products-modal__footer">
          <button
            type="button"
            className="hotkey-products-modal__footer-close"
            onClick={onClose}
          >
            Закрыть [Esc]
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyProductsModal;
