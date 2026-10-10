import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import BarcodePrintTab from "./components/BarcodePrintTab";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { clearProducts } from "../../../store/slices/productSlice";
import { useUser } from "../../../store/slices/userSlice";
import { useDebouncedValue } from "../../../hooks/useDebounce";
import { listCompanyProducts } from "../../../api/warehouse";
import { isWarehouseSectorName } from "../../../utils/warehouseSector";

const PAGE_SIZE = 100;

/**
 * Товары сектора «Склад» (GET warehouse/products/) — QA B37.
 * Раньше экран для склада брал товары модуля магазина (main/products/).
 */
const useWarehouseProducts = ({ enabled, page, search }) => {
  // key — параметры запроса, для которых получен ответ; пока ключ не совпал
  // с текущим, считаем, что идёт загрузка (без setState внутри эффекта).
  const requestKey = `${page}|${search}`;
  const [state, setState] = useState({ key: null, list: [], count: 0 });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    listCompanyProducts({
      page,
      page_size: PAGE_SIZE,
      search: search || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setState({
          key: `${page}|${search}`,
          list,
          count: Number(data?.count ?? list.length) || 0,
        });
      })
      .catch((err) => {
        console.error("Ошибка загрузки товаров склада:", err);
        if (!cancelled) {
          setState({ key: `${page}|${search}`, list: [], count: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, page, search]);

  return {
    list: state.list,
    count: state.count,
    loading: enabled && state.key !== requestKey,
  };
};

/**
 * Отдельная страница для печати штрих-кодов,
 * независимая от общей страницы склада.
 * Товары загружаются постранично (по 100 шт) через API.
 */
const BarcodePrintPage = () => {
  const dispatch = useDispatch();
  const { sector, company } = useUser();
  const isWarehouse = isWarehouseSectorName(sector || company?.sector?.name);
  const {
    list: marketProducts,
    loading: marketLoading,
    count: marketCount,
  } = useSelector((state) => state.product);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const normalizedSearch = debouncedSearch.trim();
  const [page, setPage] = useState(1);

  const warehouseProducts = useWarehouseProducts({
    enabled: isWarehouse,
    page,
    search: normalizedSearch,
  });

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch]);

  // Загрузка товаров магазина с пагинацией (не для сектора «Склад»)
  useEffect(() => {
    if (isWarehouse) return;
    dispatch(
      fetchProductsAsync({
        page,
        page_size: PAGE_SIZE,
        search: normalizedSearch || undefined,
      })
    );
  }, [dispatch, page, normalizedSearch, isWarehouse]);

  // Очистка списка при выходе со страницы
  useEffect(() => {
    return () => dispatch(clearProducts());
  }, [dispatch]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const products = isWarehouse ? warehouseProducts.list : marketProducts;
  const loading = isWarehouse ? warehouseProducts.loading : marketLoading;
  const count = isWarehouse ? warehouseProducts.count : marketCount;

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
