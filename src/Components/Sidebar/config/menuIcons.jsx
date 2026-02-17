/**
 * Иконки для пунктов меню
 * Импортируются здесь для централизованного управления
 */
import {
  BadgeDollarSign,
  BarChart3,
  BookOpenText,
  Box,
  Boxes,
  Bell,
  CalendarCheck2,
  ChefHat,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Instagram,
  InstagramIcon,
  Landmark,
  Layers,
  ScaleIcon,
  ShoppingCart,
  Table2,
  Users,
  Wallet,
  Warehouse,
  ReceiptText,
  Store,
  ClipboardList,
} from "lucide-react";
import { BsFileEarmarkPerson, BsListCheck } from "react-icons/bs";
import {
  FaBoxOpen,
  FaBuilding,
  FaCashRegister,
  FaChalkboardTeacher,
  FaChartLine,
  FaClipboardList,
  FaCog,
  FaCogs,
  FaComments,
  FaExchangeAlt,
  FaMoneyBill,
  FaRegCalendarAlt,
  FaRegChartBar,
  FaRegClipboard,
  FaRegListAlt,
  FaRegUser,
  FaShoppingCart,
  FaTags,
  FaTrashAlt,
  FaTruckLoading,
  FaUsers,
  FaWarehouse,
} from "react-icons/fa";
import { MdDocumentScanner } from "react-icons/md";
import { CiDeliveryTruck, CiShoppingCart } from "react-icons/ci";

/**
 * Создает иконку с классом для стилизации
 */
const createIcon = (IconComponent) => (
  <IconComponent className="sidebar__menu-icon" />
);

export const menuIcons = {
  // Базовые иконки
  clipboard: () => createIcon(FaRegClipboard),
  listAlt: () => createIcon(FaRegListAlt),
  scale: () => createIcon(ScaleIcon),
  chartBar: () => createIcon(FaRegChartBar),
  warehouse: () => createIcon(Warehouse),
  landmark: () => createIcon(Landmark),
  user: () => createIcon(FaRegUser),
  calendar: () => createIcon(FaRegCalendarAlt),
  filePerson: () => createIcon(BsFileEarmarkPerson),
  users: () => createIcon(Users),
  instagram: () => createIcon(Instagram),
  cog: () => createIcon(FaCog),
  store: () => createIcon(Store),
  clipboardList: () => createIcon(ClipboardList),
  // Для Building (используются в menuConfig.js)
  bell: () => createIcon(Bell),
  cart: () => createIcon(ShoppingCart),
  money: () => createIcon(BadgeDollarSign),
  box: () => createIcon(Box),
  fileText: () => createIcon(FileText),
  // Секторные иконки
  listCheck: () => createIcon(BsListCheck),
  building: () => createIcon(FaBuilding),
  tags: () => createIcon(FaTags),
  comments: () => createIcon(FaComments),
  cashRegister: () => createIcon(FaCashRegister),
  chalkboard: () => createIcon(FaChalkboardTeacher),
  moneyBill: () => createIcon(FaMoneyBill),
  shoppingCart: () => createIcon(FaShoppingCart),
  cogs: () => createIcon(FaCogs),
  boxOpen: () => createIcon(FaBoxOpen),
  chartLine: () => createIcon(FaChartLine),
  exchangeAlt: () => createIcon(FaExchangeAlt),
  truckLoading: () => createIcon(FaTruckLoading),
  trashAlt: () => createIcon(FaTrashAlt),
  layers: () => createIcon(Layers),

  // Кафе иконки
  barChart3: () => createIcon(BarChart3),
  bookOpenText: () => createIcon(BookOpenText),
  receiptText: () => createIcon(ReceiptText),
  chefHat: () => createIcon(ChefHat),
  badgeDollarSign: () => createIcon(BadgeDollarSign),
  fileBarChart: () => createIcon(FileBarChart),
  clipboardCheck: () => createIcon(ClipboardCheck),
  table2: () => createIcon(Table2),
  wallet: () => createIcon(Wallet),
  boxes: () => createIcon(Boxes),
  calendarCheck2: () => createIcon(CalendarCheck2),

  // Дополнительные
  instagramIcon: () => createIcon(InstagramIcon),
  documentScanner: () => createIcon(MdDocumentScanner),

  // Логистика
  logistics: () => createIcon(CiDeliveryTruck),
  shopLogistics: () => createIcon(CiShoppingCart),
};
