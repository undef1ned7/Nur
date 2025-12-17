import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import BarcodePrintTab from "./components/BarcodePrintTab";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { clearProducts } from "../../../store/slices/productSlice";

/**
 * Отдельная страница для печати штрих-кодов,
 * независимая от общей страницы склада.
 */
const BarcodePrintPage = () => {
  const dispatch = useDispatch();
  const { list: products, loading } = useSelector((state) => state.product);
  const [searchTerm, setSearchTerm] = useState("");

  // Загружаем товары один раз при монтировании
  useEffect(() => {
    dispatch(fetchProductsAsync({}));

    return () => {
      // очищаем список при выходе со страницы
      dispatch(clearProducts());
    };
  }, [dispatch]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="barcode-print-page">
      <BarcodePrintTab
        products={products}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
      />
    </div>
  );
};

export default BarcodePrintPage;


