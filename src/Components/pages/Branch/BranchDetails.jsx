import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  FaArrowLeft,
  FaBuilding,
  FaCashRegister,
  FaWarehouse,
  FaShoppingCart,
  FaChartLine,
  FaUsers,
  FaUserFriends,
  FaSpinner,
  FaCalendarAlt,
  FaTags,
  FaClipboardList,
  FaBed,
  FaBook,
  FaCheckSquare,
  FaCut,
  FaUserTie,
  FaCogs,
  FaMoneyBill,
  FaBoxOpen,
  FaExchangeAlt,
  FaTruckLoading,
  FaTrashAlt,
  FaComments,
} from "react-icons/fa";
import { BsListCheck } from "react-icons/bs";
import { getCashFlows, useCash } from "../../../store/slices/cashSlice";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { useProducts } from "../../../store/slices/productSlice";
import { historySellProduct } from "../../../store/creators/saleThunk";
import { fetchEmployeesAsync } from "../../../store/creators/employeeCreators";
import {
  // fetchClientsAsync,
  useClient,
} from "../../../store/slices/ClientSlice";
import { fetchBranchesAsync } from "../../../store/creators/branchCreators";
import { useUser } from "../../../store/slices/userSlice";
import { MENU_CONFIG } from "../../Sidebar/config/menuConfig";
import {
  BASE_TABS,
  applyBranchTabsRules,
  applySectorTabsRules,
} from "./branchTabsConfig";
import api from "../../../api";
import "./BranchDetails.scss";
import { fetchClientsAsync } from "../../../store/creators/clientCreators";

const BranchDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("kassa");

  // Redux состояния
  const { list: branches, loading: branchesLoading } = useSelector(
    (state) => state.branches
  );
  const { cashFlows, loading: cashLoading } = useCash();
  const { list: products, loading: productsLoading } = useProducts();
  const { history: salesHistory } = useSelector((state) => state.sale);
  const { list: employees, loading: employeesLoading } = useSelector(
    (state) => state.employee
  );
  const { list: clients, loading: clientsLoading } = useClient();
  const { company, sector, tariff } = useUser();

  // Локальные данные (для аналитики - загружаются отдельно)
  const [kassaData, setKassaData] = useState([]);
  const [warehouseData, setWarehouseData] = useState([]);
  const [salesData, setSalesData] = useState([]);

  // Данные для секторных табов
  const [sectorData, setSectorData] = useState({});
  const [sectorLoading, setSectorLoading] = useState({});

  // Фильтрованные данные из Redux для отображения
  const filteredCashFlows = useMemo(() => {
    if (!cashFlows || !Array.isArray(cashFlows)) return [];
    return cashFlows.filter((item) => item.branch === id);
  }, [cashFlows, id]);

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    return products.filter((item) => item.branch === id);
  }, [products, id]);

  const filteredSales = useMemo(() => {
    const sales = salesData.length > 0 ? salesData : salesHistory || [];
    if (!Array.isArray(sales)) return [];

    // Если данные загружены с параметром branch, они уже отфильтрованы на бэкенде
    // Проверяем, есть ли поле branch в данных
    const hasBranchField =
      sales.length > 0 &&
      sales.some(
        (item) =>
          item.branch !== undefined ||
          item.branch_id !== undefined ||
          item.branch_uuid !== undefined
      );

    // Если поле branch отсутствует во всех элементах, значит данные уже отфильтрованы на бэкенде
    if (!hasBranchField) {
      return sales; // Возвращаем все данные, так как они уже отфильтрованы
    }

    // Если поле branch есть, фильтруем по нему
    return sales.filter((item) => {
      if (!id) return true;
      const itemBranch = item.branch || item.branch_id || item.branch_uuid;
      if (itemBranch === undefined || itemBranch === null) return false;
      return String(itemBranch) === String(id);
    });
  }, [salesData, salesHistory, id]);

  const filteredEmployees = useMemo(() => {
    if (!employees || !Array.isArray(employees)) return [];
    return employees.filter((item) => {
      const itemBranches = Array.isArray(item.branches)
        ? item.branches
        : item.branch
        ? [item.branch]
        : [];
      return itemBranches.includes(id);
    });
  }, [employees, id]);

  const filteredClients = useMemo(() => {
    if (!clients || !Array.isArray(clients)) return [];
    return clients.filter((item) => !id || item.branch === id);
  }, [clients, id]);

  const branch = branches.find((b) => b.id === id);
  const loading = branchesLoading;
  const error = branch ? "" : "Филиал не найден";

  // Получение сферы компании
  const currentSector = sector || company?.sector?.name;

  // Преобразование названия сферы в ключ конфигурации
  const getSectorKey = (sectorName) => {
    if (!sectorName) return null;
    const sectorKey = sectorName.toLowerCase().replace(/\s+/g, "_");
    const sectorMapping = {
      строительная_компания: "building",
      ремонтные_и_отделочные_работы: "building",
      архитектура_и_дизайн: "building",
      барбершоп: "barber",
      гостиница: "hostel",
      школа: "school",
      магазин: "market",
      кафе: "cafe",
      цветочный_магазин: "market",
      производство: "production",
      консалтинг: "consulting",
      склад: "warehouse",
      пилорама: "pilorama",
    };
    return sectorMapping[sectorKey] || sectorKey;
  };

  // Маппинг иконок для секторных табов
  const getSectorTabIcon = (iconName) => {
    const iconMap = {
      listCheck: BsListCheck,
      building: FaBuilding,
      tags: FaTags,
      filePerson: FaUserFriends,
      calendar: FaCalendarAlt,
      clipboard: FaClipboardList,
      chartBar: FaChartLine,
      user: FaUsers,
      comments: FaComments,
      cashRegister: FaCashRegister,
      chalkboard: FaUsers,
      moneyBill: FaMoneyBill,
      shoppingCart: FaShoppingCart,
      cogs: FaCogs,
      boxOpen: FaBoxOpen,
      chartLine: FaChartLine,
      exchangeAlt: FaExchangeAlt,
      truckLoading: FaTruckLoading,
      trashAlt: FaTrashAlt,
      layers: FaBuilding,
      warehouse: FaWarehouse,
      // Барбершоп
      cut: FaCut,
      userTie: FaUserTie,
      // Гостиница
      bed: FaBed,
      // Школа
      book: FaBook,
      checkSquare: FaCheckSquare,
    };
    return iconMap[iconName] || FaBuilding;
  };

  // Маппинг маршрутов на иконки
  const getIconByRoute = (route, label) => {
    const routeLower = route.toLowerCase();
    const labelLower = label.toLowerCase();

    // Маппинг на основе маршрута
    if (routeLower.includes("work") || routeLower.includes("process"))
      return "listCheck";
    if (routeLower.includes("objects") || routeLower.includes("apartments"))
      return "building";
    if (routeLower.includes("services") || routeLower.includes("услуги"))
      return "tags";
    if (routeLower.includes("clients") || routeLower.includes("клиенты"))
      return "filePerson";
    if (
      routeLower.includes("calendar") ||
      routeLower.includes("records") ||
      routeLower.includes("bookings") ||
      routeLower.includes("reservations")
    )
      return "calendar";
    if (routeLower.includes("history") || routeLower.includes("clipboard"))
      return "clipboard";
    if (
      routeLower.includes("analytics") ||
      routeLower.includes("reports") ||
      routeLower.includes("cash-reports")
    )
      return "chartBar";
    if (
      routeLower.includes("masters") ||
      routeLower.includes("teachers") ||
      routeLower.includes("employees")
    )
      return "user";
    if (routeLower.includes("comments") || routeLower.includes("leads"))
      return "comments";
    if (routeLower.includes("kassa") || routeLower.includes("cash"))
      return "cashRegister";
    if (routeLower.includes("salary") || routeLower.includes("payroll"))
      return "moneyBill";
    if (routeLower.includes("sale") || routeLower.includes("orders"))
      return "shoppingCart";
    if (routeLower.includes("services") && routeLower.includes("consulting"))
      return "cogs";
    if (routeLower.includes("products") || routeLower.includes("stocks"))
      return "boxOpen";
    if (routeLower.includes("movements") || routeLower.includes("operations"))
      return "exchangeAlt";
    if (routeLower.includes("supply") || routeLower.includes("purchasing"))
      return "truckLoading";
    if (routeLower.includes("write") || routeLower.includes("write_offs"))
      return "trashAlt";
    if (routeLower.includes("catalog") || routeLower.includes("directories"))
      return "layers";
    if (
      routeLower.includes("warehouse") ||
      routeLower.includes("stock") ||
      routeLower.includes("sklad")
    )
      return "warehouse";
    if (routeLower.includes("rooms")) return "bed";
    if (routeLower.includes("students") || routeLower.includes("groups"))
      return "filePerson";
    if (routeLower.includes("lessons")) return "book";
    if (routeLower.includes("attendance")) return "checkSquare";
    if (routeLower.includes("cut") || routeLower.includes("barber/services"))
      return "cut";
    if (routeLower.includes("masters") && routeLower.includes("barber"))
      return "userTie";
    if (routeLower.includes("tables")) return "building";
    if (routeLower.includes("menu")) return "tags";
    if (routeLower.includes("cook")) return "building";
    if (routeLower.includes("inventory")) return "clipboard";
    if (routeLower.includes("agents")) return "filePerson";

    // Маппинг на основе метки
    if (labelLower.includes("процесс") || labelLower.includes("работа"))
      return "listCheck";
    if (labelLower.includes("квартир")) return "building";
    if (labelLower.includes("услуг")) return "tags";
    if (labelLower.includes("клиент")) return "filePerson";
    if (labelLower.includes("запис") || labelLower.includes("бронь"))
      return "calendar";
    if (labelLower.includes("истори")) return "clipboard";
    if (labelLower.includes("аналитик") || labelLower.includes("отчет"))
      return "chartBar";
    if (
      labelLower.includes("мастер") ||
      labelLower.includes("сотрудник") ||
      labelLower.includes("учител")
    )
      return "user";
    if (labelLower.includes("заявк") || labelLower.includes("запрос"))
      return "comments";
    if (labelLower.includes("касс")) return "cashRegister";
    if (labelLower.includes("зарплат")) return "moneyBill";
    if (labelLower.includes("продаж") || labelLower.includes("заказ"))
      return "shoppingCart";
    if (labelLower.includes("товар") || labelLower.includes("остатк"))
      return "boxOpen";
    if (labelLower.includes("перемещен") || labelLower.includes("операци"))
      return "exchangeAlt";
    if (labelLower.includes("поставк") || labelLower.includes("закупк"))
      return "truckLoading";
    if (labelLower.includes("списан")) return "trashAlt";
    if (labelLower.includes("каталог") || labelLower.includes("справочник"))
      return "layers";
    if (labelLower.includes("склад")) return "warehouse";
    if (labelLower.includes("комнат")) return "bed";
    if (labelLower.includes("ученик") || labelLower.includes("групп"))
      return "filePerson";
    if (labelLower.includes("урок")) return "book";
    if (labelLower.includes("посещаемост")) return "checkSquare";
    if (labelLower.includes("стол")) return "building";
    if (labelLower.includes("меню")) return "tags";
    if (labelLower.includes("кухн")) return "building";
    if (labelLower.includes("инвентаризац")) return "clipboard";
    if (labelLower.includes("агент")) return "filePerson";

    return "building";
  };

  // Получение секторных табов
  const sectorTabs = useMemo(() => {
    if (!currentSector) return [];
    const sectorKey = getSectorKey(currentSector);
    if (!sectorKey) return [];
    const sectorConfig = MENU_CONFIG.sector[sectorKey] || [];
    return sectorConfig.map((item) => {
      const iconName = getIconByRoute(item.to, item.label);
      return {
        id: item.to.replace("/crm/", "").replace(/\//g, "-"),
        label: item.label,
        icon: getSectorTabIcon(iconName),
        route: item.to,
      };
    });
  }, [currentSector]);

  // Загрузка данных филиала
  useEffect(() => {
    if (id && !branches.length) {
      dispatch(fetchBranchesAsync());
    }
  }, [id, branches.length, dispatch]);

  // Загрузка данных кассы
  const fetchKassa = async () => {
    try {
      const result = await dispatch(getCashFlows({ branch: id }));
      if (getCashFlows.fulfilled.match(result)) {
        setKassaData(Array.isArray(result.payload) ? result.payload : []);
      }
    } catch (err) {
      console.error("Ошибка загрузки кассы:", err);
    }
  };

  // Загрузка данных склада
  const fetchWarehouse = async () => {
    try {
      const result = await dispatch(
        fetchProductsAsync({ branch: id })
      ).unwrap();
      if (fetchProductsAsync.fulfilled.match(result)) {
        const data = result.payload?.results || result.payload || [];
        setWarehouseData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Ошибка загрузки склада:", err);
    }
  };

  // Загрузка данных продаж
  const fetchSales = async () => {
    try {
      const result = await dispatch(historySellProduct({ branch: id }));
      if (historySellProduct.fulfilled.match(result)) {
        // historySellProduct возвращает data.results из saleThunk.js
        const payload = result.payload;
        if (Array.isArray(payload)) {
          setSalesData(payload);
        } else if (payload?.results && Array.isArray(payload.results)) {
          // На случай, если структура ответа изменилась
          setSalesData(payload.results);
        } else {
          setSalesData([]);
        }
      } else if (historySellProduct.rejected.match(result)) {
        console.error("Ошибка загрузки продаж:", result.payload);
        setSalesData([]);
      }
    } catch (err) {
      console.error("Ошибка загрузки продаж:", err);
      setSalesData([]);
    }
  };

  // Фильтры по дате для аналитики
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Загрузка всех данных для аналитики
  const fetchAnalytics = async () => {
    try {
      // Загружаем данные из всех трех источников
      const [kassaResult, salesResult, warehouseResult] = await Promise.all([
        dispatch(getCashFlows({ branch: id })).catch(() => ({ payload: [] })),
        dispatch(historySellProduct({ branch: id })).catch(() => ({
          payload: [],
        })),
        dispatch(fetchProductsAsync({ branch: id })).catch(() => ({
          payload: [],
        })),
      ]);

      if (getCashFlows.fulfilled.match(kassaResult)) {
        const kassaRaw = kassaResult.payload || [];
        setKassaData(Array.isArray(kassaRaw) ? kassaRaw : []);
      }

      if (historySellProduct.fulfilled.match(salesResult)) {
        const salesRaw = salesResult.payload || [];
        setSalesData(Array.isArray(salesRaw) ? salesRaw : []);
      }

      if (fetchProductsAsync.fulfilled.match(warehouseResult)) {
        const warehouseRaw =
          warehouseResult.payload?.results || warehouseResult.payload || [];
        setWarehouseData(Array.isArray(warehouseRaw) ? warehouseRaw : []);
      }
    } catch (err) {
      console.error("Ошибка загрузки аналитики:", err);
    }
  };

  // Загрузка сотрудников
  const fetchEmployees = async () => {
    try {
      await dispatch(fetchEmployeesAsync({ branch: id }));
    } catch (err) {
      console.error("Ошибка загрузки сотрудников:", err);
    }
  };

  // Загрузка клиентов
  const fetchClients = async () => {
    try {
      await dispatch(fetchClientsAsync({ branch: id }));
    } catch (err) {
      console.error("Ошибка загрузки клиентов:", err);
    }
  };

  // Фильтрация данных по дате
  const filterByDate = (data, dateField = "created_at") => {
    if (!dateFrom && !dateTo) return data;

    return data.filter((item) => {
      if (!item[dateField]) return false;
      const itemDate = new Date(item[dateField]);

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }

      return true;
    });
  };

  // Вычисление аналитики
  const analyticsData = useMemo(() => {
    const filteredKassa = filterByDate(kassaData);
    const filteredSales = filterByDate(salesData);
    const filteredWarehouse = filterByDate(warehouseData);

    // Аналитика кассы
    const kassaIncome = filteredKassa
      .filter((item) => item.type === "income" || item.amount > 0)
      .reduce((sum, item) => sum + (Math.abs(Number(item.amount)) || 0), 0);

    const kassaExpense = filteredKassa
      .filter((item) => item.type === "expense" || item.amount < 0)
      .reduce((sum, item) => sum + (Math.abs(Number(item.amount)) || 0), 0);

    const kassaBalance = kassaIncome - kassaExpense;
    const kassaOperationsCount = filteredKassa.length;

    // Аналитика продаж
    const salesTotal = filteredSales.reduce(
      (sum, item) => sum + Number(item.total || item.amount || 0),
      0
    );
    const salesCount = filteredSales.length;
    const salesAverage = salesCount > 0 ? salesTotal / salesCount : 0;

    // Продажи по статусам
    const salesByStatus = filteredSales.reduce((acc, item) => {
      const status = item.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Аналитика склада
    const warehouseTotalValue = filteredWarehouse.reduce((sum, item) => {
      const quantity = Number(item.quantity || item.remainder || 0);
      const price = Number(item.price || 0);
      return sum + quantity * price;
    }, 0);
    const warehouseTotalQuantity = filteredWarehouse.reduce(
      (sum, item) => sum + Number(item.quantity || item.remainder || 0),
      0
    );
    const warehouseItemsCount = filteredWarehouse.length;
    const warehouseAveragePrice =
      warehouseItemsCount > 0
        ? filteredWarehouse.reduce(
            (sum, item) => sum + Number(item.price || 0),
            0
          ) / warehouseItemsCount
        : 0;

    return {
      // Касса
      kassa: {
        income: kassaIncome,
        expense: kassaExpense,
        balance: kassaBalance,
        operationsCount: kassaOperationsCount,
      },
      // Продажи
      sales: {
        total: salesTotal,
        count: salesCount,
        average: salesAverage,
        byStatus: salesByStatus,
      },
      // Склад
      warehouse: {
        totalValue: warehouseTotalValue,
        totalQuantity: warehouseTotalQuantity,
        itemsCount: warehouseItemsCount,
        averagePrice: warehouseAveragePrice,
      },
    };
  }, [kassaData, salesData, warehouseData, dateFrom, dateTo]);

  // Вспомогательная функция для получения всех страниц
  const fetchAllPages = async (url, params = {}) => {
    const acc = [];
    let next = url;
    while (next) {
      try {
        const { data } = await api.get(next, {
          params: next === url ? params : {},
        });
        const results = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
          ? data
          : [];
        acc.push(...results);
        next = data?.next;
      } catch (err) {
        console.error(`Ошибка загрузки ${url}:`, err);
        break;
      }
    }
    return acc;
  };

  // Функция для фильтрации данных по филиалу
  const filterByBranch = (data, branchField = "branch") => {
    if (!id || !Array.isArray(data)) return data;
    return data.filter((item) => {
      const itemBranch = item[branchField] || item.branch_id || item.branch;
      return String(itemBranch) === String(id);
    });
  };

  // Загрузка данных для секторных табов
  const fetchSectorTabData = async (tabId, route) => {
    if (!id) return;

    setSectorLoading((prev) => ({ ...prev, [tabId]: true }));
    try {
      let data = [];
      const routeLower = route.toLowerCase();

      // Барбершоп
      if (routeLower.includes("barber/clients")) {
        data = await fetchAllPages("/barbershop/clients/", { branch: id });
      } else if (routeLower.includes("barber/services")) {
        data = await fetchAllPages("/barbershop/services/", { branch: id });
      } else if (
        routeLower.includes("barber/records") ||
        routeLower.includes("barber/appointments")
      ) {
        data = await fetchAllPages("/barbershop/appointments/", { branch: id });
      } else if (routeLower.includes("barber/history")) {
        data = await fetchAllPages("/barbershop/appointments/", { branch: id });
      } else if (routeLower.includes("barber/masters")) {
        data = await fetchAllPages("/users/employees/", { branch: id });
      } else if (routeLower.includes("barber/warehouse")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("barber/cash-reports")) {
        // Аналитика - используем cashflows
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      }
      // Гостиница
      else if (routeLower.includes("hostel/rooms")) {
        data = await fetchAllPages("/booking/rooms/", { branch: id });
      } else if (routeLower.includes("hostel/bookings")) {
        data = await fetchAllPages("/booking/bookings/", { branch: id });
      } else if (routeLower.includes("hostel/clients")) {
        data = await fetchAllPages("/main/clients/", { branch: id });
      } else if (routeLower.includes("hostel/bar")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("hostel/analytics")) {
        // Аналитика гостиницы - комбинация данных
        const [bookings, hotels, rooms] = await Promise.all([
          fetchAllPages("/booking/bookings/", { branch: id }),
          fetchAllPages("/booking/hotels/", { branch: id }),
          fetchAllPages("/booking/rooms/", { branch: id }),
        ]);
        data = [...bookings, ...hotels, ...rooms];
      } else if (routeLower.includes("hostel/kassa")) {
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      }
      // Школа
      else if (routeLower.includes("school/students")) {
        data = await fetchAllPages("/education/students/", { branch: id });
      } else if (routeLower.includes("school/groups")) {
        data = await fetchAllPages("/education/groups/", { branch: id });
      } else if (routeLower.includes("school/lessons")) {
        data = await fetchAllPages("/education/lessons/", { branch: id });
      } else if (routeLower.includes("school/teachers")) {
        data = await fetchAllPages("/users/employees/", { branch: id });
      } else if (routeLower.includes("school/leads")) {
        data = await fetchAllPages("/education/leads/", { branch: id });
      } else if (routeLower.includes("school/invoices")) {
        // Аналитика школы - используем invoices или cashflows
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      }
      // Кафе
      else if (routeLower.includes("cafe/menu")) {
        data = await fetchAllPages("/cafe/menu-items/", { branch: id });
      } else if (routeLower.includes("cafe/orders")) {
        data = await fetchAllPages("/cafe/orders/", { branch: id });
      } else if (routeLower.includes("cafe/tables")) {
        data = await fetchAllPages("/cafe/tables/", { branch: id });
      } else if (routeLower.includes("cafe/clients")) {
        data = await fetchAllPages("/cafe/clients/", { branch: id });
      } else if (routeLower.includes("cafe/stock")) {
        data = await fetchAllPages("/cafe/warehouse/", { branch: id });
      } else if (routeLower.includes("cafe/inventory")) {
        // Инвентаризация - комбинация equipment и sessions
        const [equipment, sessions] = await Promise.all([
          fetchAllPages("/cafe/equipment/", { branch: id }).catch(() => []),
          fetchAllPages("/cafe/inventory/sessions/", { branch: id }).catch(
            () => []
          ),
        ]);
        data = [...equipment, ...sessions];
      } else if (routeLower.includes("cafe/cook")) {
        // Кухня - используем orders со статусом готовки
        data = await fetchAllPages("/cafe/orders/", { branch: id });
      } else if (routeLower.includes("cafe/payroll")) {
        data = await fetchAllPages("/cafe/staff/", { branch: id });
      } else if (routeLower.includes("cafe/purchasing")) {
        data = await fetchAllPages("/cafe/purchases/", { branch: id });
      } else if (routeLower.includes("cafe/reports")) {
        // Отчёты - используем cashflows
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      } else if (routeLower.includes("cafe/reservations")) {
        data = await fetchAllPages("/cafe/bookings/", { branch: id });
      } else if (routeLower.includes("cafe/analytics")) {
        // Аналитика выплат - используем staff
        data = await fetchAllPages("/cafe/staff/", { branch: id });
      } else if (routeLower.includes("cafe/kassa")) {
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      }
      // Строительство
      else if (routeLower.includes("building/work")) {
        data = await fetchAllPages("/main/contractor-works/", {
          branch: id,
        });
      } else if (routeLower.includes("building/objects")) {
        data = await fetchAllPages("/main/object-sales/", { branch: id });
      }
      // Консалтинг
      else if (
        routeLower.includes("consulting/client") &&
        !routeLower.includes("client-requests")
      ) {
        data = await fetchAllPages("/main/clients/", { branch: id });
      } else if (routeLower.includes("consulting/client-requests")) {
        data = await fetchAllPages("/consalting/requests/", {
          branch: id,
        });
      } else if (routeLower.includes("consulting/bookings")) {
        data = await fetchAllPages("/booking/bookings/", { branch: id });
      } else if (routeLower.includes("consulting/kassa")) {
        data = await fetchAllPages("/construction/cashflows/", { branch: id });
      } else if (routeLower.includes("consulting/teachers")) {
        data = await fetchAllPages("/users/employees/", { branch: id });
      } else if (routeLower.includes("consulting/salary")) {
        data = await fetchAllPages("/consalting/salaries/", {
          branch: id,
        }).catch(() => []);
      } else if (routeLower.includes("consulting/sale")) {
        data = await fetchAllPages("/consalting/sales/", { branch: id }).catch(
          () => []
        );
      } else if (routeLower.includes("consulting/services")) {
        // Используем Redux thunk или прямой API
        try {
          const response = await api.get("/consalting/services/", {
            params: { branch: id },
          });
          data = Array.isArray(response.data?.results)
            ? response.data.results
            : Array.isArray(response.data)
            ? response.data
            : [];
        } catch {
          data = [];
        }
      } else if (routeLower.includes("consulting/analytics")) {
        // Аналитика - комбинация данных
        const [rows, services, requests] = await Promise.all([
          fetchAllPages("/consalting/sales/", { branch: id }).catch(() => []),
          api
            .get("/consulting/services/", { params: { branch: id } })
            .then((r) =>
              Array.isArray(r.data?.results)
                ? r.data.results
                : Array.isArray(r.data)
                ? r.data
                : []
            )
            .catch(() => []),
          fetchAllPages("/consulting/client-requests/", { branch: id }).catch(
            () => []
          ),
        ]);
        data = [...rows, ...services, ...requests];
      }
      // Склад
      else if (routeLower.includes("warehouse/products")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("warehouse/stocks")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("warehouse/movements")) {
        data = await fetchAllPages("/warehouse/movements/", { branch: id });
      } else if (routeLower.includes("warehouse/supply")) {
        data = await fetchAllPages("/warehouse/supply/", { branch: id });
      } else if (routeLower.includes("warehouse/write")) {
        data = await fetchAllPages("/warehouse/write-offs/", { branch: id });
      } else if (routeLower.includes("warehouse/clients")) {
        data = await fetchAllPages("/main/clients/", { branch: id });
      } else if (routeLower.includes("warehouse/analytics")) {
        // Аналитика склада - комбинация данных
        const [products, movements, supply] = await Promise.all([
          fetchAllPages("/main/products/list/", { branch: id }),
          fetchAllPages("/warehouse/movements/", { branch: id }).catch(
            () => []
          ),
          fetchAllPages("/warehouse/supply/", { branch: id }).catch(() => []),
        ]);
        data = [...products, ...movements, ...supply];
      } else if (routeLower.includes("warehouse/directories")) {
        // Справочники - категории и бренды
        const [categories, brands] = await Promise.all([
          fetchAllPages("/main/categories/", { branch: id }).catch(() => []),
          fetchAllPages("/main/brands/", { branch: id }).catch(() => []),
        ]);
        data = [...categories, ...brands];
      }
      // Производство
      else if (routeLower.includes("production/warehouse")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("production/agents")) {
        data = await fetchAllPages("/main/owners/agents/products/", {
          branch: id,
        });
      } else if (routeLower.includes("production/catalog")) {
        data = await fetchAllPages("/main/products/list/", {
          branch: id,
        });
      }
      // Пилорама
      else if (routeLower.includes("pilorama/warehouse")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      }
      // Магазин
      else if (routeLower.includes("market/bar")) {
        data = await fetchAllPages("/main/products/list/", { branch: id });
      } else if (routeLower.includes("market/history")) {
        // История продаж
        data = await fetchAllPages("/main/pos/sales/", { branch: id });
      } else if (routeLower.includes("market/analytics")) {
        // Аналитика магазина
        data = await fetchAllPages("/main/pos/sales/", { branch: id });
      }

      // Фильтруем по филиалу, если данные не были отфильтрованы на бэкенде
      const filtered = filterByBranch(data);
      setSectorData((prev) => ({ ...prev, [tabId]: filtered }));
    } catch (err) {
      console.error(`Ошибка загрузки данных для таба ${tabId}:`, err);
      setSectorData((prev) => ({ ...prev, [tabId]: [] }));
    } finally {
      setSectorLoading((prev) => ({ ...prev, [tabId]: false }));
    }
  };

  // Маппинг иконок для базовых табов
  const baseTabIconMap = {
    cashRegister: FaCashRegister,
    warehouse: FaWarehouse,
    shoppingCart: FaShoppingCart,
    chartLine: FaChartLine,
    users: FaUsers,
    userFriends: FaUserFriends,
  };

  // Базовые табы с иконками
  const baseTabsWithIcons = useMemo(
    () =>
      BASE_TABS.map((tab) => ({
        ...tab,
        icon: baseTabIconMap[tab.icon] || FaBuilding,
      })),
    []
  );

  // Применяем правила для базовых табов
  const filteredBaseTabs = useMemo(
    () =>
      applyBranchTabsRules(
        baseTabsWithIcons,
        currentSector,
        tariff || company?.subscription_plan?.name
      ),
    [baseTabsWithIcons, currentSector, tariff, company?.subscription_plan?.name]
  );

  // Применяем правила для секторных табов
  const filteredSectorTabs = useMemo(
    () =>
      applySectorTabsRules(
        sectorTabs,
        currentSector,
        tariff || company?.subscription_plan?.name
      ),
    [sectorTabs, currentSector, tariff, company?.subscription_plan?.name]
  );

  // Объединение базовых и секторных табов
  const tabs = useMemo(
    () => [...filteredBaseTabs, ...filteredSectorTabs],
    [filteredBaseTabs, filteredSectorTabs]
  );

  // Загрузка данных при смене таба
  useEffect(() => {
    if (!id) return;

    const sectorTab = filteredSectorTabs.find((tab) => tab.id === activeTab);
    if (sectorTab) {
      // Загружаем данные для секторного таба
      fetchSectorTabData(activeTab, sectorTab.route);
    } else {
      // Загружаем данные для базовых табов
      switch (activeTab) {
        case "kassa":
          fetchKassa();
          break;
        case "warehouse":
          fetchWarehouse();
          break;
        case "sales":
          fetchSales();
          break;
        case "analytics":
          fetchAnalytics();
          break;
        case "employees":
          fetchEmployees();
          break;
        case "clients":
          fetchClients();
          break;
        default:
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, filteredSectorTabs]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };
  const formatDateTable = (dateString) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleString("ru-RU", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "0";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "KGS",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="branch-details">
        <div className="branch-details__loading">
          <FaSpinner className="spinner" />
          <p>Загрузка данных филиала...</p>
        </div>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="branch-details">
        <div className="branch-details__error">
          <p>{error || "Филиал не найден"}</p>
          <button
            className="branch-details__btn branch-details__btn--primary"
            onClick={() => navigate("/crm/branch")}
          >
            Вернуться к списку филиалов
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="branch-details">
      <div className="branch-details__header">
        <button
          className="branch-details__back-btn"
          onClick={() => navigate("/crm/branch")}
        >
          <FaArrowLeft /> Назад
        </button>
        <div className="branch-details__title-section">
          <FaBuilding className="branch-details__icon" />
          <div>
            <h1 className="branch-details__title">{branch.name || "Филиал"}</h1>
            {branch.address && (
              <p className="branch-details__subtitle">{branch.address}</p>
            )}
          </div>
        </div>
      </div>

      <div className="branch-details__tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSectorTab = sectorTabs.some((st) => st.id === tab.id);
          const sectorTab = isSectorTab
            ? sectorTabs.find((st) => st.id === tab.id)
            : null;
          return (
            <button
              key={tab.id}
              className={`branch-details__tab ${
                activeTab === tab.id ? "branch-details__tab--active" : ""
              }`}
              onClick={() => {
                setActiveTab(tab.id);
              }}
            >
              <Icon />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="branch-details__content">
        {/* Касса */}
        {activeTab === "kassa" && (
          <div className="branch-details__section">
            <h2 className="branch-details__section-title">Касса</h2>
            {cashLoading ? (
              <div className="branch-details__loading">
                <FaSpinner className="spinner" />
                <p>Загрузка данных кассы...</p>
              </div>
            ) : filteredCashFlows.length === 0 ? (
              <p className="branch-details__empty">Нет данных о кассе</p>
            ) : (
              <div className="branch-details__table-wrapper">
                <table className="branch-details__table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCashFlows.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.created_at)}</td>
                        <td>{item.type || "—"}</td>
                        <td>{formatCurrency(item.amount)}</td>
                        <td>{item.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Склад */}
        {activeTab === "warehouse" && (
          <div className="branch-details__section">
            <h2 className="branch-details__section-title">Склад</h2>
            {productsLoading ? (
              <div className="branch-details__loading">
                <FaSpinner className="spinner" />
                <p>Загрузка данных склада...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="branch-details__empty">Нет данных о складе</p>
            ) : (
              <div className="branch-details__table-wrapper">
                <table className="branch-details__table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Количество</th>
                      <th>Единица</th>
                      <th>Цена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name || "—"}</td>
                        <td>{item.quantity || item.remainder || 0}</td>
                        <td>{item.unit || "—"}</td>
                        <td>{formatCurrency(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Продажи */}
        {activeTab === "sales" && (
          <div className="branch-details__section">
            <h2 className="branch-details__section-title">Продажи</h2>
            {filteredSales.length === 0 ? (
              <p className="branch-details__empty">Нет данных о продажах</p>
            ) : (
              <div className="branch-details__table-wrapper">
                <table className="branch-details__table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Клиент</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((item) => (
                      <tr key={item.id}>
                        <td className="table-cell--date">{formatDateTable(item.created_at)}</td>
                        <td>{formatCurrency(item.total || item.amount)}</td>
                        <td>{item.status || "—"}</td>
                        <td>
                          {item.client_display || item.client_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Аналитика */}
        {activeTab === "analytics" && (
          <div className="branch-details__section">
            <div className="branch-details__section-header">
              <h2 className="branch-details__section-title">Аналитика</h2>
              <div className="branch-details__date-filters">
                <div className="branch-details__date-filter">
                  <FaCalendarAlt />
                  <label>От:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="branch-details__date-input"
                  />
                </div>
                <div className="branch-details__date-filter">
                  <FaCalendarAlt />
                  <label>До:</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="branch-details__date-input"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    className="branch-details__clear-filter"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Сбросить
                  </button>
                )}
              </div>
            </div>
            {!analyticsData ? (
              <p className="branch-details__empty">Нет данных аналитики</p>
            ) : (
              <div className="branch-details__analytics">
                {/* Касса */}
                <div className="branch-details__analytics-card">
                  <h3>
                    <FaCashRegister /> Касса
                  </h3>
                  <div className="branch-details__analytics-grid">
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Доходы
                      </span>
                      <span className="branch-details__analytics-value branch-details__analytics-value--positive">
                        {formatCurrency(analyticsData.kassa.income)}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Расходы
                      </span>
                      <span className="branch-details__analytics-value branch-details__analytics-value--negative">
                        {formatCurrency(analyticsData.kassa.expense)}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Баланс
                      </span>
                      <span
                        className={`branch-details__analytics-value ${
                          analyticsData.kassa.balance >= 0
                            ? "branch-details__analytics-value--positive"
                            : "branch-details__analytics-value--negative"
                        }`}
                      >
                        {formatCurrency(analyticsData.kassa.balance)}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Операций
                      </span>
                      <span className="branch-details__analytics-value">
                        {analyticsData.kassa.operationsCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Продажи */}
                <div className="branch-details__analytics-card">
                  <h3>
                    <FaShoppingCart /> Продажи
                  </h3>
                  <div className="branch-details__analytics-grid">
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Общая сумма
                      </span>
                      <span className="branch-details__analytics-value branch-details__analytics-value--positive">
                        {formatCurrency(analyticsData.sales.total)}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Количество продаж
                      </span>
                      <span className="branch-details__analytics-value">
                        {analyticsData.sales.count}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Средний чек
                      </span>
                      <span className="branch-details__analytics-value">
                        {formatCurrency(analyticsData.sales.average)}
                      </span>
                    </div>
                  </div>
                  {Object.keys(analyticsData.sales.byStatus).length > 0 && (
                    <div className="branch-details__analytics-status">
                      <h4>По статусам:</h4>
                      <div className="branch-details__analytics-status-grid">
                        {Object.entries(analyticsData.sales.byStatus).map(
                          ([status, count]) => (
                            <div
                              key={status}
                              className="branch-details__analytics-status-item"
                            >
                              <span className="branch-details__analytics-status-label">
                                {status}
                              </span>
                              <span className="branch-details__analytics-status-value">
                                {count}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Склад */}
                <div className="branch-details__analytics-card">
                  <h3>
                    <FaWarehouse /> Склад
                  </h3>
                  <div className="branch-details__analytics-grid">
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Общая стоимость
                      </span>
                      <span className="branch-details__analytics-value">
                        {formatCurrency(analyticsData.warehouse.totalValue)}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Общее количество
                      </span>
                      <span className="branch-details__analytics-value">
                        {analyticsData.warehouse.totalQuantity}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Количество позиций
                      </span>
                      <span className="branch-details__analytics-value">
                        {analyticsData.warehouse.itemsCount}
                      </span>
                    </div>
                    <div className="branch-details__analytics-item">
                      <span className="branch-details__analytics-label">
                        Средняя цена
                      </span>
                      <span className="branch-details__analytics-value">
                        {formatCurrency(analyticsData.warehouse.averagePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Сотрудники */}
        {activeTab === "employees" && (
          <div className="branch-details__section">
            <h2 className="branch-details__section-title">Сотрудники</h2>
            {employeesLoading ? (
              <div className="branch-details__loading">
                <FaSpinner className="spinner" />
                <p>Загрузка сотрудников...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <p className="branch-details__empty">
                Нет сотрудников в этом филиале
              </p>
            ) : (
              <div className="branch-details__table-wrapper">
                <table className="branch-details__table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Фамилия</th>
                      <th>Email</th>
                      <th>Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((item) => (
                      <tr key={item.id}>
                        <td>{item.first_name || "—"}</td>
                        <td>{item.last_name || "—"}</td>
                        <td>{item.email || "—"}</td>
                        <td>{item.role_display || item.role || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Клиенты */}
        {activeTab === "clients" && (
          <div className="branch-details__section">
            <h2 className="branch-details__section-title">Клиенты</h2>
            {clientsLoading ? (
              <div className="branch-details__loading">
                <FaSpinner className="spinner" />
                <p>Загрузка клиентов...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <p className="branch-details__empty">
                Нет клиентов в этом филиале
              </p>
            ) : (
              <div className="branch-details__table-wrapper">
                <table className="branch-details__table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Телефон</th>
                      <th>Email</th>
                      <th>Адрес</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name || item.full_name || "—"}</td>
                        <td>{item.phone || "—"}</td>
                        <td>{item.email || "—"}</td>
                        <td>{item.address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Секторные табы */}
        {filteredSectorTabs.some((tab) => tab.id === activeTab) &&
          (() => {
            const currentTab = filteredSectorTabs.find(
              (tab) => tab.id === activeTab
            );
            if (!currentTab) return null;

            const tabData = sectorData[activeTab] || [];
            const isLoading = sectorLoading[activeTab] || false;
            const routeLower = currentTab.route.toLowerCase();

            // Функция для определения колонок таблицы на основе типа данных
            const getTableColumns = () => {
              if (
                routeLower.includes("clients") ||
                routeLower.includes("client")
              ) {
                return ["Имя", "Телефон", "Email", "Статус"];
              } else if (
                routeLower.includes("services") ||
                routeLower.includes("menu")
              ) {
                return ["Название", "Цена", "Время", "Статус"];
              } else if (
                routeLower.includes("appointments") ||
                routeLower.includes("records") ||
                routeLower.includes("bookings")
              ) {
                return ["Дата", "Клиент", "Услуга", "Статус"];
              } else if (routeLower.includes("rooms")) {
                return ["Название", "Тип", "Цена", "Статус"];
              } else if (routeLower.includes("students")) {
                return ["Имя", "Группа", "Телефон", "Email"];
              } else if (routeLower.includes("groups")) {
                return [
                  "Название",
                  "Направление",
                  "Количество",
                  "Преподаватель",
                ];
              } else if (routeLower.includes("lessons")) {
                return ["Название", "Дата", "Группа", "Преподаватель"];
              } else if (routeLower.includes("orders")) {
                return ["Дата", "Стол", "Сумма", "Статус"];
              } else if (routeLower.includes("tables")) {
                return ["Название", "Зона", "Статус", "Вместимость"];
              } else if (
                routeLower.includes("products") ||
                routeLower.includes("stock") ||
                routeLower.includes("warehouse")
              ) {
                return ["Название", "Количество", "Цена", "Единица"];
              } else if (
                routeLower.includes("work") ||
                routeLower.includes("process")
              ) {
                return ["Название", "Статус", "Дата начала", "Дата окончания"];
              } else if (routeLower.includes("objects")) {
                return ["Название", "Адрес", "Тип", "Статус"];
              } else if (
                routeLower.includes("cash-reports") ||
                routeLower.includes("cashflows") ||
                routeLower.includes("kassa")
              ) {
                return ["Дата", "Тип", "Сумма", "Описание"];
              } else if (routeLower.includes("analytics")) {
                return ["Период", "Показатель", "Значение", "Изменение"];
              } else if (
                routeLower.includes("inventory") ||
                routeLower.includes("equipment")
              ) {
                return ["Название", "Категория", "Состояние", "Серийный номер"];
              } else if (routeLower.includes("cook")) {
                return ["Заказ", "Блюдо", "Количество", "Статус"];
              } else if (
                routeLower.includes("payroll") ||
                routeLower.includes("staff") ||
                routeLower.includes("salary")
              ) {
                return ["Сотрудник", "Период", "Сумма", "Статус"];
              } else if (
                routeLower.includes("purchasing") ||
                routeLower.includes("purchases")
              ) {
                return ["Дата", "Поставщик", "Сумма", "Статус"];
              } else if (routeLower.includes("reports")) {
                return ["Дата", "Тип отчёта", "Сумма", "Статус"];
              } else if (routeLower.includes("reservations")) {
                return ["Дата", "Стол", "Клиент", "Статус"];
              } else if (routeLower.includes("bar")) {
                return ["Товар", "Количество", "Цена", "Сумма"];
              } else if (
                routeLower.includes("history") ||
                routeLower.includes("sales")
              ) {
                return ["Дата", "Клиент", "Сумма", "Статус"];
              } else if (
                routeLower.includes("directories") ||
                routeLower.includes("categories") ||
                routeLower.includes("brands")
              ) {
                return ["Название", "Тип", "Описание", "Статус"];
              } else if (routeLower.includes("movements")) {
                return ["Дата", "Тип", "Товар", "Количество"];
              } else if (routeLower.includes("supply")) {
                return ["Дата", "Поставщик", "Товар", "Количество"];
              } else if (
                routeLower.includes("write") ||
                routeLower.includes("write-offs")
              ) {
                return ["Дата", "Причина", "Товар", "Количество"];
              } else if (routeLower.includes("agents")) {
                return ["Имя", "Телефон", "Email", "Статус"];
              } else if (routeLower.includes("catalog")) {
                return ["Название", "Категория", "Цена", "Наличие"];
              } else if (routeLower.includes("leads")) {
                return ["Имя", "Телефон", "Источник", "Дата"];
              } else if (routeLower.includes("invoices")) {
                return ["Дата", "Студент", "Сумма", "Статус"];
              } else if (
                routeLower.includes("hotels") ||
                routeLower.includes("beds")
              ) {
                return ["Название", "Тип", "Цена", "Статус"];
              } else {
                return ["Название", "Описание", "Дата", "Статус"];
              }
            };

            // Функция для получения значений строки
            const getRowValues = (item) => {
              if (
                routeLower.includes("clients") ||
                routeLower.includes("client")
              ) {
                return [
                  item.full_name || item.name || "—",
                  item.phone || item.phone_number || "—",
                  item.email || "—",
                  item.status || "—",
                ];
              } else if (
                routeLower.includes("services") ||
                routeLower.includes("menu")
              ) {
                return [
                  item.service_name || item.name || item.title || "—",
                  formatCurrency(item.price || 0),
                  item.time || item.duration || "—",
                  item.is_active !== false ? "Активен" : "Неактивен",
                ];
              } else if (
                routeLower.includes("appointments") ||
                routeLower.includes("records") ||
                routeLower.includes("bookings")
              ) {
                return [
                  formatDate(
                    item.start_at || item.start_time || item.created_at
                  ),
                  item.client_name ||
                    item.client?.full_name ||
                    item.client_label ||
                    "—",
                  item.service_name || item.service?.name || "—",
                  item.status || "—",
                ];
              } else if (routeLower.includes("rooms")) {
                return [
                  item.name || item.title || "—",
                  item.type || item.room_type || "—",
                  formatCurrency(item.price || 0),
                  item.status || item.is_available !== false
                    ? "Доступна"
                    : "Занята",
                ];
              } else if (routeLower.includes("students")) {
                return [
                  item.full_name || item.name || "—",
                  item.group_name || item.group?.name || "—",
                  item.phone || "—",
                  item.email || "—",
                ];
              } else if (routeLower.includes("groups")) {
                return [
                  item.name || item.title || "—",
                  item.direction || item.course || item.course_name || "—",
                  item.students_count || item.students?.length || 0,
                  item.teacher_name || item.teacher?.full_name || "—",
                ];
              } else if (routeLower.includes("lessons")) {
                return [
                  item.name || item.title || "—",
                  formatDate(item.date || item.start_time || item.created_at),
                  item.group_name || item.group?.name || "—",
                  item.teacher_name || item.teacher?.full_name || "—",
                ];
              } else if (routeLower.includes("orders")) {
                return [
                  formatDate(item.created_at || item.date),
                  item.table_name || item.table?.name || item.table || "—",
                  formatCurrency(item.total || item.total_amount || 0),
                  item.status || "—",
                ];
              } else if (routeLower.includes("tables")) {
                return [
                  item.name || item.title || "—",
                  item.zone_name || item.zone?.title || item.zone || "—",
                  item.status || (item.is_occupied ? "Занят" : "Свободен"),
                  item.capacity || item.seats || "—",
                ];
              } else if (
                routeLower.includes("products") ||
                routeLower.includes("stock") ||
                routeLower.includes("warehouse")
              ) {
                return [
                  item.name || item.title || "—",
                  item.quantity || item.remainder || 0,
                  formatCurrency(item.price || 0),
                  item.unit || "—",
                ];
              } else if (
                routeLower.includes("work") ||
                routeLower.includes("process")
              ) {
                return [
                  item.name || item.title || "—",
                  item.status || "—",
                  formatDate(item.start_date || item.created_at),
                  formatDate(item.end_date || item.completed_at),
                ];
              } else if (routeLower.includes("objects")) {
                return [
                  item.name || item.title || "—",
                  item.address || "—",
                  item.type || item.object_type || "—",
                  item.status || "—",
                ];
              } else if (
                routeLower.includes("cash-reports") ||
                routeLower.includes("cashflows") ||
                routeLower.includes("kassa")
              ) {
                return [
                  formatDate(item.created_at || item.date),
                  item.type || item.operation_type || "—",
                  formatCurrency(item.amount || 0),
                  item.description || item.comment || "—",
                ];
              } else if (routeLower.includes("analytics")) {
                return [
                  formatDate(item.period || item.date || item.created_at),
                  item.metric || item.indicator || "—",
                  formatCurrency(item.value || item.amount || 0),
                  item.change
                    ? `${item.change > 0 ? "+" : ""}${item.change}%`
                    : "—",
                ];
              } else if (
                routeLower.includes("inventory") ||
                routeLower.includes("equipment")
              ) {
                return [
                  item.title || item.name || "—",
                  item.category || "—",
                  item.condition || item.status || "—",
                  item.serial_number || "—",
                ];
              } else if (routeLower.includes("cook")) {
                return [
                  item.order_id || item.order || "—",
                  item.menu_item_name || item.dish || "—",
                  item.quantity || 0,
                  item.status || item.cooking_status || "—",
                ];
              } else if (
                routeLower.includes("payroll") ||
                routeLower.includes("staff") ||
                routeLower.includes("salary")
              ) {
                return [
                  item.employee_name || item.full_name || item.name || "—",
                  item.period || formatDate(item.date || item.created_at),
                  formatCurrency(item.amount || item.salary || 0),
                  item.status || item.payment_status || "—",
                ];
              } else if (
                routeLower.includes("purchasing") ||
                routeLower.includes("purchases")
              ) {
                return [
                  formatDate(item.date || item.created_at),
                  item.supplier_name || item.supplier || "—",
                  formatCurrency(item.total || item.amount || 0),
                  item.status || "—",
                ];
              } else if (routeLower.includes("reports")) {
                return [
                  formatDate(item.date || item.created_at),
                  item.report_type || item.type || "—",
                  formatCurrency(item.total || item.amount || 0),
                  item.status || "—",
                ];
              } else if (routeLower.includes("reservations")) {
                return [
                  formatDate(item.date || item.start_time || item.created_at),
                  item.table_name || item.table || "—",
                  item.client_name || item.client || "—",
                  item.status || "—",
                ];
              } else if (routeLower.includes("bar")) {
                return [
                  item.product_name || item.name || item.title || "—",
                  item.quantity || 0,
                  formatCurrency(item.price || 0),
                  formatCurrency((item.quantity || 0) * (item.price || 0)),
                ];
              } else if (
                routeLower.includes("history") ||
                routeLower.includes("sales")
              ) {
                return [
                  formatDate(item.created_at || item.date),
                  item.client_name || item.client || "—",
                  formatCurrency(item.total || item.amount || 0),
                  item.status || "—",
                ];
              } else if (
                routeLower.includes("directories") ||
                routeLower.includes("categories") ||
                routeLower.includes("brands")
              ) {
                return [
                  item.name || item.title || "—",
                  item.type ||
                    (routeLower.includes("categories")
                      ? "Категория"
                      : routeLower.includes("brands")
                      ? "Бренд"
                      : "—"),
                  item.description || "—",
                  item.is_active !== false ? "Активен" : "Неактивен",
                ];
              } else if (routeLower.includes("movements")) {
                return [
                  formatDate(item.date || item.created_at),
                  item.movement_type || item.type || "—",
                  item.product_name || item.product || "—",
                  item.quantity || 0,
                ];
              } else if (routeLower.includes("supply")) {
                return [
                  formatDate(item.date || item.created_at),
                  item.supplier_name || item.supplier || "—",
                  item.product_name || item.product || "—",
                  item.quantity || 0,
                ];
              } else if (
                routeLower.includes("write") ||
                routeLower.includes("write-offs")
              ) {
                return [
                  formatDate(item.date || item.created_at),
                  item.reason || item.write_off_reason || "—",
                  item.product_name || item.product || "—",
                  item.quantity || 0,
                ];
              } else if (routeLower.includes("agents")) {
                return [
                  item.full_name || item.name || "—",
                  item.phone || "—",
                  item.email || "—",
                  item.status || item.is_active !== false
                    ? "Активен"
                    : "Неактивен",
                ];
              } else if (routeLower.includes("catalog")) {
                return [
                  item.name || item.title || "—",
                  item.category_name || item.category || "—",
                  formatCurrency(item.price || 0),
                  item.in_stock !== false ? "В наличии" : "Нет в наличии",
                ];
              } else if (routeLower.includes("leads")) {
                return [
                  item.name || item.full_name || "—",
                  item.phone || "—",
                  item.source || "—",
                  formatDate(item.created_at || item.date),
                ];
              } else if (routeLower.includes("invoices")) {
                return [
                  formatDate(item.date || item.created_at),
                  item.student_name || item.student || "—",
                  formatCurrency(item.amount || item.total || 0),
                  item.status || item.payment_status || "—",
                ];
              } else if (
                routeLower.includes("hotels") ||
                routeLower.includes("beds")
              ) {
                return [
                  item.name || item.title || "—",
                  item.type ||
                    (routeLower.includes("beds") ? "Койко-место" : "Отель"),
                  formatCurrency(item.price || 0),
                  item.status || item.is_available !== false
                    ? "Доступен"
                    : "Занят",
                ];
              } else {
                return [
                  item.name || item.title || item.full_name || "—",
                  item.description || item.notes || "—",
                  formatDate(item.created_at || item.date),
                  item.status || "—",
                ];
              }
            };

            const columns = getTableColumns();

            return (
              <div className="branch-details__section">
                <h2 className="branch-details__section-title">
                  {currentTab.label}
                </h2>
                {isLoading ? (
                  <div className="branch-details__loading">
                    <FaSpinner className="spinner" />
                    <p>Загрузка данных...</p>
                  </div>
                ) : tabData.length === 0 ? (
                  <p className="branch-details__empty">
                    Нет данных для этого раздела
                  </p>
                ) : (
                  <div className="branch-details__table-wrapper">
                    <table className="branch-details__table">
                      <thead>
                        <tr>
                          {columns.map((col, idx) => (
                            <th key={idx}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tabData.map((item) => {
                          const values = getRowValues(item);
                          return (
                            <tr key={item.id || item.uuid || Math.random()}>
                              {values.map((val, idx) => (
                                <td key={idx}>{val}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
};

export default BranchDetails;
