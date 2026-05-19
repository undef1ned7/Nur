import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import BarcodePrintTab from "./components/BarcodePrintTab";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { clearProducts } from "../../../store/slices/productSlice";
import { useDebouncedValue } from "../../../hooks/useDebounce";

const PAGE_SIZE = 100;

/**
 * Отдельная страница для печати штрих-кодов,
 * независимая от общей страницы склада.
 * Товары загружаются постранично (по 100 шт) через API.
 */
const BarcodePrintPage = () => {
  const dispatch = useDispatch();
  const { list: products, loading, count } = useSelector((state) => state.product);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const normalizedSearch = debouncedSearch.trim();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch]);

  // Загрузка товаров с пагинацией
  useEffect(() => {
    dispatch(
      fetchProductsAsync({
        page,
        page_size: PAGE_SIZE,
        search: normalizedSearch || undefined,
      })
    );
  }, [dispatch, page, normalizedSearch]);

  // Очистка списка при выходе со страницы
  useEffect(() => {
    return () => dispatch(clearProducts());
  }, [dispatch]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <div className="barcode-print-page">
      <BarcodePrintTab
        products={products}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        page={page}
        totalPages={totalPages}
        count={count ?? 0}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
};

export default BarcodePrintPage;


