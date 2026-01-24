import { Search } from "lucide-react";
import { useDispatch } from "react-redux";
import { useDebounce } from "../../../../hooks/useDebounce";
import {
  doSearch,
  manualFilling,
  startSale,
} from "../../../../store/creators/saleThunk";
import {
  getAvailableQtyForProduct,
  getCartQtyForProduct,
} from "../utils/productUtils";

const ProductSearch = ({
  searchQuery,
  setSearchQuery,
  showDropdown,
  setShowDropdown,
  foundProduct,
  start,
  products,
  setAlert,
  dispatch,
}) => {
  const debouncedSearch = useDebounce((v) => {
    dispatch(doSearch({ search: v }));
  }, 600);

  const onChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
    setShowDropdown(value.length > 0);
  };

  const handleSelectProduct = async (product) => {
    const available = getAvailableQtyForProduct(product, products);
    const pid = product.id || product.product;
    const inCart = getCartQtyForProduct(pid, start?.items);
    if (available <= 0 || inCart >= available) {
      setAlert({
        open: true,
        type: "error",
        message:
          available > 0
            ? `Нельзя добавить больше, чем есть на складе (доступно: ${available})`
            : "Товара нет в наличии",
      });
      return;
    }
    if (!start?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина не инициализирована. Пожалуйста, подождите...",
      });
      return;
    }
    try {
      await dispatch(
        manualFilling({
          id: start.id,
          productId: product.id || product.product,
        })
      ).unwrap();
      dispatch(startSale());
      setSearchQuery("");
      setShowDropdown(false);
    } catch (error) {
      console.error("Ошибка при добавлении товара:", error);
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при добавлении товара",
      });
    }
  };

  return (
    <div className="sell__header-input flex-1" style={{ position: "relative" }}>
      <input
        onChange={onChange}
        onFocus={() => searchQuery.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        value={searchQuery}
        type="text"
        className="w-full!"
        placeholder="Введите название товара"
      />
      <span>
        <Search size={15} color="#91929E" />
      </span>
      {showDropdown && foundProduct && foundProduct.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 1000,
            maxHeight: "300px",
            overflowY: "auto",
            marginTop: "4px",
          }}
        >
          {foundProduct.map((product) => (
            <div
              key={product.id || product.product}
              onClick={() => handleSelectProduct(product)}
              style={{
                padding: "10px 15px",
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f5f5f5")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "white")
              }
            >
              <div style={{ fontWeight: "500" }}>
                {product.product_name || product.name} {product.quantity} шт
              </div>
              {product.unit_price && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginTop: "4px",
                  }}
                >
                  Цена: {product.unit_price}
                  {product.qty_on_hand !== undefined && (
                    <span style={{ marginLeft: "10px" }}>
                      Остаток: {product.qty_on_hand}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showDropdown &&
        searchQuery.length > 0 &&
        (!foundProduct ||
          (Array.isArray(foundProduct) && foundProduct.length === 0)) && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              zIndex: 1000,
              padding: "15px",
              textAlign: "center",
              color: "#666",
              marginTop: "4px",
            }}
          >
            Нет такого товара
          </div>
        )}
    </div>
  );
};

export default ProductSearch;
